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

router = APIRouter(tags=["Parts Shop"])

# ============ PARTS SHOP ENDPOINTS ============

# --- Part Categories ---
@router.get("/parts/categories")
async def get_part_categories():
    """Get all part categories"""
    categories = await db.part_categories.find({}, {"_id": 0}).to_list(100)
    return categories

@router.post("/parts/categories")
async def create_part_category(data: PartCategoryCreate, user: dict = Depends(require_admin)):
    """Create a new part category (admin only)"""
    # Check if category already exists
    existing = await db.part_categories.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Categorie bestaat al")
    
    category = PartCategory(
        name=data.name,
        description=data.description
    )
    await db.part_categories.insert_one(category.model_dump())
    return {"message": "Categorie aangemaakt", "category": category.model_dump()}

@router.delete("/parts/categories/{category_id}")
async def delete_part_category(category_id: str, user: dict = Depends(require_admin)):
    """Delete a part category (admin only)"""
    # Check if any parts use this category
    parts_count = await db.parts.count_documents({"category_id": category_id})
    if parts_count > 0:
        raise HTTPException(status_code=400, detail=f"Kan niet verwijderen: {parts_count} onderdelen gebruiken deze categorie")
    
    result = await db.part_categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Categorie niet gevonden")
    return {"message": "Categorie verwijderd"}

@router.get("/parts/brands")
async def get_motorcycle_brands():
    """Get list of motorcycle brands for parts compatibility"""
    return MOTORCYCLE_BRANDS

# --- Parts CRUD ---
@router.get("/parts")
async def get_parts(
    category_id: Optional[str] = None,
    brand: Optional[str] = None,
    search: Optional[str] = None,
    in_stock_only: bool = False
):
    """Get parts with optional filters"""
    query = {"is_active": True}
    
    if category_id:
        query["category_id"] = category_id
    
    if brand:
        query["compatible_brands"] = brand
    
    if in_stock_only:
        query["stock"] = {"$gt": 0}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}}
        ]
    
    parts = await db.parts.find(query, {"_id": 0}).to_list(500)
    return parts

@router.get("/parts/all")
async def get_all_parts_admin(user: dict = Depends(require_admin)):
    """Get all parts including inactive (admin only)"""
    parts = await db.parts.find({}, {"_id": 0}).to_list(500)
    return parts

