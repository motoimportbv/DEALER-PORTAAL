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

router = APIRouter(tags=["Wanted Requests"])

# ============ WANTED REQUEST ENDPOINTS (Motor Zoekertje) ============

@router.post("/wanted-requests")
async def create_wanted_request(data: WantedRequestCreate, user: dict = Depends(get_current_user)):
    """Dutch dealer submits a wanted request for a specific motorcycle"""
    # Only Dutch dealers can submit wanted requests
    if user.get("is_foreign_dealer"):
        raise HTTPException(status_code=403, detail="Alleen Nederlandse dealers kunnen zoekertjes indienen")
    
    if user["role"] != "dealer":
        raise HTTPException(status_code=403, detail="Alleen dealers kunnen zoekertjes indienen")
    
    # Get dealer info
    dealer = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    wanted_request = WantedRequest(
        dealer_id=user["id"],
        dealer_company=user.get("company_name", ""),
        dealer_email=user.get("email", ""),
        dealer_phone=dealer.get("phone", "") if dealer else "",
        brand=data.brand,
        model=data.model,
        year_min=data.year_min,
        year_max=data.year_max,
        max_mileage=data.max_mileage,
        max_budget=data.max_budget,
        notes=data.notes,
        status="pending"
    )
    
    await db.wanted_requests.insert_one(wanted_request.model_dump())
    
    # Notify admin about new wanted request
    try:
        year_text = ""
        if data.year_min and data.year_max:
            year_text = f"{data.year_min} - {data.year_max}"
        elif data.year_min:
            year_text = f"vanaf {data.year_min}"
        elif data.year_max:
            year_text = f"t/m {data.year_max}"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #18181b; padding: 25px; text-align: center;">
                <h1 style="color: white; margin: 0;">🔍 NIEUW ZOEKERTJE</h1>
            </div>
            <div style="padding: 25px; background: #f8f8f8;">
                <h2 style="color: #18181b; margin-top: 0;">Motor Gezocht</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0; color: #666;">Merk:</td><td style="padding: 8px 0; font-weight: bold;">{data.brand}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Model:</td><td style="padding: 8px 0; font-weight: bold;">{data.model or 'Niet gespecificeerd'}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Bouwjaar:</td><td style="padding: 8px 0; font-weight: bold;">{year_text or 'Niet gespecificeerd'}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Max km-stand:</td><td style="padding: 8px 0; font-weight: bold;">{f'{data.max_mileage:,} km'.replace(',', '.') if data.max_mileage else 'Niet gespecificeerd'}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Budget dealer:</td><td style="padding: 8px 0; font-weight: bold; color: #16a34a;">€ {data.max_budget:,.0f}</td></tr>
                </table>
                {f'<p style="margin-top: 15px; padding: 10px; background: #fff; border-radius: 5px;"><strong>Opmerkingen:</strong><br>{data.notes}</p>' if data.notes else ''}
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                <p style="color: #666; margin: 0;"><strong>Dealer:</strong> {user.get("company_name", "Onbekend")}</p>
                <p style="color: #666; margin: 5px 0;"><strong>E-mail:</strong> {user.get("email", "")}</p>
                <p style="margin-top: 20px; text-align: center;">
                    <a href="https://www.motoimportbv.nl/admin/wanted-requests" style="background: #dc2626; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">BEKIJK IN DASHBOARD</a>
                </p>
            </div>
        </div>
        """
        # Send to main admins only (not limited admin)
        for admin_email in ADMIN_EMAILS_FULL:
            await send_email(admin_email, f"🔍 Nieuw Zoekertje: {data.brand} {data.model}", html_content)
    except Exception as e:
        logger.error(f"Failed to send wanted request notification: {e}")
    
    return {"message": "Zoekertje ingediend", "id": wanted_request.id}

@router.get("/wanted-requests")
async def get_wanted_requests(user: dict = Depends(get_current_user)):
    """Get wanted requests - dealers see their own, admin sees all"""
    if user["role"] == "admin":
        requests = await db.wanted_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    else:
        requests = await db.wanted_requests.find(
            {"dealer_id": user["id"]}, 
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    
    return requests

@router.get("/wanted-requests/pending-count")
async def get_pending_wanted_requests_count(user: dict = Depends(require_admin)):
    """Get count of pending wanted requests for admin badge"""
    count = await db.wanted_requests.count_documents({"status": "pending"})
    return {"count": count}

@router.get("/wanted-requests/{request_id}")
async def get_wanted_request(request_id: str, user: dict = Depends(get_current_user)):
    """Get a specific wanted request"""
    request = await db.wanted_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Zoekertje niet gevonden")
    
    # Check access
    if user["role"] != "admin" and request["dealer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Geen toegang tot dit zoekertje")
    
    return request

@router.put("/wanted-requests/{request_id}/approve")
async def approve_wanted_request(request_id: str, data: WantedRequestApprove, user: dict = Depends(require_admin)):
    """Admin approves a wanted request and sends it to all foreign suppliers"""
    request = await db.wanted_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Zoekertje niet gevonden")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Dit zoekertje is al verwerkt")
    
    # Calculate expiry date (7 days from now)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    
    # Update request
    await db.wanted_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "active",
            "supplier_price": data.supplier_price,
            "admin_notes": data.admin_notes,
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at
        }}
    )
    
    # Get all foreign suppliers
    foreign_suppliers = await db.users.find(
        {"is_foreign_dealer": True, "is_approved": True},
        {"_id": 0}
    ).to_list(500)
    
    # Build year text
    year_text = ""
    if request.get("year_min") and request.get("year_max"):
        year_text = f"{request['year_min']} - {request['year_max']}"
    elif request.get("year_min"):
        year_text = f"vanaf {request['year_min']}"
    elif request.get("year_max"):
        year_text = f"t/m {request['year_max']}"
    
    # Send email to all foreign suppliers
    email_count = 0
    for supplier in foreign_suppliers:
        if not supplier.get("email"):
            continue
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #18181b; padding: 25px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🔍 MOTORCYCLE WANTED</h1>
                    <p style="color: #9ca3af; margin: 10px 0 0 0;">Moto Import is looking for this motorcycle</p>
                </div>
                <div style="padding: 25px; background: #f8f8f8;">
                    <div style="background: white; padding: 20px; border-radius: 10px; border-left: 4px solid #dc2626;">
                        <h2 style="color: #18181b; margin: 0 0 15px 0;">{request['brand']} {request.get('model', '')}</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 40%;">Brand:</td><td style="padding: 8px 0; font-weight: bold;">{request['brand']}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;">Model:</td><td style="padding: 8px 0; font-weight: bold;">{request.get('model') or 'Any'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;">Year:</td><td style="padding: 8px 0; font-weight: bold;">{year_text or 'Any'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;">Max mileage:</td><td style="padding: 8px 0; font-weight: bold;">{f'{request["max_mileage"]:,} km'.replace(',', '.') if request.get('max_mileage') else 'Any'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;">Target price:</td><td style="padding: 8px 0; font-weight: bold; color: #16a34a; font-size: 18px;">€ {data.supplier_price:,.0f}</td></tr>
                        </table>
                        {f'<p style="margin-top: 15px; padding: 10px; background: #f8f8f8; border-radius: 5px;"><strong>Notes:</strong><br>{request.get("notes", "")}</p>' if request.get('notes') else ''}
                    </div>
                    <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 5px;">
                        <p style="margin: 0; color: #92400e;"><strong>⏰ This request expires in 7 days</strong></p>
                    </div>
                    <div style="margin-top: 20px; text-align: center;">
                        <p style="color: #666;">Do you have this motorcycle? Contact us:</p>
                        <p style="margin: 10px 0;"><strong>📧 {ADMIN_EMAIL}</strong></p>
                        <p style="margin: 10px 0;"><strong>📱 +31 6 12345678</strong></p>
                    </div>
                </div>
                <div style="background: #18181b; padding: 15px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0; font-size: 12px;">Moto Import B.V. - www.motoimportbv.nl</p>
                </div>
            </div>
            """
            await send_email(
                supplier["email"], 
                f"🔍 Wanted: {request['brand']} {request.get('model', '')} - € {data.supplier_price:,.0f}", 
                html_content
            )
            email_count += 1
        except Exception as e:
            logger.error(f"Failed to send wanted request email to {supplier.get('email')}: {e}")
    
    return {
        "message": f"Zoekertje goedgekeurd en verstuurd naar {email_count} leveranciers",
        "emails_sent": email_count
    }

