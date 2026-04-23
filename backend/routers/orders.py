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

router = APIRouter(tags=["Orders"])

# ============ ORDER ENDPOINTS ============

@router.post("/orders", response_model=Order)
async def create_order(data: OrderCreate, user: dict = Depends(require_approved_dealer)):
    # Check motorcycle exists and is available
    motorcycle = await db.motorcycles.find_one({"id": data.motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motorcycle not found")
    if not motorcycle.get("is_available", True):
        raise HTTPException(status_code=400, detail="Motorcycle not available")
    
    # Check if dealer already has pending order for this motorcycle
    existing = await db.orders.find_one({
        "motorcycle_id": data.motorcycle_id,
        "dealer_id": user["id"],
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending order for this motorcycle")
    
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
    
    order = Order(
        motorcycle_id=data.motorcycle_id,
        dealer_id=user["id"],
        dealer_email=user["email"],
        dealer_company=user["company_name"],
        notes=data.notes or "",
        motorcycle_snapshot=motorcycle_snapshot
    )
    doc = order.model_dump()
    await db.orders.insert_one(doc)
    return order

@router.get("/orders", response_model=List[OrderWithMotorcycle])
async def get_orders(user: dict = Depends(require_approved_dealer)):
    if user["role"] in ("admin", "pakbon"):
        # Admin/Pakbon ziet alle orders (inclusief gearchiveerd)
        orders = await db.orders.find(
            {}, 
            {"_id": 0}
        ).sort("created_at", -1).to_list(10000)
    else:
        # Dealers zien hun orders (niet gearchiveerd)
        orders = await db.orders.find(
            {"dealer_id": user["id"], "archived": {"$ne": True}}, 
            {"_id": 0}
        ).sort("created_at", -1).to_list(10000)
    
    # Filter out orders without required fields and collect motorcycle IDs
    valid_orders = []
    motorcycle_ids = set()
    for order in orders:
        # Skip orders without required fields
        if not order.get("id") or not order.get("motorcycle_id") or not order.get("dealer_id"):
            continue
        valid_orders.append(order)
        motorcycle_ids.add(order["motorcycle_id"])
    
    # Batch fetch motorcycles to avoid N+1 query
    motorcycles_list = await db.motorcycles.find(
        {"id": {"$in": list(motorcycle_ids)}}, 
        {"_id": 0}
    ).to_list(1000)
    motorcycles_map = {m["id"]: m for m in motorcycles_list}
    
    # Enrich orders with motorcycle data (use snapshot as fallback)
    result = []
    for order in valid_orders:
        # Try to get live motorcycle data, fallback to snapshot
        motorcycle_data = motorcycles_map.get(order["motorcycle_id"])
        if not motorcycle_data:
            motorcycle_data = order.get("motorcycle_snapshot")
        order["motorcycle"] = motorcycle_data
        result.append(order)
    
    return result

@router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, user: dict = Depends(require_admin)):
    if status not in ["pending", "approved", "rejected", "completed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    
    # If approved or completed, mark motorcycle as unavailable
    if status in ["approved", "completed"]:
        await db.motorcycles.update_one({"id": order["motorcycle_id"]}, {"$set": {"is_available": False}})
    
    return {"message": f"Order status updated to {status}"}

@router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user: dict = Depends(require_approved_dealer)):
    """Delete an order - dealers can only delete their own orders"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check authorization: dealers can only delete their own orders, admins can delete any
    if user["role"] != "admin" and order.get("dealer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this order")
    
    # Delete the order
    await db.orders.delete_one({"id": order_id})
    
    # Make the motorcycle available again if it was reserved
    await db.motorcycles.update_one(
        {"id": order["motorcycle_id"]}, 
        {"$set": {"is_available": True}}
    )
    
    return {"message": "Order deleted successfully"}

@router.put("/orders/{order_id}/archive")
async def archive_order(order_id: str, user: dict = Depends(require_approved_dealer)):
    """Archive an order - dealers can only archive their own orders"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check authorization: dealers can only archive their own orders, admins can archive any
    if user["role"] != "admin" and order.get("dealer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to archive this order")
    
    # Archive the order
    await db.orders.update_one({"id": order_id}, {"$set": {"archived": True}})
    
    return {"message": "Order archived successfully"}

@router.put("/orders/{order_id}/restore")
async def restore_order(order_id: str, user: dict = Depends(require_approved_dealer)):
    """Restore an archived order - dealers can only restore their own orders"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check authorization: dealers can only restore their own orders, admins can restore any
    if user["role"] != "admin" and order.get("dealer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to restore this order")
    
    # Restore the order
    await db.orders.update_one({"id": order_id}, {"$set": {"archived": False}})
    
    return {"message": "Order restored successfully"}

@router.put("/orders/{order_id}/pakbon-complete")
async def complete_pakbon(order_id: str, user: dict = Depends(require_pakbon)):
    """Mark a pakbon as completed"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order niet gevonden")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "pakbon_completed": True,
            "pakbon_completed_at": datetime.now(timezone.utc).isoformat(),
            "pakbon_completed_by": user.get("email", "")
        }}
    )
    return {"message": "Pakbon voltooid", "order_id": order_id}


@router.put("/orders/{order_id}/license-plate")
async def update_order_license_plate(order_id: str, data: dict = Body(...), user: dict = Depends(require_pakbon)):
    """Update license plate on an order (pakbon/admin)"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order niet gevonden")
    
    license_plate = data.get("license_plate", "").strip().upper()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"motorcycle_license_plate": license_plate}}
    )
    
    # Also update the motorcycle record if it exists
    if order.get("motorcycle_id"):
        await db.motorcycles.update_one(
            {"id": order["motorcycle_id"]},
            {"$set": {"license_plate": license_plate}}
        )
    
    return {"message": "Kenteken bijgewerkt", "license_plate": license_plate}



@router.put("/orders/{order_id}/kentekenbewijs")
async def update_order_kentekenbewijs(order_id: str, data: dict = Body(...), user: dict = Depends(require_pakbon)):
    """Upload/update kentekenbewijs photo URL on an order (pakbon/admin)"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order niet gevonden")
    
    url = data.get("url", "").strip()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"kentekenbewijs_url": url}}
    )
    return {"message": "Kentekenbewijs bijgewerkt", "url": url}


