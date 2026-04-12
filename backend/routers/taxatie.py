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

router = APIRouter(tags=["Taxatie"])

# ==================== TAXATIE INVOICES ====================
TAXATIE_BANK_NAME = "S. Milone"
TAXATIE_BANK_IBAN = "NL03SNSB8846497880"

@router.post("/taxatie/invoices")
async def create_taxatie_invoice(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Create a taxatie invoice - only for motoimportbv@gmail.com"""
    if current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_TAXATIE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    
    last = await db.taxatie_invoices.find_one(sort=[("invoice_number", -1)], projection={"_id": 0, "invoice_number": 1})
    next_num = (last["invoice_number"] + 1) if last else 1001
    
    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_number": next_num,
        "date": body.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "customer_name": body.get("customer_name", ""),
        "customer_address": body.get("customer_address", ""),
        "customer_city": body.get("customer_city", ""),
        "customer_phone": body.get("customer_phone", ""),
        "customer_email": body.get("customer_email", ""),
        "motorcycle_brand": body.get("motorcycle_brand", ""),
        "motorcycle_model": body.get("motorcycle_model", ""),
        "motorcycle_year": body.get("motorcycle_year", ""),
        "motorcycle_license_plate": body.get("motorcycle_license_plate", ""),
        "motorcycle_vin": body.get("motorcycle_vin", ""),
        "taxatie_value": body.get("taxatie_value", 0),
        "fee": body.get("fee", TAXATIE_DEFAULT_FEE),
        "btw_percentage": TAXATIE_BTW_PERCENTAGE,
        "include_extra_fee": body.get("include_extra_fee", False),
        "extra_fee": body.get("extra_fee", 60),
        "notes": body.get("notes", ""),
        "bank_name": TAXATIE_BANK_NAME,
        "bank_iban": TAXATIE_BANK_IBAN,
        "status": "open",
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.taxatie_invoices.insert_one(invoice)
    del invoice["_id"]
    return invoice

@router.get("/taxatie/invoices")
async def list_taxatie_invoices(current_user: dict = Depends(get_current_user)):
    if current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_TAXATIE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    invoices = await db.taxatie_invoices.find({}, {"_id": 0}).sort("invoice_number", -1).to_list(500)
    return invoices

@router.get("/taxatie/invoices/{invoice_id}")
async def get_taxatie_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_TAXATIE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    invoice = await db.taxatie_invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Factuur niet gevonden")
    return invoice

@router.put("/taxatie/invoices/{invoice_id}")
async def update_taxatie_invoice(invoice_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    if current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_TAXATIE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    update_fields = {}
    for field in ["status", "notes", "fee", "btw_percentage", "include_extra_fee", "extra_fee", "taxatie_value", "customer_name", "customer_address", "customer_city", "customer_phone", "customer_email", "motorcycle_brand", "motorcycle_model", "motorcycle_year", "motorcycle_license_plate", "motorcycle_vin", "date"]:
        if field in body:
            update_fields[field] = body[field]
    if not update_fields:
        raise HTTPException(status_code=400, detail="Geen velden om bij te werken")
    result = await db.taxatie_invoices.update_one({"id": invoice_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Factuur niet gevonden")
    return {"status": "updated"}

@router.delete("/taxatie/invoices/{invoice_id}")
async def delete_taxatie_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_TAXATIE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    result = await db.taxatie_invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Factuur niet gevonden")
    return {"status": "deleted"}

# ============ GOOGLE MOTOREN (DEALER SEO LISTINGS) ============


@router.post("/google-motors/checkout")
async def create_google_motor_checkout(request: Request, body: dict = Body(...), current_user: dict = Depends(require_approved_dealer)):
    """Create Stripe checkout for Google Motors subscription"""
    plan = body.get("plan")  # "per_motor" or "monthly"
    origin_url = body.get("origin_url", str(request.base_url).rstrip("/"))
    
    if plan not in ["per_motor", "monthly"]:
        raise HTTPException(status_code=400, detail="Ongeldig plan")
    
    amount = GOOGLE_MOTOR_PRICE_PER_MOTOR if plan == "per_motor" else GOOGLE_MOTOR_MONTHLY_PRICE
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{origin_url}/dealer/google-motors?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/dealer/google-motors?payment=cancelled"
    
    checkout_req = CheckoutSessionRequest(
        amount=amount,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "google_motor_subscription",
            "plan": plan,
            "dealer_id": current_user["id"],
            "dealer_email": current_user.get("email", ""),
        },
        payment_methods=["ideal"],
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)
    
    sub_id = str(uuid.uuid4())
    await db.google_motor_subscriptions.insert_one({
        "id": sub_id,
        "dealer_id": current_user["id"],
        "dealer_email": current_user.get("email", ""),
        "plan": plan,
        "amount": amount,
        "session_id": session.session_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"checkout_url": session.url, "session_id": session.session_id, "subscription_id": sub_id}

@router.get("/google-motors/subscription")
async def get_google_motor_subscription(current_user: dict = Depends(require_approved_dealer)):
    """Get current subscription status for dealer"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check active monthly subscription
    monthly = await db.google_motor_subscriptions.find_one(
        {"dealer_id": current_user["id"], "plan": "monthly", "status": "active", "expires_at": {"$gt": now}},
        {"_id": 0}
    )
    
    # Count active per-motor credits
    per_motor_credits = await db.google_motor_subscriptions.count_documents(
        {"dealer_id": current_user["id"], "plan": "per_motor", "status": "active", "used": {"$ne": True}}
    )
    
    # Count total active motors
    active_motors = await db.google_motors.count_documents(
        {"dealer_id": current_user["id"], "status": {"$in": ["pending", "approved"]}}
    )
    
    return {
        "has_monthly": monthly is not None,
        "monthly_expires": monthly.get("expires_at") if monthly else None,
        "per_motor_credits": per_motor_credits,
        "active_motors": active_motors,
    }

@router.get("/google-motors/check-payment/{session_id}")
async def check_google_motor_payment(session_id: str, current_user: dict = Depends(require_approved_dealer)):
    """Check payment status for Google Motors subscription"""
    sub = await db.google_motor_subscriptions.find_one(
        {"session_id": session_id, "dealer_id": current_user["id"]},
        {"_id": 0}
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Abonnement niet gevonden")
    
    if sub.get("status") == "active":
        return {"status": "active", "plan": sub["plan"]}
    
    # Check with Stripe
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    status = await stripe_checkout.get_checkout_status(session_id)
    
    if status.payment_status == "paid" and sub.get("status") != "active":
        update = {"status": "active", "paid_at": datetime.now(timezone.utc).isoformat()}
        if sub["plan"] == "monthly":
            update["expires_at"] = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        await db.google_motor_subscriptions.update_one({"session_id": session_id}, {"$set": update})
        return {"status": "active", "plan": sub["plan"]}
    
    return {"status": sub.get("status", "pending"), "plan": sub["plan"]}

@router.post("/google-motors")
async def create_google_motor(data: GoogleMotorCreate, current_user: dict = Depends(require_approved_dealer)):
    """Create a new Google Motor listing"""
    now = datetime.now(timezone.utc)
    dealer_id = current_user["id"]
    
    # Check if dealer has active subscription
    has_monthly = await db.google_motor_subscriptions.find_one(
        {"dealer_id": dealer_id, "plan": "monthly", "status": "active", "expires_at": {"$gt": now.isoformat()}}
    )
    
    has_credit = None
    if not has_monthly:
        has_credit = await db.google_motor_subscriptions.find_one(
            {"dealer_id": dealer_id, "plan": "per_motor", "status": "active", "used": {"$ne": True}}
        )
        if not has_credit:
            raise HTTPException(status_code=402, detail="Geen actief abonnement. Koop eerst een abonnement.")
    
    motor_id = str(uuid.uuid4())
    expires_at = (now + timedelta(days=7)).isoformat() if not has_monthly else has_monthly.get("expires_at", (now + timedelta(days=30)).isoformat())
    
    motor = {
        "id": motor_id,
        "dealer_id": dealer_id,
        "dealer_email": current_user.get("email", ""),
        "dealer_company": current_user.get("company_name", ""),
        "dealer_phone": current_user.get("phone", ""),
        "dealer_city": current_user.get("city", ""),
        "dealer_contact_person": current_user.get("contact_person", ""),
        "brand": data.brand,
        "model": data.model,
        "year": data.year,
        "price": data.price,
        "mileage": data.mileage,
        "description": data.description,
        "images": data.images,
        "color": data.color,
        "condition": data.condition,
        "status": "pending",
        "plan": "monthly" if has_monthly else "per_motor",
        "expires_at": expires_at,
        "created_at": now.isoformat(),
    }
    
    await db.google_motors.insert_one(motor)
    
    # Use up a per-motor credit if applicable
    if has_credit and not has_monthly:
        await db.google_motor_subscriptions.update_one(
            {"id": has_credit["id"]}, {"$set": {"used": True, "motor_id": motor_id}}
        )
    
    # Notify admin
    try:
        html = f"""
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
            <div style="background:#dc2626;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
                <h1 style="color:white;margin:0;">Nieuwe Google Motor</h1>
            </div>
            <div style="padding:30px;background:white;border:1px solid #eee;">
                <p>Er is een nieuwe motor aangemeld voor Google:</p>
                <table style="width:100%;border-collapse:collapse;">
                    <tr><td style="padding:8px;font-weight:bold;">Dealer:</td><td>{current_user.get('company_name','')}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;">Motor:</td><td>{data.brand} {data.model} ({data.year})</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;">Prijs:</td><td>&euro;{data.price:,.0f}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;">Plan:</td><td>{'Maandelijks' if has_monthly else 'Per motor'}</td></tr>
                </table>
                <p style="margin-top:20px;">Ga naar het admin panel om deze motor goed te keuren.</p>
            </div>
        </div>
        """
        await send_email(ALLOWED_ADMIN_EMAIL_GOOGLE, f"Nieuwe Google Motor: {data.brand} {data.model}", html)
    except Exception as e:
        logger.error(f"Failed to send Google motor notification: {e}")
    
    motor.pop("_id", None)
    return motor

@router.get("/google-motors/my")
async def get_my_google_motors(current_user: dict = Depends(require_approved_dealer)):
    motors = await db.google_motors.find({"dealer_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return motors

@router.delete("/google-motors/{motor_id}")
async def delete_google_motor(motor_id: str, current_user: dict = Depends(require_approved_dealer)):
    result = await db.google_motors.delete_one({"id": motor_id, "dealer_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    return {"status": "deleted"}

@router.get("/google-motors/pending")
async def get_pending_google_motors(current_user: dict = Depends(require_admin)):
    if current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_GOOGLE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    motors = await db.google_motors.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return motors

@router.get("/google-motors/all")
async def get_all_google_motors(current_user: dict = Depends(require_admin)):
    if current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_GOOGLE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    motors = await db.google_motors.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return motors

@router.post("/google-motors/{motor_id}/approve")
async def approve_google_motor(motor_id: str, request: Request, current_user: dict = Depends(require_admin)):
    if current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_GOOGLE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    result = await db.google_motors.update_one(
        {"id": motor_id, "status": "pending"},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat(), "approved_by": current_user["email"]}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Motor niet gevonden of al verwerkt")
    
    motor = await db.google_motors.find_one({"id": motor_id}, {"_id": 0})
    if motor:
        import asyncio
        asyncio.create_task(generate_social_media_content(motor_id, motor, request))
        try:
            motor_url = f"{PRODUCTION_BASE_URL}/motor/{motor_id}"
            html = f"""<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
                <div style="background:#16a34a;padding:20px;text-align:center;border-radius:8px 8px 0 0;"><h1 style="color:white;margin:0;">Motor Goedgekeurd!</h1></div>
                <div style="padding:30px;background:white;border:1px solid #eee;">
                    <p>Goed nieuws! Uw motor is goedgekeurd en staat nu live op Google:</p>
                    <p style="font-size:18px;font-weight:bold;">{motor['brand']} {motor['model']} ({motor['year']}) - &euro;{motor['price']:,.0f}</p>
                    <p>De motor is nu zichtbaar voor iedereen op internet.</p>
                    <p style="margin-top:15px;">We hebben ook een <strong>social media post</strong> voor u gegenereerd! Ga naar uw Google Motoren pagina om de tekst en afbeelding te delen op Facebook en Instagram.</p>
                    <a href="{motor_url}" style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:10px;">Bekijk op Google</a>
                </div></div>"""
            await send_email(motor["dealer_email"], f"Motor goedgekeurd: {motor['brand']} {motor['model']}", html)
        except Exception as e:
            logger.error(f"Failed to send approval email: {e}")
    return {"status": "approved"}

@router.post("/google-motors/{motor_id}/reject")
async def reject_google_motor(motor_id: str, body: dict = Body({}), current_user: dict = Depends(require_admin)):
    if current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_GOOGLE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    reason = body.get("reason", "")
    result = await db.google_motors.update_one(
        {"id": motor_id, "status": "pending"},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat(), "reject_reason": reason}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Motor niet gevonden of al verwerkt")
    return {"status": "rejected"}

@router.get("/google-motors/social-image/{motor_id}")
async def get_social_image(motor_id: str):
    import base64
    motor = await db.google_motors.find_one({"id": motor_id}, {"_id": 0, "social_image_data": 1})
    if not motor or not motor.get("social_image_data"):
        raise HTTPException(status_code=404, detail="Afbeelding niet gevonden")
    image_data = base64.b64decode(motor["social_image_data"])
    return Response(content=image_data, media_type="image/jpeg", headers={
        "Content-Disposition": f"inline; filename=moto-import-{motor_id}.jpg",
        "Cache-Control": "public, max-age=86400",
    })

# ============ PUBLIC SEO ENDPOINTS (NO AUTH) ============

@router.get("/public/motors")
async def get_public_motors(brand: str = None, sort_by: str = "newest"):
    """Public endpoint: get all approved Google Motors for SEO"""
    now = datetime.now(timezone.utc).isoformat()
    query = {"status": "approved", "expires_at": {"$gt": now}}
    if brand:
        query["brand"] = brand
    
    sort_field = "created_at"
    sort_dir = -1
    if sort_by == "price_low":
        sort_field = "price"
        sort_dir = 1
    elif sort_by == "price_high":
        sort_field = "price"
        sort_dir = -1
    
    motors = await db.google_motors.find(query, {
        "_id": 0, "id": 1, "brand": 1, "model": 1, "year": 1, "price": 1,
        "mileage": 1, "images": 1, "color": 1, "condition": 1, "description": 1,
        "dealer_company": 1, "dealer_city": 1, "created_at": 1,
    }).sort(sort_field, sort_dir).to_list(500)
    return motors

@router.get("/public/motors/brands")
async def get_public_motor_brands():
    """Public endpoint: get distinct brands from approved motors"""
    now = datetime.now(timezone.utc).isoformat()
    brands = await db.google_motors.distinct("brand", {"status": "approved", "expires_at": {"$gt": now}})
    return sorted(brands)

@router.get("/public/motors/{motor_id}")
async def get_public_motor_detail(motor_id: str):
    """Public endpoint: get single motor detail for SEO"""
    now = datetime.now(timezone.utc).isoformat()
    motor = await db.google_motors.find_one(
        {"id": motor_id, "status": "approved", "expires_at": {"$gt": now}},
        {"_id": 0}
    )
    if not motor:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Return all dealer info for public display
    return {
        "id": motor["id"],
        "brand": motor["brand"],
        "model": motor["model"],
        "year": motor["year"],
        "price": motor["price"],
        "mileage": motor.get("mileage", 0),
        "description": motor.get("description", ""),
        "images": motor.get("images", []),
        "color": motor.get("color", ""),
        "condition": motor.get("condition", ""),
        "dealer_company": motor.get("dealer_company", ""),
        "dealer_email": motor.get("dealer_email", ""),
        "dealer_phone": motor.get("dealer_phone", ""),
        "dealer_city": motor.get("dealer_city", ""),
        "dealer_contact_person": motor.get("dealer_contact_person", ""),
        "created_at": motor.get("created_at", ""),
    }

@router.post("/public/motors/{motor_id}/interest")
async def express_interest_public_motor(motor_id: str, body: dict = Body(...)):
    """Public: someone expresses interest in a motor, notify admin"""
    motor = await db.google_motors.find_one({"id": motor_id, "status": "approved"}, {"_id": 0})
    if not motor:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    name = body.get("name", "Onbekend")
    email = body.get("email", "")
    phone = body.get("phone", "")
    message = body.get("message", "")
    
    if not email and not phone:
        raise HTTPException(status_code=400, detail="Email of telefoonnummer is verplicht")
    
    # Store lead
    lead_id = str(uuid.uuid4())
    await db.google_motor_leads.insert_one({
        "id": lead_id,
        "motor_id": motor_id,
        "motor_brand": motor["brand"],
        "motor_model": motor["model"],
        "dealer_id": motor["dealer_id"],
        "dealer_email": motor["dealer_email"],
        "visitor_name": name,
        "visitor_email": email,
        "visitor_phone": phone,
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Notify admin (motoimportbv@gmail.com)
    try:
        html = f"""
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
            <div style="background:#dc2626;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
                <h1 style="color:white;margin:0;">Nieuwe Interesse - Google Motor</h1>
            </div>
            <div style="padding:30px;background:white;border:1px solid #eee;">
                <p>Iemand heeft interesse getoond in een motor op Google:</p>
                <table style="width:100%;border-collapse:collapse;margin:15px 0;">
                    <tr><td style="padding:8px;font-weight:bold;width:120px;">Motor:</td><td>{motor['brand']} {motor['model']} ({motor['year']})</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;">Dealer:</td><td>{motor.get('dealer_company','')}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;">Naam:</td><td>{name}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;">Email:</td><td>{email}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;">Telefoon:</td><td>{phone}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;">Bericht:</td><td>{message}</td></tr>
                </table>
            </div>
        </div>
        """
        await send_email(ALLOWED_ADMIN_EMAIL_GOOGLE, f"Interesse: {motor['brand']} {motor['model']} - {name}", html)
    except Exception as e:
        logger.error(f"Failed to send interest email: {e}")
    
    return {"status": "ok", "message": "Uw interesse is verstuurd!"}





# ============ BPM VERMINDERING TAXATIE (MOTORFIETSEN) ============

def calculate_forfaitair_percentage(months: int) -> float:
    """Forfaitaire afschrijvingstabel Belastingdienst voor motorfietsen"""
    if months < 1:
        return 0.0
    elif months < 3:
        return 12.0 + (months - 1) * 4.0
    elif months < 5:
        return 20.0 + (months - 3) * 3.5
    elif months < 9:
        return 27.0 + (months - 5) * 1.5
    elif months < 18:
        return 33.0 + (months - 9) * 1.0
    elif months < 30:
        return 42.0 + (months - 18) * 0.75
    elif months < 42:
        return 51.0 + (months - 30) * 0.5
    elif months < 54:
        return 57.0 + (months - 42) * 0.42
    elif months < 66:
        return 62.0 + (months - 54) * 0.42
    elif months < 78:
        return 67.0 + (months - 66) * 0.42
    elif months < 90:
        return 72.0 + (months - 78) * 0.25
    elif months < 102:
        return 75.0 + (months - 90) * 0.25
    elif months < 114:
        return 78.0 + (months - 102) * 0.25
    else:
        return min(81.0 + (months - 114) * 0.19, 100.0)

def calculate_bruto_bpm(netto_catalogusprijs: float) -> float:
    """BPM tarief motorfiets (2025/2026)"""
    if netto_catalogusprijs <= 0:
        return 0.0
    if netto_catalogusprijs <= 2133:
        return round(netto_catalogusprijs * 0.096, 2)
    return round(netto_catalogusprijs * 0.194 - 210, 2)

def calculate_bpm_result(data_dict: dict) -> dict:
    """Calculate all BPM values from form data"""
    netto_cat = data_dict.get("netto_catalogusprijs", 0) or 0
    bruto_bpm = calculate_bruto_bpm(netto_cat)

    # Forfaitair
    first_reg = data_dict.get("first_registration_date", "")
    forfaitair_pct = 0.0
    months_age = 0
    if first_reg:
        try:
            reg_date = datetime.fromisoformat(first_reg)
            now = datetime.now(timezone.utc)
            months_age = (now.year - reg_date.year) * 12 + (now.month - reg_date.month)
            if months_age < 0:
                months_age = 0
            forfaitair_pct = calculate_forfaitair_percentage(months_age)
        except Exception:
            pass
    forfaitair_bpm = round(bruto_bpm * (1 - forfaitair_pct / 100), 2)

    # Koerslijst
    koerslijst_waarde = data_dict.get("koerslijst_waarde", 0) or 0
    consumentenprijs = data_dict.get("consumentenprijs", 0) or 0
    koerslijst_pct = 0.0
    if consumentenprijs > 0 and koerslijst_waarde > 0:
        koerslijst_pct = round(((consumentenprijs - koerslijst_waarde) / consumentenprijs) * 100, 2)
        koerslijst_pct = max(0, min(koerslijst_pct, 100))
    koerslijst_bpm = round(bruto_bpm * (1 - koerslijst_pct / 100), 2)

    # Taxatierapport
    taxatie_waarde = data_dict.get("taxatie_inruil_waarde", 0) or 0
    taxatie_pct = 0.0
    if consumentenprijs > 0 and taxatie_waarde > 0:
        taxatie_pct = round(((consumentenprijs - taxatie_waarde) / consumentenprijs) * 100, 2)
        taxatie_pct = max(0, min(taxatie_pct, 100))
    taxatie_bpm = round(bruto_bpm * (1 - taxatie_pct / 100), 2)

    # Schade aftrek (31% van herstelkosten)
    damage_items = data_dict.get("damage_items", [])
    total_herstelkosten = sum(item.get("cost", 0) for item in damage_items if item.get("checked"))
    has_damage = total_herstelkosten > 0
    schade_aftrek = round(total_herstelkosten * 0.31, 2) if has_damage else 0

    # Determine best method
    options = {
        "forfaitair": forfaitair_bpm,
        "koerslijst": koerslijst_bpm if koerslijst_pct > 0 else 999999,
        "taxatierapport": taxatie_bpm if taxatie_pct > 0 else 999999,
    }
    beste_methode = min(options, key=options.get)
    laagste_bpm = options[beste_methode]
    if laagste_bpm == 999999:
        beste_methode = "forfaitair"
        laagste_bpm = forfaitair_bpm

    netto_bpm = max(0, round(laagste_bpm - schade_aftrek, 2))
    bpm_vermindering = round(bruto_bpm - netto_bpm, 2)

    return {
        "bruto_bpm": bruto_bpm,
        "months_age": months_age,
        "forfaitair_percentage": round(forfaitair_pct, 2),
        "forfaitair_bpm": forfaitair_bpm,
        "koerslijst_percentage": round(koerslijst_pct, 2),
        "koerslijst_bpm": koerslijst_bpm,
        "taxatie_percentage": round(taxatie_pct, 2),
        "taxatie_bpm": taxatie_bpm,
        "has_damage": has_damage,
        "herstelkosten": total_herstelkosten,
        "schade_aftrek": schade_aftrek,
        "beste_methode": beste_methode,
        "netto_bpm": netto_bpm,
        "bpm_vermindering": bpm_vermindering,
    }

@router.post("/taxatie-programma")
async def create_taxatie(data: TaxatieCreate, current_user: dict = Depends(require_admin)):
    if current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")

    taxatie_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    data_dict = data.dict()
    bpm = calculate_bpm_result(data_dict)

    scores = [data.score_engine, data.score_frame, data.score_paint, data.score_tires,
              data.score_brakes, data.score_electrics, data.score_exhaust,
              data.score_suspension, data.score_chain_drive, data.score_general]
    avg_score = round(sum(scores) / len(scores), 1)
    condition_label = "Slecht"
    if avg_score >= 4.5: condition_label = "Uitstekend"
    elif avg_score >= 3.5: condition_label = "Goed"
    elif avg_score >= 2.5: condition_label = "Redelijk"
    elif avg_score >= 1.5: condition_label = "Matig"

    doc = {
        "id": taxatie_id,
        "taxatie_nummer": f"BPM-{now.strftime('%Y%m%d')}-{taxatie_id[:4].upper()}",
        **data_dict,
        **bpm,
        "average_score": avg_score,
        "condition_label": condition_label,
        "status": "concept",
        "created_at": now.isoformat(),
        "created_by": current_user["email"],
    }

    await db.taxatie_programma.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.get("/taxatie-programma")
async def get_taxaties(current_user: dict = Depends(require_admin)):
    if current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    return await db.taxatie_programma.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

@router.get("/taxatie-programma/{taxatie_id}")
async def get_taxatie(taxatie_id: str, current_user: dict = Depends(require_admin)):
    if current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    doc = await db.taxatie_programma.find_one({"id": taxatie_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return doc

@router.put("/taxatie-programma/{taxatie_id}")
async def update_taxatie(taxatie_id: str, data: TaxatieCreate, current_user: dict = Depends(require_admin)):
    if current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")

    data_dict = data.dict()
    bpm = calculate_bpm_result(data_dict)

    scores = [data.score_engine, data.score_frame, data.score_paint, data.score_tires,
              data.score_brakes, data.score_electrics, data.score_exhaust,
              data.score_suspension, data.score_chain_drive, data.score_general]
    avg_score = round(sum(scores) / len(scores), 1)
    condition_label = "Slecht"
    if avg_score >= 4.5: condition_label = "Uitstekend"
    elif avg_score >= 3.5: condition_label = "Goed"
    elif avg_score >= 2.5: condition_label = "Redelijk"
    elif avg_score >= 1.5: condition_label = "Matig"

    update = {
        **data_dict,
        **bpm,
        "average_score": avg_score,
        "condition_label": condition_label,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db.taxatie_programma.update_one({"id": taxatie_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return await db.taxatie_programma.find_one({"id": taxatie_id}, {"_id": 0})

@router.post("/taxatie-programma/{taxatie_id}/finalize")
async def finalize_taxatie(taxatie_id: str, current_user: dict = Depends(require_admin)):
    if current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    result = await db.taxatie_programma.update_one(
        {"id": taxatie_id},
        {"$set": {"status": "definitief", "finalized_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return {"status": "definitief"}

@router.delete("/taxatie-programma/{taxatie_id}")
async def delete_taxatie(taxatie_id: str, current_user: dict = Depends(require_admin)):
    if current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    result = await db.taxatie_programma.delete_one({"id": taxatie_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return {"status": "deleted"}


