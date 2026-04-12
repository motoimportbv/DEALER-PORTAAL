from fastapi import APIRouter, HTTPException, Depends, Request, Query, Body, UploadFile, File
from fastapi.responses import Response, FileResponse
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid
import os
import logging
import asyncio
import json

from config import *
from database import db
from services import (
    hash_password, verify_password, create_token, create_notification_token,
    create_permanent_login_token, get_current_user, get_optional_user,
    require_admin, require_pakbon, require_approved_dealer, require_foreign_dealer,
    generate_short_code, security, security_optional,
    send_email, send_email_with_attachment, send_admin_notification,
    init_storage, put_object, get_object, get_public_url,
    get_chf_eur_margin, set_chf_eur_margin, get_chf_to_eur_rate,
    convert_chf_to_eur_with_margin, convert_chf_to_eur, DEFAULT_CHF_EUR_MARGIN,
)
from models import *
import requests as req
import base64
from twilio.rest import Client as TwilioClient
from services.sms_service import send_sms, is_twilio_configured, twilio_client

router = APIRouter(tags=["Admin"])

# ============ ADMIN ACTIVITY TRACKING ENDPOINTS ============

@router.get("/admin/activity-notifications")
async def get_admin_notifications(user: dict = Depends(require_admin)):
    """Get admin notifications for dealer activity"""
    notifications = await db.admin_notifications.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return notifications

@router.get("/admin/activity-notifications/unread-count")
async def get_admin_unread_count(user: dict = Depends(require_admin)):
    """Get unread admin notification count"""
    count = await db.admin_notifications.count_documents({"is_read": False})
    return {"count": count}

