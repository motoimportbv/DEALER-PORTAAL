# Dealers Router
# Dealer management endpoints

from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
from typing import List
import uuid
import jwt
import json
import random
import string

from config import JWT_SECRET, JWT_ALGORITHM, PRODUCTION_BASE_URL, logger
from database import db
from services import (
    get_current_user, require_admin, hash_password,
    send_email, send_admin_notification
)
from models import (
    Notification, Voucher,
    CreateAdminRequest, ResetPasswordRequest, DealerPhoneUpdate
)

router = APIRouter(tags=["Dealers"])


# ============ DEALER FOREIGN STATUS ============

@router.post("/dealers/{dealer_id}/set-foreign")
async def set_foreign_dealer(dealer_id: str, country: str, user: dict = Depends(require_admin)):
    """Mark a dealer as foreign dealer (supplier)"""
    dealer = await db.users.find_one({"id": dealer_id, "role": "dealer"})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    await db.users.update_one(
        {"id": dealer_id},
        {"$set": {"is_foreign_dealer": True, "country": country}}
    )
    
    return {"message": f"Dealer gemarkeerd als buitenlandse dealer ({country})"}


@router.post("/dealers/{dealer_id}/unset-foreign")
async def unset_foreign_dealer(dealer_id: str, user: dict = Depends(require_admin)):
    """Remove foreign dealer status"""
    dealer = await db.users.find_one({"id": dealer_id, "role": "dealer"})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    await db.users.update_one(
        {"id": dealer_id},
        {"$set": {"is_foreign_dealer": False, "country": ""}}
    )
    
    return {"message": "Buitenlandse dealer status verwijderd"}


# ============ DEALER LISTING ============

