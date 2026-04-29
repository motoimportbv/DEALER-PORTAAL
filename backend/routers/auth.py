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
import jwt
import secrets
from config import JWT_SECRET, JWT_ALGORITHM

router = APIRouter(tags=["Authentication"])

# ============ AUTH ENDPOINTS ============

@router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check KVK for dealers
    if user_data.role == "dealer" and not user_data.kvk_number:
        raise HTTPException(status_code=400, detail="KVK nummer is verplicht voor dealers")
    
    user_id = str(uuid.uuid4())
    is_approved = user_data.role == "admin"  # Admins zijn direct goedgekeurd
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "company_name": user_data.company_name,
        "kvk_number": user_data.kvk_number,
        "address": user_data.address,
        "postal_code": user_data.postal_code,
        "city": user_data.city,
        "phone": user_data.phone,
        "contact_person": user_data.contact_person,
        "role": user_data.role,
        "is_approved": is_approved,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Stuur email naar admin bij nieuwe dealer registratie
    if user_data.role == "dealer":
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #DC2626;">🏍️ Nieuwe Dealer Registratie</h2>
            <p>Er heeft zich een nieuwe dealer geregistreerd op Moto Import:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background: #f4f4f5;">
                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Bedrijfsnaam</strong></td>
                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{user_data.company_name}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>KVK Nummer</strong></td>
                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{user_data.kvk_number}</td>
                </tr>
                <tr style="background: #f4f4f5;">
                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Contactpersoon</strong></td>
                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{user_data.contact_person}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Email</strong></td>
                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{user_data.email}</td>
                </tr>
                <tr style="background: #f4f4f5;">
                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Telefoon</strong></td>
                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{user_data.phone}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Adres</strong></td>
                    <td style="padding: 10px; border: 1px solid #e4e4e7;">{user_data.address}, {user_data.postal_code} {user_data.city}</td>
                </tr>
            </table>
            <p style="color: #71717a;">Log in op het admin dashboard om deze dealer goed te keuren.</p>
        </div>
        """
        await send_admin_notification(
            f"Nieuwe Dealer Registratie: {user_data.company_name}",
            html_content,
            include_limited_admin=True  # Also notify daniel2002jay@hotmail.com
        )
    
    token = create_token(user_id, user_data.email, user_data.role)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email,
            "company_name": user_data.company_name,
            "kvk_number": user_data.kvk_number,
            "role": user_data.role,
            "is_approved": is_approved
        }
    }

@router.post("/auth/register-supplier")
async def register_supplier(supplier_data: SupplierCreate):
    """Registratie voor buitenlandse leveranciers - vereenvoudigd formulier"""
    existing = await db.users.find_one({"email": supplier_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    
    user_doc = {
        "id": user_id,
        "email": supplier_data.email,
        "password_hash": hash_password(supplier_data.password),
        "company_name": supplier_data.company_name,
        "kvk_number": "",
        "address": supplier_data.address,
        "postal_code": supplier_data.postal_code,
        "city": supplier_data.city,
        "phone": supplier_data.phone,
        "contact_person": supplier_data.contact_person,
        "role": "dealer",
        "is_approved": False,
        "is_foreign_dealer": True,
        "country": supplier_data.country,
        "iban": supplier_data.iban,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Stuur email naar admin bij nieuwe leverancier registratie
    country_names = {
        "germany": "Duitsland",
        "italy": "Italië",
        "france": "Frankrijk",
        "belgium": "België",
        "austria": "Oostenrijk",
        "spain": "Spanje",
        "poland": "Polen",
        "other": "Anders"
    }
    country_display = country_names.get(supplier_data.country, supplier_data.country)
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7C3AED;">🌍 Nieuwe Buitenlandse Leverancier</h2>
        <p>Er heeft zich een nieuwe buitenlandse leverancier geregistreerd op Moto Import:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f4f4f5;">
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Bedrijfsnaam</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">{supplier_data.company_name}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Land</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">🌍 {country_display}</td>
            </tr>
            <tr style="background: #f4f4f5;">
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Contactpersoon</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">{supplier_data.contact_person}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Email</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">{supplier_data.email}</td>
            </tr>
            <tr style="background: #f4f4f5;">
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Telefoon</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">{supplier_data.phone or '-'}</td>
            </tr>
        </table>
        <p style="color: #71717a;">Log in op het admin dashboard om deze leverancier goed te keuren.</p>
        <p style="color: #7C3AED;"><strong>Let op:</strong> Dit is een buitenlandse leverancier. Na goedkeuring kunnen zij direct motoren toevoegen.</p>
    </div>
    """
    await send_admin_notification(
        f"🌍 Nieuwe Leverancier: {supplier_data.company_name} ({country_display})",
        html_content,
        include_limited_admin=True  # Also notify daniel2002jay@hotmail.com
    )
    
    token = create_token(user_id, supplier_data.email, "dealer")
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": supplier_data.email,
            "company_name": supplier_data.company_name,
            "role": "dealer",
            "is_approved": False,
            "is_foreign_dealer": True,
            "country": supplier_data.country
        }
    }

