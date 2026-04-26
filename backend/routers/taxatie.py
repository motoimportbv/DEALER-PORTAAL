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
TAXATIE_BANK_IBAN = "NL84BUNQ2159356875"

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
        "extra_fee_no_btw": body.get("extra_fee_no_btw", True),
        "invoice_type": body.get("invoice_type", "both"),
        "taxatie_items": body.get("taxatie_items", []),
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
    for field in ["status", "notes", "fee", "btw_percentage", "include_extra_fee", "extra_fee", "extra_fee_no_btw", "invoice_type", "taxatie_items", "taxatie_value", "customer_name", "customer_address", "customer_city", "customer_phone", "customer_email", "motorcycle_brand", "motorcycle_model", "motorcycle_year", "motorcycle_license_plate", "motorcycle_vin", "date"]:
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
    checklist_total = sum(item.get("cost", 0) for item in damage_items if item.get("checked"))
    manual_damage = data_dict.get("manual_damage_amount")
    total_herstelkosten = manual_damage if manual_damage is not None else checklist_total
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


@router.get("/taxatie-programma/{taxatie_id}/pdf")
async def export_taxatie_pdf(taxatie_id: str, current_user: dict = Depends(require_admin)):
    """Generate a BPM Import Rapport PDF matching Belastingdienst format"""
    if current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    
    doc = await db.taxatie_programma.find_one({"id": taxatie_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
    import io
    
    buffer = io.BytesIO()
    pdf = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=15*mm, bottomMargin=15*mm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title2', parent=styles['Title'], fontSize=16, spaceAfter=4*mm, textColor=colors.HexColor('#1a1a1a'))
    subtitle_style = ParagraphStyle('Subtitle2', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#555555'), spaceAfter=6*mm)
    section_style = ParagraphStyle('Section2', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor('#dc2626'), spaceBefore=6*mm, spaceAfter=3*mm, borderPadding=2)
    normal = ParagraphStyle('Normal2', parent=styles['Normal'], fontSize=9, leading=13)
    bold_style = ParagraphStyle('Bold2', parent=normal, fontName='Helvetica-Bold')
    small_style = ParagraphStyle('Small2', parent=normal, fontSize=8, textColor=colors.HexColor('#666666'))
    right_bold = ParagraphStyle('RightBold', parent=bold_style, alignment=TA_RIGHT)
    
    elements = []
    
    def fmt_eur(val):
        if val is None: return "-"
        return f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    def fmt_pct(val):
        if val is None: return "-"
        return f"{val:.3f}%".replace(".", ",")
    
    # Header
    elements.append(Paragraph("BPM Import Rapport", title_style))
    elements.append(Paragraph(f"Moto Import B.V. | Rapportnummer: {doc.get('taxatie_nummer', '-')}", subtitle_style))
    
    # 1. Voertuiggegevens
    elements.append(Paragraph("1. Voertuiggegevens", section_style))
    
    vin = doc.get("vin_number", "-")
    bouwjaar = doc.get("bouwjaar", "-")
    first_reg = doc.get("first_registration_date", "-")
    if first_reg and len(first_reg) >= 10:
        try:
            d = datetime.fromisoformat(first_reg)
            first_reg = d.strftime("%d-%m-%Y")
        except: pass
    if bouwjaar and len(bouwjaar) >= 10:
        try:
            d = datetime.fromisoformat(bouwjaar)
            bouwjaar = d.strftime("%d-%m-%Y")
        except: pass
    
    vehicle_data = [
        ["Merk", doc.get("brand", "-"), "Model", doc.get("model", "-")],
        ["Chassisnummer (VIN)", vin, "Brandstof", doc.get("fuel_type", "Benzine")],
        ["Datum 1e toelating", first_reg, "Bouwjaar", bouwjaar],
        ["Km-stand", str(doc.get("mileage", 0)), "Vermogen", f"{doc.get('power_kw', '-')} kW"],
        ["Cilinderinhoud", doc.get("cylinder_capacity", "-"), "Kleur", doc.get("color", "-")],
    ]
    
    t = Table(vehicle_data, colWidths=[35*mm, 50*mm, 35*mm, 50*mm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#f5f5f5')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e5e5')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4*mm))
    
    # 2. Bruto BPM Berekening
    elements.append(Paragraph("2. Bruto BPM Berekening", section_style))
    
    netto_cat = doc.get("netto_catalogusprijs", 0) or 0
    bruto_bpm = doc.get("bruto_bpm", 0) or 0
    
    if netto_cat > 2133:
        bpm_pct = "19,4%"
        brandstof_toeslag = round(netto_cat * 0.194, 2)
        energie_label = -210
    else:
        bpm_pct = "9,6%"
        brandstof_toeslag = round(netto_cat * 0.096, 2)
        energie_label = 0
    
    bpm_data = [
        [Paragraph("<b>Omschrijving</b>", normal), Paragraph("<b>Bedrag</b>", right_bold)],
        ["Netto catalogusprijs (basisuitvoering)", f"€ {fmt_eur(netto_cat)}"],
        ["Accessoires en opties", "€ 0,00"],
        [f"BPM-percentage ({bpm_pct})", f"€ {fmt_eur(brandstof_toeslag)}"],
        ["Energielabeltoeslag", f"€ {fmt_eur(energie_label)}"],
        [Paragraph("<b>Bruto BPM</b>", bold_style), Paragraph(f"<b>€ {fmt_eur(bruto_bpm)}</b>", right_bold)],
    ]
    
    t = Table(bpm_data, colWidths=[120*mm, 50*mm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e5e5')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc2626')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fef2f2')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4*mm))
    
    # 3. Afschrijving / Vermindering
    elements.append(Paragraph("3. Afschrijvingsmethode (voordeligste)", section_style))
    
    beste = doc.get("beste_methode", "forfaitair")
    methode_labels = {"forfaitair": "Forfaitaire afschrijvingstabel", "koerslijst": "Koerslijstmethode", "taxatierapport": "Taxatierapport"}
    
    afschr_data = [
        [Paragraph("<b>Methode</b>", normal), Paragraph("<b>Afschrijving</b>", normal), Paragraph("<b>Rest BPM</b>", right_bold)],
        [
            f"{'>>> ' if beste == 'forfaitair' else ''}Forfaitaire tabel ({doc.get('months_age', 0)} mnd)",
            fmt_pct(doc.get("forfaitair_percentage", 0)),
            f"€ {fmt_eur(doc.get('forfaitair_bpm', 0))}"
        ],
    ]
    if doc.get("koerslijst_percentage", 0) > 0:
        afschr_data.append([
            f"{'>>> ' if beste == 'koerslijst' else ''}Koerslijstmethode",
            fmt_pct(doc.get("koerslijst_percentage", 0)),
            f"€ {fmt_eur(doc.get('koerslijst_bpm', 0))}"
        ])
    if doc.get("taxatie_percentage", 0) > 0:
        afschr_data.append([
            f"{'>>> ' if beste == 'taxatierapport' else ''}Taxatierapport",
            fmt_pct(doc.get("taxatie_percentage", 0)),
            f"€ {fmt_eur(doc.get('taxatie_bpm', 0))}"
        ])
    
    t = Table(afschr_data, colWidths=[90*mm, 40*mm, 40*mm])
    ts = [
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e5e5')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#18181b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]
    # Highlight the best method row
    for i, row in enumerate(afschr_data[1:], 1):
        if row[0].startswith(">>>"):
            ts.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#dcfce7')))
            ts.append(('FONTNAME', (0, i), (-1, i), 'Helvetica-Bold'))
    t.setStyle(TableStyle(ts))
    # Clean up >>> markers
    for i, row in enumerate(afschr_data):
        if isinstance(row[0], str):
            afschr_data[i][0] = row[0].replace(">>> ", "")
    
    elements.append(t)
    elements.append(Spacer(1, 2*mm))
    elements.append(Paragraph(f"Gekozen methode: <b>{methode_labels.get(beste, beste)}</b> ({fmt_pct(doc.get(f'{beste}_percentage' if beste != 'taxatierapport' else 'taxatie_percentage', 0))} afschrijving)", small_style))
    elements.append(Spacer(1, 4*mm))
    
    # 4. Schade en Herstelkosten
    herstelkosten = doc.get("herstelkosten", 0) or 0
    schade_aftrek = doc.get("schade_aftrek", 0) or 0
    
    if herstelkosten > 0:
        elements.append(Paragraph("4. Schade & Herstelkosten (31% aftrek)", section_style))
        
        damage_rows = [[Paragraph("<b>Onderdeel</b>", normal), Paragraph("<b>Kosten</b>", right_bold)]]
        damage_items = doc.get("damage_items", [])
        checked_items = [i for i in damage_items if i.get("checked")]
        
        if checked_items:
            for item in checked_items:
                damage_rows.append([item.get("name", "-"), f"€ {fmt_eur(item.get('cost', 0))}"])
        
        damage_rows.append([Paragraph("<b>Totaal herstelkosten</b>", bold_style), Paragraph(f"<b>€ {fmt_eur(herstelkosten)}</b>", right_bold)])
        damage_rows.append([Paragraph("<b>BPM-aftrek (31%)</b>", bold_style), Paragraph(f"<b>- € {fmt_eur(schade_aftrek)}</b>", right_bold)])
        
        t = Table(damage_rows, colWidths=[120*mm, 50*mm])
        t.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e5e5')),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d97706')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, -2), (-1, -1), colors.HexColor('#fef3c7')),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)
        
        if doc.get("damage_notes"):
            elements.append(Spacer(1, 2*mm))
            elements.append(Paragraph(f"Toelichting: {doc['damage_notes']}", small_style))
        elements.append(Spacer(1, 4*mm))
    
    # 5. Eindberekening
    section_num = "5" if herstelkosten > 0 else "4"
    elements.append(Paragraph(f"{section_num}. Eindberekening - Te betalen BPM", section_style))
    
    laagste_label = methode_labels.get(beste, beste)
    laagste_bpm_val = doc.get(f"{beste}_bpm" if beste != "taxatierapport" else "taxatie_bpm", 0)
    netto_bpm = doc.get("netto_bpm", 0) or 0
    
    final_data = [
        [Paragraph("<b>Omschrijving</b>", normal), Paragraph("<b>Bedrag</b>", right_bold)],
        ["Bruto BPM", f"€ {fmt_eur(bruto_bpm)}"],
        [f"Afschrijving ({laagste_label})", f"- € {fmt_eur(bruto_bpm - laagste_bpm_val)}"],
        ["BPM na afschrijving", f"€ {fmt_eur(laagste_bpm_val)}"],
    ]
    if herstelkosten > 0:
        final_data.append(["Schade-aftrek (31% van herstelkosten)", f"- € {fmt_eur(schade_aftrek)}"])
    final_data.append([
        Paragraph("<b>Te betalen BPM</b>", ParagraphStyle('FinalBold', parent=bold_style, fontSize=11)),
        Paragraph(f"<b>€ {fmt_eur(netto_bpm)}</b>", ParagraphStyle('FinalRight', parent=right_bold, fontSize=11))
    ])
    
    t = Table(final_data, colWidths=[120*mm, 50*mm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -2), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e5e5')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#16a34a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#dcfce7')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 6*mm))
    
    # Footer
    now = datetime.now(timezone.utc)
    # Use admin-overridden report_date if present, otherwise now
    report_date_str = doc.get('report_date') or now.strftime('%d-%m-%Y')
    if doc.get('report_date'):
        try:
            report_date_str = datetime.fromisoformat(doc['report_date']).strftime('%d-%m-%Y')
        except Exception:
            try:
                report_date_str = datetime.strptime(doc['report_date'], '%Y-%m-%d').strftime('%d-%m-%Y')
            except Exception:
                report_date_str = doc['report_date']
    elements.append(Paragraph(f"Opgesteld door: Moto Import B.V. | Datum: {report_date_str} | {doc.get('taxatie_nummer', '')}", small_style))
    elements.append(Paragraph("Dit rapport is opgesteld conform de richtlijnen van de Belastingdienst voor BPM-aangifte bij import van motorfietsen.", small_style))
    
    pdf.build(elements)
    buffer.seek(0)
    
    filename = f"BPM_Rapport_{doc.get('brand', 'Motor')}_{doc.get('model', '')}_{now.strftime('%Y%m%d')}.pdf"
    return Response(
        content=buffer.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )




@router.get("/taxatie-programma/{taxatie_id}/belastingdienst-pdf")
async def export_belastingdienst_pdf(taxatie_id: str, current_user: dict = Depends(require_admin)):
    """Fill the official Belastingdienst BPM form with taxatie data using PyMuPDF"""
    if current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    
    doc_data = await db.taxatie_programma.find_one({"id": taxatie_id}, {"_id": 0})
    if not doc_data:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    
    blank_form = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads', 'bpm_form_blank.pdf')
    if not os.path.exists(blank_form):
        from config import ROOT_DIR
        blank_form = os.path.join(str(ROOT_DIR), 'uploads', 'bpm_form_blank.pdf')
    
    # Auto-download the official form if not present
    if not os.path.exists(blank_form):
        try:
            import httpx
            logger.info("Downloading Belastingdienst BPM form template...")
            os.makedirs(os.path.dirname(blank_form), exist_ok=True)
            resp = httpx.get("https://download.belastingdienst.nl/belastingdienst/docs/aang-meld-opg-bpm-bpm0111z13fol.pdf", timeout=30, follow_redirects=True)
            if resp.status_code == 200:
                with open(blank_form, 'wb') as f:
                    f.write(resp.content)
                logger.info(f"BPM form template downloaded: {len(resp.content)} bytes")
            else:
                logger.error(f"Failed to download BPM form: HTTP {resp.status_code}")
        except Exception as dl_err:
            logger.error(f"Failed to download BPM form template: {dl_err}")
    
    if not os.path.exists(blank_form):
        logger.error(f"BPM form template not found at: {blank_form}")
        raise HTTPException(status_code=500, detail="Belastingdienst formulier template niet gevonden. Probeer het later opnieuw.")
    
    try:
        import fitz
    except ImportError:
        logger.error("PyMuPDF (fitz) not installed")
        raise HTTPException(status_code=500, detail="PDF bibliotheek niet beschikbaar")
    
    now = datetime.now(timezone.utc)
    # Override-able report date (admin can edit). Falls back to "now"
    report_dt = now
    if doc_data.get("report_date"):
        try:
            report_dt = datetime.fromisoformat(doc_data["report_date"])
        except Exception:
            try:
                report_dt = datetime.strptime(doc_data["report_date"], "%Y-%m-%d")
            except Exception:
                pass
    vin = doc_data.get("vin_number", "")
    doc_kenmerk = vin[-7:] if len(vin) >= 7 else vin
    
    # Parse first registration date
    first_reg = doc_data.get("first_registration_date", "")
    reg_day, reg_month, reg_year = "", "", ""
    if first_reg:
        try:
            d = datetime.fromisoformat(first_reg)
            reg_day, reg_month, reg_year = f"{d.day:02d}", f"{d.month:02d}", str(d.year)
        except: pass
    
    bruto_bpm = doc_data.get("bruto_bpm", 0) or 0
    netto_cat = doc_data.get("netto_catalogusprijs", 0) or 0
    forfaitair_pct = doc_data.get("forfaitair_percentage", 0) or 0
    beste = doc_data.get("beste_methode", "forfaitair")
    
    if beste == "forfaitair":
        afschr_pct = forfaitair_pct
    elif beste == "koerslijst":
        afschr_pct = doc_data.get("koerslijst_percentage", 0)
    else:
        afschr_pct = doc_data.get("taxatie_percentage", 0)
    
    afschr_bedrag = round(bruto_bpm * afschr_pct / 100, 2)
    berekende_bpm = round(bruto_bpm - afschr_bedrag, 2)
    herstelkosten = doc_data.get("herstelkosten", 0) or 0
    schade_aftrek = doc_data.get("schade_aftrek", 0) or 0
    te_betalen = int(max(0, berekende_bpm - schade_aftrek))
    
    # Field mapping: field_name -> value
    field_map = {
        # Page 1: Identificatie
        '1.0.VIN': vin,
        '1.1.VIN._C7.1': doc_kenmerk,
        '1.2_BSR': '866851525',
        
        # Page 2: Aangifte + Gegevens (ondernemer: Motoimport B.V.)
        '1.1.VIN._C7.2': doc_kenmerk,
        '4.2.0': 'Motoimport B.V.',
        '4.2.1': 'Sandro Milone',
        '4.4': 'Horsterhoekweg',
        '4.5_HN': '11',
        '4.7_PC': '7433 SV',
        '4.8': 'Schalkhaar',
        '4.9_TEL': '0681792660',
        '4.10_EM': 'motoimportbv@gmail.com',
        '3.date01.d_CF': f"{report_dt.day:02d}",
        '3.date01.m_CF': f"{report_dt.month:02d}",
        '3.date01.y_CF': str(report_dt.year),
        
        # Page 3: Voertuiggegevens
        '1.1.VIN._C7.3': doc_kenmerk,
        '6.4': doc_data.get("brand", ""),
        '6.5': doc_data.get("model", ""),
        '6.6': doc_data.get("model", ""),
        '6.date02.d_C': reg_day,
        '6.date02.m_C': reg_month,
        '6.date02.y_C': reg_year,
        
        # Page 4: Netto-catalogusprijs & BPM
        '1.1.VIN._C7.4': doc_kenmerk,
        '7.0_A7': str(int(netto_cat)),
        '7.1_A7': '0',
        '7.2_A7': str(int(netto_cat)),
        '8b.3.date03.d_C': '01',
        '8b.3.date03.m_C': '01',
        '8b.3.date03.y_C': '2026',
        '8b.4_A7': str(int(bruto_bpm)),
        
        # Page 5: Afschrijvingsmethode + Taxatierapport + Berekening
        '1.1.VIN._C7.5': doc_kenmerk,
        '8d.0_A7': str(te_betalen),
        '8e._A7': str(te_betalen),
        
        # Page 6: Ondertekening
        '1.1.VIN._C7.6': doc_kenmerk,
        '10.0': 'Sandro Milone',
        '10.date05.d_CF': f"{report_dt.day:02d}",
        '10.date05.m_CF': f"{report_dt.month:02d}",
        '10.date05.y_CF': str(report_dt.year),
        
        # Page 7: Bijlage A (Bruto BPM)
        'B.A.0': 'Motoimport B.V.',
        'B.A.1_BSR': '866851525',
        'B.A.VIN.17': vin,
        'B.A.date01.d_F': reg_day,
        'B.A.date01.m_F': reg_month,
        'B.A.date01.y_F': reg_year,
    }
    
    # Fill method-specific fields on page 5
    if herstelkosten > 0:
        # TAXATIERAPPORT methode (8c.2.*)
        consumentenprijs = doc_data.get("consumentenprijs", 0) or 0
        koerslijst_waarde = doc_data.get("koerslijst_waarde", 0) or 0
        
        # Historische nieuwprijs = consumentenprijs (or netto_cat + bruto_bpm)
        hist_nieuwprijs = consumentenprijs if consumentenprijs > 0 else int(netto_cat + bruto_bpm)
        
        # Handelsinkoopwaarde onbeschadigd = koerslijst_waarde or estimate
        handelswaarde_onbesch = koerslijst_waarde if koerslijst_waarde > 0 else 0
        
        # Waardeverminderingspercentage = (herstelkosten / hist_nieuwprijs) * 100
        if hist_nieuwprijs > 0:
            waardevermin_pct = round((herstelkosten / hist_nieuwprijs) * 100, 2)
        else:
            waardevermin_pct = 0
        
        # Overig waardeverminderingsbedrag = schade_aftrek (31% van herstelkosten)
        overig_vermin = int(schade_aftrek)
        
        # Handelsinkoopwaarde beschadigd
        handelswaarde_besch = max(0, handelswaarde_onbesch - int(herstelkosten * waardevermin_pct / 100) - overig_vermin) if handelswaarde_onbesch > 0 else 0
        
        field_map.update({
            # Taxatierapport gegevens
            '8c.2.1': 'Sandro Milone',
            '8c.2.2': 'Schalkhaar',
            '8c.2.3': 'Motoimport',
            '8c.2.4.date06.d': f"{report_dt.day:02d}",
            '8c.2.4.date06.m': f"{report_dt.month:02d}",
            '8c.2.4.date06.y': str(report_dt.year),
            '8c.2.6_A7': str(hist_nieuwprijs),
            '8c.2.7_A7': str(handelswaarde_onbesch) if handelswaarde_onbesch > 0 else '',
            '8c.2.8_A7': str(int(herstelkosten)),
            '8c.2.9_AD3': f"{waardevermin_pct:.2f}".replace('.', ','),
            '8c.2.10_A7': str(overig_vermin),
            '8c.2.11_A7': str(handelswaarde_besch) if handelswaarde_besch > 0 else '',
            '8c.2.13_A7': '',
            
            # Forfaitaire ook invullen als referentie
            '8c.3._AD33': f"{afschr_pct:.3f}".replace('.', ','),
        })
    else:
        # Alleen forfaitaire methode
        field_map.update({
            '8c.3._AD33': f"{afschr_pct:.3f}".replace('.', ','),
        })
    
    # Bijlage D - Forfaitaire tabel (methode 3) - altijd invullen als referentie
    field_map.update({
        'B.D.3.0_A7': str(int(bruto_bpm)),
        'B.D.3.1_AD33': f"{afschr_pct:.3f}".replace('.', ','),
        'B.D.3.2_A7': str(int(afschr_bedrag)),
        'B.D.3.3_A7': str(int(berekende_bpm)),
    })
    
    # Open and fill the PDF
    try:
        pdf_doc = fitz.open(blank_form)
        
        for page_num in range(len(pdf_doc)):
            page = pdf_doc[page_num]
            for widget in page.widgets():
                fname = widget.field_name or ''
                if fname in field_map and field_map[fname]:
                    try:
                        widget.field_value = str(field_map[fname])
                        widget.update()
                    except Exception as we:
                        logger.warning(f"Could not set field '{fname}': {we}")
        
        # Save to bytes
        pdf_bytes = pdf_doc.tobytes()
        pdf_doc.close()
        
        filename = f"Aangifte_BPM_{doc_data.get('brand', 'Motor')}_{doc_data.get('model', '')}_{now.strftime('%Y%m%d')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        logger.error(f"Failed to generate Belastingdienst PDF: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF generatie mislukt: {str(e)}")


TAXATIE_LABOR_RATE = 65.0  # €65 per uur excl. BTW
COMPANY_RSIN = "866851525"
COMPANY_KVK = "94622086"

@router.get("/taxatie-programma/{taxatie_id}/taxatieverslag-pdf")
async def export_taxatieverslag_pdf(taxatie_id: str, current_user: dict = Depends(require_admin)):
    """Generate official Taxatieverslag PDF for Belastingdienst - AutoTelex style for motorcycles"""
    if current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    
    doc = await db.taxatie_programma.find_one({"id": taxatie_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
    import io
    
    buffer = io.BytesIO()
    pdf = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=15*mm, bottomMargin=15*mm)
    
    styles = getSampleStyleSheet()
    # Styles
    header_s = ParagraphStyle('HDR', parent=styles['Normal'], fontSize=18, fontName='Helvetica-Bold', textColor=colors.HexColor('#18181b'), spaceAfter=1*mm)
    sub_s = ParagraphStyle('SUB', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#666'), spaceAfter=3*mm)
    section_s = ParagraphStyle('SEC', parent=styles['Normal'], fontSize=12, fontName='Helvetica-Bold', textColor=colors.HexColor('#18181b'), spaceBefore=5*mm, spaceAfter=2*mm)
    n = ParagraphStyle('N', parent=styles['Normal'], fontSize=9, leading=12)
    b = ParagraphStyle('B', parent=n, fontName='Helvetica-Bold')
    rb = ParagraphStyle('RB', parent=b, alignment=TA_RIGHT)
    sm = ParagraphStyle('SM', parent=n, fontSize=7.5, textColor=colors.HexColor('#888'))
    label_s = ParagraphStyle('LBL', parent=n, fontSize=8, textColor=colors.HexColor('#666'))
    val_s = ParagraphStyle('VAL', parent=n, fontSize=9, fontName='Helvetica-Bold')
    red_s = ParagraphStyle('RED', parent=val_s, textColor=colors.HexColor('#dc2626'))
    green_s = ParagraphStyle('GRN', parent=val_s, textColor=colors.HexColor('#16a34a'))
    white_b = ParagraphStyle('WB', parent=b, textColor=colors.white)
    white_rb = ParagraphStyle('WRB', parent=rb, textColor=colors.white)
    
    elements = []
    now = datetime.now(timezone.utc)
    taxatie_nr = doc.get("taxatie_nummer", f"BPM-{now.strftime('%Y%m%d')}")
    
    # Override-able report date (admin can edit). Falls back to "now"
    report_date_dt = now
    if doc.get("report_date"):
        try:
            report_date_dt = datetime.fromisoformat(doc["report_date"])
        except Exception:
            try:
                report_date_dt = datetime.strptime(doc["report_date"], "%Y-%m-%d")
            except Exception:
                pass
    report_date_str = report_date_dt.strftime("%d-%m-%Y")
    
    def fe(val):
        if val is None or val == 0: return "\u20ac 0,00"
        return f"\u20ac {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    def fi(val):
        if val is None or val == 0: return "\u20ac 0"
        return f"\u20ac {int(val):,}".replace(",", ".")
    
    # Parse dates
    first_reg = doc.get("first_registration_date", "")
    reg_str = "-"
    if first_reg:
        try:
            d = datetime.fromisoformat(first_reg)
            reg_str = d.strftime("%d-%m-%Y")
        except: pass
    
    bouwjaar_str = doc.get("bouwjaar", "-")
    if bouwjaar_str and len(bouwjaar_str) >= 10:
        try:
            d = datetime.fromisoformat(bouwjaar_str)
            bouwjaar_str = d.strftime("%d-%m-%Y")
        except: pass
    
    brand = doc.get("brand", "-")
    model = doc.get("model", "")
    vin = doc.get("vin_number", "-")
    netto_cat = doc.get("netto_catalogusprijs", 0) or 0
    consumentenprijs = doc.get("consumentenprijs", 0) or 0
    bruto_bpm = doc.get("bruto_bpm", 0) or 0
    
    # ==========================================
    # PAGE 1: TAXATIERAPPORT MOTORFIETS
    # ==========================================
    
    # Company header bar
    hdr_data = [[
        Paragraph("<b>MOTO IMPORT B.V.</b>", ParagraphStyle('H1', parent=n, fontSize=14, fontName='Helvetica-Bold', textColor=colors.white)),
        Paragraph(f"<b>Taxatierapport Motorfiets</b><br/>{taxatie_nr}", ParagraphStyle('H2', parent=n, fontSize=10, textColor=colors.HexColor('#ccc'), alignment=TA_RIGHT)),
    ]]
    t = Table(hdr_data, colWidths=[90*mm, 84*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#18181b')),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 2*mm))
    
    # Company info block
    info_data = [
        [Paragraph("<b>Naam:</b>", label_s), "Moto Import B.V.", Paragraph("<b>Datum rapport:</b>", label_s), report_date_str],
        [Paragraph("<b>RSIN:</b>", label_s), COMPANY_RSIN, Paragraph("<b>KVK:</b>", label_s), COMPANY_KVK],
        [Paragraph("<b>Adres:</b>", label_s), "Horsterhoekweg 11, 7433 SV Schalkhaar", Paragraph("<b>Taxateur:</b>", label_s), "S. Milone"],
        [Paragraph("<b>Tel:</b>", label_s), "+31 6 24264861", Paragraph("<b>Email:</b>", label_s), "motoimportbv@gmail.com"],
    ]
    t = Table(info_data, colWidths=[22*mm, 66*mm, 26*mm, 60*mm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#e5e5e5')),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#fafafa')),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor('#fafafa')),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4*mm))
    
    # Section 1: Voertuiggegevens
    elements.append(Paragraph("1. Gegevens motorfiets", section_s))
    
    veh_data = [
        [Paragraph("<b>Merk</b>", label_s), brand, Paragraph("<b>Model</b>", label_s), model],
        [Paragraph("<b>Chassisnummer (VIN)</b>", label_s), Paragraph(f"<b>{vin}</b>", val_s), Paragraph("<b>Brandstof</b>", label_s), doc.get("fuel_type", "Benzine")],
        [Paragraph("<b>Datum 1e toelating</b>", label_s), reg_str, Paragraph("<b>Bouwjaar</b>", label_s), bouwjaar_str],
        [Paragraph("<b>Kilometerstand</b>", label_s), f"{doc.get('mileage', 0):,} km".replace(",", "."), Paragraph("<b>Kleur</b>", label_s), doc.get("color", "-")],
        [Paragraph("<b>Cilinderinhoud</b>", label_s), f"{doc.get('cylinder_capacity', '-')} cc", Paragraph("<b>Vermogen</b>", label_s), f"{doc.get('power_kw', '-')} kW"],
    ]
    t = Table(veh_data, colWidths=[32*mm, 56*mm, 32*mm, 54*mm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#ddd')),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f5f5f5')),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor('#f5f5f5')),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 3*mm))
    
    # Section 2: Prijsinformatie
    elements.append(Paragraph("2. Prijsinformatie en waardebepaling", section_s))
    
    koerslijst = doc.get("koerslijst_waarde", 0) or 0
    taxatie_waarde = doc.get("taxatie_inruil_waarde", 0) or 0
    
    prijs_data = [
        [Paragraph("<b>Omschrijving</b>", white_b), Paragraph("<b>Bedrag</b>", white_rb)],
        ["Netto catalogusprijs (excl. BPM, excl. BTW)", fi(netto_cat)],
        ["Consumentenprijs (incl. BPM, incl. BTW)", fi(consumentenprijs) if consumentenprijs > 0 else "-"],
        ["Bruto BPM", fi(bruto_bpm)],
    ]
    if koerslijst > 0:
        prijs_data.append(["Handelsinkoopwaarde onbeschadigd (koerslijst)", fi(koerslijst)])
    if taxatie_waarde > 0:
        prijs_data.append(["Getaxeerde inruilwaarde", fi(taxatie_waarde)])
    
    t = Table(prijs_data, colWidths=[130*mm, 44*mm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#ddd')),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#18181b')),
        ('ALIGN', (1,1), (1,-1), 'RIGHT'),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4*mm))
    
    # Section 3: Schadebeoordeling
    elements.append(Paragraph("3. Geconstateerde schade en herstelkostenbegroting", section_s))
    elements.append(Paragraph(f"Datum fysieke inspectie: <b>{report_date_str}</b> | Uurtarief arbeid: <b>\u20ac {TAXATIE_LABOR_RATE:.2f}</b> excl. BTW", sm))
    elements.append(Spacer(1, 2*mm))
    
    damage_items = doc.get("damage_items", [])
    checked_items = [i for i in damage_items if i.get("checked")]
    
    dmg_rows = [[
        Paragraph("<b>Nr.</b>", white_b),
        Paragraph("<b>Omschrijving schade</b>", white_b),
        Paragraph("<b>Uren</b>", ParagraphStyle('WR', parent=white_b, alignment=TA_RIGHT)),
        Paragraph("<b>Arbeid</b>", ParagraphStyle('WR', parent=white_b, alignment=TA_RIGHT)),
        Paragraph("<b>Materiaal</b>", ParagraphStyle('WR', parent=white_b, alignment=TA_RIGHT)),
        Paragraph("<b>Totaal</b>", ParagraphStyle('WR', parent=white_b, alignment=TA_RIGHT)),
    ]]
    
    tot_hours = 0
    tot_labor = 0
    tot_mat = 0
    tot_cost = 0
    
    for idx, item in enumerate(checked_items, 1):
        hours = item.get("hours", 0) or 0
        mat = item.get("material_cost", 0) or 0
        labor = round(hours * TAXATIE_LABOR_RATE, 2)
        cost = item.get("cost", 0) or round(labor + mat, 2)
        tot_hours += hours
        tot_labor += labor
        tot_mat += mat
        tot_cost += cost
        
        dmg_rows.append([
            str(idx),
            item.get("name", "-"),
            f"{hours:.1f}" if hours > 0 else "-",
            fe(labor) if labor > 0 else "-",
            fe(mat) if mat > 0 else "-",
            Paragraph(f"<b>{fe(cost)}</b>", rb),
        ])
    
    # Subtotals
    dmg_rows.append(["", Paragraph("<b>Subtotaal arbeid</b>", b), f"{tot_hours:.1f}", Paragraph(f"<b>{fe(tot_labor)}</b>", rb), "", ""])
    dmg_rows.append(["", Paragraph("<b>Subtotaal materiaal</b>", b), "", "", Paragraph(f"<b>{fe(tot_mat)}</b>", rb), ""])
    dmg_rows.append(["", Paragraph("<b>TOTAAL HERSTELKOSTEN</b>", ParagraphStyle('TB', parent=b, fontSize=10)), "", "", "", Paragraph(f"<b>{fe(tot_cost)}</b>", ParagraphStyle('TRB', parent=rb, fontSize=10, textColor=colors.HexColor('#dc2626')))])
    
    cw = [10*mm, 62*mm, 16*mm, 26*mm, 26*mm, 26*mm]
    t = Table(dmg_rows, colWidths=cw)
    ts_dmg = [
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#ddd')),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#dc2626')),
        ('ALIGN', (2,1), (-1,-1), 'RIGHT'),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#fef2f2')),
        ('LINEABOVE', (0,-3), (-1,-3), 0.8, colors.HexColor('#999')),
        ('BACKGROUND', (0,-2), (-1,-2), colors.HexColor('#fafafa')),
        ('BACKGROUND', (0,-3), (-1,-3), colors.HexColor('#fafafa')),
    ]
    for i in range(1, len(checked_items)+1):
        if i % 2 == 0:
            ts_dmg.append(('BACKGROUND', (0,i), (-1,i), colors.HexColor('#fafafa')))
    t.setStyle(TableStyle(ts_dmg))
    elements.append(t)
    
    if doc.get("damage_notes"):
        elements.append(Spacer(1, 2*mm))
        elements.append(Paragraph(f"<i>Toelichting: {doc['damage_notes']}</i>", sm))
    elements.append(Spacer(1, 4*mm))
    
    # Section 4: BPM Vermindering
    elements.append(Paragraph("4. Berekening BPM-vermindering", section_s))
    
    herstelkosten = tot_cost if tot_cost > 0 else (doc.get("herstelkosten", 0) or 0)
    schade_aftrek = round(herstelkosten * 0.31, 2)
    beste = doc.get("beste_methode", "forfaitair")
    methode_labels = {"forfaitair": "Forfaitaire afschrijvingstabel", "koerslijst": "Koerslijstmethode", "taxatierapport": "Taxatierapport"}
    beste_bpm = doc.get(f"{beste}_bpm" if beste != "taxatierapport" else "taxatie_bpm", bruto_bpm)
    netto_bpm = doc.get("netto_bpm", 0) or 0
    
    bpm_data = [
        [Paragraph("<b>Omschrijving</b>", white_b), Paragraph("<b>Bedrag</b>", white_rb)],
        ["Bruto BPM motorfiets", fe(bruto_bpm)],
        [f"Afschrijving via {methode_labels.get(beste, beste)} ({doc.get(f'{beste}_percentage' if beste != 'taxatierapport' else 'taxatie_percentage', 0):.1f}%)", f"- {fe(bruto_bpm - beste_bpm)}"],
        [Paragraph("<b>BPM na afschrijving</b>", b), Paragraph(f"<b>{fe(beste_bpm)}</b>", rb)],
        ["", ""],
        [f"Totaal herstelkosten (zie sectie 3)", fe(herstelkosten)],
        ["BPM-aftrek: 31% van herstelkosten", Paragraph(f"<b>- {fe(schade_aftrek)}</b>", ParagraphStyle('GRB', parent=rb, textColor=colors.HexColor('#16a34a')))],
        ["", ""],
        [Paragraph("<b>TE BETALEN BPM</b>", ParagraphStyle('FBB', parent=b, fontSize=11)), Paragraph(f"<b>{fe(netto_bpm)}</b>", ParagraphStyle('FRBB', parent=rb, fontSize=11, textColor=colors.HexColor('#dc2626')))],
        [Paragraph(f"<b>BPM-vermindering</b>", ParagraphStyle('GBB', parent=b, fontSize=10, textColor=colors.HexColor('#16a34a'))), Paragraph(f"<b>- {fe(doc.get('bpm_vermindering', 0))}</b>", ParagraphStyle('GRBB', parent=rb, fontSize=10, textColor=colors.HexColor('#16a34a')))],
    ]
    
    t = Table(bpm_data, colWidths=[130*mm, 44*mm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#ddd')),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#18181b')),
        ('BACKGROUND', (0,-2), (-1,-2), colors.HexColor('#fef2f2')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f0fdf4')),
        ('ALIGN', (1,1), (1,-1), 'RIGHT'),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 6*mm))
    
    # Section 5: Verklaring & Ondertekening
    elements.append(Paragraph("5. Verklaring en ondertekening", section_s))
    elements.append(Paragraph(
        f"Ondergetekende verklaart dat het motorrijtuig <b>{brand} {model}</b> "
        f"(chassisnummer <b>{vin}</b>) op <b>{report_date_str}</b> fysiek is ge\u00efnspecteerd "
        f"op locatie Horsterhoekweg 11, 7433 SV Schalkhaar. "
        f"De in dit verslag genoemde schadeposten zijn daadwerkelijk geconstateerd en de geschatte "
        f"herstelkosten zijn gebaseerd op gangbare tarieven in de motorfietsbranche "
        f"(uurtarief arbeid: \u20ac {TAXATIE_LABOR_RATE:.2f} excl. BTW, materiaalkosten op basis van actuele prijzen). "
        f"Dit taxatieverslag is opgesteld ten behoeve van de BPM-aangifte conform artikel 10, lid 7 van de Wet op de belasting van personenauto's en motorrijwielen 1992.",
        n
    ))
    elements.append(Spacer(1, 6*mm))
    
    sign_data = [
        [Paragraph("<b>Naam</b>", label_s), "S. Milone", Paragraph("<b>Datum</b>", label_s), report_date_str],
        [Paragraph("<b>Functie</b>", label_s), "Directeur / Taxateur", Paragraph("<b>Bedrijf</b>", label_s), "Moto Import B.V."],
        [Paragraph("<b>Handtekening</b>", label_s), "", "", ""],
    ]
    t = Table(sign_data, colWidths=[24*mm, 64*mm, 24*mm, 62*mm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#ddd')),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f5f5f5')),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor('#f5f5f5')),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,-1), (-1,-1), 25),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4*mm))
    
    # Footer
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#ddd')))
    elements.append(Spacer(1, 2*mm))
    elements.append(Paragraph(
        f"Dit document dient als bijlage bij de Aangifte BPM (formulier BPM 011) en vervangt het taxatierapport voor motorfietsen. "
        f"Moto Import B.V. | KVK {COMPANY_KVK} | RSIN {COMPANY_RSIN} | Horsterhoekweg 11, 7433 SV Schalkhaar",
        ParagraphStyle('FT', parent=sm, fontSize=7, textColor=colors.HexColor('#aaa'))
    ))
    
    pdf.build(elements)
    buffer.seek(0)
    
    filename = f"Taxatierapport_{brand}_{model}_{now.strftime('%Y%m%d')}.pdf"
    return Response(
        content=buffer.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
