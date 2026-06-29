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
import httpx

router = APIRouter(tags=["Motorcycles"])

# ============ MOTORCYCLE ENDPOINTS ============

@router.post("/motorcycles", response_model=Motorcycle)
async def create_motorcycle(data: MotorcycleCreate, user: dict = Depends(require_admin)):
    # Bereken auction end time (3 uur vanaf nu)
    auction_end = datetime.now(timezone.utc) + timedelta(hours=data.auction_duration_hours)
    
    # Bereken auto-delete time (standaard 24 uur)
    auto_delete_at = None
    if data.auto_delete_hours > 0:
        auto_delete_at = (datetime.now(timezone.utc) + timedelta(hours=data.auto_delete_hours)).isoformat()
    
    # Handle currency conversion for CHF
    original_price = data.price
    original_currency = data.currency
    final_price = data.price
    
    if data.currency == "CHF":
        # Get current exchange rate and convert to EUR
        try:
            rate = await get_chf_to_eur_rate()
            if rate:
                final_price = round(data.price * rate, 0)  # Convert CHF to EUR
                logger.info(f"Converted CHF {data.price} to EUR {final_price} (rate: {rate})")
        except Exception as e:
            logger.error(f"Failed to convert CHF to EUR: {e}")
            # If conversion fails, keep original price as EUR
            original_currency = "EUR"
    
    motorcycle = Motorcycle(
        brand=data.brand,
        model=data.model,
        year=data.year,
        price=final_price,  # EUR price (converted if CHF)
        starting_price=final_price,
        mileage=data.mileage,
        color=data.color,
        description=data.description,
        condition=data.condition,
        images=data.images,
        auction_end_time=auction_end.isoformat(),
        created_by=user["id"],
        auto_delete_at=auto_delete_at,
        original_price=original_price,  # Original price in original currency
        original_currency=original_currency,  # EUR or CHF
        visibility=data.visibility,
        visible_to_dealers=data.visible_to_dealers
    )
    doc = motorcycle.model_dump()
    await db.motorcycles.insert_one(doc)

    # Get dealers for notifications based on visibility
    if data.visibility == "selected" and data.visible_to_dealers:
        # Only notify selected dealers
        dutch_dealers = await db.users.find({
            "role": "dealer", 
            "is_approved": True,
            "is_foreign_dealer": {"$ne": True},
            "id": {"$in": data.visible_to_dealers}
        }, {"_id": 0}).to_list(1000)
    else:
        # Notify all Dutch dealers
        dutch_dealers = await db.users.find({
            "role": "dealer", 
            "is_approved": True,
            "is_foreign_dealer": {"$ne": True}
        }, {"_id": 0}).to_list(1000)
    
    if dutch_dealers:
        # Create in-app notifications only for selected/all Dutch dealers
        notifications = [
            Notification(
                user_id=dealer["id"],
                type="new_motorcycle",
                title="Nieuwe motor toegevoegd",
                message=f"{motorcycle.brand} {motorcycle.model} ({motorcycle.year}) - Koop Nu voor €{motorcycle.price:,.0f}",
                motorcycle_id=motorcycle.id
            ).model_dump()
            for dealer in dutch_dealers
        ]
        await db.notifications.insert_many(notifications)
        
        # Send email notifications only to selected/all Dutch dealers
        asyncio.create_task(notify_dealers_new_motorcycle_email(motorcycle, dutch_dealers))
        
        # NOTE: Automatic SMS is disabled - use SMS Broadcast page to manually select recipients
        # Twilio trial accounts can only send to verified numbers
        # asyncio.create_task(notify_dealers_new_motorcycle_sms(motorcycle, dutch_dealers))
        
        # Log notification sent
        logger.info(f"Notified {len(dutch_dealers)} Dutch dealers about new motorcycle {motorcycle.brand} {motorcycle.model}")
    
    return motorcycle


@router.post("/motorcycles/bulk")
async def create_motorcycles_bulk(data: BulkMotorcycleCreate, user: dict = Depends(require_admin)):
    """Create multiple motorcycles at once - same model, different mileages"""
    
    if len(data.motorcycles) == 0:
        raise HTTPException(status_code=400, detail="Geen motoren opgegeven")
    
    if len(data.motorcycles) > 20:
        raise HTTPException(status_code=400, detail="Maximaal 20 motoren per keer")
    
    # Handle currency conversion for CHF
    original_price = data.price
    original_currency = data.currency
    final_price = data.price
    
    if data.currency == "CHF":
        try:
            rate = await get_chf_to_eur_rate()
            if rate:
                final_price = round(data.price * rate, 0)
                logger.info(f"Bulk: Converted CHF {data.price} to EUR {final_price}")
        except Exception as e:
            logger.error(f"Failed to convert CHF to EUR: {e}")
            original_currency = "EUR"
    
    created_motorcycles = []
    
    for item in data.motorcycles:
        auction_end = datetime.now(timezone.utc) + timedelta(hours=data.auction_duration_hours)
        auto_delete_at = None
        if data.auto_delete_hours > 0:
            auto_delete_at = (datetime.now(timezone.utc) + timedelta(hours=data.auto_delete_hours)).isoformat()
        
        motorcycle = Motorcycle(
            brand=data.brand,
            model=data.model,
            year=data.year,
            price=final_price,
            starting_price=final_price,
            mileage=item.mileage,
            color=data.color,
            description=data.description,
            condition=data.condition,
            images=data.images,
            auction_end_time=auction_end.isoformat(),
            created_by=user["id"],
            auto_delete_at=auto_delete_at,
            original_price=original_price,
            original_currency=original_currency,
            chassis_number=item.chassis_number or "",
            license_plate=item.license_plate or "",
            visibility=data.visibility,
            visible_to_dealers=data.visible_to_dealers
        )
        doc = motorcycle.model_dump()
        await db.motorcycles.insert_one(doc)
        created_motorcycles.append(motorcycle)
    
    # Send ONE notification for all motorcycles (only to visible dealers)
    if data.visibility == "selected" and data.visible_to_dealers:
        # Only notify selected dealers
        dutch_dealers = await db.users.find({
            "role": "dealer", 
            "is_approved": True,
            "is_foreign_dealer": {"$ne": True},
            "id": {"$in": data.visible_to_dealers}
        }, {"_id": 0}).to_list(1000)
    else:
        # Notify all Dutch dealers
        dutch_dealers = await db.users.find({
            "role": "dealer", 
            "is_approved": True,
            "is_foreign_dealer": {"$ne": True}
        }, {"_id": 0}).to_list(1000)
    
    if dutch_dealers and created_motorcycles:
        # Create ONE notification per dealer for all new motorcycles
        notifications = [
            Notification(
                user_id=dealer["id"],
                type="new_motorcycle",
                title=f"{len(created_motorcycles)} nieuwe motoren toegevoegd",
                message=f"{data.brand} {data.model} ({data.year}) - {len(created_motorcycles)}x beschikbaar vanaf €{final_price:,.0f}",
                motorcycle_id=created_motorcycles[0].id
            ).model_dump()
            for dealer in dutch_dealers
        ]
        await db.notifications.insert_many(notifications)
        logger.info(f"Bulk: Notified {len(dutch_dealers)} dealers about {len(created_motorcycles)} new motorcycles")
    
    return {
        "message": f"{len(created_motorcycles)} motoren succesvol toegevoegd",
        "count": len(created_motorcycles),
        "motorcycles": [{"id": m.id, "mileage": m.mileage} for m in created_motorcycles]
    }