@router.put("/admin/activity-notifications/read-all")
async def mark_admin_notifications_read(user: dict = Depends(require_admin)):
    """Mark all admin notifications as read"""
    await db.admin_notifications.update_many(
        {"is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@router.delete("/admin/activity-notifications/all")
async def delete_admin_notifications(user: dict = Depends(require_admin)):
    """Delete all admin notifications"""
    await db.admin_notifications.delete_many({})
    return {"message": "All admin notifications deleted"}

@router.get("/admin/activity-stats")
async def get_activity_stats(user: dict = Depends(require_admin)):
    """Get dealer activity statistics for admin dashboard"""
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    
    # Views today
    views_today = await db.activity_logs.count_documents({
        "type": "motorcycle_view",
        "timestamp": {"$gte": today_start}
    })
    
    # Views this week
    views_week = await db.activity_logs.count_documents({
        "type": "motorcycle_view",
        "timestamp": {"$gte": week_ago}
    })
    
    # Most viewed motorcycles (last 7 days)
    pipeline = [
        {"$match": {"type": "motorcycle_view", "timestamp": {"$gte": week_ago}}},
        {"$group": {
            "_id": "$motorcycle_id",
            "brand": {"$first": "$motorcycle_brand"},
            "model": {"$first": "$motorcycle_model"},
            "views": {"$sum": 1}
        }},
        {"$sort": {"views": -1}},
        {"$limit": 5}
    ]
    top_motorcycles = await db.activity_logs.aggregate(pipeline).to_list(5)
    
    # Most active dealers (last 7 days)
    dealer_pipeline = [
        {"$match": {"type": "motorcycle_view", "timestamp": {"$gte": week_ago}}},
        {"$group": {
            "_id": "$dealer_id",
            "dealer_name": {"$first": "$dealer_name"},
            "views": {"$sum": 1}
        }},
        {"$sort": {"views": -1}},
        {"$limit": 5}
    ]
    top_dealers = await db.activity_logs.aggregate(dealer_pipeline).to_list(5)
    
    # Recent activity (last 10)
    recent_activity = await db.activity_logs.find(
        {"type": "motorcycle_view"},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(10)
    
    return {
        "views_today": views_today,
        "views_week": views_week,
        "top_motorcycles": top_motorcycles,
        "top_dealers": top_dealers,
        "recent_activity": recent_activity
    }


@router.get("/admin/analytics/conversion")
async def get_conversion_analytics(user: dict = Depends(require_admin)):
    """Get detailed conversion analytics - views to purchases"""
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    
    # Get all orders from last 30 days
    orders = await db.orders.find(
        {"created_at": {"$gte": month_ago}},
        {"_id": 0, "motorcycle_id": 1, "dealer_id": 1, "created_at": 1, "total_price": 1}
    ).to_list(1000)
    
    # Get all views from last 30 days
    views = await db.activity_logs.find(
        {"type": "motorcycle_view", "timestamp": {"$gte": month_ago}},
        {"_id": 0}
    ).to_list(10000)
    
    # Calculate conversion rate
    unique_viewed_motorcycles = set(v.get("motorcycle_id") for v in views if v.get("motorcycle_id"))
    purchased_motorcycles = set(o.get("motorcycle_id") for o in orders if o.get("motorcycle_id"))
    
    # Motorcycles that were viewed AND then purchased
    viewed_and_purchased = unique_viewed_motorcycles.intersection(purchased_motorcycles)
    
    conversion_rate = (len(viewed_and_purchased) / len(unique_viewed_motorcycles) * 100) if unique_viewed_motorcycles else 0
    
    # Views per purchase (how many views before a motorcycle sells)
    views_per_purchase = {}
    for order in orders:
        moto_id = order.get("motorcycle_id")
        if moto_id:
            view_count = sum(1 for v in views if v.get("motorcycle_id") == moto_id)
            views_per_purchase[moto_id] = view_count
    
    avg_views_before_sale = sum(views_per_purchase.values()) / len(views_per_purchase) if views_per_purchase else 0
    
    # Top converting dealers (most purchases relative to views)
    dealer_stats = {}
    for view in views:
        dealer_id = view.get("dealer_id")
        if dealer_id:
            if dealer_id not in dealer_stats:
                dealer_stats[dealer_id] = {"views": 0, "purchases": 0, "name": view.get("dealer_name", "Onbekend")}
            dealer_stats[dealer_id]["views"] += 1
    
    for order in orders:
        dealer_id = order.get("dealer_id")
        if dealer_id and dealer_id in dealer_stats:
            dealer_stats[dealer_id]["purchases"] += 1
    
    # Calculate conversion per dealer
    dealer_conversions = []
    for dealer_id, stats in dealer_stats.items():
        if stats["views"] >= 5:  # Only include dealers with significant activity
            conversion = (stats["purchases"] / stats["views"] * 100) if stats["views"] > 0 else 0
            dealer_conversions.append({
                "dealer_id": dealer_id,
                "dealer_name": stats["name"],
                "views": stats["views"],
                "purchases": stats["purchases"],
                "conversion_rate": round(conversion, 1)
            })
    
    dealer_conversions.sort(key=lambda x: x["conversion_rate"], reverse=True)
    
    # Brand popularity analysis
    brand_views = {}
    for view in views:
        brand = view.get("motorcycle_brand", "Onbekend")
        if brand:
            brand_views[brand] = brand_views.get(brand, 0) + 1
    
    brand_purchases = {}
    for order in orders:
        # Get motorcycle info
        moto = await db.motorcycles.find_one({"id": order.get("motorcycle_id")}, {"brand": 1, "_id": 0})
        if moto:
            brand = moto.get("brand", "Onbekend")
            brand_purchases[brand] = brand_purchases.get(brand, 0) + 1
    
    brand_stats = []
    for brand, view_count in brand_views.items():
        purchase_count = brand_purchases.get(brand, 0)
        conversion = (purchase_count / view_count * 100) if view_count > 0 else 0
        brand_stats.append({
            "brand": brand,
            "views": view_count,
            "purchases": purchase_count,
            "conversion_rate": round(conversion, 1)
        })
    
    brand_stats.sort(key=lambda x: x["views"], reverse=True)
    
    # Price range analysis
    price_ranges = [
        {"label": "< €5.000", "min": 0, "max": 5000},
        {"label": "€5.000 - €10.000", "min": 5000, "max": 10000},
        {"label": "€10.000 - €15.000", "min": 10000, "max": 15000},
        {"label": "€15.000 - €20.000", "min": 15000, "max": 20000},
        {"label": "> €20.000", "min": 20000, "max": 999999}
    ]
    
    price_stats = []
    for pr in price_ranges:
        range_orders = [o for o in orders if pr["min"] <= (o.get("total_price") or 0) < pr["max"]]
        range_views = [v for v in views if pr["min"] <= (v.get("motorcycle_price") or 0) < pr["max"]]
        price_stats.append({
            "range": pr["label"],
            "views": len(range_views),
            "purchases": len(range_orders),
            "revenue": sum(o.get("total_price", 0) for o in range_orders)
        })
    
    return {
        "summary": {
            "total_views_30d": len(views),
            "total_orders_30d": len(orders),
            "unique_motorcycles_viewed": len(unique_viewed_motorcycles),
            "motorcycles_sold": len(purchased_motorcycles),
            "conversion_rate": round(conversion_rate, 1),
            "avg_views_before_sale": round(avg_views_before_sale, 1),
            "total_revenue_30d": sum(o.get("total_price", 0) for o in orders)
        },
        "top_converting_dealers": dealer_conversions[:10],
        "brand_performance": brand_stats[:10],
        "price_range_performance": price_stats
    }


@router.get("/admin/analytics/dealer/{dealer_id}")
async def get_dealer_analytics(dealer_id: str, user: dict = Depends(require_admin)):
    """Get detailed analytics for a specific dealer"""
    from datetime import timedelta
    
    dealer = await db.users.find_one({"id": dealer_id}, {"_id": 0, "email": 1, "company_name": 1, "contact_person": 1})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    now = datetime.now(timezone.utc)
    month_ago = (now - timedelta(days=30)).isoformat()
    
    # Dealer's views
    views = await db.activity_logs.find(
        {"type": "motorcycle_view", "dealer_id": dealer_id, "timestamp": {"$gte": month_ago}},
        {"_id": 0}
    ).to_list(1000)
    
    # Dealer's orders
    orders = await db.orders.find(
        {"dealer_id": dealer_id, "created_at": {"$gte": month_ago}},
        {"_id": 0}
    ).to_list(100)
    
    # Most viewed brands by this dealer
    brand_views = {}
    for view in views:
        brand = view.get("motorcycle_brand", "Onbekend")
        brand_views[brand] = brand_views.get(brand, 0) + 1
    
    top_brands = sorted(brand_views.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Activity timeline (views per day)
    daily_activity = {}
    for view in views:
        day = view.get("timestamp", "")[:10]  # Get date part
        daily_activity[day] = daily_activity.get(day, 0) + 1
    
    return {
        "dealer": dealer,
        "stats": {
            "total_views_30d": len(views),
            "total_orders_30d": len(orders),
            "total_spent_30d": sum(o.get("total_price", 0) for o in orders),
            "conversion_rate": round((len(orders) / len(views) * 100) if views else 0, 1)
        },
        "top_brands": [{"brand": b, "views": c} for b, c in top_brands],
        "daily_activity": daily_activity,
        "recent_orders": orders[:5]
    }



# ============ MARKETING FILES MIGRATION ============

OBJ_STORAGE_KEY = os.environ.get("OBJECT_STORAGE_KEY", "")

def _cloud_url(path):
    return f"https://integrations.emergentagent.com/objstore/api/v1/storage/objects/moto-import/marketing/{path}?key={OBJ_STORAGE_KEY}"

# Hardcoded cloud URLs for marketing files (migrated to Emergent Object Storage)
MARKETING_FILES_CLOUD = {
    "Dealer_Contacten.csv": {"size_kb": 0.1, "cloud_url": _cloud_url("Dealer_Contacten.csv")},
    "Duitse_Motorhaendler.csv": {"size_kb": 2.7, "cloud_url": _cloud_url("Duitse_Motorhaendler.csv")},
    "Email_Templates_4_Talen.md": {"size_kb": 5.7, "cloud_url": _cloud_url("Email_Templates_4_Talen.md")},
    "Email_Templates_Kopieerbaar.txt": {"size_kb": 5.6, "cloud_url": _cloud_url("Email_Templates_Kopieerbaar.txt")},
    "MotoImport_EmailCampagne.md": {"size_kb": 4.1, "cloud_url": _cloud_url("MotoImport_EmailCampagne.md")},
    "MotoImport_SocialMedia.md": {"size_kb": 4.7, "cloud_url": _cloud_url("MotoImport_SocialMedia.md")},
    "MotoImport_Storyboard.md": {"size_kb": 14.5, "cloud_url": _cloud_url("MotoImport_Storyboard.md")},
    "MotoImport_VideoScript.md": {"size_kb": 3.6, "cloud_url": _cloud_url("MotoImport_VideoScript.md")},
    "Moto_Import_Dealer_Flyer_2025_DE.pdf": {"size_kb": 1721.0, "cloud_url": _cloud_url("Moto_Import_Dealer_Flyer_2025_DE.pdf")},
    "Moto_Import_Dealer_Flyer_2025_FR.pdf": {"size_kb": 1721.0, "cloud_url": _cloud_url("Moto_Import_Dealer_Flyer_2025_FR.pdf")},
    "Moto_Import_Dealer_Flyer_2025_IT.pdf": {"size_kb": 1721.0, "cloud_url": _cloud_url("Moto_Import_Dealer_Flyer_2025_IT.pdf")},
    "Moto_Import_Dealer_Flyer_2025_NL.pdf": {"size_kb": 1721.0, "cloud_url": _cloud_url("Moto_Import_Dealer_Flyer_2025_NL.pdf")},
    "Moto_Import_Dealer_Flyer_DE.pdf": {"size_kb": 3.3, "cloud_url": _cloud_url("Moto_Import_Dealer_Flyer_DE.pdf")},
    "Moto_Import_Dealer_Flyer_FR.pdf": {"size_kb": 3.3, "cloud_url": _cloud_url("Moto_Import_Dealer_Flyer_FR.pdf")},
    "Moto_Import_Dealer_Flyer_IT.pdf": {"size_kb": 3.3, "cloud_url": _cloud_url("Moto_Import_Dealer_Flyer_IT.pdf")},
    "Moto_Import_Dealer_Flyer_NL.pdf": {"size_kb": 3.2, "cloud_url": _cloud_url("Moto_Import_Dealer_Flyer_NL.pdf")},
    "Moto_Import_Dealer_Info.pdf": {"size_kb": 2.4, "cloud_url": _cloud_url("Moto_Import_Dealer_Info.pdf")},
    "Moto_Import_Dealer_Info_DE.pdf": {"size_kb": 2.4, "cloud_url": _cloud_url("Moto_Import_Dealer_Info_DE.pdf")},
    "Moto_Import_Dealer_Info_FR.pdf": {"size_kb": 2.4, "cloud_url": _cloud_url("Moto_Import_Dealer_Info_FR.pdf")},
    "Moto_Import_Dealer_Info_IT.pdf": {"size_kb": 2.4, "cloud_url": _cloud_url("Moto_Import_Dealer_Info_IT.pdf")},
    "Moto_Import_Supplier_Flyer_DE.pdf": {"size_kb": 2838.5, "cloud_url": _cloud_url("Moto_Import_Supplier_Flyer_DE.pdf")},
    "Moto_Import_Supplier_Flyer_FR.pdf": {"size_kb": 2838.5, "cloud_url": _cloud_url("Moto_Import_Supplier_Flyer_FR.pdf")},
    "Moto_Import_Supplier_Flyer_IT.pdf": {"size_kb": 2838.5, "cloud_url": _cloud_url("Moto_Import_Supplier_Flyer_IT.pdf")},
    "Moto_Import_Supplier_Flyer_NL.pdf": {"size_kb": 2838.4, "cloud_url": _cloud_url("Moto_Import_Supplier_Flyer_NL.pdf")},
    "Motorzaken_Benelux_Frankrijk.csv": {"size_kb": 2.8, "cloud_url": _cloud_url("Motorzaken_Benelux_Frankrijk.csv")},
    "Motorzaken_Nederland.csv": {"size_kb": 2.8, "cloud_url": _cloud_url("Motorzaken_Nederland.csv")},
    "Motorzaken_Noord_Italie.csv": {"size_kb": 6.9, "cloud_url": _cloud_url("Motorzaken_Noord_Italie.csv")},
    "Motorzaken_Zwitserland.csv": {"size_kb": 2.3, "cloud_url": _cloud_url("Motorzaken_Zwitserland.csv")},
    "Oostenrijkse_Motorhaendler.csv": {"size_kb": 2.7, "cloud_url": _cloud_url("Oostenrijkse_Motorhaendler.csv")},
    "Zwitserse_Motorhaendler.csv": {"size_kb": 4.6, "cloud_url": _cloud_url("Zwitserse_Motorhaendler.csv")},
    "flyer_hero.png": {"size_kb": 1139.4, "cloud_url": _cloud_url("flyer_hero.png")},
    "portal_hero.png": {"size_kb": 1620.0, "cloud_url": _cloud_url("portal_hero.png")},
}

@router.get("/admin/marketing-files")
async def get_marketing_files(user: dict = Depends(require_admin)):
    """Get all marketing files - uses hardcoded cloud URLs for production compatibility"""
    
    # Use hardcoded cloud files as primary source
    files = []
    for filename, data in MARKETING_FILES_CLOUD.items():
        files.append({
            "filename": filename,
            "size_kb": data["size_kb"],
            "cloud_url": data["cloud_url"],
            "migrated": True,
            "migrated_at": "2026-02-27T19:59:00+00:00"
        })
    
    # Sort by filename
    files.sort(key=lambda x: x["filename"])
    
    return {
        "files": files,
        "total_files": len(files),
        "migrated_count": len(files),
        "total_size_mb": round(sum(f["size_kb"] for f in files) / 1024, 2)
    }


@router.get("/admin/marketing-files/download/{filename}")
async def download_marketing_file(filename: str, token: str = None, user: dict = Depends(get_optional_user)):
    """Download a marketing file from cloud storage"""
    from fastapi.responses import Response
    import requests
    
    # Verify user is admin (either from header or query param)
    if not user:
        if token:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                user = await db.users.find_one({"id": payload.get("user_id")}, {"_id": 0})
            except Exception as e:
                logger.error(f"Token decode error: {e}")
                pass
    
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Alleen voor administrators")
    
    # Check if file exists in our list
    if filename not in MARKETING_FILES_CLOUD:
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")
    
    file_info = MARKETING_FILES_CLOUD[filename]
    storage_path = f"moto-import/marketing/{filename}"
    
    # Get storage key
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Cloud storage niet beschikbaar")
    
    try:
        # Fetch file from cloud storage with proper header
        resp = requests.get(
            f"{STORAGE_URL}/objects/{storage_path}",
            headers={"X-Storage-Key": key},
            timeout=60
        )
        resp.raise_for_status()
        
        # Determine content type
        ext = filename.split('.')[-1].lower()
        content_types = {
            'pdf': 'application/pdf',
            'csv': 'text/csv',
            'md': 'text/markdown',
            'txt': 'text/plain',
            'png': 'image/png'
        }
        content_type = content_types.get(ext, 'application/octet-stream')
        
        return Response(
            content=resp.content,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        logger.error(f"Failed to download {filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Download mislukt: {str(e)}")


@router.post("/admin/marketing-files/send-email")
async def send_flyer_email(request: EmailFlyerRequest, user: dict = Depends(require_admin)):
    """Send a marketing flyer via email to a specified address"""
    import requests as req
    import base64
    
    # Check if file exists
    if request.filename not in MARKETING_FILES_CLOUD:
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")
    
    file_info = MARKETING_FILES_CLOUD[request.filename]
    storage_path = f"moto-import/marketing/{request.filename}"
    
    # Get storage key and download file
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Cloud storage niet beschikbaar")
    
    try:
        # Fetch file from cloud
        resp = req.get(
            f"{STORAGE_URL}/objects/{storage_path}",
            headers={"X-Storage-Key": key},
            timeout=60
        )
        resp.raise_for_status()
        file_content = resp.content
        file_base64 = base64.b64encode(file_content).decode('utf-8')
        
        # Determine language from filename for email text
        lang = "nl"
        if "_DE" in request.filename or "_DE." in request.filename:
            lang = "de"
        elif "_FR" in request.filename or "_FR." in request.filename:
            lang = "fr"
        elif "_IT" in request.filename or "_IT." in request.filename:
            lang = "it"
        
        # Email texts per language
        email_texts = {
            "nl": {
                "subject": "Moto Import - Dealer Informatie",
                "greeting": f"Beste {request.recipient_name},",
                "intro": "Hierbij ontvangt u onze dealer flyer met informatie over samenwerking met Moto Import B.V.",
                "cta": "Heeft u interesse of vragen? Neem gerust contact met ons op!",
                "closing": "Met vriendelijke groet,"
            },
            "de": {
                "subject": "Moto Import - Händler Information",
                "greeting": f"Sehr geehrte(r) {request.recipient_name},",
                "intro": "Anbei erhalten Sie unseren Händler-Flyer mit Informationen zur Zusammenarbeit mit Moto Import B.V.",
                "cta": "Haben Sie Interesse oder Fragen? Kontaktieren Sie uns gerne!",
                "closing": "Mit freundlichen Grüßen,"
            },
            "fr": {
                "subject": "Moto Import - Information Concessionnaire",
                "greeting": f"Cher/Chère {request.recipient_name},",
                "intro": "Veuillez trouver ci-joint notre flyer concessionnaire avec des informations sur la collaboration avec Moto Import B.V.",
                "cta": "Vous avez des questions ou êtes intéressé? N'hésitez pas à nous contacter!",
                "closing": "Cordialement,"
            },
            "it": {
                "subject": "Moto Import - Informazioni Concessionario",
                "greeting": f"Gentile {request.recipient_name},",
                "intro": "In allegato troverà il nostro flyer per concessionari con informazioni sulla collaborazione con Moto Import B.V.",
                "cta": "Ha domande o è interessato? Non esiti a contattarci!",
                "closing": "Cordiali saluti,"
            }
        }
        
        texts = email_texts.get(lang, email_texts["nl"])
        
        # Custom message if provided
        custom_section = ""
        if request.custom_message:
            custom_section = f"""
            <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #0369a1;">{request.custom_message}</p>
            </div>
            """
        
        # Build email HTML
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
        </head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f5;">
            <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">MOTO IMPORT B.V.</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Premium Motorcycles</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <p style="font-size: 16px; color: #374151;">{texts['greeting']}</p>
                    
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        {texts['intro']}
                    </p>
                    
                    {custom_section}
                    
                    <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                        <p style="margin: 0 0 10px 0; color: #991b1b; font-weight: bold;">📎 Bijlage / Attachment</p>
                        <p style="margin: 0; color: #666;">{request.filename}</p>
                    </div>
                    
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        {texts['cta']}
                    </p>
                    
                    <p style="margin-top: 30px; color: #374151;">
                        {texts['closing']}<br>
                        <strong>Team Moto Import B.V.</strong><br>
                        <span style="color: #666;">📞 +31 6 24264861</span><br>
                        <span style="color: #666;">✉️ motoimportbv@gmail.com</span><br>
                        <span style="color: #666;">🌐 www.motoimportbv.nl</span>
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send email with attachment using Gmail
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.base import MIMEBase
        from email import encoders
        
        gmail_user = os.environ.get("GMAIL_EMAIL", os.environ.get("GMAIL_USER", "motoimportbv@gmail.com"))
        gmail_password = os.environ.get("GMAIL_APP_PASSWORD")
        
        if not gmail_password:
            raise HTTPException(status_code=500, detail="Email configuratie ontbreekt")
        
        msg = MIMEMultipart()
        msg['From'] = f"Moto Import B.V. <{gmail_user}>"
        msg['To'] = request.recipient_email
        msg['Subject'] = texts['subject']
        
        # Attach HTML body
        msg.attach(MIMEText(html_content, 'html'))
        
        # Attach the PDF/file
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(file_content)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename="{request.filename}"')
        msg.attach(part)
        
        # Send email
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        
        logger.info(f"Flyer email sent to {request.recipient_email}: {request.filename}")
        
        return {
            "success": True,
            "message": f"Email verzonden naar {request.recipient_email}",
            "filename": request.filename,
            "language": lang
        }
        
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending flyer: {e}")
        raise HTTPException(status_code=500, detail=f"Email verzenden mislukt: {str(e)}")
    except Exception as e:
        logger.error(f"Failed to send flyer email: {e}")
        raise HTTPException(status_code=500, detail=f"Fout: {str(e)}")




@router.post("/admin/marketing-files/migrate")
async def migrate_marketing_files(user: dict = Depends(require_admin)):
    """Migrate all marketing files to Emergent Object Storage"""
    import glob
    import requests
    
    # Initialize storage
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Cloud storage niet beschikbaar. Controleer EMERGENT_LLM_KEY.")
    
    upload_dir = ROOT_DIR / "uploads"
    marketing_patterns = ["*.pdf", "*.csv", "*.md", "*.txt", "*.png"]
    
    migrated = []
    failed = []
    skipped = []
    
    for pattern in marketing_patterns:
        for filepath in glob.glob(str(upload_dir / pattern)):
            filename = os.path.basename(filepath)
            
            # Check if already migrated
            existing = await db.marketing_files.find_one({"filename": filename})
            if existing:
                skipped.append(filename)
                continue
            
            try:
                # Read file
                with open(filepath, 'rb') as f:
                    content = f.read()
                
                # Determine content type
                ext = filename.split('.')[-1].lower()
                content_types = {
                    'pdf': 'application/pdf',
                    'csv': 'text/csv',
                    'md': 'text/markdown',
                    'txt': 'text/plain',
                    'png': 'image/png',
                    'jpg': 'image/jpeg'
                }
                content_type = content_types.get(ext, 'application/octet-stream')
                
                # Upload to cloud storage
                storage_path = f"{APP_NAME}/marketing/{filename}"
                resp = requests.put(
                    f"{STORAGE_URL}/objects/{storage_path}",
                    headers={"X-Storage-Key": key, "Content-Type": content_type},
                    data=content,
                    timeout=60
                )
                resp.raise_for_status()
                result = resp.json()
                
                # Save record to database
                await db.marketing_files.insert_one({
                    "filename": filename,
                    "storage_path": storage_path,
                    "cloud_url": result.get("url", f"{STORAGE_URL}/objects/{storage_path}?key={key}"),
                    "content_type": content_type,
                    "size_bytes": len(content),
                    "migrated_at": datetime.now(timezone.utc).isoformat(),
                    "migrated_by": user["email"]
                })
                
                migrated.append(filename)
                logger.info(f"Migrated marketing file: {filename}")
                
            except Exception as e:
                logger.error(f"Failed to migrate {filename}: {e}")
                failed.append({"filename": filename, "error": str(e)})
    
    return {
        "message": f"Migratie voltooid: {len(migrated)} bestanden gemigreerd",
        "migrated": migrated,
        "skipped": skipped,
        "failed": failed,
        "summary": {
            "total_migrated": len(migrated),
            "total_skipped": len(skipped),
            "total_failed": len(failed)
        }
    }


@router.get("/admin/marketing-files/{filename}/download")
async def download_marketing_file(filename: str, user: dict = Depends(require_admin)):
    """Get download URL for a marketing file (prefers cloud, fallback to local)"""
    from fastapi.responses import FileResponse
    
    # Check if file exists in cloud
    cloud_record = await db.marketing_files.find_one({"filename": filename}, {"_id": 0})
    
    if cloud_record and cloud_record.get("cloud_url"):
        return {"url": cloud_record["cloud_url"], "source": "cloud"}
    
    # Fallback to local file
    local_path = ROOT_DIR / "uploads" / filename
    if local_path.exists():
        return FileResponse(
            path=str(local_path),
            filename=filename,
            media_type="application/octet-stream"
        )
    
    raise HTTPException(status_code=404, detail="Bestand niet gevonden")




async def generate_welcome_message(dealer_name: str, new_motorcycles: list) -> str:
    """Generate a personalized welcome message using GPT-5.2"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
        if not EMERGENT_LLM_KEY:
            logger.warning("EMERGENT_LLM_KEY not configured")
            return None
        
        # Build motorcycle list for the prompt
        if not new_motorcycles:
            return None
            
        motorcycle_list = "\n".join([
            f"- {m.get('brand', '')} {m.get('model', '')} ({m.get('year', '')}) - €{m.get('price', 0):,.0f}"
            for m in new_motorcycles[:5]  # Max 5 motorcycles
        ])
        
        more_text = f"\n...en nog {len(new_motorcycles) - 5} andere nieuwe motoren!" if len(new_motorcycles) > 5 else ""
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"welcome-{uuid.uuid4()}",
            system_message="""Je bent een vriendelijke assistent voor Moto Import B.V., een motorfiets groothandel in Nederland. 
Schrijf korte, enthousiaste welkomstberichten in het Nederlands. Gebruik een professionele maar warme toon.
Houd het bericht kort (max 3 zinnen) en eindig met een uitnodiging om de nieuwe motoren te bekijken.
Gebruik GEEN emoji's. Schrijf in gewone tekst."""
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(
            text=f"""Schrijf een kort welkomstbericht voor dealer "{dealer_name}".
Er zijn {len(new_motorcycles)} nieuwe motoren toegevoegd sinds hun laatste bezoek:

{motorcycle_list}{more_text}

Maak het persoonlijk en nodig ze uit om te kijken."""
        )
        
        response = await chat.send_message(user_message)
        return response
        
    except Exception as e:
        logger.error(f"Error generating welcome message: {e}")
        return None

@router.get("/dealer/welcome-message")
async def get_dealer_welcome_message(user: dict = Depends(require_approved_dealer)):
    """Get personalized AI welcome message with new motorcycles since last visit"""
    
    # Only for dealers, not admin
    if user.get("role") == "admin":
        return {"show_message": False}
    
    dealer_id = user["id"]
    dealer_name = user.get("company_name", "dealer")
    
    # Get last visit timestamp
    dealer_data = await db.users.find_one({"id": dealer_id}, {"_id": 0, "last_visit": 1})
    last_visit = dealer_data.get("last_visit") if dealer_data else None
    
    # Update last visit to now
    await db.users.update_one(
        {"id": dealer_id},
        {"$set": {"last_visit": datetime.now(timezone.utc).isoformat()}}
    )
    
    # If first visit or no last_visit recorded, show welcome but no new motorcycles
    if not last_visit:
        return {
            "show_message": True,
            "message": f"Welkom bij Moto Import, {dealer_name}! Bekijk ons actuele aanbod van kwaliteitsmotoren.",
            "new_motorcycles_count": 0,
            "new_motorcycles": []
        }
    
    # Find motorcycles added since last visit
    try:
        new_motorcycles = await db.motorcycles.find(
            {
                "created_at": {"$gt": last_visit},
                "is_available": True,
                "is_active": {"$ne": False}
            },
            {"_id": 0, "id": 1, "brand": 1, "model": 1, "year": 1, "price": 1, "images": 1}
        ).sort("created_at", -1).to_list(20)
    except Exception as e:
        logger.error(f"Error fetching new motorcycles: {e}")
        new_motorcycles = []
    
    if not new_motorcycles:
        return {"show_message": False}
    
    # Generate AI message
    ai_message = await generate_welcome_message(dealer_name, new_motorcycles)
    
    # Fallback message if AI fails
    if not ai_message:
        ai_message = f"Welkom terug, {dealer_name}! Er zijn {len(new_motorcycles)} nieuwe motoren toegevoegd sinds uw laatste bezoek. Bekijk ze nu!"
    
    return {
        "show_message": True,
        "message": ai_message,
        "new_motorcycles_count": len(new_motorcycles),
        "new_motorcycles": new_motorcycles[:5]  # Return max 5 for preview
    }



# ============ SMS NOTIFICATION ENDPOINTS ============

async def send_sms_to_dealer(phone_number: str, message: str) -> dict:
    """Send SMS to a single phone number using Twilio"""
    if not twilio_client:
        logger.warning("Twilio client not initialized - SMS disabled")
        return {"success": False, "error": "SMS niet geconfigureerd"}
    
    if not TWILIO_PHONE_NUMBER:
        logger.warning("Twilio phone number not configured")
        return {"success": False, "error": "Twilio telefoonnummer niet geconfigureerd"}
    
    try:
        # Normalize phone number (ensure it starts with +)
        if not phone_number.startswith('+'):
            # Assume Dutch number if no country code
            if phone_number.startswith('0'):
                phone_number = '+31' + phone_number[1:]
            else:
                phone_number = '+' + phone_number
        
        # Send SMS via Twilio
        sms = twilio_client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=phone_number
        )
        
        logger.info(f"SMS sent to {phone_number}, SID: {sms.sid}")
        return {"success": True, "sid": sms.sid, "status": sms.status}
    
    except Exception as e:
        logger.error(f"Failed to send SMS to {phone_number}: {e}")
        return {"success": False, "error": str(e)}

async def send_sms_to_all_dealers(message: str, exclude_user_id: str = None) -> dict:
    """Send SMS to all active dealers with phone numbers"""
    if not twilio_client:
        return {"success": False, "error": "SMS niet geconfigureerd", "sent": 0, "failed": 0}
    
    # Get all active dealers with phone numbers
    query = {
        "role": "dealer",
        "is_offline": {"$ne": True},
        "phone": {"$exists": True, "$ne": "", "$ne": None}
    }
    
    if exclude_user_id:
        query["id"] = {"$ne": exclude_user_id}
    
    dealers = await db.users.find(query, {"_id": 0, "phone": 1, "company_name": 1, "id": 1}).to_list(1000)
    
    sent_count = 0
    failed_count = 0
    results = []
    
    for dealer in dealers:
        phone = dealer.get("phone")
        if phone:
            result = await send_sms_to_dealer(phone, message)
            if result.get("success"):
                sent_count += 1
            else:
                failed_count += 1
            results.append({
                "dealer": dealer.get("company_name", "Unknown"),
                "phone": phone,
                "result": result
            })
            # Small delay to avoid rate limiting
            await asyncio.sleep(0.2)
    
    return {
        "success": True,
        "sent": sent_count,
        "failed": failed_count,
        "total_dealers": len(dealers),
        "details": results
    }

@router.post("/sms/send")
async def send_single_sms(data: SMSRequest, user: dict = Depends(require_admin)):
    """Send SMS to a single phone number (admin only)"""
    result = await send_sms_to_dealer(data.phone_number, data.message)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "SMS verzenden mislukt"))
    return result

@router.post("/sms/send-to-selected")
async def send_sms_to_selected_dealers(data: SelectedSMSRequest, user: dict = Depends(require_admin)):
    """Send SMS to selected dealers only (admin only)"""
    if not twilio_client:
        raise HTTPException(status_code=400, detail="SMS niet geconfigureerd")
    
    if not data.dealer_ids:
        raise HTTPException(status_code=400, detail="Geen dealers geselecteerd")
    
    # Get selected dealers
    dealers = await db.users.find(
        {
            "id": {"$in": data.dealer_ids},
            "role": "dealer",
            "is_approved": True,
            "phone": {"$exists": True, "$ne": ""}
        },
        {"_id": 0, "id": 1, "company_name": 1, "phone": 1}
    ).to_list(500)
    
    sent_count = 0
    failed_count = 0
    results = []
    
    for dealer in dealers:
        phone = dealer.get("phone", "").replace(" ", "").replace("-", "")
        if not phone:
            continue
            
        # Format phone number
        if not phone.startswith("+"):
            if phone.startswith("0"):
                phone = "+31" + phone[1:]
            elif phone.startswith("31"):
                phone = "+" + phone
            else:
                phone = "+" + phone
        
        try:
            twilio_client.messages.create(
                body=data.message,
                from_=TWILIO_PHONE_NUMBER,
                to=phone
            )
            sent_count += 1
            results.append({"dealer": dealer.get("company_name"), "status": "sent"})
            logger.info(f"SMS sent to {dealer.get('company_name')} ({phone})")
            await asyncio.sleep(0.3)
        except Exception as e:
            failed_count += 1
            results.append({"dealer": dealer.get("company_name"), "status": "failed", "error": str(e)})
            logger.error(f"Failed to send SMS to {phone}: {e}")
    
    return {
        "sent": sent_count,
        "failed": failed_count,
        "total": len(dealers),
        "results": results
    }

@router.post("/sms/send-all")
async def send_sms_to_all(data: BulkSMSRequest, user: dict = Depends(require_admin)):
    """Send SMS to all active dealers (admin only)"""
    result = await send_sms_to_all_dealers(data.message)
    return result

@router.get("/sms/status")
async def get_sms_status(user: dict = Depends(require_admin)):
    """Check if SMS is configured and working"""
    is_configured = bool(twilio_client and TWILIO_PHONE_NUMBER)
    
    # Count dealers with phone numbers
    dealers_with_phone = await db.users.count_documents({
        "role": "dealer",
        "is_offline": {"$ne": True},
        "phone": {"$exists": True, "$ne": "", "$ne": None}
    })
    
    return {
        "configured": is_configured,
        "twilio_account": bool(TWILIO_ACCOUNT_SID),
        "twilio_phone": bool(TWILIO_PHONE_NUMBER),
        "dealers_with_phone": dealers_with_phone
    }

@router.get("/motorcycles/{motorcycle_id}/sms-share")
async def get_sms_share_message(motorcycle_id: str, user: dict = Depends(require_admin)):
    """Generate SMS message for sharing a motorcycle and get list of Dutch dealers with phone"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Get Dutch dealers with phone numbers (exclude foreign dealers)
    dealers = await db.users.find(
        {
            "role": "dealer", 
            "is_approved": True, 
            "phone": {"$exists": True, "$ne": ""},
            "is_foreign_dealer": {"$ne": True}
        },
        {"_id": 0, "id": 1, "company_name": 1, "phone": 1}
    ).to_list(500)
    
    base_url = PRODUCTION_BASE_URL
    
    brand = motorcycle.get("brand", "")
    model = motorcycle.get("model", "")
    year = motorcycle.get("year", "")
    price = motorcycle.get("price", 0)
    
    message = f"""🏍️ NIEUWE MOTOR: {brand} {model} ({year})
💰 €{price:,.0f}

Bekijk: {base_url}/motorcycle/{motorcycle_id}

- Moto Import"""

    dealer_list = []
    for dealer in dealers:
        phone = dealer.get("phone", "").replace(" ", "").replace("-", "")
        if phone:
            dealer_list.append({
                "dealer_id": dealer.get("id"),
                "company_name": dealer.get("company_name", ""),
                "phone": phone
            })

    return {
        "message": message,
        "motorcycle": {
            "id": motorcycle_id,
            "brand": brand,
            "model": model,
            "year": year,
            "price": price
        },
        "dealers": dealer_list
    }

@router.post("/motorcycles/{motorcycle_id}/sms-send-all")
async def send_motorcycle_sms_to_all(motorcycle_id: str, user: dict = Depends(require_admin)):
    """Send SMS about a motorcycle to all Dutch dealers with phone numbers"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    base_url = PRODUCTION_BASE_URL
    
    brand = motorcycle.get("brand", "")
    model = motorcycle.get("model", "")
    year = motorcycle.get("year", "")
    price = motorcycle.get("price", 0)
    mileage = motorcycle.get("mileage", 0)
    
    message = f"""🏍️ NIEUWE MOTOR bij Moto Import!

{brand} {model} ({year})
💰 €{price:,.0f}
📍 {mileage:,} km

Bekijk: {base_url}/motorcycle/{motorcycle_id}"""

    # Get only Dutch dealers
    dealers = await db.users.find(
        {
            "role": "dealer", 
            "is_approved": True, 
            "phone": {"$exists": True, "$ne": ""},
            "is_foreign_dealer": {"$ne": True}
        },
        {"_id": 0, "id": 1, "company_name": 1, "phone": 1}
    ).to_list(500)
    
    sent_count = 0
    failed_count = 0
    
    for dealer in dealers:
        phone = dealer.get("phone", "").replace(" ", "").replace("-", "")
        if phone:
            result = await send_sms_to_dealer(phone, message)
            if result.get("success"):
                sent_count += 1
            else:
                failed_count += 1
            await asyncio.sleep(0.3)
    
    return {
        "sent": sent_count,
        "failed": failed_count,
        "total": len(dealers)
    }


# ============ STATS ENDPOINTS ============

@router.get("/stats")
async def get_stats(user: dict = Depends(require_admin)):
    total_motorcycles = await db.motorcycles.count_documents({})
    available_motorcycles = await db.motorcycles.count_documents({"is_available": True})
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    # Count dealers from users collection (not dealers collection)
    total_dealers = await db.users.count_documents({"role": "dealer"})
    
    return {
        "total_motorcycles": total_motorcycles,
        "available_motorcycles": available_motorcycles,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "total_dealers": total_dealers
    }

@router.get("/stats/top-dealers")
async def get_top_dealers(user: dict = Depends(require_admin)):
    """Get most active dealers by login count with last_active time"""
    dealers = await db.users.find(
        {"role": "dealer", "is_approved": True},
        {"_id": 0, "id": 1, "company_name": 1, "email": 1, "login_count": 1, "last_login": 1, "last_active": 1}
    ).sort("login_count", -1).to_list(10)
    
    return dealers

# ============ BULK EMAIL / MARKETING ENDPOINTS ============

# About Us content for marketing emails
ABOUT_US_HTML = """
<div style="background: #f0f4f8; padding: 25px; border-radius: 10px; margin: 20px 0;">
    <h3 style="color: #DC2626; margin-top: 0;">Over Moto Import B.V.</h3>
    <p style="color: #333; line-height: 1.6;">
        Moto Import B.V. is gespecialiseerd in de import en verkoop van kwaliteitsmotoren voor dealers in Europa. 
        Wij bieden een breed assortiment aan motorfietsen tegen competitieve prijzen, met snelle levering en 
        professionele service.
    </p>
    <p style="color: #333; line-height: 1.6;">
        <strong>Waarom kiezen voor Moto Import?</strong>
    </p>
    <ul style="color: #333; line-height: 1.8;">
        <li>✓ Ruim aanbod uit heel Europa</li>
        <li>✓ Scherpe dealerprijzen</li>
        <li>✓ Snelle levering binnen Europa</li>
        <li>✓ Betrouwbare partner sinds jaren</li>
        <li>✓ Persoonlijke service</li>
    </ul>
    <p style="color: #666; font-size: 14px; margin-bottom: 0;">
        <strong>Contact:</strong> +31 6 24264861 | info@motoimportbv.nl<br>
        <strong>Adres:</strong> Horsterhoekweg 11, 7433 SV Schalkhaar, Nederland
    </p>
</div>
"""

async def send_email_with_attachment(to_email: str, subject: str, html_content: str, attachment_path: str = None):
    """Send email via Gmail SMTP with optional PDF attachment"""
    from email.mime.base import MIMEBase
    from email import encoders
    
    if not GMAIL_EMAIL or not GMAIL_APP_PASSWORD:
        logger.error("Gmail credentials not configured")
        return False
    
    try:
        msg = MIMEMultipart()
        msg['From'] = GMAIL_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Attach HTML body
        msg.attach(MIMEText(html_content, 'html'))
        
        # Attach PDF if provided
        if attachment_path and os.path.exists(attachment_path):
            with open(attachment_path, 'rb') as f:
                part = MIMEBase('application', 'pdf')
                part.set_payload(f.read())
                encoders.encode_base64(part)
                filename = os.path.basename(attachment_path)
                part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
                msg.attach(part)
                logger.info(f"Attached file: {filename}")
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_EMAIL, to_email, msg.as_string())
            return True
    except Exception as e:
        logger.error(f"Failed to send email with attachment: {str(e)}")
        return False

@router.post("/admin/bulk-email", response_model=BulkEmailResponse)
async def send_bulk_email(data: BulkEmailRequest, user: dict = Depends(require_admin)):
    """Admin sends bulk marketing emails with optional flyer attachment and about us section"""
    sent = 0
    failed = 0
    failed_emails = []
    
    # Build about us section if requested
    about_us_section = ABOUT_US_HTML if data.include_about_us else ""
    
    # Get attachment path if flyer is specified
    attachment_path = None
    if data.flyer_filename:
        flyer_path = ROOT_DIR / "uploads" / data.flyer_filename
        if flyer_path.exists():
            attachment_path = str(flyer_path)
            logger.info(f"Will attach flyer: {data.flyer_filename}")
    
    html_template = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #DC2626; margin: 0;">🏍️ Moto Import</h1>
            <p style="color: #666; margin-top: 5px;">Uw partner in motoren</p>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 10px;">
            {data.message.replace(chr(10), '<br>')}
        </div>
        {about_us_section}
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
            <p><strong>Moto Import BV</strong></p>
            <p>Horsterhoekweg 11, 7433 SV Schalkhaar</p>
            <p>Tel: +31 6 24264861 | www.motoimportbv.nl</p>
        </div>
    </body>
    </html>
    """
    
    for email in data.recipient_emails:
        try:
            if attachment_path:
                success = await send_email_with_attachment(email, data.subject, html_template, attachment_path)
            else:
                success = await send_email(email, data.subject, html_template)
            
            if success:
                sent += 1
            else:
                failed += 1
                failed_emails.append(email)
        except Exception as e:
            logger.error(f"Failed to send to {email}: {str(e)}")
            failed += 1
            failed_emails.append(email)
        
        # Small delay to avoid rate limiting
        await asyncio.sleep(0.5)
    
    return BulkEmailResponse(
        total=len(data.recipient_emails),
        sent=sent,
        failed=failed,
        failed_emails=failed_emails
    )

@router.post("/admin/upload-marketing-csv")
async def upload_marketing_csv(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    """Upload a CSV file with email addresses for marketing"""
    import csv
    from io import StringIO
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Alleen CSV bestanden toegestaan")
    
    try:
        # Read file content
        content = await file.read()
        text = content.decode('utf-8')
        
        # Auto-detect delimiter (semicolon or comma)
        first_line = text.split('\n')[0]
        delimiter = ';' if ';' in first_line else ','
        
        # Parse CSV
        reader = csv.DictReader(StringIO(text), delimiter=delimiter)
        
        # Find email column (case insensitive)
        emails = []
        for row in reader:
            # Try different email column names
            email = None
            for key in row.keys():
                if key and key.lower() in ['email', 'e-mail', 'emailaddress', 'email_address', 'mail']:
                    email = row[key]
                    break
            
            if email and '@' in email:
                name = row.get('Bedrijfsnaam', row.get('Company', row.get('Name', row.get('Naam', ''))))
                emails.append({
                    "email": email.strip(),
                    "name": name.strip() if name else ""
                })
        
        if not emails:
            raise HTTPException(status_code=400, detail="Geen geldige email adressen gevonden in CSV")
        
        # Save file to uploads folder with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"Upload_{timestamp}_{file.filename}"
        filepath = ROOT_DIR / "uploads" / safe_filename
        
        with open(filepath, 'wb') as f:
            f.write(content)
        
        logger.info(f"Uploaded marketing CSV: {safe_filename} with {len(emails)} emails")
        
        return {
            "message": f"Succesvol geüpload: {len(emails)} email adressen gevonden",
            "filename": safe_filename,
            "count": len(emails),
            "emails": emails
        }
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Kan bestand niet lezen. Zorg voor UTF-8 encoding.")
    except Exception as e:
        logger.error(f"Error uploading CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Fout bij uploaden: {str(e)}")

@router.post("/admin/upload-flyer")
async def upload_flyer_pdf(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    """Upload a PDF flyer for marketing emails"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Alleen PDF bestanden toegestaan")
    
    try:
        content = await file.read()
        
        # Check file size (max 5MB)
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Bestand te groot (max 5MB)")
        
        # Create safe filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"Flyer_{timestamp}_{file.filename.replace(' ', '_')}"
        filepath = ROOT_DIR / "uploads" / safe_filename
        
        with open(filepath, 'wb') as f:
            f.write(content)
        
        size_kb = len(content) / 1024
        logger.info(f"Uploaded flyer: {safe_filename} ({size_kb:.1f} KB)")
        
        return {
            "message": f"Flyer geüpload: {safe_filename}",
            "filename": safe_filename,
            "size_kb": round(size_kb, 1),
            "url": f"/api/uploads/{safe_filename}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Fout bij uploaden: {str(e)}")

