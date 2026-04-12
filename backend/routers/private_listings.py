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
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

router = APIRouter(tags=["Private Listings"])

# ============ PRIVATE LISTINGS (PARTICULIEREN) ENDPOINTS ============


@router.post("/private-listings/register")
async def register_private_seller(data: dict = Body(...)):
    """Register a new private seller account"""
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "").strip()
    phone = data.get("phone", "").strip()
    city = data.get("city", "").strip()
    
    if not email or not password or not name:
        raise HTTPException(status_code=400, detail="Naam, email en wachtwoord zijn verplicht")
    
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Dit emailadres is al in gebruik")
    
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": name,
        "phone": phone,
        "city": city,
        "password_hash": hashed,
        "role": "particulier",
        "is_approved": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, email, "particulier")
    return {"token": token, "user": {"id": user_id, "email": email, "name": name, "role": "particulier", "phone": phone, "city": city}}

@router.post("/private-listings")
async def create_private_listing(data: PrivateListingCreate, current_user: dict = Depends(get_current_user)):
    """Create a new private motorcycle listing (requires payment)"""
    if current_user.get("role") != "particulier":
        raise HTTPException(status_code=403, detail="Alleen particulieren kunnen hier adverteren")
    
    listing = PrivateListing(
        user_id=current_user["id"],
        user_name=current_user.get("name", data.name or "Particulier"),
        user_email=current_user.get("email", data.email),
        user_phone=data.phone or current_user.get("phone", ""),
        city=data.city or current_user.get("city", ""),
        brand=data.brand,
        model=data.model,
        year=data.year,
        mileage=data.mileage,
        price=data.price,
        description=data.description,
        color=data.color,
        photos=data.photos,
        is_active=False,
        is_paid=False,
    )
    await db.private_listings.insert_one(listing.model_dump())
    return {"listing_id": listing.id, "message": "Advertentie aangemaakt. Betaal om te activeren."}