# Dealer marketplace - dealers can list their own motorcycles
@router.post("/motorcycles/dealer-listing", response_model=Motorcycle)
async def create_dealer_listing(data: MotorcycleCreate, user: dict = Depends(require_approved_dealer)):
    """Allow dealers to list their own motorcycles for sale to other dealers"""
    
    motorcycle = Motorcycle(
        brand=data.brand,
        model=data.model,
        year=data.year,
        price=data.price,
        starting_price=data.starting_price,
        mileage=data.mileage,
        color=data.color,
        description=data.description,
        condition=data.condition,
        images=data.images,
        created_by=user["id"],
        # Dealer marketplace fields
        is_dealer_listing=True,
        seller_company=user.get("company_name", ""),
        seller_id=user["id"]
    )
    doc = motorcycle.model_dump()
    await db.motorcycles.insert_one(doc)
    
    # Get all OTHER approved dealers (not the seller)
    dealers = await db.users.find({
        "role": "dealer", 
        "is_approved": True,
        "id": {"$ne": user["id"]}  # Exclude the seller
    }, {"_id": 0}).to_list(1000)
    
    if dealers:
        # Create in-app notifications
        notifications = [
            Notification(
                user_id=dealer["id"],
                type="new_motorcycle",
                title="Nieuwe dealer motor",
                message=f"{motorcycle.brand} {motorcycle.model} ({motorcycle.year}) - €{motorcycle.price:,.0f} (van {user.get('company_name', 'dealer')})",
                motorcycle_id=motorcycle.id
            ).model_dump()
            for dealer in dealers
        ]
        await db.notifications.insert_many(notifications)
    
    # Notify admin about new dealer listing
    admin_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #DC2626;">🏍️ Nieuwe Dealer Motor Geplaatst</h2>
        <p>Een dealer heeft een motor te koop aangeboden:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f4f4f5;">
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Verkoper</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">{user.get('company_name', 'Dealer')}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Motor</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">{motorcycle.brand} {motorcycle.model} ({motorcycle.year})</td>
            </tr>
            <tr style="background: #f4f4f5;">
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Prijs</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">€{motorcycle.price:,.0f}</td>
            </tr>
        </table>
        <p style="color: #71717a;">Bij verkoop: €250 plaatsingskosten factureren aan {user.get('company_name', 'dealer')}.</p>
    </div>
    """
    await send_admin_notification(
        f"🏍️ Nieuwe Dealer Motor: {motorcycle.brand} {motorcycle.model}", 
        admin_html,
        include_limited_admin=True  # Also notify daniel2002jay@hotmail.com
    )
    
    return motorcycle

# Foreign dealer endpoint - submit motorcycles for admin approval
@router.post("/motorcycles/foreign-listing")
async def create_foreign_listing(data: MotorcycleCreate, user: dict = Depends(get_current_user)):
    """Allow foreign dealers to submit motorcycles for admin approval"""
    
    # Check if user is a foreign dealer
    if not user.get("is_foreign_dealer", False):
        raise HTTPException(status_code=403, detail="Alleen buitenlandse dealers kunnen deze functie gebruiken")
    
    # Validate maintenance history is provided (required for foreign dealers)
    if data.has_maintenance_history is None:
        raise HTTPException(status_code=400, detail="Onderhoudshistorie is verplicht. Geef aan of er onderhoudshistorie bij de motor zit.")
    
    # Get currency - default to CHF for Swiss dealers
    currency = data.currency.upper() if data.currency else "CHF"
    if currency not in ["EUR", "CHF"]:
        currency = "CHF"
    
    # Store original price and convert to EUR if needed for display
    original_price = data.price
    display_price = data.price
    
    if currency == "CHF":
        # Convert CHF to EUR for display price (with margin)
        rate = await get_chf_to_eur_rate()
        margin = await get_chf_eur_margin()
        display_price = convert_chf_to_eur(data.price, rate, margin)
    
    motorcycle = Motorcycle(
        brand=data.brand,
        model=data.model,
        year=data.year,
        price=display_price,  # EUR price for display (with margin)
        starting_price=data.starting_price,
        mileage=data.mileage,
        color=data.color,
        description=data.description,
        condition=data.condition,
        images=data.images,
        created_by=user["id"],
        is_available=False,  # Not visible until admin activates
        # Foreign dealer fields
        is_foreign_listing=True,
        is_pending_approval=True,
        foreign_dealer_id=user["id"],
        foreign_dealer_company=user.get("company_name", ""),
        original_price=original_price,
        original_currency=currency,
        has_maintenance_history=data.has_maintenance_history,
        maintenance_history_details=data.maintenance_history_details
    )
    doc = motorcycle.model_dump()
    await db.motorcycles.insert_one(doc)
    
    # 🪄 Auto-magische gum voor Mundi Moto (AI-inpaint) — best-effort, non-fatal
    if "mundi" in (user.get("company_name") or "").lower() and motorcycle.images:
        try:
            from routers.uploads import erase_motorcycle_logo
            await erase_motorcycle_logo(motorcycle.id, prompt_hint=user.get("company_name", "Mundi Moto"), user=user)
            logger.info(f"Auto-AI-erase toegepast op {len(motorcycle.images)} Mundi foto's voor motor {motorcycle.id}")
        except Exception as e:
            logger.error(f"Auto-AI-erase na Mundi foreign-listing mislukt: {e}")
    
    # Format price display for email
    price_display = f"CHF {original_price:,.0f}" if currency == "CHF" else f"€{original_price:,.0f}"
    eur_display = f"€{display_price:,.0f}" if currency == "CHF" else ""
    
    # Notify admin about new foreign dealer submission
    admin_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #8B5CF6; padding: 15px; text-align: center;">
            <h2 style="color: white; margin: 0;">🌍 Nieuwe Motor van Buitenlandse Dealer</h2>
        </div>
        <div style="padding: 20px; background: #f5f3ff;">
            <p style="font-size: 16px; margin-bottom: 15px;"><strong>Actie vereist:</strong> Beoordeel en stel de prijs in.</p>
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px;">
                <tr style="background: #f4f4f5;">
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Buitenlandse Dealer</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7; color: #8B5CF6; font-weight: bold;">{user.get('company_name', 'Dealer')} ({user.get('country', '')})</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Motor</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;">{motorcycle.brand} {motorcycle.model} ({motorcycle.year})</td>
                </tr>
                <tr style="background: #f4f4f5;">
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Inkoopprijs ({currency})</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7; font-weight: bold;">{price_display} {f'(≈ {eur_display})' if eur_display else ''}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Kilometerstand</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;">{motorcycle.mileage:,} km</td>
                </tr>
            </table>
            <p style="margin-top: 15px; color: #6b7280;">Log in om de verkoopprijs aan te passen en de motor te activeren.</p>
        </div>
    </div>
    """
    await send_admin_notification(
        f"🌍 Nieuwe Motor van {user.get('company_name', 'Buitenlandse Dealer')}", 
        admin_html,
        include_limited_admin=True  # Also notify daniel2002jay@hotmail.com
    )
    
    return {"message": "Motor ingediend voor beoordeling", "motorcycle_id": motorcycle.id}

@router.get("/motorcycles/{motorcycle_id}/whatsapp-share")
async def get_whatsapp_share_link(motorcycle_id: str, user: dict = Depends(require_admin)):
    """Generate a WhatsApp share link with auto-login tokens for all dealers"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Get the base URL from environment or use default
    base_url = PRODUCTION_BASE_URL
    
    # Create a generic share message (dealers will get auto-login when they click their personalized link)
    brand = motorcycle.get("brand", "")
    model = motorcycle.get("model", "")
    year = motorcycle.get("year", "")
    price = motorcycle.get("price", 0)
    mileage = motorcycle.get("mileage", 0)
    condition = motorcycle.get("condition", "goed").title()
    vin = motorcycle.get("vin", "")
    
    # Build the message
    message = f"""🏍️ *NIEUWE MOTOR BESCHIKBAAR*

*{brand} {model}* ({year})