@router.put("/orders/{order_id}/payment-instructions")
async def update_order_payment_instructions(order_id: str, data: dict = Body(...), user: dict = Depends(require_admin)):
    """Update payment instructions on an order (admin only)"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order niet gevonden")
    
    instructions = data.get("instructions", {})
    update_fields = {"payment_instructions": instructions}
    supplier_info = data.get("supplier_info")
    if supplier_info:
        update_fields["supplier_info"] = supplier_info
    await db.orders.update_one(
        {"id": order_id},
        {"$set": update_fields}
    )
    return {"message": "Betalingsinstructies bijgewerkt"}




@router.put("/orders/{order_id}/coc-status")
async def update_coc_status(order_id: str, data: dict = Body(...), user: dict = Depends(require_admin)):
    """Admin updates COC/CVO status for an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order niet gevonden")
    if not order.get("needs_coc"):
        raise HTTPException(status_code=400, detail="Deze bestelling heeft geen COC aangevraagd")
    
    new_status = data.get("status")
    if new_status not in COC_STATUSES:
        raise HTTPException(status_code=400, detail=f"Ongeldige status. Geldig: {COC_STATUSES}")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "coc_status": new_status,
            "coc_updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    # If sent to dealer, notify them via email with optional PDF attachment
    if new_status == "sent_to_dealer" and order.get("dealer_email"):
        moto = order.get("motorcycle_snapshot") or {}
        pdf_path = order.get("coc_pdf_path")
        dealer_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #16a34a; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 22px;">COC/CVO Verzonden!</h1>
            </div>
            <div style="padding: 25px; background: #f9fafb;">
                <p>Beste {order.get('dealer_company', 'Dealer')},</p>
                <p>Goed nieuws! Het COC/CVO-document voor uw <strong>{moto.get('brand', '')} {moto.get('model', '')}</strong> is {'bijgevoegd in deze e-mail' if pdf_path and os.path.exists(pdf_path) else 'verzonden'}.</p>
                <p>Bestelnummer: <strong>{order_id[:8].upper()}</strong></p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">Met vriendelijke groet,<br>Moto Import B.V.</p>
            </div>
        </div>
        """
        subject = f"📄 COC/CVO verzonden - {moto.get('brand', '')} {moto.get('model', '')}"
        try:
            if pdf_path and os.path.exists(pdf_path):
                await send_email_with_attachment(order["dealer_email"], subject, dealer_html, pdf_path)
            else:
                await send_email(order["dealer_email"], subject, dealer_html)
        except Exception as e:
            logger.error(f"Failed to send COC dealer notification: {e}")
    
    return {"message": "COC status bijgewerkt", "status": new_status}


@router.post("/orders/{order_id}/coc-pdf")
async def upload_coc_pdf(order_id: str, file: UploadFile = File(...), user: dict = Depends(require_admin)):
    """Admin uploads COC/CVO PDF for an order (saved locally for email attachment)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order niet gevonden")
    if not order.get("needs_coc"):
        raise HTTPException(status_code=400, detail="Deze bestelling heeft geen COC aangevraagd")
    
    # Validate file
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Leeg bestand")
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Bestand te groot (max 20MB)")
    
    # Save to local storage
    coc_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "coc")
    os.makedirs(coc_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "document.pdf")[1].lower() or ".pdf"
    if ext not in (".pdf",):
        raise HTTPException(status_code=400, detail="Alleen PDF toegestaan")
    pdf_path = os.path.join(coc_dir, f"{order_id}{ext}")
    with open(pdf_path, "wb") as f:
        f.write(content)
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "coc_pdf_path": pdf_path,
            "coc_pdf_filename": file.filename or f"coc_{order_id}.pdf",
            "coc_pdf_uploaded_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"message": "COC PDF geüpload", "filename": file.filename}


