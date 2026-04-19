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
import bcrypt
import random
import string

router = APIRouter(tags=["Dealers"])

# ============ DEALER MANAGEMENT ============

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


# ============ DEALER MANAGEMENT ENDPOINTS ============

@router.get("/dealers")
async def get_dealers(user: dict = Depends(require_admin)):
    dealers = await db.users.find(
        {"role": "dealer"},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return dealers

@router.post("/dealers/{dealer_id}/reset-password")
async def reset_dealer_password(dealer_id: str, body: dict = Body(...), user: dict = Depends(require_admin)):
    """Admin: reset a dealer's password"""
    new_password = body.get("new_password", "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Wachtwoord moet minimaal 6 tekens zijn")
    
    dealer = await db.users.find_one({"id": dealer_id})
    if not dealer:
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden")
    
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.update_one({"id": dealer_id}, {"$set": {"password_hash": hashed}})
    
    # Send email to dealer with new password
    try:
        html = f"""
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
            <div style="background:#dc2626;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
                <h1 style="color:white;margin:0;">Wachtwoord Gereset</h1>
            </div>
            <div style="padding:30px;background:white;border:1px solid #eee;">
                <p>Uw wachtwoord voor Moto Import is gereset.</p>
                <p><strong>Nieuw wachtwoord:</strong> {new_password}</p>
                <p>U kunt hiermee inloggen op <a href="{PRODUCTION_BASE_URL}/login">{PRODUCTION_BASE_URL}/login</a></p>
                <p style="margin-top:20px;color:#666;font-size:12px;">Wijzig uw wachtwoord na het inloggen.</p>
            </div>
        </div>
        """
        await send_email(dealer["email"], "Moto Import - Wachtwoord gereset", html)
    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")
    
    return {"status": "ok", "message": f"Wachtwoord gereset voor {dealer['email']}"}



@router.get("/dealers/pending")
async def get_pending_dealers(user: dict = Depends(require_admin)):
    dealers = await db.users.find(
        {"role": "dealer", "is_approved": False},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return dealers

@router.put("/dealers/{dealer_id}/approve")
async def approve_dealer(request: Request, dealer_id: str, user: dict = Depends(require_admin)):
    dealer = await db.users.find_one({"id": dealer_id, "role": "dealer"})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    await db.users.update_one(
        {"id": dealer_id},
        {"$set": {"is_approved": True}}
    )
    
    # Check of het een buitenlandse dealer is
    is_foreign = dealer.get("is_foreign_dealer", False)
    
    # Always use production URL for email links
    base_url = PRODUCTION_BASE_URL
    login_url = f"{base_url}/login"
    
    # Buitenlandse dealers krijgen GEEN voucher
    if is_foreign:
        # Email voor buitenlandse dealer (zonder voucher)
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
                    <p style="margin: 5px 0;">Tel: +31 6 24264861 | Email: Motoimportbv@gmail.com</p>
                </div>
            </div>
            """
            await send_email(dealer["email"], "✅ Account Approved - Moto Import", html_content)
        except Exception as e:
            logger.error(f"Failed to send approval email to foreign dealer: {str(e)}")
        
        return {"message": f"Buitenlandse dealer {dealer['company_name']} is goedgekeurd"}
    
    # Nederlandse dealers krijgen WEL een voucher
    import random
    import string
    voucher_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    voucher_code = f"WELKOM-{voucher_suffix}"
    
    # Maak voucher aan
    voucher = Voucher(
        code=voucher_code,
        dealer_id=dealer_id,
        amount=250.0
    )
    await db.vouchers.insert_one(voucher.model_dump())
    
    # Stuur email naar dealer met voucher
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
                <p style="margin: 5px 0;">Tel: +31 6 24264861 | Email: Motoimportbv@gmail.com</p>
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
    
    # Verwijder de dealer
    await db.users.delete_one({"id": dealer_id})
    
    return {"message": f"Dealer {dealer['company_name']} is afgewezen en verwijderd"}

@router.delete("/dealers/{dealer_id}")
async def delete_dealer(dealer_id: str, user: dict = Depends(require_admin)):
    """Verwijder een dealer volledig uit het systeem"""
    dealer = await db.users.find_one({"id": dealer_id, "role": "dealer"})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    # Verwijder de dealer
    await db.users.delete_one({"id": dealer_id})
    
    # Verwijder ook gerelateerde data
    await db.vouchers.delete_many({"dealer_id": dealer_id})
    await db.notifications.delete_many({"user_id": dealer_id})
    await db.push_subscriptions.delete_many({"user_id": dealer_id})
    await db.chat_messages.delete_many({"sender_id": dealer_id})
    
    return {"message": f"Dealer {dealer['company_name']} is verwijderd"}

@router.post("/admin/create-admin")
async def create_admin_user(data: CreateAdminRequest, user: dict = Depends(require_admin)):
    """Bestaande admin kan een nieuwe admin aanmaken"""
    # Check if email already exists
    existing = await db.users.find_one({"email": {"$regex": f"^{data.email}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="E-mailadres is al in gebruik")
    
    # Create new admin
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
    # Find user by email
    target_user = await db.users.find_one({"email": {"$regex": f"^{data.email}$", "$options": "i"}})
    if not target_user:
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden")
    
    # Don't allow resetting other admin passwords (security)
    if target_user.get("role") == "admin" and target_user.get("id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Kan wachtwoord van andere admin niet resetten")
    
    # Hash new password
    new_hash = hash_password(data.new_password)
    
    # Update password
    await db.users.update_one(
        {"id": target_user["id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {
        "message": f"Wachtwoord gereset voor {target_user.get('company_name', data.email)}",
        "email": target_user["email"]
    }

@router.post("/auth/change-password")
async def change_own_password(data: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    """Gebruiker kan eigen wachtwoord wijzigen"""
    # Get full user data with password hash
    full_user = await db.users.find_one({"id": user["id"]})
    if not full_user:
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden")
    
    # Verify current password
    if not verify_password(data.current_password, full_user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Huidig wachtwoord is onjuist")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Nieuw wachtwoord moet minimaal 6 tekens zijn")
    
    # Hash and save new password
    new_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {"message": "Wachtwoord succesvol gewijzigd"}

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
    if not new_status:  # new_status is False means dealer is now online
        # Create in-app notification
        notification = Notification(
            user_id=dealer_id,
            type="account_online",
            title="Account weer online",
            message="Goed nieuws! Wij waren bezig met een update en alles is nu afgerond. Uw account is weer online en u kunt weer volop gebruik maken van het platform."
        )
        await db.notifications.insert_one(notification.model_dump())
        
        # Send push notification to all devices of this dealer
        push_sent = 0
        push_failed = 0
        try:
            subscriptions = await db.push_subscriptions.find({"user_id": dealer_id}, {"_id": 0}).to_list(100)
            print(f"[ONLINE PUSH] Found {len(subscriptions)} push subscription(s) for dealer {dealer['company_name']}")
            
            for sub in subscriptions:
                try:
                    # Handle both old format (endpoint at root) and new format (endpoint inside subscription object)
                    sub_data = sub.get("subscription", sub)
                    endpoint = sub_data.get("endpoint") or sub.get("endpoint")
                    keys = sub_data.get("keys") or sub.get("keys")
                    
                    print(f"[ONLINE PUSH] Processing subscription for endpoint: {endpoint[:50] if endpoint else 'NONE'}...")
                    
                    # Validate subscription has required fields
                    if not endpoint or not keys:
                        print(f"[ONLINE PUSH] Skipping invalid subscription (missing endpoint or keys)")
                        push_failed += 1
                        continue
                    
                    subscription_info = {
                        "endpoint": endpoint,
                        "keys": keys
                    }
                    
                    # Generate auto-login token for this dealer
                    token_payload = {
                        "user_id": dealer_id,
                        "email": dealer.get("email"),
                        "role": dealer.get("role"),
                        "exp": (datetime.now(timezone.utc) + timedelta(hours=24)).timestamp()
                    }
                    auto_login_token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
                    
                    payload = json.dumps({
                        "title": "Account weer online! ✅",
                        "body": "Wij waren bezig met een update. Alles is nu afgerond en u bent weer online!",
                        "url": f"https://www.motoimportbv.nl/login?token={auto_login_token}",
                        "tag": "account-online"
                    })
                    
                    webpush(
                        subscription_info=subscription_info,
                        data=payload,
                        vapid_private_key=get_vapid_private_key(),
                        vapid_claims={"sub": VAPID_CLAIMS_EMAIL}
                    )
                    push_sent += 1
                    print(f"[ONLINE PUSH] Successfully sent to endpoint: {sub['endpoint'][:50]}...")
                except Exception as push_error:
                    push_failed += 1
                    print(f"[ONLINE PUSH] Failed to send: {push_error}")
            
            print(f"[ONLINE PUSH] Result: {push_sent} sent, {push_failed} failed")
        except Exception as e:
            print(f"[ONLINE PUSH] Error: {e}")
    
        return {
            "message": f"Dealer {dealer['company_name']} is nu {status_text}",
            "is_offline": new_status,
            "push_notifications_sent": push_sent,
            "push_notifications_failed": push_failed
        }
    
    return {
        "message": f"Dealer {dealer['company_name']} is nu {status_text}",
        "is_offline": new_status
    }

@router.put("/dealers/{dealer_id}/phone")
async def update_dealer_phone(dealer_id: str, data: DealerPhoneUpdate, user: dict = Depends(require_admin)):
    """Admin updates dealer phone number"""
    dealer = await db.users.find_one({"id": dealer_id, "role": {"$in": ["dealer", "foreign_dealer"]}})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    # Clean phone number
    phone = data.phone.strip().replace(" ", "").replace("-", "")
    
    await db.users.update_one(
        {"id": dealer_id},
        {"$set": {"phone": phone}}
    )
    
    return {
        "message": f"Telefoonnummer bijgewerkt voor {dealer['company_name']}",
        "phone": phone
    }




@router.put("/dealers/{dealer_id}/iban")
async def update_dealer_iban(dealer_id: str, data: dict = Body(...), user: dict = Depends(require_admin)):
    """Admin updates dealer IBAN"""
    dealer = await db.users.find_one({"id": dealer_id, "role": {"$in": ["dealer", "foreign_dealer"]}})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    iban = data.get("iban", "").strip().upper()
    await db.users.update_one(
        {"id": dealer_id},
        {"$set": {"iban": iban}}
    )
    return {"message": f"IBAN bijgewerkt voor {dealer['company_name']}", "iban": iban}