@router.put("/wanted-requests/{request_id}/status")
async def update_wanted_request_status(request_id: str, status: str, user: dict = Depends(require_admin)):
    """Update wanted request status (fulfilled, cancelled, expired)"""
    if status not in ["fulfilled", "cancelled", "expired", "pending", "active"]:
        raise HTTPException(status_code=400, detail="Ongeldige status")
    
    request = await db.wanted_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Zoekertje niet gevonden")
    
    await db.wanted_requests.update_one(
        {"id": request_id},
        {"$set": {"status": status}}
    )
    
    # If fulfilled, notify the dealer
    if status == "fulfilled":
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #16a34a; padding: 25px; text-align: center;">
                    <h1 style="color: white; margin: 0;">✅ MOTOR GEVONDEN!</h1>
                </div>
                <div style="padding: 25px; background: #f8f8f8;">
                    <p>Goed nieuws! We hebben een {request['brand']} {request.get('model', '')} gevonden die aan uw wensen voldoet.</p>
                    <p>We nemen zo snel mogelijk contact met u op met meer details.</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                    <p style="color: #666;"><strong>Uw zoekertje:</strong></p>
                    <ul style="color: #666;">
                        <li>Merk: {request['brand']}</li>
                        <li>Model: {request.get('model') or 'Niet gespecificeerd'}</li>
                        <li>Budget: € {request['max_budget']:,.0f}</li>
                    </ul>
                </div>
            </div>
            """
            await send_email(
                request["dealer_email"],
                f"✅ Motor gevonden: {request['brand']} {request.get('model', '')}",
                html_content
            )
        except Exception as e:
            logger.error(f"Failed to send fulfillment notification: {e}")
    
    return {"message": f"Status bijgewerkt naar {status}"}

@router.delete("/wanted-requests/{request_id}")
async def delete_wanted_request(request_id: str, user: dict = Depends(get_current_user)):
    """Delete/cancel a wanted request"""
    request = await db.wanted_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Zoekertje niet gevonden")
    
    # Check access - admin can delete any, dealers only their own pending requests
    if user["role"] != "admin":
        if request["dealer_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Geen toegang tot dit zoekertje")
        if request["status"] != "pending":
            raise HTTPException(status_code=400, detail="U kunt alleen openstaande zoekertjes annuleren")
    
    await db.wanted_requests.delete_one({"id": request_id})
    return {"message": "Zoekertje verwijderd"}

# Background task to expire old wanted requests
async def expire_wanted_requests():
    """Check and expire wanted requests that have passed their expiry date"""
    while True:
        try:
            now = datetime.now(timezone.utc).isoformat()
            result = await db.wanted_requests.update_many(
                {
                    "status": "active",
                    "expires_at": {"$lt": now}
                },
                {"$set": {"status": "expired"}}
            )
            if result.modified_count > 0:
                logger.info(f"Expired {result.modified_count} wanted requests")
        except Exception as e:
            logger.error(f"Error expiring wanted requests: {e}")
        
        await asyncio.sleep(3600)  # Check every hour


