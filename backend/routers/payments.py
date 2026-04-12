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

router = APIRouter(tags=["Payments"])

# ============ PAYMENT ENDPOINTS ============

@router.post("/payments/create-checkout")
async def create_checkout(data: PaymentRequest, user: dict = Depends(require_approved_dealer)):
    # Get motorcycle
    motorcycle = await db.motorcycles.find_one({"id": data.motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    if not motorcycle.get("is_available", True):
        raise HTTPException(status_code=400, detail="Motor is niet meer beschikbaar")
    
    # Calculate amounts
    if data.order_type == "bid_won":
        # Use highest bid price
        motor_price = motorcycle.get("highest_bid", motorcycle["price"])
    else:
        # Use buy now price
        motor_price = motorcycle["price"]
    
    deposit_amount = motor_price * DEPOSIT_PERCENTAGE
    delivery_cost = DELIVERY_COST if data.needs_delivery else 0.0
    total_to_pay = deposit_amount + delivery_cost
    
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
    
    # Create order first
    order = Order(
        motorcycle_id=data.motorcycle_id,
        dealer_id=user["id"],
        dealer_email=user["email"],
        dealer_company=user["company_name"],
        status="pending",
        needs_delivery=data.needs_delivery,
        delivery_cost=delivery_cost,
        deposit_amount=deposit_amount,
        total_price=motor_price,
        payment_status="pending",
        motorcycle_snapshot=motorcycle_snapshot
    )
    
    # Save order
    await db.orders.insert_one(order.model_dump())
    
    # Create Stripe checkout session
    try:
        webhook_url = f"{data.origin_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        success_url = f"{data.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&order_id={order.id}"
        cancel_url = f"{data.origin_url}/motorcycle/{data.motorcycle_id}"
        
        # Description for Stripe
        description = f"Aanbetaling 10% - {motorcycle['brand']} {motorcycle['model']}"
        if data.needs_delivery:
            description += " + Bezorging €50"
        
        checkout_request = CheckoutSessionRequest(
            amount=float(total_to_pay),
            currency="eur",
            success_url=success_url,
            cancel_url=cancel_url,
            payment_methods=["ideal", "card"],  # iDEAL + creditcard
            metadata={
                "order_id": order.id,
                "motorcycle_id": data.motorcycle_id,
                "dealer_id": user["id"],
                "deposit_amount": str(deposit_amount),
                "delivery_cost": str(delivery_cost),
                "total_price": str(motor_price)
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Update order with stripe session id
        await db.orders.update_one(
            {"id": order.id},
            {"$set": {"stripe_session_id": session.session_id}}
        )
        
        # Save payment transaction
        await db.payment_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "order_id": order.id,
            "session_id": session.session_id,
            "amount": total_to_pay,
            "currency": "eur",
            "dealer_id": user["id"],
            "dealer_email": user["email"],
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "order_id": order.id,
            "deposit_amount": deposit_amount,
            "delivery_cost": delivery_cost,
            "total_to_pay": total_to_pay
        }
        
    except Exception as e:
        # Delete the order if Stripe fails
        await db.orders.delete_one({"id": order.id})
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Betaling kon niet worden gestart: {str(e)}")

@router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, user: dict = Depends(require_approved_dealer)):
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update order and transaction status
        if status.payment_status == "paid":
            # Update payment transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid"}}
            )
            
            # Update order
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            if transaction:
                await db.orders.update_one(
                    {"id": transaction["order_id"]},
                    {"$set": {"payment_status": "paid", "status": "paid"}}
                )
                
                # Mark motorcycle as unavailable
                order = await db.orders.find_one({"id": transaction["order_id"]})
                if order:
                    await db.motorcycles.update_one(
                        {"id": order["motorcycle_id"]},
                        {"$set": {"is_available": False}}
                    )
                    
                    # Send email to admin
                    motorcycle = await db.motorcycles.find_one({"id": order["motorcycle_id"]}, {"_id": 0})
                    dealer = await db.users.find_one({"id": order["dealer_id"]}, {"_id": 0})
                    if motorcycle:
                        delivery_text = "Ja (€50)" if order.get("needs_delivery") else "Nee (ophalen)"
                        rest_bedrag = order['total_price'] - order['deposit_amount']
                        
                        # Email naar Admin
                        admin_html = f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px;">
                            <h2 style="color: #16a34a;">💰 Aanbetaling Ontvangen!</h2>
                            <p>Er is een aanbetaling ontvangen voor:</p>
                            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                <tr style="background: #f4f4f5;">
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Motor</strong></td>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{motorcycle['brand']} {motorcycle['model']} ({motorcycle['year']})</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Dealer</strong></td>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{order['dealer_company']}</td>
                                </tr>
                                <tr style="background: #f4f4f5;">
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Dealer Email</strong></td>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{order.get('dealer_email', 'N/A')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Dealer Telefoon</strong></td>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{dealer.get('phone', 'N/A') if dealer else 'N/A'}</td>
                                </tr>
                                <tr style="background: #f4f4f5;">
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Totaalprijs</strong></td>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;">€{order['total_price']:,.2f}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Aanbetaling (10%)</strong></td>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;">€{order['deposit_amount']:,.2f}</td>
                                </tr>
                                <tr style="background: #f4f4f5;">
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Restbedrag</strong></td>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;">€{rest_bedrag:,.2f}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Bezorging</strong></td>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{delivery_text}</td>
                                </tr>
                                <tr style="background: #f4f4f5;">
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Order ID</strong></td>
                                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{order['id']}</td>
                                </tr>
                            </table>
                        </div>
                        """
                        await send_admin_notification("💰 Aanbetaling Ontvangen!", admin_html)
                        
                        # Email naar Dealer
                        dealer_html = f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: #DC2626; padding: 20px; text-align: center;">
                                <h1 style="color: white; margin: 0; font-size: 24px;">MOTO IMPORT</h1>
                            </div>
                            <div style="padding: 30px; background: #f9fafb;">
                                <h2 style="color: #16a34a; margin-top: 0;">✅ Aankoopbevestiging</h2>
                                <p>Beste {order['dealer_company']},</p>
                                <p>Bedankt voor uw aankoop! Hieronder vindt u de details van uw bestelling.</p>
                                
                                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                    <h3 style="margin-top: 0; color: #18181b;">Uw Motorfiets</h3>
                                    <p style="font-size: 20px; font-weight: bold; color: #DC2626; margin: 10px 0;">
                                        {motorcycle['brand']} {motorcycle['model']} ({motorcycle['year']})
                                    </p>
                                    <p style="color: #6b7280; margin: 5px 0;">Kleur: {motorcycle.get('color', 'N/A')}</p>
                                    <p style="color: #6b7280; margin: 5px 0;">Kilometerstand: {motorcycle.get('mileage', 'N/A'):,} km</p>
                                </div>
                                
                                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                    <h3 style="margin-top: 0; color: #18181b;">Betalingsoverzicht</h3>
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Totaalprijs motor</td>
                                            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">€{order['total_price']:,.2f}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Aanbetaling (10%)</td>
                                            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #16a34a;">- €{order['deposit_amount']:,.2f}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Bezorging</td>
                                            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{delivery_text}</td>
                                        </tr>
                                        <tr style="font-weight: bold; font-size: 18px;">
                                            <td style="padding: 12px 0;">Restbedrag</td>
                                            <td style="padding: 12px 0; text-align: right; color: #DC2626;">€{rest_bedrag:,.2f}</td>
                                        </tr>
                                    </table>
                                </div>
                                
                                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                    <h3 style="margin-top: 0; color: #92400e;">⚠️ Restbedrag Overmaken</h3>
                                    <p style="margin-bottom: 15px;">Maak het restbedrag binnen <strong>5 werkdagen</strong> na ontvangst van de factuur over naar:</p>
                                    <div style="background: white; padding: 15px; border-radius: 6px; font-family: monospace;">
                                        <p style="margin: 5px 0;"><strong>IBAN:</strong> NL23 INGB 0107 0760 63</p>
                                        <p style="margin: 5px 0;"><strong>T.n.v.:</strong> Moto Import B.V.</p>
                                        <p style="margin: 5px 0;"><strong>Kenmerk:</strong> {order['id'][:8].upper()}</p>
                                    </div>
                                </div>
                                
                                <p style="color: #6b7280; font-size: 14px;">
                                    Order ID: {order['id']}<br>
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
                        await send_email(order.get('dealer_email', ''), "✅ Aankoopbevestiging - Moto Import", dealer_html)
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency
        }
    except Exception as e:
        logger.error(f"Error getting payment status: {str(e)}")
        raise HTTPException(status_code=500, detail="Kon betaalstatus niet ophalen")

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    try:
        body = await request.body()
        stripe_signature = request.headers.get("Stripe-Signature")
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, stripe_signature)
        
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid"}}
            )
            
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            if transaction:
                await db.orders.update_one(
                    {"id": transaction["order_id"]},
                    {"$set": {"payment_status": "paid", "status": "paid"}}
                )
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error"}

@router.get("/payments/calculate")
async def calculate_payment(motorcycle_id: str, needs_delivery: bool = False, user: dict = Depends(get_current_user)):
    """Calculate payment amounts before checkout"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    motor_price = motorcycle["price"]
    deposit_amount = motor_price * DEPOSIT_PERCENTAGE
    delivery_cost = DELIVERY_COST if needs_delivery else 0.0
    total_to_pay = deposit_amount + delivery_cost
    
    return {
        "motor_price": motor_price,
        "deposit_percentage": DEPOSIT_PERCENTAGE * 100,
        "deposit_amount": deposit_amount,
        "delivery_cost": delivery_cost,
        "total_to_pay": total_to_pay
    }


