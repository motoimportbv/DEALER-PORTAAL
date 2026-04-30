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
    require_admin, require_taxatie_access, require_pakbon, require_approved_dealer, require_foreign_dealer,
    generate_short_code, security, security_optional,
    send_email, send_email_with_attachment, send_admin_notification,
    init_storage, put_object, get_object, get_public_url,
    get_chf_eur_margin, set_chf_eur_margin, get_chf_to_eur_rate,
    convert_chf_to_eur_with_margin, convert_chf_to_eur, DEFAULT_CHF_EUR_MARGIN,
)
from models import *

router = APIRouter(tags=["Taxatie"])

def _owner_filter_for_user(user: dict, owner_field: str = "owner_user_id") -> dict:
    """Returns Mongo filter so each user only sees their own records.
    
    - taxateur (DK Automotive etc.): only own records (owner_user_id == user.id)
    - admin / Moto Import: own records + legacy records without owner field
    """
    user_id = user.get("id")
    if user.get("role") == "taxateur":
        return {owner_field: user_id}
    # admin: owner is admin himself OR field missing/empty (legacy records)
    return {"$or": [{owner_field: user_id}, {owner_field: {"$in": [None, ""]}}, {owner_field: {"$exists": False}}]}


def _stamp_owner(doc: dict, user: dict) -> dict:
    """Add ownership fields to a new document."""
    doc["owner_user_id"] = user.get("id")
    doc["owner_email"] = (user.get("email") or "").lower()
    return doc


# ==================== TAXATIE INVOICES ====================
TAXATIE_BANK_NAME = "S. Milone"
TAXATIE_BANK_IBAN = "NL84BUNQ2159356875"

