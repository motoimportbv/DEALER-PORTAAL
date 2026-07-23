"""
MotoDirect.nl - B2C Consumer Platform
Particulieren kopen motoren direct van de importeur tegen dealerprijzen.
35% aanbetaling via Stripe.
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging

from config import STRIPE_API_KEY, logger
from database import db
from services import (
    hash_password, verify_password, create_token,
    get_current_user,
    send_email, send_admin_notification,
)
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest
)

router = APIRouter(tags=["MotoDirect"])

MOTODIRECT_DEPOSIT_PERCENTAGE = 0.35  # 35% aanbetaling voor particulieren

# ============ AUTH ============

async def get_current_motodirect_user(user: dict = Depends(get_current_user)):
    """Get authenticated MotoDirect private buyer"""
    if user.get("role") != "motodirect_buyer":
        raise HTTPException(status_code=403, detail="Alleen MotoDirect klanten")
    return user


@router.post("/motodirect/register")
async def motodirect_register(data: dict = Body(...)):
    """Register a new private buyer (particulier) on MotoDirect."""
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    address = (data.get("address") or "").strip()
    postal_code = (data.get("postal_code") or "").strip()
    city = (data.get("city") or "").strip()
    bsn = (data.get("bsn") or "").strip()

    # Validation
    if not email or not password or not name:
        raise HTTPException(status_code=400, detail="Email, wachtwoord en naam zijn verplicht")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Wachtwoord minimaal 6 tekens")
    if not phone or not address or not postal_code or not city:
        raise HTTPException(status_code=400, detail="Alle NAW-gegevens zijn verplicht")
    # Basic BSN validation: 8 or 9 digits
    bsn_digits = "".join(c for c in bsn if c.isdigit())
    if len(bsn_digits) not in (8, 9):
        raise HTTPException(status_code=400, detail="Ongeldig BSN nummer (8 of 9 cijfers)")

    # Check duplicate
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email is al geregistreerd")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "password": hash_password(password),
        "role": "motodirect_buyer",
        "company_name": name,  # Reuse field for full name
        "contact_person": name,
        "phone": phone,
        "address": address,
        "postal_code": postal_code,
        "city": city,
        "bsn": bsn_digits,  # Stored for RDW import registration
        "is_approved": True,  # Particulieren auto-approved
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)

    # Notify admin
    try:
        await send_admin_notification(
            "Nieuwe MotoDirect klant",
            f"Nieuwe particulier geregistreerd: <b>{name}</b> ({email}) uit {city}."
        )
    except Exception as e:
        logger.warning(f"Admin notification failed: {e}")

    token = create_token(user_id, email, "motodirect_buyer")
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": email,
            "name": name,
            "role": "motodirect_buyer",
        }
    }


@router.post("/motodirect/login")
async def motodirect_login(data: dict = Body(...)):
    """Login for private buyer."""
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email en wachtwoord zijn verplicht")
    user = await db.users.find_one({"email": email})
    if not user or user.get("role") != "motodirect_buyer":
        raise HTTPException(status_code=401, detail="Ongeldige inloggegevens")
    if not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Ongeldige inloggegevens")
    token = create_token(user["id"], user["email"], "motodirect_buyer")
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("contact_person", user.get("company_name")),
            "role": "motodirect_buyer",
        }
    }


@router.get("/motodirect/me")
async def motodirect_me(user: dict = Depends(get_current_motodirect_user)):
    """Return current buyer info."""
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("contact_person", user.get("company_name")),
        "phone": user.get("phone", ""),
        "address": user.get("address", ""),
        "postal_code": user.get("postal_code", ""),
        "city": user.get("city", ""),
    }


# ============ CATALOG (public) ============

@router.get("/motodirect/catalog")
async def motodirect_catalog(
    brand: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_year: Optional[int] = None,
    max_year: Optional[int] = None,
    sort: Optional[str] = "newest",
    limit: int = 60,
    offset: int = 0,
):
    """Public catalog: alle beschikbare motoren voor particulieren."""
    query = {
        "is_available": True,
    }
    if brand:
        query["brand"] = brand
    price_range = {}
    if min_price is not None:
        price_range["$gte"] = float(min_price)
    if max_price is not None:
        price_range["$lte"] = float(max_price)
    if price_range:
        query["price"] = price_range
    year_range = {}
    if min_year is not None:
        year_range["$gte"] = int(min_year)
    if max_year is not None:
        year_range["$lte"] = int(max_year)
    if year_range:
        query["year"] = year_range

    sort_map = {
        "newest": [("created_at", -1)],
        "price_low": [("price", 1)],
        "price_high": [("price", -1)],
        "year_new": [("year", -1)],
    }
    sort_by = sort_map.get(sort or "newest", sort_map["newest"])

    total = await db.motorcycles.count_documents(query)
    cursor = db.motorcycles.find(query, {"_id": 0}).sort(sort_by).skip(offset).limit(limit)
    motorcycles = await cursor.to_list(limit)

    # Trim fields for public listing
    result = []
    for m in motorcycles:
        result.append({
            "id": m.get("id"),
            "brand": m.get("brand"),
            "model": m.get("model"),
            "year": m.get("year"),
            "price": m.get("price"),
            "mileage": m.get("mileage"),
            "color": m.get("color", ""),
            "condition": m.get("condition", ""),
            "images": m.get("images", []),
            "description": m.get("description", ""),
        })

    # Brands with counts (for filter sidebar)
    brand_agg = await db.motorcycles.aggregate([
        {"$match": {"is_available": True}},
        {"$group": {"_id": "$brand", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]).to_list(500)
    brands = [{"name": b["_id"], "count": b["count"]} for b in brand_agg if b["_id"]]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "motorcycles": result,
        "brands": brands,
    }


@router.get("/motodirect/catalog/{motorcycle_id}")
async def motodirect_catalog_detail(motorcycle_id: str):
    """Public motor detail."""
    m = await db.motorcycles.find_one({"id": motorcycle_id, "is_available": True}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Motor niet gevonden of niet meer beschikbaar")
    return {
        "id": m.get("id"),
        "brand": m.get("brand"),
        "model": m.get("model"),
        "year": m.get("year"),
        "price": m.get("price"),
        "mileage": m.get("mileage"),
        "color": m.get("color", ""),
        "condition": m.get("condition", ""),
        "images": m.get("images", []),
        "description": m.get("description", ""),
        "chassis_number": m.get("chassis_number", ""),
        "deposit_percentage": MOTODIRECT_DEPOSIT_PERCENTAGE,
        "deposit_amount": round(float(m.get("price", 0)) * MOTODIRECT_DEPOSIT_PERCENTAGE, 2),
    }


# ============ CHECKOUT (35% deposit via Stripe) ============

@router.post("/motodirect/checkout")
async def motodirect_checkout(
    data: dict = Body(...),
    user: dict = Depends(get_current_motodirect_user),
):
    """Create Stripe checkout session for 35% deposit."""
    motorcycle_id = data.get("motorcycle_id")
    origin_url = data.get("origin_url", "")
    if not motorcycle_id or not origin_url:
        raise HTTPException(status_code=400, detail="motorcycle_id en origin_url vereist")

    motor = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motor:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    if not motor.get("is_available", True):
        raise HTTPException(status_code=400, detail="Motor is niet meer beschikbaar")

    motor_price = float(motor["price"])
    deposit_amount = round(motor_price * MOTODIRECT_DEPOSIT_PERCENTAGE, 2)

    snapshot = {
        "id": motor["id"],
        "brand": motor.get("brand"),
        "model": motor.get("model"),
        "year": motor.get("year"),
        "price": motor.get("price"),
        "mileage": motor.get("mileage"),
        "color": motor.get("color"),
        "images": motor.get("images", []),
    }

    order_id = str(uuid.uuid4())
    order_doc = {
        "id": order_id,
        "motorcycle_id": motorcycle_id,
        "buyer_id": user["id"],
        "buyer_email": user["email"],
        "buyer_name": user.get("contact_person", user.get("company_name")),
        "buyer_phone": user.get("phone", ""),
        "buyer_address": user.get("address", ""),
        "buyer_postal_code": user.get("postal_code", ""),
        "buyer_city": user.get("city", ""),
        "total_price": motor_price,
        "deposit_amount": deposit_amount,
        "deposit_percentage": MOTODIRECT_DEPOSIT_PERCENTAGE,
        "remaining_amount": motor_price - deposit_amount,
        "status": "pending",
        "payment_status": "pending",
        "motorcycle_snapshot": snapshot,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.motodirect_orders.insert_one(order_doc)

    try:
        webhook_url = f"{origin_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        success_url = f"{origin_url}/motodirect/checkout/success?session_id={{CHECKOUT_SESSION_ID}}&order_id={order_id}"
        cancel_url = f"{origin_url}/motodirect/motor/{motorcycle_id}"

        checkout_request = CheckoutSessionRequest(
            amount=deposit_amount,
            currency="eur",
            success_url=success_url,
            cancel_url=cancel_url,
            payment_methods=["ideal", "card"],
            metadata={
                "motodirect_order_id": order_id,
                "motorcycle_id": motorcycle_id,
                "buyer_id": user["id"],
                "deposit_amount": str(deposit_amount),
                "total_price": str(motor_price),
            }
        )
        session = await stripe_checkout.create_checkout_session(checkout_request)
        await db.motodirect_orders.update_one(
            {"id": order_id},
            {"$set": {"stripe_session_id": session.session_id}}
        )
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "order_id": order_id,
            "deposit_amount": deposit_amount,
            "total_price": motor_price,
        }
    except Exception as e:
        await db.motodirect_orders.delete_one({"id": order_id})
        logger.error(f"MotoDirect Stripe error: {e}")
        raise HTTPException(status_code=500, detail=f"Betaling kon niet worden gestart: {e}")


@router.get("/motodirect/order-status/{session_id}")
async def motodirect_order_status(
    session_id: str,
    user: dict = Depends(get_current_motodirect_user),
):
    """Poll payment status and finalize order if paid."""
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        status = await stripe_checkout.get_checkout_status(session_id)

        order = await db.motodirect_orders.find_one({"stripe_session_id": session_id, "buyer_id": user["id"]}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Bestelling niet gevonden")

        if status.payment_status == "paid" and order.get("payment_status") != "paid":
            await db.motodirect_orders.update_one(
                {"id": order["id"]},
                {"$set": {"payment_status": "paid", "status": "reserved",
                          "paid_at": datetime.now(timezone.utc).isoformat()}}
            )
            # Reserve motorcycle
            await db.motorcycles.update_one(
                {"id": order["motorcycle_id"]},
                {"$set": {"is_available": False, "reserved_for_motodirect": True}}
            )
            # Notify admin
            try:
                snap = order.get("motorcycle_snapshot", {})
                await send_admin_notification(
                    "MotoDirect - Nieuwe aanbetaling",
                    f"<h3>Aanbetaling ontvangen</h3>"
                    f"<p><b>Klant:</b> {order['buyer_name']} ({order['buyer_email']})<br>"
                    f"<b>Motor:</b> {snap.get('brand')} {snap.get('model')} ({snap.get('year')})<br>"
                    f"<b>Aanbetaling:</b> €{order['deposit_amount']:.2f}<br>"
                    f"<b>Totaal:</b> €{order['total_price']:.2f}<br>"
                    f"<b>Restant:</b> €{order['remaining_amount']:.2f}</p>"
                )
            except Exception as e:
                logger.warning(f"Admin notify failed: {e}")

        return {
            "payment_status": status.payment_status,
            "status": status.status,
            "order_id": order["id"],
            "deposit_amount": order["deposit_amount"],
            "total_price": order["total_price"],
            "remaining_amount": order.get("remaining_amount"),
            "motorcycle": order.get("motorcycle_snapshot"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MotoDirect status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/motodirect/my-orders")
async def motodirect_my_orders(user: dict = Depends(get_current_motodirect_user)):
    """List all orders for the current buyer."""
    orders = await db.motodirect_orders.find(
        {"buyer_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"orders": orders}


# ============ ADMIN endpoints ============

async def _require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Alleen admin")
    return user


@router.get("/motodirect/admin/orders")
async def motodirect_admin_orders(admin: dict = Depends(_require_admin)):
    """Admin: list all MotoDirect orders."""
    orders = await db.motodirect_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"orders": orders}


@router.get("/motodirect/admin/customers")
async def motodirect_admin_customers(admin: dict = Depends(_require_admin)):
    """Admin: list all MotoDirect registered buyers."""
    users = await db.users.find(
        {"role": "motodirect_buyer"},
        {"_id": 0, "password": 0}
    ).sort("created_at", -1).to_list(500)
    return {"customers": users}