# NOTE: These order routes MUST be before /parts/{part_id} to avoid path matching issues
@router.get("/parts/orders/my")
async def get_my_part_orders(user: dict = Depends(require_approved_dealer)):
    """Get current user's parts orders"""
    orders = await db.part_orders.find(
        {"dealer_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return orders

@router.get("/parts/orders")
async def get_all_part_orders(user: dict = Depends(require_admin)):
    """Get all parts orders (admin only)"""
    orders = await db.part_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders

@router.put("/parts/orders/{order_id}/status")
async def update_part_order_status(order_id: str, status: str, user: dict = Depends(require_admin)):
    """Update parts order status (admin only)"""
    valid_statuses = ["pending", "paid", "shipped", "completed", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Ongeldige status. Kies uit: {', '.join(valid_statuses)}")
    
    update_data = {"status": status}
    if status == "paid":
        update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.part_orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bestelling niet gevonden")
    
    return {"message": f"Status bijgewerkt naar {status}"}

@router.get("/parts/{part_id}")
async def get_part(part_id: str):
    """Get a specific part"""
    part = await db.parts.find_one({"id": part_id}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Onderdeel niet gevonden")
    return part

@router.post("/parts")
async def create_part(data: PartCreate, user: dict = Depends(require_admin)):
    """Create a new part (admin only)"""
    # Verify category exists
    category = await db.part_categories.find_one({"id": data.category_id})
    if not category:
        raise HTTPException(status_code=400, detail="Categorie niet gevonden")
    
    part = Part(
        name=data.name,
        description=data.description,
        price=data.price,
        category_id=data.category_id,
        category_name=category["name"],
        compatible_brands=data.compatible_brands,
        stock=data.stock,
        sku=data.sku,
        images=data.images
    )
    await db.parts.insert_one(part.model_dump())
    return {"message": "Onderdeel aangemaakt", "part": part.model_dump()}

@router.put("/parts/{part_id}")
async def update_part(part_id: str, data: PartUpdate, user: dict = Depends(require_admin)):
    """Update a part (admin only)"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Geen updates opgegeven")
    
    # If category is changing, update category name too
    if "category_id" in update_data:
        category = await db.part_categories.find_one({"id": update_data["category_id"]})
        if not category:
            raise HTTPException(status_code=400, detail="Categorie niet gevonden")
        update_data["category_name"] = category["name"]
    
    result = await db.parts.update_one({"id": part_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Onderdeel niet gevonden")
    
    updated_part = await db.parts.find_one({"id": part_id}, {"_id": 0})
    return {"message": "Onderdeel bijgewerkt", "part": updated_part}

@router.delete("/parts/{part_id}")
async def delete_part(part_id: str, user: dict = Depends(require_admin)):
    """Delete a part (admin only)"""
    result = await db.parts.delete_one({"id": part_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Onderdeel niet gevonden")
    return {"message": "Onderdeel verwijderd"}

# --- Part Orders ---
async def generate_part_order_number():
    """Generate a sequential order number for parts"""
    year = datetime.now().year
    # Count orders this year
    count = await db.part_orders.count_documents({
        "created_at": {"$regex": f"^{year}"}
    })
    return f"PO-{year}-{str(count + 1).zfill(4)}"

async def generate_parts_invoice_pdf(order: dict, dealer: dict) -> bytes:
    """Generate a PDF invoice for parts order"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from io import BytesIO
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=28, textColor=colors.HexColor('#DC2626'))
    
    elements = []
    
    # Header with FACTUUR title (no logo)
    elements.append(Paragraph("FACTUUR", title_style))
    elements.append(Spacer(1, 10*mm))
    
    # Company info (left side) and Order info (right side) in a table
    header_data = [
        [Paragraph("<b>S. Milone</b><br/>Moto Import B.V.<br/>IBAN: NL90 REVO 9997 6557 88", styles['Normal']),
         Paragraph(f"<b>Factuurnummer:</b> {order['order_number']}<br/><b>Datum:</b> {order['created_at'][:10]}", styles['Normal'])]
    ]
    header_table = Table(header_data, colWidths=[90*mm, 75*mm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 8*mm))
    
    # Customer info
    elements.append(Paragraph("<b>Factuuradres:</b>", styles['Normal']))
    elements.append(Paragraph(f"{dealer.get('company_name', '')}", styles['Normal']))
    if dealer.get('address'):
        elements.append(Paragraph(f"{dealer.get('address', '')}", styles['Normal']))
    if dealer.get('postal_code') or dealer.get('city'):
        elements.append(Paragraph(f"{dealer.get('postal_code', '')} {dealer.get('city', '')}", styles['Normal']))
    elements.append(Paragraph(f"{dealer.get('email', '')}", styles['Normal']))
    elements.append(Spacer(1, 8*mm))
    
    # Items table
    table_data = [['Artikel', 'Aantal', 'Prijs', 'Totaal']]
    for item in order['items']:
        table_data.append([
            item['part_name'],
            str(item['quantity']),
            f"€{item['price']:.2f}",
            f"€{item['quantity'] * item['price']:.2f}"
        ])
    
    # Subtotal, shipping, total
    table_data.append(['', '', 'Subtotaal:', f"€{order['subtotal']:.2f}"])
    if order['shipping_cost'] > 0:
        table_data.append(['', '', 'Verzendkosten:', f"€{order['shipping_cost']:.2f}"])
    else:
        table_data.append(['', '', 'Verzending:', 'Ophalen (gratis)'])
    table_data.append(['', '', '<b>TOTAAL:</b>', f"<b>€{order['total']:.2f}</b>"])
    
    # Convert to Paragraphs for bold text
    for i, row in enumerate(table_data):
        table_data[i] = [Paragraph(str(cell), styles['Normal']) for cell in row]
    
    table = Table(table_data, colWidths=[80*mm, 25*mm, 30*mm, 30*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DC2626')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -4), 0.5, colors.grey),
        ('LINEABOVE', (2, -3), (-1, -3), 1, colors.grey),
        ('LINEABOVE', (2, -1), (-1, -1), 2, colors.black),
    ]))
    elements.append(table)
    
    elements.append(Spacer(1, 15*mm))
    
    # Payment info
    elements.append(Paragraph("<b>Betaalinstructies:</b>", styles['Normal']))
    elements.append(Paragraph(f"Gelieve het totaalbedrag van €{order['total']:.2f} over te maken naar:", styles['Normal']))
    elements.append(Paragraph("<b>IBAN: NL90 REVO 9997 6557 88</b>", styles['Normal']))
    elements.append(Paragraph(f"<b>t.n.v. S. Milone</b>", styles['Normal']))
    elements.append(Paragraph(f"<b>o.v.v. {order['order_number']}</b>", styles['Normal']))
    
    doc.build(elements)
    return buffer.getvalue()

@router.post("/parts/order")
async def create_part_order(data: PartOrderCreate, user: dict = Depends(get_current_user)):
    """Create a parts order (dealers only)"""
    if user.get("role") != "dealer":
        raise HTTPException(status_code=403, detail="Alleen dealers kunnen onderdelen bestellen")
    
    if not user.get("is_approved"):
        raise HTTPException(status_code=403, detail="Uw account is nog niet goedgekeurd")
    
    if not data.items or len(data.items) == 0:
        raise HTTPException(status_code=400, detail="Winkelwagen is leeg")
    
    # Verify all parts exist and have stock
    order_items = []
    subtotal = 0.0
    
    for item in data.items:
        part = await db.parts.find_one({"id": item.part_id, "is_active": True}, {"_id": 0})
        if not part:
            raise HTTPException(status_code=400, detail=f"Onderdeel niet gevonden: {item.part_id}")
        
        if part["stock"] < item.quantity:
            raise HTTPException(status_code=400, detail=f"Onvoldoende voorraad voor {part['name']}: {part['stock']} beschikbaar")
        
        order_items.append({
            "part_id": item.part_id,
            "part_name": part["name"],
            "sku": part.get("sku", ""),
            "quantity": item.quantity,
            "price": part["price"]
        })
        subtotal += part["price"] * item.quantity
    
    # Calculate shipping
    shipping_cost = 9.95 if data.needs_shipping else 0.0
    total = subtotal + shipping_cost
    
    # Create order
    order_number = await generate_part_order_number()
    order = PartOrder(
        order_number=order_number,
        dealer_id=user["id"],
        dealer_email=user["email"],
        dealer_company=user["company_name"],
        dealer_address=user.get("address", ""),
        dealer_postal_code=user.get("postal_code", ""),
        dealer_city=user.get("city", ""),
        dealer_phone=user.get("phone", ""),
        items=order_items,
        subtotal=subtotal,
        shipping_cost=shipping_cost,
        total=total,
        notes=data.notes
    )
    
    await db.part_orders.insert_one(order.model_dump())
    
    # Update stock for each part
    for item in order_items:
        await db.parts.update_one(
            {"id": item["part_id"]},
            {"$inc": {"stock": -item["quantity"]}}
        )
    
    # Generate PDF invoice
    try:
        pdf_bytes = await generate_parts_invoice_pdf(order.model_dump(), user)
        
        # Send email with PDF attachment
        if GMAIL_EMAIL and GMAIL_APP_PASSWORD:
            msg = MIMEMultipart()
            msg['Subject'] = f'Factuur {order_number} - Moto Import Onderdelen'
            msg['From'] = GMAIL_EMAIL
            msg['To'] = user["email"]
            
            # Email body
            body = f"""
Beste {user.get('contact_person', user['company_name'])},

Bedankt voor uw bestelling bij Moto Import!

Bestelnummer: {order_number}
Totaalbedrag: €{total:.2f}

{"Verzending: €9,95" if data.needs_shipping else "Ophalen: Gratis"}

Gelieve het totaalbedrag over te maken naar:
IBAN: NL90 REVO 9997 6557 88
t.n.v. S. Milone
o.v.v. {order_number}

Na ontvangst van uw betaling wordt uw bestelling verwerkt.

Bijgevoegd vindt u de factuur als PDF.

Met vriendelijke groet,
S. Milone
Moto Import
            """
            msg.attach(MIMEText(body, 'plain'))
            
            # Attach PDF
            from email.mime.base import MIMEBase
            from email import encoders
            
            pdf_attachment = MIMEBase('application', 'pdf')
            pdf_attachment.set_payload(pdf_bytes)
            encoders.encode_base64(pdf_attachment)
            pdf_attachment.add_header('Content-Disposition', f'attachment; filename="factuur-{order_number}.pdf"')
            msg.attach(pdf_attachment)
            
            # Send email
            try:
                with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                    smtp.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
                    smtp.send_message(msg)
                logger.info(f"Invoice email sent to {user['email']}")
            except Exception as e:
                logger.error(f"Failed to send invoice email: {e}")
        
        # Also notify all admins
        if ADMIN_EMAILS and GMAIL_EMAIL and GMAIL_APP_PASSWORD:
            items_list = "\n".join([f"- {item['part_name']} x{item['quantity']} (€{item['price'] * item['quantity']:.2f})" for item in order_items])
            admin_body = f"""
Nieuwe onderdelen bestelling ontvangen!

Bestelnummer: {order_number}
Dealer: {user['company_name']}
Email: {user['email']}

Artikelen:
{items_list}

Subtotaal: €{subtotal:.2f}
Verzending: €{shipping_cost:.2f}
TOTAAL: €{total:.2f}

{"Verzending gewenst" if data.needs_shipping else "Wordt opgehaald"}
            """
            
            for admin_email in ADMIN_EMAILS_FULL:
                try:
                    admin_msg = MIMEMultipart()
                    admin_msg['Subject'] = f'Nieuwe onderdelen bestelling: {order_number}'
                    admin_msg['From'] = GMAIL_EMAIL
                    admin_msg['To'] = admin_email
                    admin_msg.attach(MIMEText(admin_body, 'plain'))
                    
                    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                        smtp.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
                        smtp.send_message(admin_msg)
                    logger.info(f"Admin notification sent to {admin_email}")
                except Exception as e:
                    logger.error(f"Failed to send admin notification to {admin_email}: {e}")
                
    except Exception as e:
        logger.error(f"Failed to generate/send invoice: {e}")
    
    return {
        "message": "Bestelling geplaatst! Factuur is verstuurd naar uw email.",
        "order": order.model_dump()
    }


