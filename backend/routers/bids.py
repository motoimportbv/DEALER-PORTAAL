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

router = APIRouter(tags=["Bids"])

# ============ BID ENDPOINTS ============

@router.post("/bids")
async def place_bid(data: BidCreate, request: Request, user: dict = Depends(get_current_user)):
    # Get motorcycle
    motorcycle = await db.motorcycles.find_one({"id": data.motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    if not motorcycle.get("is_available", True):
        raise HTTPException(status_code=400, detail="Motor is niet meer beschikbaar")
    
    # Check if auction is still active
    auction_end = datetime.fromisoformat(motorcycle.get("auction_end_time", datetime.now(timezone.utc).isoformat()))
    if datetime.now(timezone.utc) > auction_end:
        raise HTTPException(status_code=400, detail="Veiling is afgelopen")
    
    # Check if user is already the highest bidder - prevent self-overbidding
    if motorcycle.get("highest_bidder_id") == user["id"]:
        raise HTTPException(status_code=400, detail="U bent al de hoogste bieder. Wacht op een ander bod.")
    
    # Check minimum bid
    current_highest = motorcycle.get("highest_bid") or motorcycle.get("starting_price", 0)
    min_bid = current_highest + 100 if motorcycle.get("highest_bid") else motorcycle.get("starting_price", 0)
    
    if data.amount < min_bid:
        raise HTTPException(status_code=400, detail=f"Minimum bod is €{min_bid:,.0f}")
    
    # Check if bid is not higher than buy now price
    if data.amount >= motorcycle.get("price", float('inf')):
        raise HTTPException(status_code=400, detail="Bod is hoger dan Koop Nu prijs. Gebruik Koop Nu optie.")
    
    # Save bid
    bid = Bid(
        motorcycle_id=data.motorcycle_id,
        dealer_id=user["id"],
        dealer_company=user["company_name"],
        amount=data.amount
    )
    await db.bids.insert_one(bid.model_dump())
    
    # Update motorcycle with highest bid
    await db.motorcycles.update_one(
        {"id": data.motorcycle_id},
        {"$set": {"highest_bid": data.amount, "highest_bidder_id": user["id"]}}
    )
    
    # Send notification to admin about new bid
    try:
        # Always use production URL for email links
        base_url = PRODUCTION_BASE_URL
        
        # Create in-app notification for admin
        admin_user = await db.users.find_one({"role": "admin"}, {"_id": 0})
        if admin_user:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": admin_user["id"],
                "title": "Nieuw bod ontvangen!",
                "message": f"{user['company_name']} heeft €{data.amount:,.0f} geboden op {motorcycle['brand']} {motorcycle['model']}",
                "type": "bid",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "link": "/admin/motorcycles"
            }
            await db.notifications.insert_one(notification)
            
            # Send email to admin
            email_body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #18181b; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">🏍️ MOTO IMPORT</h1>
                </div>
                <div style="padding: 30px; background: #f4f4f5;">
                    <h2 style="color: #dc2626;">💰 Nieuw Bod Ontvangen!</h2>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Motor:</strong> {motorcycle['brand']} {motorcycle['model']} ({motorcycle['year']})</p>
                        <p><strong>Dealer:</strong> {user['company_name']}</p>
                        <p><strong>Bod:</strong> <span style="color: #dc2626; font-size: 24px; font-weight: bold;">€{data.amount:,.0f}</span></p>
                        <p><strong>Vraagprijs:</strong> €{motorcycle['price']:,.0f}</p>
                        <p><strong>Vorig hoogste bod:</strong> €{current_highest:,.0f}</p>
                    </div>
                    <a href="{base_url}/admin/motorcycles" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Bekijk in Dashboard</a>
                </div>
                <div style="padding: 20px; text-align: center; color: #71717a; font-size: 12px;">
                    <p>Moto Import B.V. | www.motoimportbv.nl</p>
                </div>
            </div>
            """
            # Send to all admin emails
            for admin_email in ADMIN_EMAILS_FULL:
                await send_email(
                    to_email=admin_email,
                    subject=f"💰 Nieuw bod: €{data.amount:,.0f} op {motorcycle['brand']} {motorcycle['model']}",
                    html_content=email_body
                )
    except Exception as e:
        logger.error(f"Error sending bid notification: {e}")
    
    return {"message": f"Bod van €{data.amount:,.0f} geplaatst", "bid": bid.model_dump()}

@router.get("/bids/{motorcycle_id}")
async def get_bids(motorcycle_id: str, user: dict = Depends(get_current_user)):
    bids = await db.bids.find(
        {"motorcycle_id": motorcycle_id},
        {"_id": 0}
    ).sort("amount", -1).to_list(100)
    return bids

@router.post("/motorcycles/{motorcycle_id}/buy-now")
async def buy_now(motorcycle_id: str, user: dict = Depends(get_current_user)):
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    if not motorcycle.get("is_available", True):
        raise HTTPException(status_code=400, detail="Motor is niet meer beschikbaar")
    
    # Create snapshot of motorcycle data for historical reference
    motorcycle_snapshot = {
        "id": motorcycle["id"],
        "brand": motorcycle.get("brand"),
        "model": motorcycle.get("model"),
        "year": motorcycle.get("year"),
        "price": motorcycle.get("price"),
        "mileage": motorcycle.get("mileage"),
        "color": motorcycle.get("color"),
        "condition": motorcycle.get("condition"),
        "images": motorcycle.get("images", []),
        "description": motorcycle.get("description"),
    }
    
    # Create order with buy now
    order = Order(
        motorcycle_id=motorcycle_id,
        dealer_id=user["id"],
        dealer_email=user["email"],
        dealer_company=user["company_name"],
        status="approved",
        notes=f"Koop Nu voor €{motorcycle['price']:,.0f}",
        motorcycle_snapshot=motorcycle_snapshot
    )
    await db.orders.insert_one(order.model_dump())
    
    # Mark motorcycle as unavailable
    await db.motorcycles.update_one(
        {"id": motorcycle_id},
        {"$set": {"is_available": False}}
    )
    
    return {"message": "Motor gekocht!", "order": order.model_dump()}