💰 Prijs: €{price:,.0f}
📍 KM-stand: {mileage:,} km
⭐ Conditie: {condition}
🔑 Chassisnr: {vin if vin else 'Zie website'}

👉 Bekijk en bestel direct:
{base_url}/motorcycle/{motorcycle_id}

_Moto Import - Uw partner in motoren_"""

    # URL encode the message for WhatsApp
    import urllib.parse
    encoded_message = urllib.parse.quote(message)
    
    whatsapp_url = f"https://wa.me/?text={encoded_message}"
    
    return {
        "whatsapp_url": whatsapp_url,
        "message": message,
        "motorcycle_id": motorcycle_id
    }

@router.get("/motorcycles/{motorcycle_id}/whatsapp-share-personal")
async def get_personal_whatsapp_share(motorcycle_id: str, dealer_id: str, user: dict = Depends(require_admin)):
    """Generate a personalized WhatsApp share link with auto-login for a specific dealer"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    dealer = await db.users.find_one({"id": dealer_id}, {"_id": 0, "password_hash": 0})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    # Create auto-login token for this dealer
    auto_token = create_notification_token(dealer["id"], dealer.get("email", ""), dealer.get("role", "dealer"))
    
    # Get the base URL
    base_url = PRODUCTION_BASE_URL
    
    # Build personalized URL with auto-login
    auto_login_url = f"{base_url}/auto-login?token={auto_token}&redirect=/motorcycle/{motorcycle_id}"
    
    brand = motorcycle.get("brand", "")
    model = motorcycle.get("model", "")
    year = motorcycle.get("year", "")
    price = motorcycle.get("price", 0)
    
    message = f"""🏍️ *NIEUWE MOTOR*

*{brand} {model}* ({year})
💰 €{price:,.0f}

👉 Klik hier om direct te bekijken:
{auto_login_url}

_Moto Import_"""

    import urllib.parse
    encoded_message = urllib.parse.quote(message)
    
    # If dealer has a phone number, create direct link
    phone = dealer.get("phone", "").replace(" ", "").replace("-", "")
    if phone:
        whatsapp_url = f"https://wa.me/{phone}?text={encoded_message}"
    else:
        whatsapp_url = f"https://wa.me/?text={encoded_message}"
    
    return {
        "whatsapp_url": whatsapp_url,
        "message": message,
        "dealer_phone": phone,
        "dealer_company": dealer.get("company_name", "")
    }

@router.get("/motorcycles/{motorcycle_id}/whatsapp-share-all-dealers")
async def get_whatsapp_share_all_dealers(motorcycle_id: str, user: dict = Depends(require_admin)):
    """Get WhatsApp share links for DUTCH dealers only (not foreign dealers) with phone numbers"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Get only Dutch approved dealers with phone numbers (exclude foreign dealers)
    dealers = await db.users.find(
        {
            "role": "dealer", 
            "is_approved": True, 
            "phone": {"$exists": True, "$ne": ""},
            "is_foreign_dealer": {"$ne": True}  # Only Dutch dealers
        },
        {"_id": 0, "id": 1, "company_name": 1, "phone": 1, "email": 1}
    ).to_list(500)
    
    base_url = PRODUCTION_BASE_URL
    
    # Create message
    message = f"""🏍️ *Nieuwe Motor Beschikbaar!*

*{motorcycle.get('brand', '')} {motorcycle.get('model', '')}*
• Jaar: {motorcycle.get('year', '')}
• KM stand: {motorcycle.get('mileage', 0):,} km
• Prijs: €{motorcycle.get('price', 0):,.0f}

👉 Bekijk direct: {base_url}/motorcycle/{motorcycle_id}

