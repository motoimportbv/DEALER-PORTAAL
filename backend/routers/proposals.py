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

router = APIRouter(tags=["Price Proposals"])

# ============ PRICE PROPOSAL ENDPOINTS ============

@router.post("/price-proposals")
async def create_price_proposal(data: PriceProposalCreate, user: dict = Depends(get_current_user)):
    """Dealer submits a price proposal for a motorcycle"""
    # Foreign dealers cannot submit proposals
    if user.get("is_foreign_dealer"):
        raise HTTPException(status_code=403, detail="Buitenlandse leveranciers kunnen geen prijsvoorstellen indienen")
    
    # Get motorcycle
    motorcycle = await db.motorcycles.find_one({"id": data.motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    if not motorcycle.get("is_available", True):
        raise HTTPException(status_code=400, detail="Motor is niet meer beschikbaar")
    
    # Check if dealer already has a pending proposal for this motorcycle
    existing = await db.price_proposals.find_one({
        "motorcycle_id": data.motorcycle_id,
        "dealer_id": user["id"],
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="U heeft al een openstaand voorstel voor deze motor")
    
    # Create proposal
    proposal = PriceProposal(
        motorcycle_id=data.motorcycle_id,
        dealer_id=user["id"],
        dealer_company=user.get("company_name", "Onbekend"),
        dealer_email=user.get("email", ""),
        original_price=motorcycle.get("price", 0),
        proposed_price=data.proposed_price,
        reason=data.reason,
        request_inspection=data.request_inspection,
        request_appraisal=data.request_appraisal,
        request_delivery=data.request_delivery
    )
    
    await db.price_proposals.insert_one(proposal.model_dump())
    
    # Send email notification to admin
    try:
        difference = motorcycle.get("price", 0) - data.proposed_price
        diff_text = f"€{abs(difference):,.0f}".replace(",", ".") + (" onder" if difference > 0 else " boven" if difference < 0 else " gelijk aan")
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #18181b; padding: 25px; text-align: center;">
                <h1 style="color: white; margin: 0;">💰 NIEUW PRIJSVOORSTEL</h1>
            </div>
            
            <div style="padding: 30px; background: #fffbeb; border: 2px solid #f59e0b;">
                <h2 style="color: #b45309; margin-top: 0;">Prijsvoorstel ontvangen</h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #666;">Dealer:</td>
                        <td style="padding: 8px 0; font-weight: bold;">{user.get('company_name', 'Onbekend')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;">E-mail:</td>
                        <td style="padding: 8px 0;">{user.get('email', '')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;">Motor:</td>
                        <td style="padding: 8px 0; font-weight: bold;">{motorcycle.get('brand', '')} {motorcycle.get('model', '')} ({motorcycle.get('year', '')})</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;">Vraagprijs:</td>
                        <td style="padding: 8px 0;">€{motorcycle.get('price', 0):,.0f}</td>
                    </tr>
                    <tr style="background: #fef3c7;">
                        <td style="padding: 12px 8px; color: #666; font-weight: bold;">Voorstel:</td>
                        <td style="padding: 12px 8px; font-weight: bold; font-size: 1.2em; color: #b45309;">€{data.proposed_price:,.0f}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;">Verschil:</td>
                        <td style="padding: 8px 0; color: {'#dc2626' if difference > 0 else '#16a34a'};">{diff_text} vraagprijs</td>
                    </tr>
                </table>
                
                {f'<div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px;"><strong>Toelichting dealer:</strong><br><em>"{data.reason}"</em></div>' if data.reason else ''}
                
                {'<div style="margin-top: 15px; padding: 15px; background: #dbeafe; border-radius: 8px; border: 1px solid #3b82f6;"><strong style="color: #1d4ed8;">📋 Gevraagde opties:</strong><ul style="margin: 10px 0 0 0; padding-left: 20px;">' + (''.join([f'<li>Keuringskosten</li>' if data.request_inspection else '', f'<li>Taxatiekosten</li>' if data.request_appraisal else '', f'<li>Bezorging</li>' if data.request_delivery else ''])) + '</ul></div>' if (data.request_inspection or data.request_appraisal or data.request_delivery) else ''}
                
                <div style="margin-top: 25px; text-align: center;">
                    <a href="https://www.motoimportbv.nl/admin/price-proposals" 
                       style="display: inline-block; background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Bekijk Voorstellen
                    </a>
                </div>
            </div>
            
            <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
                <p>Moto Import B.V. | www.motoimportbv.nl</p>
            </div>
        </div>
        """
        
        await send_email(
            to_email=os.environ.get("GMAIL_EMAIL", "motoimportbv@gmail.com"),
            subject=f"💰 Prijsvoorstel: {motorcycle.get('brand', '')} {motorcycle.get('model', '')} - €{data.proposed_price:,.0f}",
            html_content=html_content
        )
    except Exception as e:
        logger.error(f"Failed to send price proposal email: {e}")
    
    return {"message": "Prijsvoorstel verstuurd!", "proposal_id": proposal.id}


@router.get("/price-proposals")
async def get_price_proposals(user: dict = Depends(require_admin)):
    """Admin gets all price proposals"""
    proposals = await db.price_proposals.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with motorcycle info
    for proposal in proposals:
        motorcycle = await db.motorcycles.find_one({"id": proposal.get("motorcycle_id")}, {"_id": 0, "brand": 1, "model": 1, "year": 1, "images": 1, "price": 1, "is_available": 1})
        proposal["motorcycle"] = motorcycle
    
    return proposals


@router.get("/price-proposals/my")
async def get_my_price_proposals(user: dict = Depends(get_current_user)):
    """Dealer gets their own price proposals"""
    proposals = await db.price_proposals.find({"dealer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Enrich with motorcycle info
    for proposal in proposals:
        motorcycle = await db.motorcycles.find_one({"id": proposal.get("motorcycle_id")}, {"_id": 0, "brand": 1, "model": 1, "year": 1, "images": 1})
        proposal["motorcycle"] = motorcycle
    
    return proposals


@router.put("/price-proposals/{proposal_id}/respond")
async def respond_to_proposal(
    proposal_id: str, 
    response: str, 
    admin_message: str = "", 
    counter_price: float = None,
    include_inspection: bool = False,
    include_appraisal: bool = False,
    include_delivery: bool = False,
    user: dict = Depends(require_admin)
):
    """Admin responds to a price proposal (accept/reject/counter)"""
    proposal = await db.price_proposals.find_one({"id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Voorstel niet gevonden")
    
    if proposal.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Dit voorstel is al beantwoord")
    
    if response not in ["accepted", "rejected", "counter"]:
        raise HTTPException(status_code=400, detail="Ongeldige reactie")
    
    # Update proposal
    update_data = {
        "status": response,
        "admin_response": admin_message,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if response == "counter" and counter_price:
        update_data["counter_price"] = counter_price
    
    # Store extra options for accepted proposals
    if response == "accepted":
        update_data["include_inspection"] = include_inspection
        update_data["include_appraisal"] = include_appraisal
        update_data["include_delivery"] = include_delivery
    
    await db.price_proposals.update_one({"id": proposal_id}, {"$set": update_data})
    
    # Get motorcycle info
    motorcycle = await db.motorcycles.find_one({"id": proposal.get("motorcycle_id")}, {"_id": 0})
    
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Get dealer info
    dealer = await db.users.find_one({"id": proposal.get("dealer_id")}, {"_id": 0, "password_hash": 0})
    
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    # If ACCEPTED: Create order, mark as sold, send pakbon
    if response == "accepted":
        # Create snapshot of motorcycle data with the ACCEPTED price
        motorcycle_snapshot = {
            "id": motorcycle.get("id"),
            "brand": motorcycle.get("brand"),
            "model": motorcycle.get("model"),
            "year": motorcycle.get("year"),
            "price": proposal.get("proposed_price"),  # Use accepted price in snapshot!
            "original_price": proposal.get("original_price"),
            "mileage": motorcycle.get("mileage"),
            "color": motorcycle.get("color"),
            "condition": motorcycle.get("condition"),
            "images": motorcycle.get("images", []),
            "description": motorcycle.get("description"),
        }
        
        # Create order with the accepted price and extra options
        order_id = str(uuid.uuid4())
        order = {
            "id": order_id,
            "motorcycle_id": proposal.get("motorcycle_id"),
            "dealer_id": proposal.get("dealer_id"),
            "dealer_email": dealer.get("email", ""),
            "dealer_company": dealer.get("company_name", ""),
            "price": proposal.get("proposed_price"),  # Use the accepted proposal price
            "total_price": proposal.get("proposed_price"),  # Total price = accepted price
            "original_price": proposal.get("original_price"),
            "discount_amount": proposal.get("original_price", 0) - proposal.get("proposed_price", 0),
            "motorcycle_snapshot": motorcycle_snapshot,
            "status": "confirmed",
            "payment_status": "pending",
            "needs_delivery": include_delivery,
            "delivery_cost": 0,
            "deposit_amount": 0,
            "order_type": "price_proposal",
            "proposal_id": proposal_id,
            "include_inspection": include_inspection,
            "include_appraisal": include_appraisal,
            "include_delivery": include_delivery,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.orders.insert_one(order)
        
        # Mark motorcycle as SOLD
        await db.motorcycles.update_one(
            {"id": proposal.get("motorcycle_id")},
            {"$set": {"is_available": False}}
        )
        
        # Generate pakbon HTML
        pakbon_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="background: #18181b; padding: 25px; text-align: center; margin-bottom: 20px;">
                <h1 style="color: white; margin: 0;">🏍️ MOTO IMPORT B.V.</h1>
                <p style="color: #a1a1aa; margin: 5px 0 0 0;">Pakbon / Delivery Note</p>
            </div>
            
            <div style="background: #f0fdf4; border: 2px solid #22c55e; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #16a34a; margin: 0 0 10px 0;">✅ BESTELLING BEVESTIGD</h2>
                <p style="margin: 0; color: #166534;">Uw prijsvoorstel is geaccepteerd!</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr style="background: #f4f4f5;">
                    <td style="padding: 12px; font-weight: bold; width: 40%;">Order Nummer:</td>
                    <td style="padding: 12px;">{order_id[:8].upper()}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; font-weight: bold;">Datum:</td>
                    <td style="padding: 12px;">{datetime.now(timezone.utc).strftime('%d-%m-%Y %H:%M')}</td>
                </tr>
            </table>
            
            <h3 style="border-bottom: 2px solid #e4e4e7; padding-bottom: 10px;">📋 Klantgegevens</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding: 8px 12px; font-weight: bold; width: 40%;">Bedrijf:</td>
                    <td style="padding: 8px 12px;">{dealer.get('company_name', 'N/A')}</td>
                </tr>
                <tr style="background: #f4f4f5;">
                    <td style="padding: 8px 12px; font-weight: bold;">E-mail:</td>
                    <td style="padding: 8px 12px;">{dealer.get('email', 'N/A')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; font-weight: bold;">Telefoon:</td>
                    <td style="padding: 8px 12px;">{dealer.get('phone', 'N/A')}</td>
                </tr>
                <tr style="background: #f4f4f5;">
                    <td style="padding: 8px 12px; font-weight: bold;">Adres:</td>
                    <td style="padding: 8px 12px;">{dealer.get('address', 'N/A')}</td>
                </tr>
            </table>
            
            <h3 style="border-bottom: 2px solid #e4e4e7; padding-bottom: 10px;">🏍️ Motorgegevens</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding: 8px 12px; font-weight: bold; width: 40%;">Merk / Model:</td>
                    <td style="padding: 8px 12px; font-weight: bold; font-size: 1.1em;">{motorcycle.get('brand', '')} {motorcycle.get('model', '')}</td>
                </tr>
                <tr style="background: #f4f4f5;">
                    <td style="padding: 8px 12px; font-weight: bold;">Bouwjaar:</td>
                    <td style="padding: 8px 12px;">{motorcycle.get('year', 'N/A')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; font-weight: bold;">Kilometerstand:</td>
                    <td style="padding: 8px 12px;">{motorcycle.get('mileage', 0):,} km</td>
                </tr>
                <tr style="background: #f4f4f5;">
                    <td style="padding: 8px 12px; font-weight: bold;">Kleur:</td>
                    <td style="padding: 8px 12px;">{motorcycle.get('color', 'N/A')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; font-weight: bold;">Chassisnummer:</td>
                    <td style="padding: 8px 12px; font-family: monospace;">{motorcycle.get('chassis_number', 'N/A')}</td>
                </tr>
            </table>
            
            <h3 style="border-bottom: 2px solid #e4e4e7; padding-bottom: 10px;">💰 Prijsoverzicht</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding: 8px 12px;">Oorspronkelijke prijs:</td>
                    <td style="padding: 8px 12px; text-align: right; text-decoration: line-through; color: #666;">€{proposal.get('original_price', 0):,.2f}</td>
                </tr>
                <tr style="background: #fef3c7;">
                    <td style="padding: 8px 12px; font-weight: bold;">Uw voorstel (geaccepteerd):</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #b45309;">-€{proposal.get('original_price', 0) - proposal.get('proposed_price', 0):,.2f}</td>
                </tr>
                <tr style="background: #18181b; color: white;">
                    <td style="padding: 15px 12px; font-weight: bold; font-size: 1.2em;">TOTAAL:</td>
                    <td style="padding: 15px 12px; text-align: right; font-weight: bold; font-size: 1.3em;">€{proposal.get('proposed_price', 0):,.2f}</td>
                </tr>
            </table>
            
            {'<h3 style="border-bottom: 2px solid #e4e4e7; padding-bottom: 10px;">📋 Extra Opties</h3><div style="background: #f0fdf4; border: 1px solid #22c55e; padding: 15px; border-radius: 8px; margin-bottom: 20px;"><ul style="margin: 0; padding-left: 20px;">' + (''.join([f'<li style="color: #16a34a;">✅ Keuringskosten inbegrepen</li>' if include_inspection else '', f'<li style="color: #16a34a;">✅ Taxatiekosten inbegrepen</li>' if include_appraisal else '', f'<li style="color: #16a34a;">✅ Bezorging inbegrepen</li>' if include_delivery else ''])) + '</ul></div>' if (include_inspection or include_appraisal or include_delivery) else ''}
            
            {f'<div style="padding: 15px; background: #f0f9ff; border-left: 4px solid #3b82f6; margin-bottom: 20px;"><strong>Bericht van Moto Import:</strong><br>{admin_message}</div>' if admin_message else ''}
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #b45309;">⚠️ Volgende stappen:</h4>
                <ol style="margin: 0; padding-left: 20px; color: #92400e;">
                    <li>Neem contact op voor betaling en ophaalafspraak</li>
                    <li>Breng legitimatie en dit document mee bij ophalen</li>
                    <li>Controleer de motor bij ontvangst</li>
                </ol>
            </div>
            
            <div style="text-align: center; padding: 20px; background: #f4f4f5; border-radius: 8px;">
                <p style="margin: 0 0 10px 0; font-weight: bold;">Moto Import B.V.</p>
                
                <p style="margin: 5px 0; color: #666;">📞 +31 6 24264861 | ✉️ motoimportbv@gmail.com</p>
                <p style="margin: 5px 0; color: #666;">🌐 www.motoimportbv.nl</p>
            </div>
        </div>
        """
        
        # Send pakbon to dealer
        try:
            await send_email(
                to_email=proposal.get("dealer_email"),
                subject=f"✅ PAKBON - {motorcycle.get('brand', '')} {motorcycle.get('model', '')} - Order #{order_id[:8].upper()}",
                html_content=pakbon_html
            )
        except Exception as e:
            logger.error(f"Failed to send pakbon: {e}")
        
        # Send notification to admin
        try:
            admin_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #16a34a; padding: 25px; text-align: center;">
                    <h1 style="color: white; margin: 0;">✅ MOTOR VERKOCHT</h1>
                </div>
                <div style="padding: 30px; background: #f0fdf4;">
                    <h2 style="margin-top: 0;">{motorcycle.get('brand', '')} {motorcycle.get('model', '')} ({motorcycle.get('year', '')})</h2>
                    <p><strong>Koper:</strong> {dealer.get('company_name', 'N/A')}</p>
                    <p><strong>Oorspronkelijke prijs:</strong> €{proposal.get('original_price', 0):,.2f}</p>
                    <p><strong>Verkocht voor:</strong> <span style="color: #16a34a; font-weight: bold; font-size: 1.2em;">€{proposal.get('proposed_price', 0):,.2f}</span></p>
                    <p><strong>Korting gegeven:</strong> €{proposal.get('original_price', 0) - proposal.get('proposed_price', 0):,.2f}</p>
                    <p><strong>Order #:</strong> {order_id[:8].upper()}</p>
                </div>
            </div>
            """
            await send_admin_notification(
                f"✅ VERKOCHT: {motorcycle.get('brand', '')} {motorcycle.get('model', '')} voor €{proposal.get('proposed_price', 0):,.0f}",
                admin_html
            )
        except Exception as e:
            logger.error(f"Failed to send admin notification: {e}")
        
        return {"message": "Voorstel geaccepteerd! Order aangemaakt en pakbon verstuurd.", "order_id": order_id}
    
    # For rejected or counter: just send notification email
    try:
        if response == "rejected":
            status_text = "❌ AFGEWEZEN"
            status_color = "#dc2626"
            message = f"Helaas is uw prijsvoorstel van €{proposal.get('proposed_price'):,.0f} voor de {motorcycle.get('brand', '')} {motorcycle.get('model', '')} afgewezen."
        else:  # counter
            status_text = "💬 TEGENBOD"
            status_color = "#f59e0b"
            message = f"Wij hebben een tegenbod voor uw voorstel op de {motorcycle.get('brand', '')} {motorcycle.get('model', '')}: €{counter_price:,.0f}"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #18181b; padding: 25px; text-align: center;">
                <h1 style="color: white; margin: 0;">🏍️ MOTO IMPORT</h1>
            </div>
            
            <div style="padding: 30px; background: #f9fafb;">
                <div style="background: {status_color}; color: white; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">{status_text}</h2>
                </div>
                
                <p>{message}</p>
                
                {f'<div style="padding: 15px; background: white; border-left: 4px solid {status_color}; margin: 20px 0;"><strong>Bericht van Moto Import:</strong><br>{admin_message}</div>' if admin_message else ''}
                
                <div style="margin-top: 25px; text-align: center;">
                    <a href="https://www.motoimportbv.nl/dealer" 
                       style="display: inline-block; background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Ga naar Dashboard
                    </a>
                </div>
            </div>
            
            <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
                <p>Moto Import B.V. | +31 6 24264861 | motoimportbv@gmail.com</p>
            </div>
        </div>
        """
        
        await send_email(
            to_email=proposal.get("dealer_email"),
            subject=f"{status_text} - Uw prijsvoorstel voor {motorcycle.get('brand', '')} {motorcycle.get('model', '')}",
            html_content=html_content
        )
    except Exception as e:
        logger.error(f"Failed to send proposal response email: {e}")
    
    return {"message": f"Voorstel {response}"}


@router.get("/price-proposals/count")
async def get_pending_proposals_count(user: dict = Depends(require_admin)):
    """Get count of pending proposals for admin badge"""
    count = await db.price_proposals.count_documents({"status": "pending"})
    return {"count": count}