@router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": {"$regex": f"^{credentials.email}$", "$options": "i"}})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if dealer is approved
    is_approved = user.get("is_approved", True)  # Default True for backwards compatibility
    if user["role"] == "dealer" and not is_approved:
        raise HTTPException(status_code=403, detail="Uw account wacht nog op goedkeuring door Moto Import")
    
    # Track login activity for dealers
    if user["role"] == "dealer":
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$inc": {"login_count": 1},
                "$set": {"last_login": datetime.now(timezone.utc).isoformat()}
            }
        )
    
    token = create_token(user["id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user.get("username", ""),
            "company_name": user.get("company_name", user.get("name", "")),
            "name": user.get("name", ""),
            "role": user["role"],
            "is_approved": is_approved,
            "terms_accepted": user.get("terms_accepted", False),
            "is_foreign_dealer": user.get("is_foreign_dealer", False),
            "country": user.get("country", ""),
            "phone": user.get("phone", ""),
            "city": user.get("city", ""),
            "vehicle_type": user.get("vehicle_type", ""),
            "kvk_number": user.get("kvk_number", ""),
            "btw_number": user.get("btw_number", ""),
            "address": user.get("address", ""),
        }
    }

@router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@router.post("/auth/notification-login")
async def notification_auto_login(data: NotificationAutoLogin):
    """Auto-login via push notification token - returns a full session token"""
    try:
        payload = jwt.decode(data.token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Verify this is a notification token
        if payload.get("type") != "notification":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Check if user is offline
        if user.get("is_offline"):
            raise HTTPException(status_code=403, detail="Account is offline")
        
        # Create a full session token
        full_token = create_token(user["id"], user["email"], user["role"])
        
        return {
            "token": full_token,
            "user": user
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/auth/accept-terms")
async def accept_terms(user: dict = Depends(get_current_user)):
    """Accept terms and conditions"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"terms_accepted": True, "terms_accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Voorwaarden geaccepteerd", "terms_accepted": True}

@router.put("/users/email-preferences")
async def update_email_preferences(preferences: EmailPreferences, user: dict = Depends(get_current_user)):
    """Update email notification preferences for the current user"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"email_preferences": preferences.model_dump()}}
    )
    return {"message": "Email voorkeuren opgeslagen", "email_preferences": preferences.model_dump()}

@router.post("/auth/generate-permanent-link")
async def generate_permanent_link(user: dict = Depends(get_current_user)):
    """Generate a permanent auto-login link for the user"""
    # Create permanent token
    permanent_token = create_permanent_login_token(user["id"])
    
    # Generate a short code for easy URLs
    short_code = generate_short_code()
    
    # Ensure short code is unique
    while await db.users.find_one({"login_short_code": short_code}):
        short_code = generate_short_code()
    
    # Store token and short code in user profile
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "permanent_login_token": permanent_token,
            "login_short_code": short_code,
            "permanent_link_created_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Build the permanent login URL using query parameter format (works better with iOS bookmarks)
    base_url = PRODUCTION_BASE_URL
    permanent_url = f"{base_url}/login?code={short_code}"
    
    return {
        "permanent_url": permanent_url,
        "short_code": short_code,
        "token": permanent_token,
        "message": "Permanente login link aangemaakt"
    }

@router.get("/auth/my-permanent-link")
async def get_my_permanent_link(user: dict = Depends(get_current_user)):
    """Get the user's permanent login link"""
    permanent_token = user.get("permanent_login_token")
    short_code = user.get("login_short_code")
    
    if not permanent_token or not short_code:
        return {"has_permanent_link": False, "permanent_url": None}
    
    # Use query parameter format (works better with iOS bookmarks)
    base_url = PRODUCTION_BASE_URL
    permanent_url = f"{base_url}/login?code={short_code}"
    
    return {
        "has_permanent_link": True,
        "permanent_url": permanent_url,
        "short_code": short_code,
        "created_at": user.get("permanent_link_created_at")
    }

@router.post("/auth/permanent-login")
async def permanent_login(data: PermanentLoginRequest):
    """Login using a permanent auto-login token"""
    try:
        payload = jwt.decode(data.token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Verify this is a permanent token
        if payload.get("type") != "permanent":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        # Find user and verify token matches
        user = await db.users.find_one(
            {"id": payload["user_id"], "permanent_login_token": data.token},
            {"_id": 0, "password_hash": 0}
        )
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or revoked token")
        
        # Check if user is offline
        if user.get("is_offline"):
            raise HTTPException(status_code=403, detail="Account is offline")
        
        # Create a regular session token
        session_token = create_token(user["id"], user["email"], user["role"])
        
        # Update last login
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_permanent_login": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "token": session_token,
            "user": user
        }
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/auth/shortcode-login")
async def shortcode_login(data: ShortCodeLoginRequest):
    """Login using a short code - for iOS home screen bookmarks"""
    # Find user by short code
    user = await db.users.find_one(
        {"login_short_code": data.code.upper()},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user:
        raise HTTPException(status_code=401, detail="Ongeldige code")
    
    # Check if user is offline
    if user.get("is_offline"):
        raise HTTPException(status_code=403, detail="Account is offline")
    
    # Create a regular session token
    session_token = create_token(user["id"], user["email"], user["role"])
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_shortcode_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "token": session_token,
        "user": user
    }

@router.get("/auth/shortcode/{code}")
async def get_user_by_shortcode(code: str):
    """Get user info by short code (for auto-login page)"""
    user = await db.users.find_one(
        {"login_short_code": code.upper()},
        {"_id": 0, "password_hash": 0, "permanent_login_token": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Ongeldige code")
    
    if user.get("is_offline"):
        raise HTTPException(status_code=403, detail="Account is offline")
    
    # Return limited info for security
    return {
        "valid": True,
        "company_name": user.get("company_name", ""),
        "user_id": user["id"]
    }

@router.post("/auth/revoke-permanent-link")
async def revoke_permanent_link(user: dict = Depends(get_current_user)):
    """Revoke the user's permanent login link"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$unset": {"permanent_login_token": "", "permanent_link_created_at": ""}}
    )
    return {"message": "Permanente login link ingetrokken"}

@router.post("/auth/forgot-password")
async def forgot_password(request: Request, data: PasswordResetRequest):
    """Send password reset email"""
    user = await db.users.find_one({"email": data.email})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "Als dit e-mailadres bij ons bekend is, ontvangt u een e-mail met instructies."}
    
    # Generate reset token (valid for 1 hour)
    import secrets
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token
    await db.password_resets.delete_many({"email": data.email})  # Remove old tokens
    await db.password_resets.insert_one({
        "email": data.email,
        "token": reset_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Always use production URL for email links
    base_url = "https://www.motoimportbv.nl"
    
    reset_link = f"{base_url}/reset-password?token={reset_token}"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #18181b; padding: 25px; text-align: center;">
            <h1 style="color: white; margin: 0;">🏍️ MOTO IMPORT</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #18181b; margin-top: 0;">Wachtwoord Resetten</h2>
            <p>Beste {user.get('contact_person', user.get('company_name', 'Klant'))},</p>
            <p>U heeft een verzoek ingediend om uw wachtwoord te resetten.</p>
            <p>Klik op de onderstaande knop om een nieuw wachtwoord in te stellen:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" 
                   style="display: inline-block; background: #DC2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    Nieuw Wachtwoord Instellen
                </a>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                    <strong>⚠️ Let op:</strong> Deze link is 1 uur geldig. Als u dit verzoek niet heeft gedaan, kunt u deze email negeren.
                </p>
            </div>
            
            <p style="color: #71717a; font-size: 12px; margin-top: 20px;">
                Werkt de knop niet? Kopieer deze link naar uw browser:<br>
                <span style="word-break: break-all; color: #DC2626;">{reset_link}</span>
            </p>
        </div>
        
        <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
            <p style="margin: 5px 0;">Moto Import B.V. | www.motoimportbv.nl</p>
        </div>
    </div>
    """
    
    try:
        await send_email(data.email, "🔐 Wachtwoord Resetten - Moto Import", html_content)
    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")
    
    return {"message": "Als dit e-mailadres bij ons bekend is, ontvangt u een e-mail met instructies."}

@router.post("/auth/reset-password")
async def reset_password(data: PasswordResetConfirm):
    """Reset password using token"""
    # Find reset token
    reset_doc = await db.password_resets.find_one({"token": data.token})
    
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Ongeldige of verlopen reset link")
    
    # Check if expired
    expires_at = datetime.fromisoformat(reset_doc["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        await db.password_resets.delete_one({"token": data.token})
        raise HTTPException(status_code=400, detail="Reset link is verlopen. Vraag een nieuwe aan.")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Wachtwoord moet minimaal 6 tekens zijn")
    
    # Update password
    password_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"email": reset_doc["email"]},
        {"$set": {"password_hash": password_hash}}
    )
    
    # Delete used token
    await db.password_resets.delete_one({"token": data.token})
    
    return {"message": "Wachtwoord succesvol gewijzigd. U kunt nu inloggen met uw nieuwe wachtwoord."}