_Moto Import BV_"""
    
    encoded_message = urllib.parse.quote(message)
    
    dealer_links = []
    for dealer in dealers:
        phone = dealer.get("phone", "").replace(" ", "").replace("-", "").replace("+", "")
        if not phone.startswith("31") and not phone.startswith("32") and not phone.startswith("41"):
            if phone.startswith("0"):
                phone = "31" + phone[1:]  # Dutch number
        
        if phone:
            dealer_links.append({
                "dealer_id": dealer.get("id"),
                "company_name": dealer.get("company_name", dealer.get("email", "")),
                "phone": phone,
                "whatsapp_url": f"https://wa.me/{phone}?text={encoded_message}"
            })
    
    return {
        "motorcycle": {
            "id": motorcycle_id,
            "brand": motorcycle.get("brand"),
            "model": motorcycle.get("model"),
            "price": motorcycle.get("price")
        },
        "message": message,
        "dealers": dealer_links,
        "total_dealers": len(dealer_links)
    }

@router.get("/motorcycles/foreign-listings")
async def get_foreign_listings(user: dict = Depends(get_current_user)):
    """Get motorcycles submitted by the current foreign dealer"""
    if not user.get("is_foreign_dealer", False):
        raise HTTPException(status_code=403, detail="Alleen voor buitenlandse dealers")
    
    motorcycles = await db.motorcycles.find(
        {"foreign_dealer_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Strip selling price - foreign dealers should only see their own price
    for moto in motorcycles:
        moto.pop("price", None)
        moto.pop("purchase_price", None)
    
    return motorcycles

@router.get("/motorcycles/pending-foreign")
async def get_pending_foreign_listings(user: dict = Depends(require_admin)):
    """Get all pending motorcycles from foreign dealers (admin only)"""
    motorcycles = await db.motorcycles.find(
        {"is_foreign_listing": True, "is_pending_approval": True},
        {"_id": 0}
    ).to_list(100)
    return motorcycles



@router.put("/motorcycles/foreign-listings/{motorcycle_id}/price")
async def update_foreign_listing_price(motorcycle_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Foreign dealer OR admin updates the supplier price of a motorcycle listing.
    Price is expected in the original currency (CHF for Swiss suppliers).
    The EUR selling price is recalculated using the live exchange rate."""
    is_admin = user.get("role") == "admin"
    is_foreign = user.get("is_foreign_dealer", False)
    
    if not is_admin and not is_foreign:
        raise HTTPException(status_code=403, detail="Geen toegang")
    
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Foreign dealers can only edit their own listings
    if is_foreign and motorcycle.get("foreign_dealer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="U bent niet de eigenaar van deze motor")
    
    new_price = data.get("price")
    if not new_price or float(new_price) <= 0:
        raise HTTPException(status_code=400, detail="Ongeldige prijs")
    
    new_price = float(new_price)
    old_price = float(motorcycle.get("original_price") or motorcycle.get("price", 0))
    price_diff = old_price - new_price  # Positive = price reduction
    original_currency = motorcycle.get("original_currency", "EUR")
    
    update_fields = {"original_price": new_price}
    
    current_selling_price = float(motorcycle.get("price", 0))
    if current_selling_price and price_diff != 0:
        # Convert the price difference to EUR if original currency is CHF
        if original_currency == "CHF":
            try:
                rate = await get_chf_to_eur_rate()
                margin = await get_chf_eur_margin()
                price_diff_eur = convert_chf_to_eur(abs(price_diff), rate, margin)
                if price_diff > 0:
                    new_selling_price = max(0, current_selling_price - price_diff_eur)
                else:
                    new_selling_price = current_selling_price + price_diff_eur
                logger.info(f"CHF price change: {price_diff} CHF = {price_diff_eur} EUR (rate: {rate})")
            except Exception as e:
                logger.error(f"Failed CHF->EUR conversion: {e}")
                new_selling_price = max(0, current_selling_price - price_diff)
        else:
            new_selling_price = max(0, current_selling_price - price_diff)
        
        update_fields["price"] = round(new_selling_price, 0)
        
        if motorcycle.get("price_override") and motorcycle.get("price_override_amount"):
            new_override = max(0, float(motorcycle["price_override_amount"]) - (current_selling_price - new_selling_price))
            update_fields["price_override_amount"] = new_override
    
    # Track supplier price reduction
    if price_diff > 0:
        update_fields["supplier_price_reduced"] = True
        update_fields["supplier_price_reduction"] = price_diff
        update_fields["supplier_price_reduced_at"] = datetime.now(timezone.utc).isoformat()
    elif price_diff < 0:
        update_fields["supplier_price_reduced"] = False
        update_fields["supplier_price_reduction"] = 0
    
    await db.motorcycles.update_one(
        {"id": motorcycle_id},
        {"$set": update_fields}
    )
    
    return {
        "message": "Prijs bijgewerkt",
        "new_supplier_price": new_price,
        "currency": original_currency,
        "new_selling_price": update_fields.get("price", current_selling_price),
        "price_difference": price_diff
    }


@router.post("/motorcycles/foreign-listings/{motorcycle_id}/mark-sold-elsewhere")
async def mark_motorcycle_sold_elsewhere(motorcycle_id: str, user: dict = Depends(get_current_user)):
    """Mark a motorcycle as sold elsewhere by the foreign dealer/supplier.
    This will notify any dealer who has ordered this motorcycle."""
    
    # Check if user is foreign dealer
    if not user.get("is_foreign_dealer", False):
        raise HTTPException(status_code=403, detail="Alleen voor buitenlandse leveranciers")
    
    # Find the motorcycle
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Verify ownership
    if motorcycle.get("foreign_dealer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="U bent niet de eigenaar van deze motor")
    
    # Check if motorcycle is already marked as sold elsewhere
    if motorcycle.get("sold_elsewhere"):
        raise HTTPException(status_code=400, detail="Motor is al gemarkeerd als elders verkocht")
    
    # Find any orders for this motorcycle
    orders = await db.orders.find(
        {"motorcycle_id": motorcycle_id, "archived": {"$ne": True}},
        {"_id": 0}
    ).to_list(100)
    
    # Mark motorcycle as sold elsewhere and unavailable
    await db.motorcycles.update_one(
        {"id": motorcycle_id},
        {"$set": {
            "sold_elsewhere": True,
            "sold_elsewhere_at": datetime.now(timezone.utc).isoformat(),
            "is_available": False
        }}
    )
    
    # Get supplier info for the email
    supplier = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    supplier_company = supplier.get("company_name", "Leverancier") if supplier else "Leverancier"
    
    # Find similar motorcycles to suggest
    similar_motorcycles = await db.motorcycles.find(
        {
            "is_available": True,
            "brand": motorcycle.get("brand"),
            "id": {"$ne": motorcycle_id}
        },
        {"_id": 0}
    ).to_list(3)
    
    # Notify each dealer who ordered this motorcycle
    notified_dealers = []
    for order in orders:
        dealer = await db.users.find_one({"id": order["dealer_id"]}, {"_id": 0})
        if dealer and dealer.get("email"):
            # Send email notification
            asyncio.create_task(send_sold_elsewhere_email(
                dealer, 
                motorcycle, 
                supplier_company,
                similar_motorcycles
            ))
            notified_dealers.append(dealer.get("company_name", dealer.get("email")))
            
            # Create in-app notification
            notification = Notification(
                user_id=dealer["id"],
                type="motorcycle_sold_elsewhere",
                title="Motor niet meer beschikbaar",
                message=f"De {motorcycle['brand']} {motorcycle['model']} is helaas elders verkocht door de leverancier.",
                motorcycle_id=motorcycle_id
            ).model_dump()
            await db.notifications.insert_one(notification)
    
    return {
        "message": "Motor gemarkeerd als elders verkocht",
        "notified_dealers": notified_dealers,
        "orders_affected": len(orders)
    }

async def send_sold_elsewhere_email(dealer: dict, motorcycle: dict, supplier_company: str, similar_motorcycles: list):
    """Send email to dealer when a motorcycle they ordered is sold elsewhere by supplier"""
    try:
        dealer_name = dealer.get("contact_person", dealer.get("company_name", "Dealer"))
        dealer_email = dealer.get("email")
        
        if not dealer_email:
            return
        
        # Format price
        price = motorcycle.get("price", 0)
        price_formatted = f"€{price:,.0f}".replace(",", ".")
        
        # Build similar motorcycles section
        similar_html = ""
        if similar_motorcycles:
            similar_html = """
            <div style="margin-top: 30px; padding: 20px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 16px;">🔍 Vergelijkbare motoren beschikbaar:</h3>
            """
            for moto in similar_motorcycles:
                moto_price = f"€{moto.get('price', 0):,.0f}".replace(",", ".")
                similar_html += f"""
                <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>{moto.get('brand', '')} {moto.get('model', '')}</strong><br>
                        <span style="color: #666; font-size: 14px;">{moto.get('year', '')} • {moto.get('mileage', 0):,} km</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="color: #dc2626; font-weight: bold; font-size: 18px;">{moto_price}</span>
                    </div>
                </div>
                """
            similar_html += """
                <a href="https://www.motoimportbv.nl/dealer" 
                   style="display: inline-block; margin-top: 10px; background: #166534; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Bekijk alle motoren →
                </a>
            </div>
            """
        
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
                    <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Motor Niet Meer Beschikbaar</h1>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <p style="font-size: 16px; color: #374151;">Beste {dealer_name},</p>
                    
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Helaas moeten wij u mededelen dat de motor waarin u geïnteresseerd was, door de leverancier 
                        <strong>{supplier_company}</strong> elders is verkocht.
                    </p>
                    
                    <!-- Motorcycle info -->
                    <div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 12px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0; color: #991b1b;">
                            {motorcycle.get('brand', '')} {motorcycle.get('model', '')}
                        </h3>
                        <p style="margin: 0; color: #666;">
                            {motorcycle.get('year', '')} • {motorcycle.get('mileage', 0):,} km • {motorcycle.get('color', '')}
                        </p>
                        <p style="margin: 10px 0 0 0; font-size: 20px; font-weight: bold; color: #dc2626;">
                            {price_formatted}
                        </p>
                    </div>
                    
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Onze excuses voor het ongemak. Dit kan soms gebeuren wanneer een leverancier de motor via 
                        een ander kanaal verkoopt voordat de transactie bij ons is afgerond.
                    </p>
                    
                    {similar_html}
                    
                    <p style="font-size: 16px; color: #374151; line-height: 1.6; margin-top: 20px;">
                        Heeft u vragen? Neem gerust contact met ons op.
                    </p>
                    
                    <p style="margin-top: 30px; color: #374151;">
                        Met vriendelijke groet,<br>
                        <strong>Team Moto Import B.V.</strong><br>
                        <span style="color: #666;">📞 +31 6 24264861</span><br>
                        <span style="color: #666;">✉️ motoimportbv@gmail.com</span>
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await send_email(
            to_email=dealer_email,
            subject=f"⚠️ Motor niet meer beschikbaar: {motorcycle.get('brand', '')} {motorcycle.get('model', '')}",
            html_content=html_content
        )
        print(f"Sold elsewhere email sent to {dealer_email}")
        
    except Exception as e:
        print(f"Failed to send sold elsewhere email: {e}")


@router.post("/motorcycles/{motorcycle_id}/activate")
async def activate_foreign_listing(motorcycle_id: str, price: float, starting_price: Optional[float] = None, user: dict = Depends(require_admin)):
    """Activate a foreign dealer listing with new price (admin only)"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    if not motorcycle.get("is_foreign_listing", False):
        raise HTTPException(status_code=400, detail="Dit is geen buitenlandse dealer motor")
    
    # Save original supplier price if not already saved
    original_price = motorcycle.get("original_price") or motorcycle.get("price")
    
    # Update motorcycle with new price and activate it
    # Keep original_price for reference (supplier's asking price)
    await db.motorcycles.update_one(
        {"id": motorcycle_id},
        {"$set": {
            "price": price,
            "starting_price": starting_price or price * 0.8,
            "is_available": True,
            "is_pending_approval": False,
            "original_price": original_price,  # Keep supplier's original price
            "price_override": True if price != original_price else False,
            "price_override_amount": price if price != original_price else None
        }}
    )
    
    # Get all approved dealers for notifications
    dealers = await db.users.find(
        {"role": "dealer", "is_approved": True, "is_foreign_dealer": {"$ne": True}},
        {"_id": 0}
    ).to_list(1000)
    
    if dealers:
        # Create in-app notifications
        notifications = [
            Notification(
                user_id=dealer["id"],
                type="new_motorcycle",
                title="Nieuwe motor beschikbaar",
                message=f"{motorcycle['brand']} {motorcycle['model']} ({motorcycle['year']}) - €{price:,.0f}",
                motorcycle_id=motorcycle_id
            ).model_dump()
            for dealer in dealers
        ]
        await db.notifications.insert_many(notifications)
        
        # Create a simple motorcycle object for notifications
        class MotorcycleNotify:
            def __init__(self, moto, new_price):
                self.id = moto.get('id')
                self.brand = moto.get('brand', '')
                self.model = moto.get('model', '')
                self.year = moto.get('year', '')
                self.price = new_price
                self.mileage = moto.get('mileage', 0)
                self.color = moto.get('color', '')
        
        moto_notify = MotorcycleNotify(motorcycle, price)
        
        # Send email notifications to Dutch dealers
        asyncio.create_task(notify_dealers_new_motorcycle_email(moto_notify, dealers))
        
        # NOTE: Automatic SMS is disabled - use SMS Broadcast page to manually select recipients
        # Twilio trial accounts can only send to verified numbers
        # asyncio.create_task(notify_dealers_new_motorcycle_sms(moto_notify, dealers))
    
    return {"message": "Motor geactiveerd", "price": price}

async def notify_dealers_new_motorcycle_email(motorcycle, dealers):
    """Queue motorcycle for bundled email notification - max 3 emails per day per dealer"""
    # Instead of sending immediately, add to pending queue
    # Emails are sent in batches by the scheduled task
    
    for dealer in dealers:
        # Skip dealers without email, who are offline, or who are foreign dealers
        if not dealer.get("email") or dealer.get("is_offline", False) or dealer.get("is_foreign_dealer", False):
            continue
        
        try:
            # Add to pending email queue
            await db.pending_motorcycle_emails.update_one(
                {"dealer_id": dealer["id"]},
                {
                    "$push": {
                        "motorcycles": {
                            "id": motorcycle.id,
                            "brand": motorcycle.brand,
                            "model": motorcycle.model,
                            "year": motorcycle.year,
                            "color": motorcycle.color,
                            "mileage": motorcycle.mileage,
                            "price": motorcycle.price,
                            "added_at": datetime.now(timezone.utc).isoformat()
                        }
                    },
                    "$setOnInsert": {
                        "dealer_id": dealer["id"],
                        "dealer_email": dealer["email"],
                        "dealer_company": dealer.get("company_name", "Dealer"),
                        "emails_sent_today": 0,
                        "last_email_date": None
                    }
                },
                upsert=True
            )
        except Exception as e:
            logger.error(f"Failed to queue motorcycle email for {dealer.get('email')}: {e}")
    
    # Trigger batch send (will respect daily limit)
    asyncio.create_task(send_pending_motorcycle_emails())


async def send_pending_motorcycle_emails():
    """Send bundled motorcycle emails - max 3 per dealer per day"""
    base_url = PRODUCTION_BASE_URL
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get all dealers with pending motorcycles
    pending_list = await db.pending_motorcycle_emails.find({
        "motorcycles": {"$exists": True, "$ne": []},
        "$or": [
            {"last_email_date": {"$ne": today}},  # Haven't emailed today
            {"emails_sent_today": {"$lt": 3}}     # Or sent less than 3 today
        ]
    }).to_list(100)
    
    for pending in pending_list:
        dealer_email = pending.get("dealer_email")
        dealer_company = pending.get("dealer_company", "Dealer")
        motorcycles = pending.get("motorcycles", [])
        
        if not motorcycles or not dealer_email:
            continue
        
        # Reset counter if new day
        if pending.get("last_email_date") != today:
            await db.pending_motorcycle_emails.update_one(
                {"dealer_id": pending["dealer_id"]},
                {"$set": {"emails_sent_today": 0, "last_email_date": today}}
            )
            pending["emails_sent_today"] = 0
        
        # Check daily limit
        if pending.get("emails_sent_today", 0) >= 3:
            logger.info(f"Skipping {dealer_email} - already sent 3 emails today")
            continue
        
        try:
            # Build email with all pending motorcycles
            motorcycle_html = ""
            for moto in motorcycles:
                motorcycle_html += f"""
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0;">
                    <h3 style="margin: 0 0 8px 0; color: #DC2626;">
                        {moto['brand']} {moto['model']}
                    </h3>
                    <p style="color: #6b7280; margin: 3px 0; font-size: 14px;">Bouwjaar: {moto['year']} | Kleur: {moto['color']} | {moto['mileage']:,} km</p>
                    <p style="font-size: 20px; font-weight: bold; color: #18181b; margin: 8px 0;">
                        €{moto['price']:,.0f}
                    </p>
                    <a href="{base_url}/motorcycle/{moto['id']}" 
                       style="color: #DC2626; text-decoration: none; font-weight: bold; font-size: 14px;">
                        Bekijk motor →
                    </a>
                </div>
                """
            
            count = len(motorcycles)
            subject = f"🏍️ {count} nieuwe motor{'en' if count > 1 else ''} toegevoegd!"
            
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #DC2626; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">🏍️ {count} NIEUWE MOTOR{'EN' if count > 1 else ''}!</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <p>Beste {dealer_company},</p>
                    <p>Er {'zijn' if count > 1 else 'is'} {count} nieuwe motor{'fietsen' if count > 1 else 'fiets'} toegevoegd aan ons aanbod:</p>
                    
                    {motorcycle_html}
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="{base_url}/dealer" 
                           style="background: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            BEKIJK ALLE MOTOREN
                        </a>
                    </div>
                </div>
                <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
                    <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
                    <p style="margin: 5px 0;">www.motoimportbv.nl</p>
                    <p style="margin: 5px 0;">Tel: +31 6 24264861</p>
                    <p style="margin: 10px 0; font-size: 11px; color: #6b7280;">U ontvangt maximaal 3 emails per dag</p>
                </div>
            </div>
            """
            
            await send_email(dealer_email, subject, html_content)
            
            # Clear pending and update counter
            await db.pending_motorcycle_emails.update_one(
                {"dealer_id": pending["dealer_id"]},
                {
                    "$set": {"motorcycles": []},
                    "$inc": {"emails_sent_today": 1}
                }
            )
            
            logger.info(f"Sent bundled email to {dealer_email} with {count} motorcycles")
            await asyncio.sleep(0.5)  # Rate limiting
            
        except Exception as e:
            logger.error(f"Failed to send bundled email to {dealer_email}: {e}")


async def notify_dealers_new_motorcycle_sms(motorcycle, dealers):
    """Send SMS notifications to Dutch dealers with phone numbers about a new motorcycle"""
    if not twilio_client:
        logger.warning("Twilio client not configured - skipping SMS notifications")
        return
    
    base_url = PRODUCTION_BASE_URL
    
    # Short SMS message
    message = f"""🏍️ NIEUWE MOTOR bij Moto Import!

{motorcycle.brand} {motorcycle.model} ({motorcycle.year})
💰 €{motorcycle.price:,.0f}
📍 {motorcycle.mileage:,} km

Bekijk: {base_url}/motorcycle/{motorcycle.id}"""

    sent_count = 0
    for dealer in dealers:
        phone = dealer.get("phone", "")
        if not phone:
            continue
        
        # Skip foreign dealers
        if dealer.get("is_foreign_dealer", False):
            continue
            
        # Format phone number
        phone = phone.replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            if phone.startswith("0"):
                phone = "+31" + phone[1:]  # Dutch number
            elif phone.startswith("31"):
                phone = "+" + phone
            else:
                phone = "+" + phone
        
        try:
            twilio_client.messages.create(
                body=message,
                from_=TWILIO_PHONE_NUMBER,
                to=phone
            )
            sent_count += 1
            logger.info(f"SMS sent to {dealer.get('company_name')} ({phone})")
            # Delay between SMS to avoid rate limiting
            await asyncio.sleep(0.5)
        except Exception as e:
            logger.error(f"Failed to send SMS to {phone}: {e}")
    
    logger.info(f"Sent {sent_count} SMS notifications for new motorcycle {motorcycle.brand} {motorcycle.model}")

@router.get("/motorcycles")
async def get_motorcycles(user: dict = Depends(require_approved_dealer)):
    # Sort by created_at descending (newest first)
    motorcycles = await db.motorcycles.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get current exchange rate and margin for CHF motorcycles
    chf_eur_rate = await get_chf_to_eur_rate()
    margin = await get_chf_eur_margin()
    
    # Check user role
    is_admin = user.get("role") == "admin"
    is_foreign_dealer = user.get("is_foreign_dealer", False) or user.get("role") == "foreign_dealer"
    user_id = user.get("id")
    
    # SECURITY: Foreign dealers can ONLY see their own motorcycles
    if is_foreign_dealer:
        own_motorcycles = [m for m in motorcycles if m.get("foreign_dealer_id") == user_id]
        # Strip selling price - foreign dealers only see their own price
        for m in own_motorcycles:
            m.pop("price", None)
            m.pop("purchase_price", None)
        return own_motorcycles
    
    # Filter motorcycles based on visibility (admin sees all)
    filtered_motorcycles = []
    for m in motorcycles:
        # Admin sees all motorcycles
        if is_admin:
            pass  # Include all
        else:
            # Check visibility
            visibility = m.get("visibility", "all")
            if visibility == "selected":
                visible_to = m.get("visible_to_dealers", [])
                if user_id not in visible_to:
                    continue  # Skip this motorcycle - dealer not in visible list
        
        # Add default starting_price if missing
        if "starting_price" not in m or m["starting_price"] is None:
            m["starting_price"] = m.get("price", 0) * 0.8
        
        # Check if admin has manually set a price (price_override flag)
        if m.get("price_override") and m.get("price_override_amount"):
            # Admin has overridden the price - use that
            m["price"] = m["price_override_amount"]
            m["price_override_active"] = True
        # For CHF motorcycles WITHOUT override, show live conversion
        # But ONLY if we don't already have a saved EUR price that differs from original
        elif m.get("original_currency") == "CHF" and m.get("original_price"):
            # Calculate what the live CHF->EUR price would be
            live_eur_price = convert_chf_to_eur(m["original_price"], chf_eur_rate, margin)
            
            # Check if the stored price is significantly different from live conversion
            # If so, it means admin set a custom price - respect that
            stored_price = m.get("price", 0)
            if stored_price and abs(stored_price - live_eur_price) > 100:
                # Admin has set a custom price, keep it
                m["price_override_active"] = True
                logger.info(f"Keeping admin price €{stored_price} instead of live €{live_eur_price} for {m.get('brand')} {m.get('model')}")
            else:
                # Use live conversion
                m["price"] = live_eur_price
                m["starting_price"] = round(live_eur_price * 0.8, 2)
                m["exchange_rate"] = chf_eur_rate
                m["margin_percent"] = margin * 100
                m["price_updated_live"] = True
        
        # Hide supplier price info from non-admin users
        if not is_admin:
            m.pop("original_price", None)
            m.pop("original_currency", None)
            m.pop("price_override", None)
            m.pop("price_override_amount", None)
            m.pop("price_override_active", None)
            m.pop("purchase_price", None)  # Inkoopprijs alleen voor admin
            # Also hide visibility settings from dealers
            m.pop("visible_to_dealers", None)
        
        filtered_motorcycles.append(m)
    
    return filtered_motorcycles

@router.get("/motorcycles/with-exchange-rate")
async def get_motorcycles_with_exchange_rate(user: dict = Depends(require_approved_dealer)):
    """Get motorcycles with real-time CHF to EUR conversion for foreign listings"""
    # SECURITY: Foreign dealers can only see their own motorcycles
    is_foreign_dealer = user.get("is_foreign_dealer", False) or user.get("role") == "foreign_dealer"
    if is_foreign_dealer:
        own_motorcycles = await db.motorcycles.find(
            {"foreign_dealer_id": user.get("id")}, 
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        return {"motorcycles": own_motorcycles, "exchange_rate": {"CHF_EUR": 0.95}, "margin_percent": 0}
    
    # Sort by created_at descending (newest first)
    motorcycles = await db.motorcycles.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get current exchange rate and margin
    chf_eur_rate = await get_chf_to_eur_rate()
    margin = await get_chf_eur_margin()
    
    # Check if user is admin
    is_admin = user.get("role") == "admin"
    
    result = []
    for m in motorcycles:
        # Add default starting_price if missing
        if "starting_price" not in m or m["starting_price"] is None:
            m["starting_price"] = m.get("price", 0) * 0.8
        
        # Check if admin has manually set a price
        if m.get("price_override") and m.get("price_override_amount"):
            m["price"] = m["price_override_amount"]
            m["price_override_active"] = True
        elif m.get("original_currency") == "CHF" and m.get("original_price"):
            live_eur_price = convert_chf_to_eur(m["original_price"], chf_eur_rate, margin)
            stored_price = m.get("price", 0)
            # If stored price differs significantly from live, admin set a custom price
            if stored_price and abs(stored_price - live_eur_price) > 100:
                m["price_override_active"] = True
            else:
                m["price"] = live_eur_price
                m["starting_price"] = round(live_eur_price * 0.8, 2)
                m["exchange_rate"] = chf_eur_rate
                m["margin_percent"] = margin * 100
        
        # Hide supplier price info from non-admin users
        if not is_admin:
            m.pop("original_price", None)
            m.pop("original_currency", None)
            m.pop("price_override", None)
            m.pop("price_override_amount", None)
            m.pop("price_override_active", None)
        
        result.append(m)
    
    return {"motorcycles": result, "exchange_rate": {"CHF_EUR": chf_eur_rate}, "margin_percent": margin * 100}

@router.get("/motorcycles/available")
async def get_available_motorcycles(user: dict = Depends(require_approved_dealer)):
    # SECURITY: Foreign dealers cannot access available motorcycles list
    is_foreign_dealer = user.get("is_foreign_dealer", False) or user.get("role") == "foreign_dealer"
    if is_foreign_dealer:
        raise HTTPException(status_code=403, detail="Leveranciers hebben geen toegang tot de catalogus")
    
    # For dealers, exclude their own listings from the available motorcycles
    query = {"is_available": True}
    if user["role"] == "dealer":
        query["seller_id"] = {"$ne": user["id"]}  # Don't show own listings
    
    # Sort by created_at descending (newest first)
    motorcycles = await db.motorcycles.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get current exchange rate and margin for CHF motorcycles
    chf_eur_rate = await get_chf_to_eur_rate()
    margin = await get_chf_eur_margin()
    
    # Check if user is admin
    is_admin = user.get("role") == "admin"
    
    # Process motorcycles - recalculate EUR prices for CHF motorcycles
    filtered = []
    user_id = user.get("id")
    for m in motorcycles:
        # VISIBILITY CHECK: Skip motorcycles this dealer shouldn't see
        if not is_admin:
            vis = m.get("visibility", "all")
            if vis == "selected":
                visible_to = m.get("visible_to_dealers", [])
                if user_id not in visible_to:
                    continue
        
        # Add default starting_price if missing
        if "starting_price" not in m or m["starting_price"] is None:
            m["starting_price"] = m.get("price", 0) * 0.8
        
        # Check if admin has manually set a price
        if m.get("price_override") and m.get("price_override_amount"):
            m["price"] = m["price_override_amount"]
            m["price_override_active"] = True
        elif m.get("original_currency") == "CHF" and m.get("original_price"):
            live_eur_price = convert_chf_to_eur(m["original_price"], chf_eur_rate, margin)
            stored_price = m.get("price", 0)
            # If stored price differs significantly from live, admin set a custom price
            if stored_price and abs(stored_price - live_eur_price) > 100:
                m["price_override_active"] = True
            else:
                m["price"] = live_eur_price
                m["starting_price"] = round(live_eur_price * 0.8, 2)
                m["exchange_rate"] = chf_eur_rate
                m["margin_percent"] = margin * 100
                m["price_updated_live"] = True
        
        # Hide supplier price info from non-admin users
        if not is_admin:
            m.pop("original_price", None)
            m.pop("original_currency", None)
            m.pop("price_override", None)
            m.pop("price_override_amount", None)
            m.pop("price_override_active", None)
            m.pop("purchase_price", None)  # Inkoopprijs alleen voor admin
            m.pop("visible_to_dealers", None)  # Hide visibility settings
        
        filtered.append(m)
    
    return filtered

@router.get("/motorcycles/my-listings")
async def get_my_listings(user: dict = Depends(require_approved_dealer)):
    """Get motorcycles listed by the current dealer"""
    motorcycles = await db.motorcycles.find(
        {"seller_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    return motorcycles

@router.put("/motorcycles/my-listings/{motorcycle_id}")
async def update_my_listing(motorcycle_id: str, data: MotorcycleUpdate, user: dict = Depends(require_approved_dealer)):
    """Update a dealer's own listing"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Verify ownership
    if motorcycle.get("seller_id") != user["id"]:
        raise HTTPException(status_code=403, detail="U kunt alleen uw eigen listings bewerken")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.motorcycles.update_one({"id": motorcycle_id}, {"$set": update_data})
    
    updated = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    return updated

@router.put("/motorcycles/my-listings/{motorcycle_id}/pause")
async def pause_my_listing(motorcycle_id: str, user: dict = Depends(require_approved_dealer)):
    """Pause a dealer's own listing (make it invisible)"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Verify ownership
    if motorcycle.get("seller_id") != user["id"]:
        raise HTTPException(status_code=403, detail="U kunt alleen uw eigen listings pauzeren")
    
    # Toggle pause state
    is_paused = motorcycle.get("is_paused", False)
    await db.motorcycles.update_one(
        {"id": motorcycle_id}, 
        {"$set": {"is_paused": not is_paused, "is_available": is_paused}}
    )
    
    return {"message": "Listing hervat" if is_paused else "Listing gepauzeerd", "is_paused": not is_paused}

@router.delete("/motorcycles/my-listings/{motorcycle_id}")
async def delete_my_listing(motorcycle_id: str, user: dict = Depends(require_approved_dealer)):
    """Delete a dealer's own listing"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Verify ownership
    if motorcycle.get("seller_id") != user["id"]:
        raise HTTPException(status_code=403, detail="U kunt alleen uw eigen listings verwijderen")
    
    # Delete associated bids
    await db.bids.delete_many({"motorcycle_id": motorcycle_id})
    
    # Delete the motorcycle
    await db.motorcycles.delete_one({"id": motorcycle_id})
    
    return {"message": "Listing verwijderd"}

@router.get("/motorcycles/{motorcycle_id}/public")
async def get_motorcycle_public(motorcycle_id: str):
    """Get motorcycle details without authentication (for sharing links)"""
    # First try to find with is_active=True, then try without the filter
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id, "is_active": True}, {"_id": 0})
    if not motorcycle:
        # Try without is_active filter (for older motorcycles without this field)
        motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Add default starting_price if missing
    if "starting_price" not in motorcycle or motorcycle["starting_price"] is None:
        motorcycle["starting_price"] = motorcycle.get("price", 0) * 0.8
    
    # Hide supplier price info from public view
    motorcycle.pop("original_price", None)
    motorcycle.pop("original_currency", None)
    motorcycle.pop("price_override", None)
    motorcycle.pop("price_override_amount", None)
    motorcycle.pop("price_override_active", None)
    
    return motorcycle

@router.get("/motorcycles/{motorcycle_id}/customer-share")
async def get_motorcycle_customer_share(motorcycle_id: str):
    """Get motorcycle details WITHOUT any prices for sharing with customers"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")

    # Remove ALL price-related fields
    price_fields = [
        "price", "starting_price", "purchase_price", "highest_bid",
        "original_price", "original_currency", "price_override",
        "price_override_amount", "price_override_active",
        "supplier_price_reduced", "supplier_price_reduction",
        "listing_fee_invoiced",
    ]
    for f in price_fields:
        motorcycle.pop(f, None)

    # Remove internal/sensitive fields
    internal_fields = [
        "visible_to_dealers", "visibility", "created_by",
        "highest_bidder_id", "foreign_dealer_id", "seller_id",
    ]
    for f in internal_fields:
        motorcycle.pop(f, None)

    return motorcycle

@router.get("/motorcycles/{motorcycle_id}")
async def get_motorcycle(motorcycle_id: str, user: dict = Depends(require_approved_dealer)):
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motorcycle not found")
    
    # VISIBILITY CHECK: Dealers can only see motorcycles they have access to
    if user.get("role") == "dealer":
        vis = motorcycle.get("visibility", "all")
        if vis == "selected":
            visible_to = motorcycle.get("visible_to_dealers", [])
            if user.get("id") not in visible_to:
                raise HTTPException(status_code=403, detail="U heeft geen toegang tot deze motor")
    
    # SECURITY: Foreign dealers can only see their own motorcycles
    is_foreign_dealer = user.get("is_foreign_dealer", False) or user.get("role") == "foreign_dealer"
    if is_foreign_dealer:
        if motorcycle.get("foreign_dealer_id") != user.get("id"):
            raise HTTPException(status_code=403, detail="U heeft geen toegang tot deze motor")
        # Strip selling price for foreign dealers
        motorcycle.pop("price", None)
        motorcycle.pop("purchase_price", None)
    
    # Track dealer view activity (only for Dutch dealers, not admins or foreign dealers)
    if user.get("role") != "admin" and not is_foreign_dealer:
        try:
            # Log the view
            view_log = {
                "id": str(uuid.uuid4()),
                "type": "motorcycle_view",
                "dealer_id": user["id"],
                "dealer_name": user.get("company_name", user.get("email", "Unknown")),
                "motorcycle_id": motorcycle_id,
                "motorcycle_brand": motorcycle.get("brand", ""),
                "motorcycle_model": motorcycle.get("model", ""),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            await db.activity_logs.insert_one(view_log)
            
            # Create admin notification (limit to 1 per dealer per motorcycle per hour)
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            recent_notification = await db.admin_notifications.find_one({
                "type": "dealer_view",
                "dealer_id": user["id"],
                "motorcycle_id": motorcycle_id,
                "created_at": {"$gte": one_hour_ago}
            })
            
            if not recent_notification:
                admin_notification = {
                    "id": str(uuid.uuid4()),
                    "type": "dealer_view",
                    "title": f"Motor Bekeken",
                    "message": f"{user.get('company_name', 'Dealer')} heeft {motorcycle.get('brand')} {motorcycle.get('model')} bekeken",
                    "dealer_id": user["id"],
                    "dealer_name": user.get("company_name", user.get("email")),
                    "motorcycle_id": motorcycle_id,
                    "is_read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.admin_notifications.insert_one(admin_notification)
        except Exception as e:
            logger.error(f"Failed to log activity: {e}")
    
    # Add default starting_price if missing
    if "starting_price" not in motorcycle or motorcycle["starting_price"] is None:
        motorcycle["starting_price"] = motorcycle.get("price", 0) * 0.8
    
    # Check if admin has manually set a price
    if motorcycle.get("price_override") and motorcycle.get("price_override_amount"):
        motorcycle["price"] = motorcycle["price_override_amount"]
        motorcycle["price_override_active"] = True
    elif motorcycle.get("original_currency") == "CHF" and motorcycle.get("original_price"):
        chf_eur_rate = await get_chf_to_eur_rate()
        margin = await get_chf_eur_margin()
        live_eur_price = convert_chf_to_eur(motorcycle["original_price"], chf_eur_rate, margin)
        stored_price = motorcycle.get("price", 0)
        # If stored price differs significantly from live, admin set a custom price
        if stored_price and abs(stored_price - live_eur_price) > 100:
            motorcycle["price_override_active"] = True
        else:
            motorcycle["price"] = live_eur_price
            motorcycle["starting_price"] = round(live_eur_price * 0.8, 2)
            motorcycle["exchange_rate"] = chf_eur_rate
            motorcycle["margin_percent"] = margin * 100
            motorcycle["price_updated_live"] = True
    
    # Hide supplier price info from non-admin users
    if user.get("role") != "admin":
        motorcycle.pop("original_price", None)
        motorcycle.pop("original_currency", None)
        motorcycle.pop("price_override", None)
        motorcycle.pop("price_override_amount", None)
        motorcycle.pop("price_override_active", None)
        motorcycle.pop("purchase_price", None)  # Inkoopprijs alleen voor admin
    
    return motorcycle


@router.put("/motorcycles/{motorcycle_id}/source")
async def update_motorcycle_source(motorcycle_id: str, data: dict = Body(...), user: dict = Depends(require_admin)):
    """Admin sets the source of a motorcycle (foreign dealer or private)"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    update_fields = {}
    
    if data.get("is_foreign_listing"):
        foreign_dealer_id = data.get("foreign_dealer_id")
        foreign_dealer = await db.users.find_one({"id": foreign_dealer_id}, {"_id": 0}) if foreign_dealer_id else None
        update_fields["is_foreign_listing"] = True
        update_fields["foreign_dealer_id"] = foreign_dealer_id
        update_fields["foreign_dealer_company"] = data.get("foreign_dealer_company", foreign_dealer.get("company_name", "") if foreign_dealer else "")
        if motorcycle.get("original_currency") == "CHF" or data.get("original_currency") == "CHF":
            update_fields["original_price"] = motorcycle.get("price", 0)
            update_fields["original_currency"] = "CHF"
    
    if data.get("is_private_source"):
        update_fields["is_private_source"] = True
    
    if update_fields:
        await db.motorcycles.update_one({"id": motorcycle_id}, {"$set": update_fields})
    
    return {"message": "Bron bijgewerkt", "source": update_fields}


@router.put("/motorcycles/{motorcycle_id}", response_model=Motorcycle)
async def update_motorcycle(motorcycle_id: str, data: MotorcycleUpdate, user: dict = Depends(require_admin)):
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motorcycle not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    # Track old price for price reduction notification
    old_price = motorcycle.get("price", 0)
    new_price = update_data.get("price")
    price_reduced = new_price is not None and new_price < old_price
    
    # If admin manually sets price, mark it as overridden and save original price
    if "price" in update_data:
        # Save original price if not already saved
        if not motorcycle.get("original_price"):
            update_data["original_price"] = motorcycle.get("price")
        
        # Mark as override if price differs from original
        original = motorcycle.get("original_price") or motorcycle.get("price")
        if update_data["price"] != original:
            update_data["price_override"] = True
            update_data["price_override_amount"] = update_data["price"]
            logger.info(f"Admin override price for motorcycle {motorcycle_id}: €{update_data['price']} (original: €{original})")
        
        # Auto-activate if motor was pending approval
        if motorcycle.get("is_pending_approval"):
            update_data["is_pending_approval"] = False
            update_data["is_available"] = True
            logger.info(f"Auto-activated motorcycle {motorcycle_id} after price update")
    
    # Also auto-activate if explicitly setting is_available to True
    if update_data.get("is_available") == True and motorcycle.get("is_pending_approval"):
        update_data["is_pending_approval"] = False
    
    if update_data:
        await db.motorcycles.update_one({"id": motorcycle_id}, {"$set": update_data})
    
    updated = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    
    # Send price reduction email to dealers who viewed this motorcycle
    if price_reduced and GMAIL_EMAIL and GMAIL_APP_PASSWORD:
        asyncio.create_task(send_price_reduction_emails(
            motorcycle_id=motorcycle_id,
            brand=motorcycle.get("brand", ""),
            model=motorcycle.get("model", ""),
            year=motorcycle.get("year", ""),
            old_price=old_price,
            new_price=new_price
        ))
        logger.info(f"Price reduction detected for {motorcycle.get('brand')} {motorcycle.get('model')}: €{old_price} -> €{new_price}")
    
    return updated

@router.delete("/motorcycles/{motorcycle_id}")
async def delete_motorcycle(motorcycle_id: str, user: dict = Depends(require_admin)):
    result = await db.motorcycles.delete_one({"id": motorcycle_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Motorcycle not found")
    return {"message": "Motorcycle deleted"}




# ============ BACKGROUND TASK: AUTO-DELETE EXPIRED MOTORCYCLES ============

async def auto_delete_expired_motorcycles():
    """Background task to delete motorcycles that have expired (not sold within time limit)"""
    while True:
        try:
            now = datetime.now(timezone.utc).isoformat()
            expired_motorcycles = await db.motorcycles.find({
                "auto_delete_at": {"$lte": now},
                "is_available": True
            }, {"_id": 0, "id": 1, "brand": 1, "model": 1, "year": 1}).to_list(100)
            
            for moto in expired_motorcycles:
                await db.motorcycles.delete_one({"id": moto["id"]})
                await db.notifications.delete_many({"motorcycle_id": moto["id"]})
                await db.bids.delete_many({"motorcycle_id": moto["id"]})
                await db.price_proposals.delete_many({"motorcycle_id": moto["id"]})
                logger.info(f"Auto-deleted expired motorcycle: {moto['brand']} {moto['model']} ({moto['year']})")
            
            if expired_motorcycles:
                try:
                    deleted_list = "<br>".join([f"• {m['brand']} {m['model']} ({m['year']})" for m in expired_motorcycles])
                    html_content = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #18181b; padding: 25px; text-align: center;">
                            <h1 style="color: white; margin: 0;">Auto-Verwijdering</h1>
                        </div>
                        <div style="padding: 30px; background: #fef3c7; border: 2px solid #f59e0b;">
                            <p>De volgende {len(expired_motorcycles)} motor(en) zijn automatisch verwijderd:</p>
                            <div style="padding: 15px; background: white; border-radius: 8px; margin: 15px 0;">
                                {deleted_list}
                            </div>
                        </div>
                    </div>
                    """
                    for admin_email in ADMIN_EMAILS_FULL:
                        await send_email(admin_email, f"{len(expired_motorcycles)} motor(en) automatisch verwijderd", html_content)
                except Exception as e:
                    logger.error(f"Failed to send auto-delete notification: {e}")
        except Exception as e:
            logger.error(f"Error in auto_delete_expired_motorcycles: {e}")
        await asyncio.sleep(300)