@router.get("/admin/available-flyers")
async def get_available_flyers(user: dict = Depends(require_admin)):
    """Get list of available PDF flyers for email attachments"""
    import glob
    upload_dir = ROOT_DIR / "uploads"
    pdf_files = glob.glob(str(upload_dir / "*.pdf"))
    
    flyers = []
    for filepath in pdf_files:
        filename = os.path.basename(filepath)
        size_kb = os.path.getsize(filepath) / 1024
        flyers.append({
            "filename": filename,
            "size_kb": round(size_kb, 1),
            "url": f"/api/uploads/{filename}"
        })
    
    return flyers

@router.get("/admin/marketing-lists")
async def get_marketing_lists(user: dict = Depends(require_admin)):
    """Get available marketing CSV files (both pre-made and uploaded)"""
    import glob
    upload_dir = ROOT_DIR / "uploads"
    
    # Get both Motorzaken_*.csv and Upload_*.csv files
    csv_patterns = [
        str(upload_dir / "Motorzaken_*.csv"),
        str(upload_dir / "Upload_*.csv")
    ]
    
    all_csv_files = []
    for pattern in csv_patterns:
        all_csv_files.extend(glob.glob(pattern))
    
    lists = []
    for filepath in all_csv_files:
        filename = os.path.basename(filepath)
        # Count lines (excluding header)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                count = len([l for l in lines[1:] if l.strip()])
        except:
            count = 0
        
        # Determine display name
        if filename.startswith("Motorzaken_"):
            display_name = filename.replace('Motorzaken_', '').replace('.csv', '')
        elif filename.startswith("Upload_"):
            display_name = "📤 " + filename.replace('Upload_', '').replace('.csv', '').split('_', 2)[-1] if '_' in filename else filename
        else:
            display_name = filename.replace('.csv', '')
        
        lists.append({
            "filename": filename,
            "display_name": display_name,
            "count": count,
            "url": f"/api/uploads/{filename}",
            "is_uploaded": filename.startswith("Upload_")
        })
    
    # Sort: pre-made lists first, then uploaded
    lists.sort(key=lambda x: (x["is_uploaded"], x["filename"]))
    
    return lists

@router.get("/admin/marketing-list/{filename}")
async def get_marketing_list_emails(filename: str, user: dict = Depends(require_admin)):
    """Get emails from a marketing CSV file"""
    import csv
    filepath = ROOT_DIR / "uploads" / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    emails = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            if 'Email' in row and row['Email']:
                emails.append({
                    "email": row['Email'],
                    "name": row.get('Bedrijfsnaam', ''),
                    "city": row.get('Stad', ''),
                    "region": row.get('Land/Regio', row.get('Regio', row.get('Kanton/Regio', '')))
                })
    
    return emails