@router.get("/dealers")
async def get_dealers(user: dict = Depends(require_admin)):
    dealers = await db.users.find(
        {"role": "dealer"},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return dealers


@router.get("/dealers/pending")
async def get_pending_dealers(user: dict = Depends(require_admin)):
    dealers = await db.users.find(
        {"role": "dealer", "is_approved": False},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return dealers


# ============ DEALER APPROVAL ============

@router.put("/dealers/{dealer_id}/approve")
async def approve_dealer(request: Request, dealer_id: str, user: dict = Depends(require_admin)):
    dealer = await db.users.find_one({"id": dealer_id, "role": "dealer"})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    await db.users.update_one(
        {"id": dealer_id},
        {"$set": {"is_approved": True}}
    )
    
    is_foreign = dealer.get("is_foreign_dealer", False)
    base_url = PRODUCTION_BASE_URL
    login_url = f"{base_url}/login"
    
    # Buitenlandse dealers krijgen GEEN voucher
    if is_foreign:
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #18181b; padding: 25px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🏍️ MOTO IMPORT</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #16a34a; margin-top: 0;">✅ Account Approved!</h2>
                    <p>Dear {dealer.get('contact_person', dealer['company_name'])},</p>
                    <p>Your supplier account at <strong>Moto Import</strong> has been approved!</p>
                    <p>You can now log in and submit motorcycles for sale to our dealer network.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{login_url}" 
                           style="display: inline-block; background: #DC2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            Login Now
                        </a>
                    </div>
                </div>
                
                <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
                    <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
                    <p style="margin: 5px 0;">www.motoimportbv.nl</p>
                    <p style="margin: 5px 0;">Tel: +31 6 81792660 | Email: Motoimportbv@gmail.com</p>
                </div>
            </div>
            """
            await send_email(dealer["email"], "✅ Account Approved - Moto Import", html_content)
        except Exception as e:
            logger.error(f"Failed to send approval email to foreign dealer: {str(e)}")
        
        return {"message": f"Buitenlandse dealer {dealer['company_name']} is goedgekeurd"}
    
    # Nederlandse dealers krijgen WEL een voucher
    voucher_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    voucher_code = f"WELKOM-{voucher_suffix}"
    
    voucher = Voucher(
        code=voucher_code,
        dealer_id=dealer_id,
        amount=250.0
    )
    await db.vouchers.insert_one(voucher.model_dump())
    
    try:
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #18181b; padding: 25px; text-align: center;">
                <h1 style="color: white; margin: 0;">🏍️ MOTO IMPORT</h1>
            </div>
            
            <div style="padding: 30px; background: #f9fafb;">
                <h2 style="color: #16a34a; margin-top: 0;">✅ Account Goedgekeurd!</h2>
                <p>Beste {dealer.get('contact_person', dealer['company_name'])},</p>
                <p>Uw dealer account bij <strong>Moto Import</strong> is goedgekeurd!</p>
                <p>U kunt nu inloggen en direct motorfietsen bestellen.</p>
                
                <!-- VOUCHER -->
                <div style="background: linear-gradient(135deg, #DC2626 0%, #b91c1c 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; color: white;">
                    <p style="margin: 0 0 5px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9;">🎁 Welkomstcadeau</p>
                    <h2 style="margin: 0; font-size: 36px; font-weight: bold;">€250 KORTING</h2>
                    <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">op uw eerste aankoop</p>
                    
                    <div style="background: white; border-radius: 8px; padding: 15px; margin-top: 20px;">
                        <p style="margin: 0 0 5px 0; color: #71717a; font-size: 12px; text-transform: uppercase;">Uw vouchercode</p>
                        <p style="margin: 0; font-family: monospace; font-size: 28px; font-weight: bold; color: #18181b; letter-spacing: 3px;">{voucher_code}</p>
                    </div>
                    
                    <p style="margin: 15px 0 0 0; font-size: 12px; opacity: 0.8;">
                        Voer deze code in bij het bestellen van uw eerste motor
                    </p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{login_url}" 
                       style="display: inline-block; background: #DC2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Nu Inloggen & Bestellen
                    </a>
                </div>
                
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                        <strong>💡 Tip:</strong> De voucher is eenmalig geldig en wordt automatisch toegepast bij uw eerste bestelling. Bewaar deze email goed!
                    </p>
                </div>
            </div>
            
            <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
                <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
                <p style="margin: 5px 0;">www.motoimportbv.nl</p>
                <p style="margin: 5px 0;">Tel: +31 6 81792660 | Email: Motoimportbv@gmail.com</p>
            </div>
        </div>
        """
        await send_email(dealer["email"], "🎁 Welkom bij Moto Import + €250 Voucher!", html_content)
    except Exception as e:
        logger.error(f"Failed to send approval email: {str(e)}")
    
    return {"message": f"Dealer {dealer['company_name']} is goedgekeurd", "voucher_code": voucher_code}


@router.put("/dealers/{dealer_id}/reject")
async def reject_dealer(dealer_id: str, user: dict = Depends(require_admin)):
    dealer = await db.users.find_one({"id": dealer_id, "role": "dealer"})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    await db.users.delete_one({"id": dealer_id})
    
    return {"message": f"Dealer {dealer['company_name']} is afgewezen en verwijderd"}


@router.delete("/dealers/{dealer_id}")
async def delete_dealer(dealer_id: str, user: dict = Depends(require_admin)):
    """Verwijder een dealer volledig uit het systeem"""
    dealer = await db.users.find_one({"id": dealer_id, "role": "dealer"})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    await db.users.delete_one({"id": dealer_id})
    
    # Verwijder ook gerelateerde data
    await db.vouchers.delete_many({"dealer_id": dealer_id})
    await db.notifications.delete_many({"user_id": dealer_id})
    await db.push_subscriptions.delete_many({"user_id": dealer_id})
    await db.chat_messages.delete_many({"sender_id": dealer_id})
    
    return {"message": f"Dealer {dealer['company_name']} is verwijderd"}


# ============ DEALER OFFLINE/ONLINE TOGGLE ============

@router.put("/dealers/{dealer_id}/toggle-offline")
async def toggle_dealer_offline(dealer_id: str, user: dict = Depends(require_admin)):
    """Zet een dealer tijdelijk offline/online - ontvangt geen meldingen wanneer offline"""
    dealer = await db.users.find_one({"id": dealer_id, "role": {"$in": ["dealer", "foreign_dealer"]}})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    current_status = dealer.get("is_offline", False)
    new_status = not current_status
    
    await db.users.update_one(
        {"id": dealer_id},
        {"$set": {"is_offline": new_status}}
    )
    
    status_text = "offline" if new_status else "online"
    
    # Send notification when dealer is set back ONLINE
    if not new_status:
        notification = Notification(
            user_id=dealer_id,
            type="account_online",
            title="Account weer online",
            message="Goed nieuws! Wij waren bezig met een update en alles is nu afgerond. Uw account is weer online en u kunt weer volop gebruik maken van het platform."
        )
        await db.notifications.insert_one(notification.model_dump())
        
        # Note: Push notifications disabled - requires pywebpush
        return {
            "message": f"Dealer {dealer['company_name']} is nu {status_text}",
            "is_offline": new_status,
            "push_notifications_sent": 0,
            "push_notifications_failed": 0
        }
    
    return {
        "message": f"Dealer {dealer['company_name']} is nu {status_text}",
        "is_offline": new_status
    }


# ============ DEALER PHONE UPDATE ============

@router.put("/dealers/{dealer_id}/phone")
async def update_dealer_phone(dealer_id: str, data: DealerPhoneUpdate, user: dict = Depends(require_admin)):
    """Admin updates dealer phone number"""
    dealer = await db.users.find_one({"id": dealer_id, "role": {"$in": ["dealer", "foreign_dealer"]}})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    phone = data.phone.strip().replace(" ", "").replace("-", "")
    
    await db.users.update_one(
        {"id": dealer_id},
        {"$set": {"phone": phone}}
    )
    
    return {
        "message": f"Telefoonnummer bijgewerkt voor {dealer['company_name']}",
        "phone": phone
    }


# ============ ADMIN USER MANAGEMENT ============

@router.post("/admin/create-admin")
async def create_admin_user(data: CreateAdminRequest, user: dict = Depends(require_admin)):
    """Bestaande admin kan een nieuwe admin aanmaken"""
    existing = await db.users.find_one({"email": {"$regex": f"^{data.email}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="E-mailadres is al in gebruik")
    
    user_id = str(uuid.uuid4())
    password_hash = hash_password(data.password)
    
    new_admin = {
        "id": user_id,
        "email": data.email,
        "password_hash": password_hash,
        "company_name": data.company_name,
        "role": "admin",
        "is_approved": True,
        "is_foreign_dealer": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_admin)
    
    return {
        "message": f"Admin account aangemaakt voor {data.email}",
        "user_id": user_id
    }


@router.post("/admin/reset-password")
async def reset_user_password(data: ResetPasswordRequest, user: dict = Depends(require_admin)):
    """Admin kan wachtwoord van een gebruiker resetten"""
    target_user = await db.users.find_one({"email": {"$regex": f"^{data.email}$", "$options": "i"}})
    if not target_user:
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden")
    
    if target_user.get("role") == "admin" and target_user.get("id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Kan wachtwoord van andere admin niet resetten")
    
    new_hash = hash_password(data.new_password)
    
    await db.users.update_one(
        {"id": target_user["id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {
        "message": f"Wachtwoord gereset voor {target_user.get('company_name', data.email)}",
        "email": target_user["email"]
    }