@router.get("/orders/{order_id}/coc-pdf")
async def download_coc_pdf(order_id: str, user: dict = Depends(get_current_user)):
    """Download the COC PDF for an order. Admin or the owning dealer only."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order niet gevonden")
    # Authorization: admin or owning dealer
    if user["role"] != "admin" and order.get("dealer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Geen toegang")
    pdf_path = order.get("coc_pdf_path")
    if not pdf_path or not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Geen COC PDF beschikbaar")
    filename = order.get("coc_pdf_filename") or f"coc_{order_id}.pdf"
    return FileResponse(pdf_path, media_type="application/pdf", filename=filename)


@router.get("/admin/coc-orders")
async def get_coc_orders(user: dict = Depends(require_admin)):
    """Get all orders with COC/CVO requested (admin only)"""
    orders = await db.orders.find(
        {"needs_coc": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    
    # Enrich with motorcycle data (use snapshot as fallback)
    motorcycle_ids = [o["motorcycle_id"] for o in orders if o.get("motorcycle_id")]
    motos = await db.motorcycles.find({"id": {"$in": motorcycle_ids}}, {"_id": 0}).to_list(2000)
    moto_map = {m["id"]: m for m in motos}
    
    result = []
    for o in orders:
        moto = moto_map.get(o.get("motorcycle_id")) or o.get("motorcycle_snapshot") or {}
        o["motorcycle"] = moto
        result.append(o)
    return result


@router.put("/orders/{order_id}/transport")
async def update_transport_status(order_id: str, data: TransportStatusUpdate, user: dict = Depends(require_admin)):
    """Admin updates transport status for an order"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order niet gevonden")
    
    # Valid transport statuses
    valid_statuses = ["pending", "picked_up", "in_transit", "delivered"]
    if data.transport_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Ongeldige transport status")
    
    update_data = {
        "transport_status": data.transport_status,
        "transport_updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if data.transport_carrier is not None:
        update_data["transport_carrier"] = data.transport_carrier
    if data.transport_tracking_number is not None:
        update_data["transport_tracking_number"] = data.transport_tracking_number
    if data.transport_estimated_delivery is not None:
        update_data["transport_estimated_delivery"] = data.transport_estimated_delivery
    if data.transport_notes is not None:
        update_data["transport_notes"] = data.transport_notes
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Send email notification to dealer about transport update
    dealer = await db.users.find_one({"id": order.get("dealer_id")}, {"_id": 0, "email": 1, "company_name": 1})
    motorcycle = order.get("motorcycle_snapshot", {})
    
    status_labels = {
        "pending": "Wachtend op transport",
        "picked_up": "Opgehaald door transporteur",
        "in_transit": "Onderweg",
        "delivered": "Afgeleverd"
    }
    
    status_label = status_labels.get(data.transport_status, data.transport_status)
    
    if dealer and dealer.get("email") and GMAIL_EMAIL and GMAIL_APP_PASSWORD:
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">🚚 Transport Update</h1>
                </div>
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #1a1a1a; margin: 0 0 10px 0;">{motorcycle.get('brand', '')} {motorcycle.get('model', '')}</h2>
                    
                    <div style="background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
                        <p style="color: #1d4ed8; font-size: 14px; margin: 0 0 5px 0; text-transform: uppercase;">Status</p>
                        <p style="color: #1d4ed8; font-size: 24px; font-weight: bold; margin: 0;">{status_label}</p>
                    </div>
                    
                    {f'<p><strong>Transporteur:</strong> {data.transport_carrier}</p>' if data.transport_carrier else ''}
                    {f'<p><strong>Trackingnummer:</strong> {data.transport_tracking_number}</p>' if data.transport_tracking_number else ''}
                    {f'<p><strong>Verwachte levering:</strong> {data.transport_estimated_delivery}</p>' if data.transport_estimated_delivery else ''}
                    {f'<p><strong>Opmerking:</strong> {data.transport_notes}</p>' if data.transport_notes else ''}
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        Heeft u vragen? Neem contact met ons op via Motoimportbv@gmail.com
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        try:
            await send_email(
                dealer["email"],
                f"🚚 Transport Update: {motorcycle.get('brand', '')} {motorcycle.get('model', '')} - {status_label}",
                html_content
            )
            logger.info(f"Transport update email sent to {dealer['email']}")
        except Exception as e:
            logger.error(f"Failed to send transport email: {e}")
    
    return {"message": "Transport status bijgewerkt", "transport_status": data.transport_status}

@router.get("/orders/archived", response_model=List[OrderWithMotorcycle])
async def get_archived_orders(user: dict = Depends(require_approved_dealer)):
    """Get archived orders for the current dealer"""
    if user["role"] == "admin":
        # Admin sees all archived orders
        orders = await db.orders.find(
            {"archived": True}, 
            {"_id": 0}
        ).to_list(1000)
    else:
        # Dealers see only their archived orders
        orders = await db.orders.find(
            {"dealer_id": user["id"], "archived": True}, 
            {"_id": 0}
        ).to_list(1000)
    
    # Batch fetch motorcycles
    motorcycle_ids = list(set(order["motorcycle_id"] for order in orders))
    motorcycles_list = await db.motorcycles.find(
        {"id": {"$in": motorcycle_ids}}, 
        {"_id": 0}
    ).to_list(1000)
    motorcycles_map = {m["id"]: m for m in motorcycles_list}
    
    # Enrich orders with motorcycle data
    result = []
    for order in orders:
        motorcycle_data = motorcycles_map.get(order["motorcycle_id"])
        if not motorcycle_data:
            motorcycle_data = order.get("motorcycle_snapshot")
        order["motorcycle"] = motorcycle_data
        result.append(order)
    
    return result

# ============ DIRECT ORDER ENDPOINTS ============


@router.get("/voucher/check/{code}")
async def check_voucher(code: str, user: dict = Depends(get_current_user)):
    """Check if a voucher code is valid for the current user"""
    # Foreign dealers cannot use vouchers
    if user.get("is_foreign_dealer"):
        raise HTTPException(status_code=403, detail="Buitenlandse leveranciers kunnen geen vouchers gebruiken")
    
    voucher = await db.vouchers.find_one({
        "code": code.upper(),
        "$or": [{"dealer_id": user["id"]}, {"dealer_id": None}],
        "is_used": False
    }, {"_id": 0})
    
    if not voucher:
        # Check if voucher exists but belongs to someone else or is used
        any_voucher = await db.vouchers.find_one({"code": code.upper()}, {"_id": 0})
        if any_voucher:
            if any_voucher.get("is_used"):
                raise HTTPException(status_code=400, detail="Deze voucher is al gebruikt")
            else:
                raise HTTPException(status_code=400, detail="Deze voucher is niet geldig voor uw account")
        raise HTTPException(status_code=404, detail="Voucher niet gevonden")
    
    return {
        "valid": True,
        "amount": voucher["amount"],
        "code": voucher["code"]
    }

@router.get("/voucher/my-voucher")
async def get_my_voucher(user: dict = Depends(get_current_user)):
    """Get the user's voucher if they have one"""
    # Foreign dealers don't get vouchers
    if user.get("is_foreign_dealer"):
        return {"has_voucher": False}
    
    voucher = await db.vouchers.find_one({
        "dealer_id": user["id"]
    }, {"_id": 0})
    
    if not voucher:
        return {"has_voucher": False}
    
    return {
        "has_voucher": True,
        "code": voucher["code"],
        "amount": voucher["amount"],
        "is_used": voucher["is_used"],
        "used_at": voucher.get("used_at")
    }

@router.post("/orders/buy-now")
async def create_buy_now_order(data: BuyNowRequest, user: dict = Depends(require_approved_dealer)):
    """Create a direct order without payment - sends emails to dealer and admin"""
    
    # Get motorcycle
    motorcycle = await db.motorcycles.find_one({"id": data.motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    if not motorcycle.get("is_available", True):
        raise HTTPException(status_code=400, detail="Motor is niet meer beschikbaar")
    
    # Calculate costs
    delivery_cost = DELIVERY_COST if data.needs_delivery else 0.0
    inspection_cost = INSPECTION_COST if data.needs_inspection else 0.0
    valuation_cost = VALUATION_COST if data.needs_valuation else 0.0
    
    # COC/CVO cost based on motorcycle brand (only supported brands)
    coc_cost = 0.0
    if data.needs_coc:
        brand_key = (motorcycle.get("brand") or "").strip().lower()
        coc_cost = COC_PRICES.get(brand_key, 0.0)
        if coc_cost == 0.0:
            raise HTTPException(status_code=400, detail=f"COC/CVO is niet beschikbaar voor merk: {motorcycle.get('brand', '')}")
    
    # Check and apply voucher
    voucher_discount = 0.0
    voucher_applied = None
    if data.voucher_code:
        voucher = await db.vouchers.find_one({
            "code": data.voucher_code.upper(),
            "dealer_id": user["id"],
            "is_used": False
        })
        if voucher:
            voucher_discount = voucher["amount"]
            voucher_applied = voucher["code"]
            # Mark voucher as used
            await db.vouchers.update_one(
                {"code": data.voucher_code.upper()},
                {
                    "$set": {
                        "is_used": True,
                        "used_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
    
    total_price = max(0, motorcycle["price"] + delivery_cost + inspection_cost + valuation_cost + coc_cost - voucher_discount)
    
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
    
    # Create order
    order = Order(
        motorcycle_id=data.motorcycle_id,
        dealer_id=user["id"],
        dealer_email=user["email"],
        dealer_company=user.get("company_name", ""),
        status="pending",
        needs_delivery=data.needs_delivery,
        motorcycle_snapshot=motorcycle_snapshot,
        delivery_cost=delivery_cost,
        total_price=total_price,
        deposit_amount=0,
        payment_status="niet_vereist"
    )
    
    # Add voucher info to order (store in notes or separate field)
    order_dict = order.model_dump()
    if voucher_applied:
        order_dict["voucher_code"] = voucher_applied
        order_dict["voucher_discount"] = voucher_discount
    
    # Add inspection and valuation info
    order_dict["needs_inspection"] = data.needs_inspection
    order_dict["inspection_cost"] = inspection_cost
    order_dict["needs_valuation"] = data.needs_valuation
    order_dict["valuation_cost"] = valuation_cost
    order_dict["needs_coc"] = data.needs_coc
    order_dict["coc_cost"] = coc_cost
    if data.needs_coc:
        brand_key = (motorcycle.get("brand") or "").strip().lower()
        supplier = COC_SUPPLIERS.get(brand_key)
        order_dict["coc_status"] = "requested"
        order_dict["coc_supplier_email"] = supplier.get("email") if supplier else ""
        order_dict["coc_supplier_name"] = supplier.get("name") if supplier else ""
        order_dict["coc_admin_cost_chf"] = supplier.get("admin_cost_chf", 0.0) if supplier else 0.0
    
    # Check if this is a dealer-to-dealer sale
    is_dealer_listing = motorcycle.get("is_dealer_listing", False)
    seller_company = motorcycle.get("seller_company", "")
    seller_id = motorcycle.get("seller_id", "")
    
    if is_dealer_listing:
        order_dict["is_dealer_to_dealer"] = True
        order_dict["seller_company"] = seller_company
        order_dict["seller_id"] = seller_id
    
    # Auto-fill payment instructions from foreign dealer (supplier) data
    foreign_dealer_id = motorcycle.get("foreign_dealer_id")
    if foreign_dealer_id:
        foreign_dealer = await db.users.find_one({"id": foreign_dealer_id}, {"_id": 0})
        if foreign_dealer:
            order_dict["payment_instructions"] = {
                "amount": str(int(motorcycle.get("original_price", 0))) if motorcycle.get("original_price") else "",
                "currency": motorcycle.get("original_currency", "CHF"),
                "recipient_name": foreign_dealer.get("company_name", ""),
                "iban": foreign_dealer.get("iban", foreign_dealer.get("bank_iban", "")),
                "reference": f"{motorcycle.get('brand', '')} {motorcycle.get('model', '')} VIN:{motorcycle.get('chassis_number', '')}",
            }
            order_dict["supplier_info"] = {
                "company": foreign_dealer.get("company_name", ""),
                "email": foreign_dealer.get("email", ""),
                "phone": foreign_dealer.get("phone", ""),
                "country": foreign_dealer.get("country", ""),
                "address": foreign_dealer.get("address", ""),
            }
    
    await db.orders.insert_one(order_dict)
    
    # ============ COC/CVO: send automatic email to supplier (admin in CC) ============
    if data.needs_coc and coc_cost > 0:
        brand_key = (motorcycle.get("brand") or "").strip().lower()
        coc_supplier = COC_SUPPLIERS.get(brand_key)
        if coc_supplier and coc_supplier.get("email"):
            # German email to supplier (Hostettler / Mage Motos)
            coc_subject = f"COC/CVO Bestellung - {motorcycle.get('brand', '')} {motorcycle.get('model', '')}"
            coc_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #DC2626; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 22px;">COC/CVO Bestellung</h1>
                </div>
                <div style="padding: 25px; background: #f9fafb;">
                    <p>Sehr geehrte Damen und Herren,</p>
                    <p>Wir möchten hiermit ein <strong>COC/CVO-Dokument</strong> für das folgende Motorrad bei Ihnen bestellen:</p>
                    <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0;">
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Marke</strong></td>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{motorcycle.get('brand', '')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Modell</strong></td>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{motorcycle.get('model', '')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Baujahr</strong></td>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{motorcycle.get('year', '')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Fahrgestellnummer (VIN)</strong></td>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">{motorcycle.get('chassis_number', 'N/A')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Kilometerstand</strong></td>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{motorcycle.get('mileage', 0):,} km</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Farbe</strong></td>
                            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{motorcycle.get('color', 'N/A')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px;"><strong>Bestellnummer</strong></td>
                            <td style="padding: 12px; font-family: monospace;">{order_dict['id'][:8].upper()}</td>
                        </tr>
                    </table>
                    <p>Bitte senden Sie das COC/CVO-Dokument an folgende Adresse:</p>
                    <div style="background: white; border: 2px solid #DC2626; border-radius: 8px; padding: 15px; margin: 15px 0;">
                        <p style="margin: 0; font-weight: bold; font-size: 16px;">Moto Import B.V.</p>
                        <p style="margin: 5px 0;">Tel: +31 6 24264861</p>
                        <p style="margin: 5px 0;">E-Mail: Motoimportbv@gmail.com</p>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">Vielen Dank im Voraus für Ihre Hilfe!</p>
                    <p style="color: #6b7280; font-size: 14px;">Mit freundlichen Grüßen,<br>Moto Import B.V.</p>
                </div>
                <div style="background: #18181b; padding: 15px; text-align: center; color: #a1a1aa; font-size: 11px;">
                    <p style="margin: 0;">Moto Import B.V. | www.motoimportbv.nl</p>
                </div>
            </div>
            """
            try:
                # Send to supplier with admin in CC
                await send_email(coc_supplier["email"], coc_subject, coc_html, cc=[GMAIL_EMAIL] if GMAIL_EMAIL else None)
                logger.info(f"COC request email sent to supplier {coc_supplier['email']} for order {order_dict['id']}")
            except Exception as e:
                logger.error(f"Failed to send COC supplier email: {e}")
    
    # Auto-create concept taxatie invoice when dealer requests valuation
    if data.needs_valuation:
        last_inv = await db.taxatie_invoices.find_one(sort=[("invoice_number", -1)], projection={"_id": 0, "invoice_number": 1})
        next_inv_num = (last_inv["invoice_number"] + 1) if last_inv else 1001
        taxatie_concept = {
            "id": str(uuid.uuid4()),
            "invoice_number": next_inv_num,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "customer_name": user.get("company_name", user.get("email", "")),
            "customer_address": "",
            "customer_city": "",
            "customer_phone": user.get("phone", ""),
            "customer_email": user.get("email", ""),
            "motorcycle_brand": motorcycle.get("brand", ""),
            "motorcycle_model": motorcycle.get("model", ""),
            "motorcycle_year": str(motorcycle.get("year", "")),
            "motorcycle_license_plate": "",
            "motorcycle_vin": "",
            "taxatie_value": 0,
            "fee": TAXATIE_DEFAULT_FEE,
            "btw_percentage": TAXATIE_BTW_PERCENTAGE,
            "include_extra_fee": False,
            "extra_fee": 60,
            "notes": f"Automatisch aangemaakt bij bestelling. Order: {order_dict['id']}",
            "bank_name": "S. Milone",
            "bank_iban": "NL03SNSB8846497880",
            "status": "concept",
            "order_id": order_dict["id"],
            "created_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.taxatie_invoices.insert_one(taxatie_concept)
    
    # Mark motorcycle as unavailable
    await db.motorcycles.update_one(
        {"id": data.motorcycle_id},
        {"$set": {"is_available": False}}
    )
    
    # Check if this motorcycle is from a foreign dealer and notify them (without price)
    foreign_dealer_id = motorcycle.get("foreign_dealer_id")
    if foreign_dealer_id:
        foreign_dealer = await db.users.find_one({"id": foreign_dealer_id}, {"_id": 0})
        if foreign_dealer:
            # Determine language based on country
            country = foreign_dealer.get("country", "").lower()
            
            if "schweiz" in country or "suisse" in country or "svizzera" in country or "zwitserland" in country:
                # German for Switzerland
                subject = "🎉 Ihr Motorrad wurde verkauft! - Moto Import"
                greeting = f"Sehr geehrte/r {foreign_dealer.get('company_name', 'Lieferant')}"
                intro = "Gute Nachrichten! Ihr Motorrad wurde über Moto Import verkauft."
                sold_title = "Verkauftes Motorrad"
                year_label = "Baujahr"
                mileage_label = "Kilometerstand"
                contact_text = "Wir werden Sie in Kürze bezüglich der Lieferung kontaktieren."
                thanks_text = "Vielen Dank für die Zusammenarbeit mit Moto Import!"
            elif "ital" in country:
                # Italian
                subject = "🎉 La tua moto è stata venduta! - Moto Import"
                greeting = f"Gentile {foreign_dealer.get('company_name', 'Fornitore')}"
                intro = "Ottime notizie! La tua moto è stata venduta tramite Moto Import."
                sold_title = "Moto Venduta"
                year_label = "Anno"
                mileage_label = "Chilometraggio"
                contact_text = "Ti contatteremo presto per organizzare la consegna."
                thanks_text = "Grazie per la collaborazione con Moto Import!"
            elif "france" in country or "frank" in country:
                # French
                subject = "🎉 Votre moto a été vendue! - Moto Import"
                greeting = f"Cher/Chère {foreign_dealer.get('company_name', 'Fournisseur')}"
                intro = "Bonne nouvelle! Votre moto a été vendue via Moto Import."
                sold_title = "Moto Vendue"
                year_label = "Année"
                mileage_label = "Kilométrage"
                contact_text = "Nous vous contacterons bientôt concernant la livraison."
                thanks_text = "Merci de travailler avec Moto Import!"
            else:
                # Default English
                subject = "🎉 Your Motorcycle Has Been Sold! - Moto Import"
                greeting = f"Dear {foreign_dealer.get('company_name', 'Supplier')}"
                intro = "Great news! Your motorcycle has been sold through Moto Import."
                sold_title = "Sold Motorcycle"
                year_label = "Year"
                mileage_label = "Mileage"
                contact_text = "We will contact you shortly regarding the delivery arrangements."
                thanks_text = "Thank you for working with Moto Import!"
            
            # Send email notification to foreign dealer (without price)
            foreign_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #16a34a; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 {sold_title.upper()}!</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <p>{greeting},</p>
                    <p>{intro}</p>
                    
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #18181b;">{sold_title}</h3>
                        <p style="font-size: 20px; font-weight: bold; color: #16a34a; margin: 10px 0;">
                            {motorcycle['brand']} {motorcycle['model']}
                        </p>
                        <p><strong>{year_label}:</strong> {motorcycle['year']}</p>
                        <p><strong>{mileage_label}:</strong> {motorcycle.get('mileage', 'N/A'):,} km</p>
                    </div>
                    
                    <p>{contact_text}</p>
                    <p style="color: #6b7280; font-size: 14px;">{thanks_text}</p>
                </div>
                <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
                    <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
                    <p style="margin: 5px 0;">www.motoimportbv.nl</p>
                </div>
            </div>
            """
            try:
                await send_email(foreign_dealer["email"], subject, foreign_html)
            except Exception as e:
                logger.error(f"Failed to notify foreign dealer: {str(e)}")
    
    # Get dealer info
    dealer = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    delivery_text = "Ja (€50)" if data.needs_delivery else "Nee (ophalen)"
    inspection_text = "Ja (€125)" if data.needs_inspection else "Nee"
    valuation_text = "Ja (€160 excl. BTW)" if data.needs_valuation else "Nee"
    coc_text = f"Ja (€{coc_cost:.0f})" if data.needs_coc else "Nee"
    voucher_text = f"€{voucher_discount:,.2f} korting (code: {voucher_applied})" if voucher_applied else "Geen"
    
    # If dealer-to-dealer sale, send special admin notification about €250 fee
    if is_dealer_listing:
        fee_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <div style="background: #f59e0b; padding: 15px; text-align: center;">
                <h2 style="color: white; margin: 0;">💰 DEALER MOTOR VERKOCHT - €500 FACTUREREN!</h2>
            </div>
            <div style="padding: 20px; background: #fef3c7;">
                <p style="font-size: 16px; margin-bottom: 15px;"><strong>Actie vereist:</strong> Factureer €250 aan BEIDE partijen.</p>
                <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px;">
                    <tr style="background: #dc2626; color: white;">
                        <td colspan="2" style="padding: 12px; font-weight: bold;">TE FACTUREREN</td>
                    </tr>
                    <tr style="background: #fef2f2;">
                        <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Verkoper (€250)</strong></td>
                        <td style="padding: 12px; border: 1px solid #e4e4e7; color: #DC2626; font-weight: bold;">{seller_company}</td>
                    </tr>
                    <tr style="background: #fef2f2;">
                        <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Koper (€250)</strong></td>
                        <td style="padding: 12px; border: 1px solid #e4e4e7; color: #DC2626; font-weight: bold;">{user.get('company_name', 'Dealer')}</td>
                    </tr>
                    <tr style="background: #f4f4f5;">
                        <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Totaal te factureren</strong></td>
                        <td style="padding: 12px; border: 1px solid #e4e4e7; color: #16a34a; font-weight: bold; font-size: 18px;">€500</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Motor</strong></td>
                        <td style="padding: 12px; border: 1px solid #e4e4e7;">{motorcycle['brand']} {motorcycle['model']} ({motorcycle['year']})</td>
                    </tr>
                    <tr style="background: #f4f4f5;">
                        <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Verkoopprijs</strong></td>
                        <td style="padding: 12px; border: 1px solid #e4e4e7;">€{motorcycle['price']:,.0f}</td>
                    </tr>
                </table>
            </div>
        </div>
        """
        await send_admin_notification(f"💰 DEALER VERKOOP: €500 factureren ({seller_company} + {user.get('company_name', 'Dealer')})", fee_html)
    
    # Send email to Dealer
    dealer_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #DC2626; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">MOTO IMPORT</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #16a34a; margin-top: 0;">✅ Bestelling Bevestigd!</h2>
            <p>Beste {user.get('company_name', 'Dealer')},</p>
            <p>Bedankt voor uw bestelling! Hieronder vindt u de details.</p>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #18181b;">Uw Motorfiets</h3>
                <p style="font-size: 20px; font-weight: bold; color: #DC2626; margin: 10px 0;">
                    {motorcycle['brand']} {motorcycle['model']} ({motorcycle['year']})
                </p>
                <p style="color: #6b7280; margin: 5px 0;">Kleur: {motorcycle.get('color', 'N/A')}</p>
                <p style="color: #6b7280; margin: 5px 0;">Kilometerstand: {motorcycle.get('mileage', 0):,} km</p>
            </div>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #18181b;">Prijsoverzicht</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Motorprijs</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">€{motorcycle['price']:,.2f}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Bezorging</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{delivery_text}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Keuring</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{inspection_text}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Taxatie</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{valuation_text}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">COC / CVO</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{coc_text}</td>
                    </tr>
                    {"<tr style='color: #16a34a;'><td style='padding: 8px 0; border-bottom: 1px solid #e5e7eb;'>🎁 Welkomstkorting</td><td style='padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;'>-€" + f"{voucher_discount:,.2f}" + "</td></tr>" if voucher_applied else ""}
                    <tr style="font-weight: bold; font-size: 18px;">
                        <td style="padding: 12px 0;">Totaal</td>
                        <td style="padding: 12px 0; text-align: right; color: #DC2626;">€{total_price:,.2f}</td>
                    </tr>
                </table>
            </div>
            
            <p style="color: #6b7280;">Wij nemen zo snel mogelijk contact met u op voor de verdere afhandeling.</p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                Order ID: {order.id}<br>
                Datum: {datetime.now(timezone.utc).strftime('%d-%m-%Y %H:%M')}
            </p>
        </div>
        <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
            <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
            <p style="margin: 5px 0;">www.motoimportbv.nl</p>
            <p style="margin: 5px 0;">Tel: +31 6 24264861 | Email: Motoimportbv@gmail.com</p>
        </div>
    </div>
    """
    
    try:
        await send_email(user["email"], "✅ Bestelling Bevestigd - Moto Import", dealer_html)
    except Exception as e:
        logger.error(f"Failed to send dealer confirmation email: {e}")
    
    # Send email to Admin with Pakbon
    # Always use production URL for any links
    base_url = PRODUCTION_BASE_URL
    order_date = datetime.now(timezone.utc).strftime('%d-%m-%Y')
    order_time = datetime.now(timezone.utc).strftime('%H:%M')
    
    # Get supplier/source info for admin
    supplier_info_html = ""
    foreign_dealer = None
    seller = None
    
    if foreign_dealer_id:
        # Motor komt van buitenlandse leverancier
        foreign_dealer = await db.users.find_one({"id": foreign_dealer_id}, {"_id": 0})
        if foreign_dealer:
            country_names = {
                "CH": "🇨🇭 Zwitserland", "DE": "🇩🇪 Duitsland", "AT": "🇦🇹 Oostenrijk",
                "IT": "🇮🇹 Italië", "FR": "🇫🇷 Frankrijk", "BE": "🇧🇪 België"
            }
            country_display = country_names.get(foreign_dealer.get("country", ""), foreign_dealer.get("country", "Onbekend"))
            supplier_info_html = f"""
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background: #fef3c7; border-radius: 8px; border: 2px solid #f59e0b;">
                <tr style="background: #f59e0b;">
                    <td colspan="2" style="padding: 12px; color: white; font-weight: bold;">🌍 LEVERANCIER INFORMATIE</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #fcd34d; width: 30%;"><strong>Bedrijf</strong></td>
                    <td style="padding: 12px; border: 1px solid #fcd34d; font-weight: bold;">{foreign_dealer.get('company_name', 'N/A')}</td>
                </tr>
                <tr style="background: #fef9c3;">
                    <td style="padding: 12px; border: 1px solid #fcd34d;"><strong>Land</strong></td>
                    <td style="padding: 12px; border: 1px solid #fcd34d;">{country_display}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #fcd34d;"><strong>Contactpersoon</strong></td>
                    <td style="padding: 12px; border: 1px solid #fcd34d;">{foreign_dealer.get('contact_person', 'N/A')}</td>
                </tr>
                <tr style="background: #fef9c3;">
                    <td style="padding: 12px; border: 1px solid #fcd34d;"><strong>Email</strong></td>
                    <td style="padding: 12px; border: 1px solid #fcd34d;"><a href="mailto:{foreign_dealer.get('email', '')}">{foreign_dealer.get('email', 'N/A')}</a></td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #fcd34d;"><strong>Telefoon</strong></td>
                    <td style="padding: 12px; border: 1px solid #fcd34d;">{foreign_dealer.get('phone', 'N/A')}</td>
                </tr>
                <tr style="background: #fef9c3;">
                    <td style="padding: 12px; border: 1px solid #fcd34d;"><strong>Adres</strong></td>
                    <td style="padding: 12px; border: 1px solid #fcd34d;">{foreign_dealer.get('address', 'Niet opgegeven')}</td>
                </tr>
            </table>
            """
    elif is_dealer_listing:
        # Motor komt van Nederlandse dealer
        seller = await db.users.find_one({"id": seller_id}, {"_id": 0}) if seller_id else None
        if seller:
            supplier_info_html = f"""
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background: #dbeafe; border-radius: 8px; border: 2px solid #3b82f6;">
                <tr style="background: #3b82f6;">
                    <td colspan="2" style="padding: 12px; color: white; font-weight: bold;">🏪 VERKOPENDE DEALER</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #93c5fd; width: 30%;"><strong>Bedrijf</strong></td>
                    <td style="padding: 12px; border: 1px solid #93c5fd; font-weight: bold;">{seller.get('company_name', 'N/A')}</td>
                </tr>
                <tr style="background: #eff6ff;">
                    <td style="padding: 12px; border: 1px solid #93c5fd;"><strong>Contactpersoon</strong></td>
                    <td style="padding: 12px; border: 1px solid #93c5fd;">{seller.get('contact_person', 'N/A')}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #93c5fd;"><strong>Email</strong></td>
                    <td style="padding: 12px; border: 1px solid #93c5fd;"><a href="mailto:{seller.get('email', '')}">{seller.get('email', 'N/A')}</a></td>
                </tr>
                <tr style="background: #eff6ff;">
                    <td style="padding: 12px; border: 1px solid #93c5fd;"><strong>Telefoon</strong></td>
                    <td style="padding: 12px; border: 1px solid #93c5fd;">{seller.get('phone', 'N/A')}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #93c5fd;"><strong>Adres</strong></td>
                    <td style="padding: 12px; border: 1px solid #93c5fd;">{seller.get('address', '')} {seller.get('postal_code', '')} {seller.get('city', '')}</td>
                </tr>
            </table>
            """
    else:
        # Motor is van Moto Import zelf
        supplier_info_html = """
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background: #dcfce7; border-radius: 8px; border: 2px solid #22c55e;">
                <tr style="background: #22c55e;">
                    <td style="padding: 12px; color: white; font-weight: bold;">✅ EIGEN VOORRAAD</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #86efac;">Deze motor komt uit de eigen voorraad van Moto Import B.V.</td>
                </tr>
            </table>
            """
    
    admin_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #18181b; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🏍️ NIEUWE BESTELLING!</h1>
        </div>
        
        <div style="padding: 20px; background: #f9fafb;">
            <p style="color: #16a34a; font-weight: bold; font-size: 18px;">Er is een nieuwe bestelling geplaatst!</p>
            
            <!-- Quick Summary -->
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border-radius: 8px;">
                <tr style="background: #f4f4f5;">
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Motor</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;">{motorcycle['brand']} {motorcycle['model']} ({motorcycle['year']})</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Dealer</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;">{user.get('company_name', 'N/A')}</td>
                </tr>
                <tr style="background: #f4f4f5;">
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Totaal</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7; color: #DC2626; font-weight: bold; font-size: 18px;">€{total_price:,.2f}</td>
                </tr>
            </table>
            
            <!-- Supplier/Source Info -->
            {supplier_info_html}
        </div>
        
        <!-- PAKBON -->
        <div style="background: white; margin: 20px; border: 2px solid #18181b;">
            <div style="background: #18181b; color: white; padding: 20px;">
                <table style="width: 100%;">
                    <tr>
                        <td>
                            <h2 style="margin: 0; font-size: 28px; letter-spacing: 2px;">PAKBON</h2>
                            <p style="margin: 5px 0 0 0; color: #a1a1aa;">Moto Import B.V.</p>
                        </td>
                        <td style="text-align: right;">
                            <p style="margin: 0; color: #a1a1aa; font-size: 12px;">Ordernummer</p>
                            <p style="margin: 0; font-family: monospace; font-size: 16px;">{order.id[:8].upper()}</p>
                            <p style="margin: 10px 0 0 0; color: #a1a1aa; font-size: 12px;">Datum</p>
                            <p style="margin: 0;">{order_date}</p>
                        </td>
                    </tr>
                </table>
            </div>
            
            <div style="padding: 25px;">
                <!-- Afzender en Ontvanger -->
                <table style="width: 100%; margin-bottom: 25px;">
                    <tr>
                        <td style="width: 50%; vertical-align: top;">
                            <p style="color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;"><strong>AFZENDER</strong></p>
                            <p style="margin: 0; font-weight: bold; font-size: 16px;">Moto Import B.V.</p>
                            <p style="margin: 10px 0 0 0; color: #52525b;">Tel: +31 6 24264861</p>
                            <p style="margin: 5px 0; color: #52525b;">Motoimportbv@gmail.com</p>
                            <p style="margin: 5px 0; color: #52525b;">www.motoimportbv.nl</p>
                        </td>
                        <td style="width: 50%; vertical-align: top;">
                            <p style="color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;"><strong>ONTVANGER</strong></p>
                            <p style="margin: 0; font-weight: bold; font-size: 16px;">{user.get('company_name', 'Dealer')}</p>
                            <p style="margin: 5px 0; color: #52525b;">{dealer.get('address', '') if dealer else ''}</p>
                            <p style="margin: 5px 0; color: #52525b;">{dealer.get('postal_code', '')} {dealer.get('city', '') if dealer else ''}</p>
                            <p style="margin: 10px 0 0 0; color: #52525b;">Tel: {dealer.get('phone', 'N/A') if dealer else 'N/A'}</p>
                            <p style="margin: 5px 0; color: #52525b;">{user['email']}</p>
                            <p style="margin: 10px 0 0 0; display: inline-block; background: {'#DC2626' if data.needs_delivery else '#71717a'}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px;">
                                {'BEZORGING' if data.needs_delivery else 'OPHALEN'}
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Herkomst Motor (alleen voor admin) -->
                {f'''
                <div style="background: #fef3c7; border: 2px dashed #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
                    <p style="color: #92400e; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;"><strong>🌍 HERKOMST MOTOR (ALLEEN VOOR ADMIN)</strong></p>
                    <p style="margin: 0; font-weight: bold; font-size: 14px; color: #78350f;">{foreign_dealer.get("company_name", "N/A") if foreign_dealer else (seller.get("company_name", "N/A") if seller else "Moto Import B.V. (eigen voorraad)")}</p>
                    <p style="margin: 5px 0 0 0; color: #78350f; font-size: 13px;">{foreign_dealer.get("contact_person", "") if foreign_dealer else (seller.get("contact_person", "") if seller else "")}</p>
                    <p style="margin: 5px 0 0 0; color: #78350f; font-size: 13px;">{foreign_dealer.get("address", "Adres niet opgegeven") if foreign_dealer else (f"{seller.get('address', '')} {seller.get('postal_code', '')} {seller.get('city', '')}" if seller else "")}</p>
                    <p style="margin: 5px 0 0 0; color: #78350f; font-size: 13px;">Tel: {foreign_dealer.get("phone", "N/A") if foreign_dealer else (seller.get("phone", "N/A") if seller else "+31 6 24264861")}</p>
                    <p style="margin: 5px 0 0 0; color: #78350f; font-size: 13px;">Email: {foreign_dealer.get("email", "N/A") if foreign_dealer else (seller.get("email", "N/A") if seller else "Motoimportbv@gmail.com")}</p>
                </div>
                ''' if (foreign_dealer or seller) else ''}
                
                <!-- Motor Details Tabel -->
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="background: #f4f4f5;">
                        <th style="padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; border-bottom: 2px solid #e4e4e7;">Omschrijving</th>
                        <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; border-bottom: 2px solid #e4e4e7;">Aantal</th>
                        <th style="padding: 12px; text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; border-bottom: 2px solid #e4e4e7;">Prijs</th>
                    </tr>
                    <tr>
                        <td style="padding: 15px 12px; border-bottom: 1px solid #e4e4e7;">
                            <p style="margin: 0; font-weight: bold; font-size: 16px;">{motorcycle['brand']} {motorcycle['model']}</p>
                            <p style="margin: 5px 0 0 0; color: #71717a; font-size: 13px;">
                                Bouwjaar: {motorcycle['year']} | Kleur: {motorcycle.get('color', 'N/A')} | KM: {motorcycle.get('mileage', 0):,}
                            </p>
                            <p style="margin: 3px 0 0 0; color: #71717a; font-size: 13px;">Conditie: {motorcycle.get('condition', 'N/A')}</p>
                        </td>
                        <td style="padding: 15px 12px; border-bottom: 1px solid #e4e4e7; text-align: right; vertical-align: top;">1</td>
                        <td style="padding: 15px 12px; border-bottom: 1px solid #e4e4e7; text-align: right; vertical-align: top; font-weight: 500;">€{motorcycle['price']:,.2f}</td>
                    </tr>
                    {'<tr><td style="padding: 15px 12px; border-bottom: 1px solid #e4e4e7;"><p style="margin: 0; font-weight: 500;">Bezorgkosten</p><p style="margin: 3px 0 0 0; color: #71717a; font-size: 13px;">Levering aan bovenstaand adres</p></td><td style="padding: 15px 12px; border-bottom: 1px solid #e4e4e7; text-align: right; vertical-align: top;">1</td><td style="padding: 15px 12px; border-bottom: 1px solid #e4e4e7; text-align: right; vertical-align: top; font-weight: 500;">€50,00</td></tr>' if data.needs_delivery else ''}
                    <tr>
                        <td colspan="2" style="padding: 15px 12px; text-align: right; font-weight: bold; font-size: 18px;">TOTAAL</td>
                        <td style="padding: 15px 12px; text-align: right; font-weight: bold; font-size: 22px; color: #DC2626;">€{total_price:,.2f}</td>
                    </tr>
                </table>
                
                <!-- Handtekening vakken -->
                <table style="width: 100%; margin-top: 40px;">
                    <tr>
                        <td style="width: 50%; padding-right: 20px;">
                            <p style="color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 50px 0;"><strong>HANDTEKENING AFZENDER</strong></p>
                            <div style="border-bottom: 1px solid #d4d4d8; margin-bottom: 5px;"></div>
                            <p style="color: #a1a1aa; font-size: 11px; margin: 0;">Datum: _______________</p>
                        </td>
                        <td style="width: 50%; padding-left: 20px;">
                            <p style="color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 50px 0;"><strong>HANDTEKENING ONTVANGER</strong></p>
                            <div style="border-bottom: 1px solid #d4d4d8; margin-bottom: 5px;"></div>
                            <p style="color: #a1a1aa; font-size: 11px; margin: 0;">Datum: _______________</p>
                        </td>
                    </tr>
                </table>
            </div>
            
            <!-- Footer -->
            <div style="border-top: 1px solid #e4e4e7; padding: 15px; text-align: center; color: #a1a1aa; font-size: 11px;">
                <p style="margin: 0;">Moto Import B.V. | KVK: 94622086 | www.motoimportbv.nl</p>
            </div>
        </div>
        
        <!-- Print instructie -->
        <div style="padding: 20px; text-align: center; background: #f4f4f5; border-radius: 8px; margin: 20px;">
            <p style="color: #52525b; font-size: 14px; margin: 0;">
                <strong>💡 Tip:</strong> Print deze email uit als pakbon (Ctrl+P of ⌘+P)
            </p>
        </div>
        
        <div style="background: #18181b; padding: 15px; text-align: center; color: #a1a1aa; font-size: 11px;">
            <p style="margin: 0;">Deze email is automatisch gegenereerd door Moto Import B.V.</p>
        </div>
    </div>
    """
    
    try:
        await send_admin_notification("🏍️ Nieuwe Bestelling + Pakbon!", admin_html)
    except Exception as e:
        logger.error(f"Failed to send admin notification email: {e}")
    
    return {"order_id": order.id, "message": "Bestelling geplaatst"}

# ============ ADMIN: ORDER ON BEHALF OF DEALER ============

@router.post("/admin/order-for-dealer")
async def admin_order_for_dealer(data: AdminOrderForDealer, current_user: dict = Depends(require_admin)):
    """Admin creates an order on behalf of a dealer"""
    # Get the dealer
    dealer = await db.users.find_one({"id": data.dealer_id, "role": "dealer", "is_approved": True}, {"_id": 0})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden of niet goedgekeurd")

    # Get the motorcycle
    motorcycle = await db.motorcycles.find_one({"id": data.motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    if not motorcycle.get("is_available"):
        raise HTTPException(status_code=400, detail="Motor is niet meer beschikbaar")

    # Calculate total price (same logic as buy-now)
    base_price = motorcycle.get("price", 0)
    delivery_cost = 50 if data.needs_delivery else 0
    total_price = base_price + delivery_cost

    order = Order(
        dealer_id=dealer["id"],
        motorcycle_id=data.motorcycle_id,
        dealer_email=dealer.get("email", ""),
        dealer_company=dealer.get("company_name", dealer.get("name", "")),
        status="confirmed",
        needs_delivery=data.needs_delivery,
        delivery_cost=delivery_cost,
        total_price=total_price,
        payment_status="unpaid",
        motorcycle_snapshot={
            "brand": motorcycle.get("brand", ""),
            "model": motorcycle.get("model", ""),
            "year": motorcycle.get("year", 0),
            "price": base_price,
            "mileage": motorcycle.get("mileage", 0),
            "color": motorcycle.get("color", ""),
            "needs_inspection": data.needs_inspection,
            "needs_valuation": data.needs_valuation,
            "inspection_cost": 125 if data.needs_inspection else 0,
            "valuation_cost": 160 if data.needs_valuation else 0,
        },
        notes=f"Besteld door admin ({current_user['email']}) namens dealer",
    )

    order_dict = order.model_dump()
    await db.orders.insert_one(order_dict)
    order_dict.pop("_id", None)

    # Mark motorcycle as unavailable
    await db.motorcycles.update_one(
        {"id": data.motorcycle_id},
        {"$set": {"is_available": False}}
    )

    # Send confirmation email to dealer
    dealer_company = dealer.get("company_name", dealer.get("name", ""))
    delivery_text = "Ja (€50)" if data.needs_delivery else "Nee (ophalen)"
    inspection_text = "Ja (€125)" if data.needs_inspection else "Nee"
    valuation_text = "Ja (€160 excl. BTW)" if data.needs_valuation else "Nee"
    motor_brand = motorcycle.get("brand", "")
    motor_model = motorcycle.get("model", "")
    motor_year = motorcycle.get("year", 0)
    motor_mileage = motorcycle.get("mileage", 0)

    dealer_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #DC2626; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Bestelling Bevestigd</h1>
        </div>
        <div style="padding: 20px;">
            <p>Beste {dealer_company},</p>
            <p>Er is een bestelling voor u geplaatst door Moto Import.</p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0;">{motor_brand} {motor_model} ({motor_year})</h3>
                <p>Km-stand: {motor_mileage:,} km</p>
                <p style="font-size: 24px; font-weight: bold; color: #DC2626;">€{total_price:,.2f}</p>
                <p>Bezorging: {delivery_text}</p>
                <p>Keuring: {inspection_text}</p>
                <p>Taxatie: {valuation_text}</p>
            </div>
            <p style="color: #6b7280;">Wij nemen contact met u op voor de verdere afhandeling.</p>
        </div>
        <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
            <p><strong style="color: white;">Moto Import B.V.</strong></p>
        </div>
    </div>
    """
    try:
        await send_email(dealer["email"], f"Bestelling Bevestigd - {motor_brand} {motor_model} - Moto Import", dealer_html)
    except Exception as e:
        logger.error(f"Failed to send dealer order email: {e}")

    return {"order_id": order.id, "message": f"Bestelling geplaatst namens {dealer_company}"}

@router.get("/admin/approved-dealers")
async def get_approved_dealers(current_user: dict = Depends(require_admin)):
    """Get list of approved dealers for dropdown"""
    dealers = await db.users.find(
        {"role": "dealer", "is_approved": True},
        {"_id": 0, "id": 1, "email": 1, "company_name": 1, "name": 1, "phone": 1, "city": 1}
    ).sort("company_name", 1).to_list(500)
    return dealers