@router.post("/private-listings/{listing_id}/checkout")
async def create_private_listing_checkout(listing_id: str, request: Request, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout for a private listing"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    listing = await db.private_listings.find_one({"id": listing_id, "user_id": current_user["id"]}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Advertentie niet gevonden")
    if listing.get("is_paid"):
        raise HTTPException(status_code=400, detail="Deze advertentie is al betaald")
    
    origin_url = body.get("origin_url", str(request.base_url).rstrip("/"))
    success_url = f"{origin_url}/particulier/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/particulier"
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    checkout_req = CheckoutSessionRequest(
        amount=PRIVATE_LISTING_PRICE,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "listing_id": listing_id,
            "user_id": current_user["id"],
            "type": "private_listing",
        },
        payment_methods=["card", "ideal"],
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)
    
    # Store payment transaction
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "listing_id": listing_id,
        "user_id": current_user["id"],
        "amount": PRIVATE_LISTING_PRICE,
        "currency": "eur",
        "status": "pending",
        "payment_status": "initiated",
        "type": "private_listing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Link session to listing
    await db.private_listings.update_one(
        {"id": listing_id},
        {"$set": {"payment_session_id": session.session_id}}
    )
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@router.get("/private-listings/checkout-status/{session_id}")
async def check_private_listing_payment(session_id: str, current_user: dict = Depends(get_current_user)):
    """Check payment status and activate listing if paid"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update payment transaction
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": status.status, "payment_status": status.payment_status}}
    )
    
    # Activate listing if paid
    if status.payment_status == "paid":
        listing = await db.private_listings.find_one({"payment_session_id": session_id}, {"_id": 0})
        if listing and not listing.get("is_paid"):
            expires = datetime.now(timezone.utc) + timedelta(days=7)
            await db.private_listings.update_one(
                {"payment_session_id": session_id},
                {"$set": {
                    "is_active": True,
                    "is_paid": True,
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": expires.isoformat(),
                }}
            )
    
    return {"status": status.status, "payment_status": status.payment_status}

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    
    try:
        event = await stripe_checkout.handle_webhook(body, sig)
        if event.payment_status == "paid" and event.metadata.get("type") == "private_listing":
            listing_id = event.metadata.get("listing_id")
            if listing_id:
                listing = await db.private_listings.find_one({"id": listing_id}, {"_id": 0})
                if listing and not listing.get("is_paid"):
                    expires = datetime.now(timezone.utc) + timedelta(days=7)
                    await db.private_listings.update_one(
                        {"id": listing_id},
                        {"$set": {
                            "is_active": True, "is_paid": True,
                            "paid_at": datetime.now(timezone.utc).isoformat(),
                            "expires_at": expires.isoformat(),
                        }}
                    )
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"status": "completed", "payment_status": "paid"}}
                )
        # Handle dealer private purchase payment
        elif event.payment_status == "paid" and event.metadata.get("type") == "dealer_private_purchase":
            listing_id = event.metadata.get("listing_id")
            dealer_id = event.metadata.get("dealer_id")
            if listing_id and dealer_id:
                existing = await db.private_listing_purchases.find_one({"dealer_id": dealer_id, "listing_id": listing_id})
                if not existing:
                    await db.private_listing_purchases.insert_one({
                        "id": str(uuid.uuid4()),
                        "dealer_id": dealer_id,
                        "listing_id": listing_id,
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                        "session_id": event.session_id,
                    })
                    # Mark listing as sold
                    await db.private_listings.update_one(
                        {"id": listing_id},
                        {"$set": {"status": "sold", "sold_to_dealer": dealer_id, "sold_at": datetime.now(timezone.utc).isoformat()}}
                    )
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"status": "completed", "payment_status": "paid"}}
                )
        # Handle Google Motor subscription payment
        elif event.payment_status == "paid" and event.metadata.get("type") == "google_motor_subscription":
            plan = event.metadata.get("plan")
            dealer_id = event.metadata.get("dealer_id")
            sub = await db.google_motor_subscriptions.find_one({"session_id": event.session_id})
            if sub and sub.get("status") != "active":
                update = {"status": "active", "paid_at": datetime.now(timezone.utc).isoformat()}
                if plan == "monthly":
                    update["expires_at"] = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                await db.google_motor_subscriptions.update_one({"session_id": event.session_id}, {"$set": update})
                logger.info(f"Google motor subscription activated: {plan} for dealer {dealer_id}")
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

@router.get("/private-listings/my")
async def get_my_private_listings(current_user: dict = Depends(get_current_user)):
    """Get listings for current private seller"""
    listings = await db.private_listings.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return listings

@router.get("/private-listings/active")
async def get_active_private_listings(current_user: dict = Depends(get_current_user)):
    """Get all active private listings for dealers and the allowed admin"""
    role = current_user.get("role")
    email = current_user.get("email", "").lower()
    
    # Only dealers and the specific admin are allowed
    if role == "admin" and email != ALLOWED_ADMIN_EMAIL_PRIVATE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    if role not in ["dealer", "admin"]:
        raise HTTPException(status_code=403, detail="Alleen dealers")
    
    now = datetime.now(timezone.utc).isoformat()
    listings = await db.private_listings.find(
        {"is_active": True, "is_paid": True, "expires_at": {"$gt": now}}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Check which listings this dealer has already purchased
    dealer_id = current_user["id"]
    purchases = await db.private_listing_purchases.find(
        {"dealer_id": dealer_id}, {"_id": 0}
    ).to_list(500)
    purchased_ids = {p["listing_id"] for p in purchases}
    
    for listing in listings:
        listing["is_purchased"] = listing["id"] in purchased_ids
    
    return listings

@router.post("/private-listings/{listing_id}/dealer-checkout")
async def create_dealer_purchase_checkout(listing_id: str, request: Request, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout for a dealer to BUY a motorcycle from a private seller (EUR 175)"""
    role = current_user.get("role")
    email = current_user.get("email", "").lower()
    if role == "admin" and email != ALLOWED_ADMIN_EMAIL_PRIVATE:
        raise HTTPException(status_code=403, detail="Geen toegang")
    if role not in ["dealer", "admin"]:
        raise HTTPException(status_code=403, detail="Alleen dealers")
    
    listing = await db.private_listings.find_one({"id": listing_id, "is_active": True, "is_paid": True}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Advertentie niet gevonden of niet meer actief")
    
    # Check if dealer already purchased
    existing = await db.private_listing_purchases.find_one({"dealer_id": current_user["id"], "listing_id": listing_id})
    if existing:
        raise HTTPException(status_code=400, detail="U heeft deze motor al gekocht")
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    origin_url = body.get("origin_url", str(request.base_url).rstrip("/"))
    success_url = f"{origin_url}/dealer?private_purchase=success&listing_id={listing_id}"
    cancel_url = f"{origin_url}/dealer?tab=particulier"
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    checkout_req = CheckoutSessionRequest(
        amount=DEALER_CONTACT_FEE,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "listing_id": listing_id,
            "dealer_id": current_user["id"],
            "type": "dealer_private_purchase",
        },
        payment_methods=["card", "ideal"],
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)
    
    # Store payment transaction
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "listing_id": listing_id,
        "dealer_id": current_user["id"],
        "amount": DEALER_CONTACT_FEE,
        "currency": "eur",
        "status": "pending",
        "payment_status": "initiated",
        "type": "dealer_private_purchase",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@router.post("/private-listings/dealer-purchase-confirm")
async def confirm_dealer_purchase(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Confirm dealer purchase after successful Stripe payment"""
    listing_id = body.get("listing_id", "")
    
    if not listing_id:
        raise HTTPException(status_code=400, detail="listing_id is verplicht")
    
    existing = await db.private_listing_purchases.find_one({"dealer_id": current_user["id"], "listing_id": listing_id})
    if existing:
        return {"status": "already_purchased"}
    
    tx = await db.payment_transactions.find_one({
        "listing_id": listing_id,
        "dealer_id": current_user["id"],
        "type": "dealer_private_purchase",
    }, {"_id": 0})
    
    if not tx:
        raise HTTPException(status_code=404, detail="Geen betaling gevonden")
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    status = await stripe_checkout.get_checkout_status(tx["session_id"])
    
    if status.payment_status == "paid":
        await db.private_listing_purchases.insert_one({
            "id": str(uuid.uuid4()),
            "dealer_id": current_user["id"],
            "listing_id": listing_id,
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "session_id": tx["session_id"],
        })
        await db.payment_transactions.update_one(
            {"session_id": tx["session_id"]},
            {"$set": {"status": "completed", "payment_status": "paid"}}
        )
        # Mark listing as sold
        await db.private_listings.update_one(
            {"id": listing_id},
            {"$set": {"status": "sold", "sold_to_dealer": current_user["id"], "sold_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"status": "purchased"}
    
    return {"status": "pending", "payment_status": status.payment_status}