@router.post("/taxatie/invoices")
async def create_taxatie_invoice(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Create a taxatie invoice - only for motoimportbv@gmail.com"""
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_TAXATIE:
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
    _stamp_owner(invoice, current_user)
    
    await db.taxatie_invoices.insert_one(invoice)
    del invoice["_id"]
    return invoice

@router.get("/taxatie/invoices")
async def list_taxatie_invoices(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_TAXATIE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    invoices = await db.taxatie_invoices.find(_owner_filter_for_user(current_user), {"_id": 0}).sort("invoice_number", -1).to_list(500)
    return invoices

@router.get("/taxatie/invoices/{invoice_id}")
async def get_taxatie_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_TAXATIE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    invoice = await db.taxatie_invoices.find_one({"id": invoice_id, **_owner_filter_for_user(current_user)}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Factuur niet gevonden")
    return invoice

@router.put("/taxatie/invoices/{invoice_id}")
async def update_taxatie_invoice(invoice_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_TAXATIE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    update_fields = {}
    for field in ["status", "notes", "fee", "btw_percentage", "include_extra_fee", "extra_fee", "extra_fee_no_btw", "invoice_type", "taxatie_items", "taxatie_value", "customer_name", "customer_address", "customer_city", "customer_phone", "customer_email", "motorcycle_brand", "motorcycle_model", "motorcycle_year", "motorcycle_license_plate", "motorcycle_vin", "date"]:
        if field in body:
            update_fields[field] = body[field]
    if not update_fields:
        raise HTTPException(status_code=400, detail="Geen velden om bij te werken")
    result = await db.taxatie_invoices.update_one({"id": invoice_id, **_owner_filter_for_user(current_user)}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Factuur niet gevonden")
    return {"status": "updated"}

@router.delete("/taxatie/invoices/{invoice_id}")
async def delete_taxatie_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != ALLOWED_ADMIN_EMAIL_TAXATIE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    result = await db.taxatie_invoices.delete_one({"id": invoice_id, **_owner_filter_for_user(current_user)})
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
async def create_taxatie(data: TaxatieCreate, current_user: dict = Depends(require_taxatie_access)):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
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
    _stamp_owner(doc, current_user)

    await db.taxatie_programma.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.get("/taxatie-programma")
async def get_taxaties(current_user: dict = Depends(require_taxatie_access)):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    return await db.taxatie_programma.find(_owner_filter_for_user(current_user), {"_id": 0}).sort("created_at", -1).to_list(500)

@router.get("/taxatie-programma/{taxatie_id}")
async def get_taxatie(taxatie_id: str, current_user: dict = Depends(require_taxatie_access)):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    doc = await db.taxatie_programma.find_one({"id": taxatie_id, **_owner_filter_for_user(current_user)}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return doc

@router.put("/taxatie-programma/{taxatie_id}")
async def update_taxatie(taxatie_id: str, data: TaxatieCreate, current_user: dict = Depends(require_taxatie_access)):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
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

    result = await db.taxatie_programma.update_one({"id": taxatie_id, **_owner_filter_for_user(current_user)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return await db.taxatie_programma.find_one({"id": taxatie_id}, {"_id": 0})

@router.post("/taxatie-programma/{taxatie_id}/finalize")
async def finalize_taxatie(taxatie_id: str, body: dict | None = None, current_user: dict = Depends(require_taxatie_access)):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    body = body or {}
    update_set = {"status": "definitief", "finalized_at": datetime.now(timezone.utc).isoformat()}
    custom_date = (body.get("report_date") or "").strip()
    if custom_date:
        update_set["report_date"] = custom_date
    else:
        update_set["report_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = await db.taxatie_programma.update_one(
        {"id": taxatie_id, **_owner_filter_for_user(current_user)},
        {"$set": update_set}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return {"status": "definitief", "report_date": update_set["report_date"]}

@router.post("/taxatie-programma/{taxatie_id}/revert-to-concept")
async def revert_taxatie_to_concept(taxatie_id: str, current_user: dict = Depends(require_taxatie_access)):
    """Zet een definitief gemaakt rapport terug naar concept zodat datum/inhoud aangepast kan worden."""
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    result = await db.taxatie_programma.update_one(
        {"id": taxatie_id, **_owner_filter_for_user(current_user)},
        {"$set": {"status": "concept"}, "$unset": {"finalized_at": ""}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return {"status": "concept"}


# ==================== POST + BPM TRACKING + MAANDFACTUUR ====================
# Workflow: concept → definitief → posted (verzonden naar Belastingdienst) → bpm_received
# Reminder na 5 dagen: tonen in `/api/taxatie-programma/reminders`
# Maandfactuur: groeperen per maand op `bpm_received_at` voor admin facturatie

@router.post("/taxatie-programma/{taxatie_id}/mark-posted")
async def mark_taxatie_posted(
    taxatie_id: str,
    body: dict | None = None,
    current_user: dict = Depends(require_taxatie_access),
):
    """Markeer dat het taxatieverslag op de post is gedaan naar de Belastingdienst.
    Body (optioneel): {posted_at: 'YYYY-MM-DD'} — anders vandaag.
    """
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    body = body or {}
    posted_at = (body.get("posted_at") or "").strip() or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = await db.taxatie_programma.update_one(
        {"id": taxatie_id, **_owner_filter_for_user(current_user)},
        {"$set": {"posted_at": posted_at, "post_status": "verzonden"}, "$unset": {"bpm_received_at": "", "bpm_meldcode": ""}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return {"posted_at": posted_at, "post_status": "verzonden"}


@router.post("/taxatie-programma/{taxatie_id}/mark-bpm-received")
async def mark_bpm_received(
    taxatie_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(require_taxatie_access),
):
    """Markeer dat de BPM is ontvangen van de Belastingdienst.
    Body: {bpm_meldcode: str (verplicht), bpm_amount_received: float (optioneel),
           received_at: 'YYYY-MM-DD' (optioneel — anders vandaag)}.
    """
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    meldcode = (body.get("bpm_meldcode") or "").strip()
    if not meldcode:
        raise HTTPException(status_code=400, detail="Meldcode Belastingdienst is verplicht")
    received_at = (body.get("received_at") or "").strip() or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    update = {
        "bpm_received_at": received_at,
        "bpm_meldcode": meldcode,
        "post_status": "bpm_ontvangen",
    }
    if body.get("bpm_amount_received") is not None:
        try:
            update["bpm_amount_received"] = float(body["bpm_amount_received"])
        except (TypeError, ValueError):
            pass
    result = await db.taxatie_programma.update_one(
        {"id": taxatie_id, **_owner_filter_for_user(current_user)},
        {"$set": update}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return update


@router.get("/taxatie-programma-reminders")
async def get_post_reminders(current_user: dict = Depends(require_taxatie_access)):
    """Lijst van taxaties die >5 dagen geleden op de post zijn gedaan en waarvoor
    nog geen BPM-ontvangst is geregistreerd. Wordt getoond als banner.
    """
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=5)).strftime("%Y-%m-%d")
    docs = await db.taxatie_programma.find(
        {
            **_owner_filter_for_user(current_user),
            "posted_at": {"$ne": None, "$lte": cutoff},
            "$or": [{"bpm_received_at": {"$in": [None, ""]}}, {"bpm_received_at": {"$exists": False}}],
        },
        {"_id": 0, "id": 1, "taxatie_nummer": 1, "brand": 1, "model": 1,
         "customer_name": 1, "posted_at": 1, "report_date": 1},
    ).sort("posted_at", 1).to_list(200)
    today = datetime.now(timezone.utc).date()
    for d in docs:
        try:
            posted_d = datetime.strptime(d["posted_at"], "%Y-%m-%d").date()
            d["dagen_open"] = (today - posted_d).days
        except Exception:
            d["dagen_open"] = 0
    return {"count": len(docs), "items": docs}


@router.get("/taxatie-programma-maandfactuur")
async def get_maandfactuur_overzicht(current_user: dict = Depends(require_taxatie_access)):
    """Overzicht voor maandelijkse facturatie naar klanten.
    Toont alle taxaties met status `bpm_ontvangen`, gegroepeerd per maand (op bpm_received_at).
    Per regel: meldcode, klantnaam, taxatiewaarde, BPM-bedrag, factuur-status.
    """
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    docs = await db.taxatie_programma.find(
        {
            **_owner_filter_for_user(current_user),
            "bpm_received_at": {"$nin": [None, ""], "$exists": True},
        },
        {"_id": 0, "id": 1, "taxatie_nummer": 1, "brand": 1, "model": 1,
         "license_plate": 1, "vin_number": 1, "first_registration_date": 1,
         "customer_name": 1, "customer_phone": 1, "customer_email": 1,
         "customer_address": 1, "taxatie_inruil_waarde": 1,
         "bpm_meldcode": 1, "bpm_received_at": 1, "bpm_amount_received": 1,
         "posted_at": 1, "invoiced": 1, "invoice_id": 1,
         "extra_fee_enabled": 1, "extra_fee_amount": 1},
    ).sort("bpm_received_at", -1).to_list(1000)

    # Group by year-month
    fee_ex = float(TAXATIE_DEFAULT_FEE)  # €160 ex BTW (config)
    btw_pct = float(TAXATIE_BTW_PERCENTAGE) / 100.0  # 21%
    fee_btw = round(fee_ex * btw_pct, 2)
    fee_incl = round(fee_ex + fee_btw, 2)

    months = {}
    for d in docs:
        try:
            recv = datetime.strptime(d["bpm_received_at"], "%Y-%m-%d")
            ym = recv.strftime("%Y-%m")
            ym_label = recv.strftime("%B %Y")
        except Exception:
            ym = "0000-00"
            ym_label = "Onbekend"
        # Verrijk per item met factuurbedrag
        d["fee_ex_btw"] = fee_ex
        d["fee_btw"] = fee_btw
        d["fee_incl_btw"] = fee_incl
        # Optionele €60 extra fee (per regel)
        extra_enabled = bool(d.get("extra_fee_enabled"))
        extra_amount = float(d.get("extra_fee_amount") or 60.0) if extra_enabled else 0.0
        d["extra_fee_enabled"] = extra_enabled
        d["extra_fee_amount"] = extra_amount
        # Totaal per regel ex en incl BTW (extra fee is BTW-vrij, conform bestaande factuurregel)
        line_ex = fee_ex + extra_amount
        line_incl = fee_incl + extra_amount
        d["line_total_ex"] = line_ex
        d["line_total_incl"] = line_incl
        bucket = months.setdefault(ym, {
            "month": ym, "label": ym_label, "items": [],
            "totaal_taxatiewaarde": 0.0, "totaal_bpm": 0.0,
            "totaal_te_factureren_ex": 0.0, "totaal_te_factureren_incl": 0.0,
            "totaal_extra_fee": 0.0,
            "aantal": 0, "te_factureren": 0,
        })
        bucket["items"].append(d)
        bucket["totaal_taxatiewaarde"] += float(d.get("taxatie_inruil_waarde") or 0)
        bucket["totaal_bpm"] += float(d.get("bpm_amount_received") or 0)
        bucket["aantal"] += 1
        if not d.get("invoiced"):
            bucket["te_factureren"] += 1
            bucket["totaal_te_factureren_ex"] += line_ex
            bucket["totaal_te_factureren_incl"] += line_incl
            bucket["totaal_extra_fee"] += extra_amount
    sorted_months = sorted(months.values(), key=lambda b: b["month"], reverse=True)
    return {
        "months": sorted_months,
        "fee_ex_btw": fee_ex,
        "fee_btw": fee_btw,
        "fee_incl_btw": fee_incl,
        "btw_percentage": int(TAXATIE_BTW_PERCENTAGE),
    }


@router.get("/taxatie-programma-maandfactuur/{ym}/pdf")
async def export_maandfactuur_pdf(ym: str, current_user: dict = Depends(require_taxatie_access)):
    """Genereer een verzamel-PDF voor een specifieke maand (ym = 'YYYY-MM').
    Lijst van alle taxaties met ontvangen BPM in die maand, geschikt als basis voor klantfacturen.
    """
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    try:
        datetime.strptime(ym, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="Ongeldig maandformaat (verwacht YYYY-MM)")

    # Alle ontvangen items, daarna filter op maand
    docs = await db.taxatie_programma.find(
        {
            **_owner_filter_for_user(current_user),
            "bpm_received_at": {"$nin": [None, ""], "$exists": True},
        },
        {"_id": 0},
    ).sort("bpm_received_at", 1).to_list(2000)
    items = [d for d in docs if (d.get("bpm_received_at") or "").startswith(ym)]
    if not items:
        raise HTTPException(status_code=404, detail=f"Geen ontvangen BPM in {ym}")

    from services.branding import get_branding
    cb = get_branding(current_user)

    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_RIGHT
    import io

    buffer = io.BytesIO()
    pdf = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=12 * mm, bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    n = ParagraphStyle('N', parent=styles['Normal'], fontSize=8.5, leading=11)
    nb = ParagraphStyle('NB', parent=n, fontName='Helvetica-Bold')
    sm = ParagraphStyle('SM', parent=n, fontSize=7.5, textColor=colors.HexColor('#666'))
    right_b = ParagraphStyle('RB', parent=nb, alignment=TA_RIGHT)
    white_b = ParagraphStyle('WB', parent=nb, textColor=colors.white)

    elements = []

    ym_dt = datetime.strptime(ym, "%Y-%m")
    nl_months = ["januari", "februari", "maart", "april", "mei", "juni",
                 "juli", "augustus", "september", "oktober", "november", "december"]
    ym_label = f"{nl_months[ym_dt.month - 1].capitalize()} {ym_dt.year}"

    # Header bar
    hdr = [[
        Paragraph(f"<b>{cb['name']}</b>", ParagraphStyle('CN', parent=n, fontSize=14, fontName='Helvetica-Bold', textColor=colors.white)),
        Paragraph(f"<b>Maandoverzicht Facturatie</b><br/>{ym_label}", ParagraphStyle('CR', parent=n, fontSize=10, textColor=colors.HexColor('#ccc'), alignment=TA_RIGHT)),
    ]]
    t = Table(hdr, colWidths=[140 * mm, 130 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#18181b')),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))

    # Bedrijfsinfo
    info_lines = []
    if cb.get('address'): info_lines.append(cb['address'])
    if cb.get('kvk'): info_lines.append(f"KvK: {cb['kvk']}")
    if cb.get('btw'): info_lines.append(f"BTW: {cb['btw']}")
    if cb.get('phone'): info_lines.append(cb['phone'])
    if cb.get('email'): info_lines.append(cb['email'])
    elements.append(Paragraph(" \u2022 ".join(info_lines), sm))
    elements.append(Spacer(1, 5 * mm))

    fee_ex = float(TAXATIE_DEFAULT_FEE)
    btw_pct_int = int(TAXATIE_BTW_PERCENTAGE)
    fee_btw = round(fee_ex * (btw_pct_int / 100.0), 2)
    fee_incl = round(fee_ex + fee_btw, 2)
    def fmt_eur_inline(v):
        return f"\u20ac {float(v or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    elements.append(Paragraph(
        f"Onderstaand overzicht bevat alle taxaties waarvan in <b>{ym_label}</b> "
        f"de BPM-vermindering door de Belastingdienst is uitgekeerd. "
        f"Het taxatietarief bedraagt <b>{fmt_eur_inline(fee_ex)} ex BTW</b> per regel "
        f"(<b>{fmt_eur_inline(fee_incl)} incl. {btw_pct_int}% BTW</b>) — "
        f"te gebruiken als basis voor de individuele klantfactuur.",
        n,
    ))
    elements.append(Spacer(1, 4 * mm))

    # Tabel
    def fmt_eur(v):
        return f"\u20ac {float(v or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    def fmt_date(s):
        return datetime.strptime(s, "%Y-%m-%d").strftime("%d-%m-%Y") if s else "-"

    header_row = [
        Paragraph("#", white_b),
        Paragraph("Meldcode", white_b),
        Paragraph("Klant", white_b),
        Paragraph("Voertuig / Taxatienr", white_b),
        Paragraph("Ontvangen", white_b),
        Paragraph("BPM bedrag", ParagraphStyle('WBR', parent=white_b, alignment=TA_RIGHT)),
        Paragraph(f"Taxatie ex {btw_pct_int}%", ParagraphStyle('WBR2', parent=white_b, alignment=TA_RIGHT)),
        Paragraph("Extra €60", ParagraphStyle('WBR4', parent=white_b, alignment=TA_RIGHT)),
        Paragraph("Totaal incl", ParagraphStyle('WBR3', parent=white_b, alignment=TA_RIGHT)),
        Paragraph("Status", white_b),
    ]
    rows = [header_row]
    totaal_bpm = 0.0
    totaal_te_factureren_ex = 0.0
    totaal_te_factureren_incl = 0.0
    totaal_extra = 0.0
    open_count = 0
    for idx, it in enumerate(items, start=1):
        bedrag = float(it.get("bpm_amount_received") or 0)
        totaal_bpm += bedrag
        extra_enabled = bool(it.get("extra_fee_enabled"))
        extra_amount = float(it.get("extra_fee_amount") or 60.0) if extra_enabled else 0.0
        line_ex = fee_ex + extra_amount
        line_incl = fee_incl + extra_amount
        is_open = not it.get("invoiced")
        if is_open:
            open_count += 1
            totaal_te_factureren_ex += line_ex
            totaal_te_factureren_incl += line_incl
            totaal_extra += extra_amount
        klant_lines = []
        if it.get("customer_name"): klant_lines.append(f"<b>{it['customer_name']}</b>")
        if it.get("customer_phone"): klant_lines.append(it["customer_phone"])
        if it.get("customer_email"): klant_lines.append(it["customer_email"])
        rows.append([
            Paragraph(str(idx), n),
            Paragraph(it.get("bpm_meldcode") or "-", nb),
            Paragraph("<br/>".join(klant_lines) or "-", n),
            Paragraph(
                f"<b>{(it.get('brand') or '') + ' ' + (it.get('model') or '')}</b>"
                f"<br/><font size=7 color='#666'>{it.get('taxatie_nummer','')}</font>",
                n,
            ),
            Paragraph(fmt_date(it.get("bpm_received_at")), n),
            Paragraph(fmt_eur(bedrag), right_b),
            Paragraph(fmt_eur(fee_ex), right_b),
            Paragraph(fmt_eur(extra_amount) if extra_enabled else "\u2014", right_b),
            Paragraph(f"<b>{fmt_eur(line_incl)}</b>", right_b),
            Paragraph("Gefactureerd" if it.get("invoiced") else "Open", n),
        ])

    # Totaal-rij
    rows.append([
        "", "", "", "",
        Paragraph("<b>TOTAAL</b>", right_b),
        Paragraph(f"<b>{fmt_eur(totaal_bpm)}</b>", right_b),
        Paragraph(f"<b>{fmt_eur(totaal_te_factureren_ex - totaal_extra)}</b>", right_b),
        Paragraph(f"<b>{fmt_eur(totaal_extra)}</b>", right_b),
        Paragraph(f"<b>{fmt_eur(totaal_te_factureren_incl)}</b>", right_b),
        "",
    ])

    col_widths = [8*mm, 24*mm, 40*mm, 46*mm, 20*mm, 24*mm, 22*mm, 20*mm, 26*mm, 20*mm]
    tbl = Table(rows, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#18181b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (-1, 0), 0.6, colors.HexColor('#18181b')),
        ('LINEBELOW', (0, 1), (-1, -2), 0.3, colors.HexColor('#e4e4e7')),
        ('LINEABOVE', (0, -1), (-1, -1), 1.0, colors.HexColor('#18181b')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fafafa')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f9fafb')]),
    ]))
    elements.append(tbl)
    elements.append(Spacer(1, 6 * mm))

    elements.append(Paragraph(
        f"<b>Samenvatting:</b> {len(items)} taxatie(s) in {ym_label} \u2014 "
        f"totaal ontvangen BPM <b>{fmt_eur(totaal_bpm)}</b> \u2014 "
        f"<b>{open_count}</b> nog te factureren \u2022 <b>{len(items) - open_count}</b> reeds gefactureerd.",
        n,
    ))
    elements.append(Spacer(1, 2 * mm))
    extra_label = f" (incl. {fmt_eur(totaal_extra)} aan extra fees)" if totaal_extra > 0 else ""
    elements.append(Paragraph(
        f"<b>Te factureren bedrag deze maand:</b> "
        f"{fmt_eur(totaal_te_factureren_ex)} ex BTW \u2014 "
        f"<b>{fmt_eur(totaal_te_factureren_incl)} incl. {btw_pct_int}% BTW</b>"
        f"{extra_label}.",
        n,
    ))
    elements.append(Spacer(1, 3 * mm))
    elements.append(Paragraph(
        f"Gegenereerd op {datetime.now(timezone.utc).strftime('%d-%m-%Y %H:%M')} UTC \u2014 {cb['name']}",
        sm,
    ))

    pdf.build(elements)
    buffer.seek(0)
    pdf_bytes = buffer.getvalue()

    safe_name = cb['name'].replace(' ', '_').replace('.', '')
    filename = f"Maandoverzicht_{safe_name}_{ym}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/taxatie-programma/{taxatie_id}/toggle-extra-fee")
async def toggle_extra_fee(
    taxatie_id: str,
    body: dict | None = None,
    current_user: dict = Depends(require_taxatie_access),
):
    """Schakel de optionele €60 extra fee aan/uit voor deze taxatie.
    Body: {enabled: bool, amount?: float}. Standaard €60 (zonder BTW)."""
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    body = body or {}
    enabled = bool(body.get("enabled"))
    amount = 60.0
    try:
        if body.get("amount") is not None:
            amount = float(body["amount"])
    except (TypeError, ValueError):
        amount = 60.0
    update = {"extra_fee_enabled": enabled, "extra_fee_amount": amount}
    result = await db.taxatie_programma.update_one(
        {"id": taxatie_id, **_owner_filter_for_user(current_user)},
        {"$set": update}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return update


@router.post("/taxatie-programma/{taxatie_id}/mark-invoiced")
async def mark_taxatie_invoiced(
    taxatie_id: str,
    body: dict | None = None,
    current_user: dict = Depends(require_taxatie_access),
):
    """Markeer een (of de hele maand) als gefactureerd zodat het uit de te-doen lijst verdwijnt."""
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    body = body or {}
    invoice_id = (body.get("invoice_id") or "").strip()
    update = {"invoiced": True}
    if invoice_id:
        update["invoice_id"] = invoice_id
    result = await db.taxatie_programma.update_one(
        {"id": taxatie_id, **_owner_filter_for_user(current_user)},
        {"$set": update}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return update

@router.delete("/taxatie-programma/{taxatie_id}")
async def delete_taxatie(taxatie_id: str, current_user: dict = Depends(require_taxatie_access)):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    result = await db.taxatie_programma.delete_one({"id": taxatie_id, **_owner_filter_for_user(current_user)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    return {"status": "deleted"}


@router.get("/taxatie-programma/{taxatie_id}/bundle-pdf")
async def export_bundle_pdf(taxatie_id: str, current_user: dict = Depends(require_taxatie_access)):
    """Genereer één gecombineerde PDF met alle 3 rapporten achter elkaar:
    BPM Rapport + Belastingdienst formulier + Taxatieverslag.
    Gemakkelijk voor printen en archiveren in één bestand.
    """
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")

    doc = await db.taxatie_programma.find_one(
        {"id": taxatie_id, **_owner_filter_for_user(current_user)},
        {"_id": 0, "brand": 1, "model": 1, "taxatie_nummer": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")

    # Roep de 3 bestaande handlers direct aan — zij retourneren Response-objecten
    try:
        r1 = await export_taxatie_pdf(taxatie_id, current_user)
        r2 = await export_belastingdienst_pdf(taxatie_id, current_user)
        r3 = await export_taxatieverslag_pdf(taxatie_id, current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Bundle genereren mislukt bij deelrapport")
        raise HTTPException(status_code=500, detail=f"Deelrapport mislukt: {str(e)}")

    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise HTTPException(status_code=500, detail="PyMuPDF (fitz) niet geïnstalleerd")

    merged = fitz.open()
    for r in (r1, r2, r3):
        pdf_bytes = r.body if hasattr(r, "body") else r.content
        src = fitz.open(stream=pdf_bytes, filetype="pdf")
        merged.insert_pdf(src)
        src.close()
    out_bytes = merged.tobytes()
    merged.close()

    brand = (doc.get("brand") or "Motor").replace(" ", "_")
    model = (doc.get("model") or "").replace(" ", "_")
    tnr = doc.get("taxatie_nummer") or taxatie_id[:8]
    filename = f"Taxatie_Compleet_{brand}_{model}_{tnr}.pdf"
    return Response(
        content=out_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/taxatie-programma/{taxatie_id}/pdf")
async def export_taxatie_pdf(taxatie_id: str, current_user: dict = Depends(require_taxatie_access)):
    """Generate a BPM Import Rapport PDF matching Belastingdienst format"""
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    
    doc = await db.taxatie_programma.find_one({"id": taxatie_id, **_owner_filter_for_user(current_user)}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    
    from services.branding import get_branding
    cb = get_branding(current_user)
    
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
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
    elements.append(Paragraph(f"{cb['name']} | Rapportnummer: {doc.get('taxatie_nummer', '-')}", subtitle_style))
    
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
    
    # NB: De AI gegenereerde "Toelichting taxateur" staat alleen in het Taxatieverslag PDF
    # (officieel rapport voor de Belastingdienst), niet hier. Voorkomt dubbele weergave.
    
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
    elements.append(Paragraph(f"Opgesteld door: {cb['name']} | Datum: {report_date_str} | {doc.get('taxatie_nummer', '')}", small_style))
    elements.append(Paragraph(f"Dit rapport is opgesteld conform de richtlijnen van de Belastingdienst voor BPM-aangifte bij import van {cb['vehicle_label_plural']}.", small_style))
    
    pdf.build(elements)
    buffer.seek(0)
    
    filename = f"BPM_Rapport_{doc.get('brand', 'Motor')}_{doc.get('model', '')}_{now.strftime('%Y%m%d')}.pdf"
    return Response(
        content=buffer.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )




@router.get("/taxatie-programma/{taxatie_id}/belastingdienst-pdf")
async def export_belastingdienst_pdf(taxatie_id: str, current_user: dict = Depends(require_taxatie_access)):
    """Fill the official Belastingdienst BPM form with taxatie data using PyMuPDF"""
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    
    doc_data = await db.taxatie_programma.find_one({"id": taxatie_id, **_owner_filter_for_user(current_user)}, {"_id": 0})
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
async def export_taxatieverslag_pdf(taxatie_id: str, current_user: dict = Depends(require_taxatie_access)):
    """Generate official Taxatieverslag PDF for Belastingdienst - AutoTelex style for motorcycles"""
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    
    doc = await db.taxatie_programma.find_one({"id": taxatie_id, **_owner_filter_for_user(current_user)}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Taxatie niet gevonden")
    
    from services.branding import get_branding
    cb = get_branding(current_user)
    
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
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
        Paragraph(f"<b>Taxatierapport {cb['vehicle_label'].capitalize()}</b><br/>{taxatie_nr}", ParagraphStyle('H2', parent=n, fontSize=10, textColor=colors.HexColor('#ccc'), alignment=TA_RIGHT)),
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
    taxateur_name = (current_user or {}).get("username") or (current_user or {}).get("company_name") or "S. Milone"
    info_data = [
        [Paragraph("<b>Naam:</b>", label_s), cb['name'], Paragraph("<b>Datum rapport:</b>", label_s), report_date_str],
        [Paragraph("<b>RSIN:</b>", label_s), cb.get('rsin') or "-", Paragraph("<b>KVK:</b>", label_s), cb.get('kvk') or "-"],
        [Paragraph("<b>Adres:</b>", label_s), cb.get('address') or "-", Paragraph("<b>Taxateur:</b>", label_s), taxateur_name],
        [Paragraph("<b>Tel:</b>", label_s), cb.get('phone') or "-", Paragraph("<b>Email:</b>", label_s), cb.get('email') or "-"],
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
    elements.append(Paragraph(f"1. Gegevens {cb['vehicle_label']}", section_s))
    
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
        [f"Bruto BPM {cb['vehicle_label']}", fe(bruto_bpm)],
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
    
    # Section 5: Toelichting taxateur (AI gegenereerde unieke onderbouwing op aparte pagina)
    if doc.get("damage_notes"):
        elements.append(PageBreak())
        elements.append(Paragraph("5. Toelichting taxateur", section_s))
        elements.append(Spacer(1, 3*mm))
        toelichting_s = ParagraphStyle(
            'TLT', parent=n, fontSize=10, leading=14, alignment=TA_JUSTIFY, spaceAfter=4*mm
        )
        paragraphs = [p.strip() for p in str(doc["damage_notes"]).replace("\r", "").split("\n\n") if p.strip()]
        if not paragraphs:
            paragraphs = [str(doc["damage_notes"]).strip()]
        for p in paragraphs:
            elements.append(Paragraph(p.replace("\n", " "), toelichting_s))
        elements.append(Spacer(1, 4*mm))
        elements.append(HRFlowable(width="40%", thickness=0.5, color=colors.HexColor('#999')))
        elements.append(Spacer(1, 2*mm))
        elements.append(Paragraph(
            "Onderbouwing opgesteld door de taxateur op basis van fysieke inspectie en bevindingen.",
            ParagraphStyle('TLTSig', parent=sm, fontSize=8, textColor=colors.HexColor('#666'))
        ))
        elements.append(Spacer(1, 6*mm))
    
    # Section 6: Verklaring & Ondertekening
    elements.append(Paragraph("6. Verklaring en ondertekening", section_s))
    location_text = cb.get('address') or "het bedrijfsadres"
    elements.append(Paragraph(
        f"Ondergetekende verklaart dat het motorrijtuig <b>{brand} {model}</b> "
        f"(chassisnummer <b>{vin}</b>) op <b>{report_date_str}</b> fysiek is ge\u00efnspecteerd "
        f"op locatie {location_text}. "
        f"De in dit verslag genoemde schadeposten zijn daadwerkelijk geconstateerd en de geschatte "
        f"herstelkosten zijn gebaseerd op gangbare tarieven in de {cb['branche_label']} "
        f"(uurtarief arbeid: \u20ac {TAXATIE_LABOR_RATE:.2f} excl. BTW, materiaalkosten op basis van actuele prijzen). "
        f"Dit taxatieverslag is opgesteld ten behoeve van de BPM-aangifte conform artikel 10, lid 7 van de Wet op de belasting van personenauto's en motorrijwielen 1992.",
        n
    ))
    elements.append(Spacer(1, 6*mm))
    
    sign_data = [
        [Paragraph("<b>Naam</b>", label_s), taxateur_name, Paragraph("<b>Datum</b>", label_s), report_date_str],
        [Paragraph("<b>Functie</b>", label_s), "Directeur / Taxateur", Paragraph("<b>Bedrijf</b>", label_s), cb['name']],
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
    
    # Section 7: Wettelijke onderbouwing (alleen voor motorfietsen / import-context)
    if cb['vehicle_label'] == 'motorfiets':
        elements.append(PageBreak())
        elements.append(Paragraph("7. Wettelijke onderbouwing BPM-vermindering (import)", section_s))
        elements.append(Spacer(1, 3*mm))
        legal_s = ParagraphStyle(
            'Legal', parent=n, fontSize=9.5, leading=13, alignment=TA_JUSTIFY, spaceAfter=3*mm
        )
        legal_quote_s = ParagraphStyle(
            'LegalQuote', parent=n, fontSize=9, leading=12.5, alignment=TA_JUSTIFY,
            leftIndent=8*mm, rightIndent=8*mm, spaceAfter=3*mm,
            textColor=colors.HexColor('#444'), borderColor=colors.HexColor('#ccc'),
            borderWidth=0, borderPadding=4
        )
        legal_h_s = ParagraphStyle(
            'LegalH', parent=n, fontSize=10, leading=13, spaceAfter=2*mm, spaceBefore=3*mm,
            textColor=colors.HexColor('#222'), fontName='Helvetica-Bold'
        )

        elements.append(Paragraph("Artikel 10, lid 7 — Wet op de belasting van personenauto's en motorrijwielen 1992", legal_h_s))
        elements.append(Paragraph(
            "<i>\"De vermindering, bedoeld in het tweede lid, wordt op verzoek van de aangever vastgesteld op basis van een taxatierapport. "
            "Bij ministeriële regeling kunnen voorwaarden worden gesteld waaraan een taxatierapport moet voldoen om in aanmerking te komen voor "
            "toepassing van de waardevermindering, bedoeld in dit artikel.\"</i>",
            legal_quote_s
        ))
        elements.append(Paragraph(
            "Bron: <b>wetten.overheid.nl</b> &mdash; Wet BPM 1992, artikel 10. Dit artikel bepaalt dat een gemotiveerd taxatierapport leidend is "
            "voor de vaststelling van de werkelijke marktwaarde van een ge&iuml;mporteerd voertuig, en daarmee voor de te betalen BPM.",
            legal_s
        ))

        elements.append(Paragraph("Hoge Raad 17 januari 2014 &mdash; ECLI:NL:HR:2014:80", legal_h_s))
        elements.append(Paragraph(
            "<i>\"De handelsinkoopwaarde is de prijs die een (handelaar in) gebruikte motorvoertuigen voor het te taxeren voertuig zou willen betalen. "
            "Bij de bepaling van die waarde dient rekening te worden gehouden met alle waardedrukkende omstandigheden, waaronder de staat van het voertuig "
            "alsmede met factoren die specifiek samenhangen met de import en het in Nederland verkoopklaar maken van het voertuig.\"</i>",
            legal_quote_s
        ))
        elements.append(Paragraph(
            "Bron: <b>uitspraken.rechtspraak.nl</b> &mdash; ECLI:NL:HR:2014:80. Deze uitspraak bevestigt expliciet dat <b>importgerelateerde kosten en "
            "marktverschillen</b> een waardedrukkend effect hebben op de handelsinkoopwaarde, en dus op de af te dragen BPM.",
            legal_s
        ))

        elements.append(Paragraph("Toegepaste waardedrukkende factoren in dit rapport", legal_h_s))
        legal_factors = (
            "1. <b>Logistieke en transactiekosten import</b>: ophalen in het land van herkomst (BE/DE/AT/IT/CH), "
            "grenstransport, douaneformaliteiten en exportkenteken brengen aanzienlijke extra kosten met zich mee.<br/>"
            "2. <b>Aanvullende keurings- en onderhoudskosten</b>: volledige onderhoudsbeurt en RDW-keuring zijn noodzakelijk; "
            "tevens vervanging van koplampen/snelheidsmeter naar Nederlandse specificatie en eventuele aanpassing van de uitlaat.<br/>"
            "3. <b>Geen Nederlandse onderhoudshistorie / garantieverlies</b>: het ontbreken van een Nederlandse dealerhistorie "
            "en de niet-overdraagbare fabrieksgarantie drukken de marktwaarde structureel.<br/>"
            "4. <b>Verminderde verkoopbaarheid</b>: vraagprijzen op AutoScout24 en Marktplaats voor importmotoren liggen aantoonbaar "
            "10-20% onder die van vergelijkbare Nederlandse exemplaren.<br/>"
            "5. <b>Technische gebreken en herstelkosten</b>: zoals gespecificeerd in sectie 3 en 5 van dit verslag."
        )
        elements.append(Paragraph(legal_factors, legal_s))
        elements.append(Spacer(1, 3*mm))
        elements.append(HRFlowable(width="40%", thickness=0.5, color=colors.HexColor('#999')))
        elements.append(Spacer(1, 1*mm))
        elements.append(Paragraph(
            "Deze wettelijke onderbouwing maakt integraal deel uit van het taxatieverslag en dient als juridische basis "
            "voor de vastgestelde rest-BPM in sectie 4.",
            ParagraphStyle('LegalSig', parent=sm, fontSize=8, textColor=colors.HexColor('#666'))
        ))
        elements.append(Spacer(1, 4*mm))
    
    # Footer
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#ddd')))
    elements.append(Spacer(1, 2*mm))
    elements.append(Paragraph(
        f"Dit document dient als bijlage bij de Aangifte BPM (formulier BPM 011) en vervangt het taxatierapport voor {cb['vehicle_label_plural']}. "
        f"{cb['name']} | KVK {cb.get('kvk') or '-'}{(' | RSIN ' + cb.get('rsin')) if cb.get('rsin') else ''} | {cb.get('address') or ''}",
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
