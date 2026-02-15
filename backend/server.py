from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import smtplib
import shutil
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import json
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
from pywebpush import webpush, WebPushException

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = "HS256"

# Gmail Config
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')
GMAIL_EMAIL = os.environ.get('GMAIL_EMAIL', '')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')

# Stripe Config
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
DELIVERY_COST = 50.0  # €50 bezorgkosten
DEPOSIT_PERCENTAGE = 0.10  # 10% aanbetaling

# VAPID Config for Push Notifications
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY_PATH = os.environ.get('VAPID_PRIVATE_KEY_PATH', '')
VAPID_PRIVATE_KEY_B64 = os.environ.get('VAPID_PRIVATE_KEY_B64', '')  # Base64 encoded key (for production)
VAPID_CLAIMS_EMAIL = os.environ.get('VAPID_CLAIMS_EMAIL', 'mailto:Motoimportbv@gmail.com')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ============ MODELS ============

class UserCreate(BaseModel):
    email: str
    password: str
    company_name: str
    kvk_number: str = ""
    address: str = ""
    postal_code: str = ""
    city: str = ""
    phone: str = ""
    contact_person: str = ""
    role: str = "dealer"  # "admin" or "dealer"

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    company_name: str
    kvk_number: str = ""
    address: str = ""
    postal_code: str = ""
    city: str = ""
    phone: str = ""
    contact_person: str = ""
    role: str
    is_approved: bool = False  # Dealer moet goedgekeurd worden
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MotorcycleCreate(BaseModel):
    brand: str
    model: str
    year: int
    price: float  # Koop nu prijs
    starting_price: float  # Vanaf prijs voor bieden
    mileage: int
    color: str
    description: str
    condition: str  # "new", "excellent", "good", "fair"
    images: List[str] = []
    auction_duration_hours: int = 3  # Standaard 3 uur

class MotorcycleUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    price: Optional[float] = None
    starting_price: Optional[float] = None
    mileage: Optional[int] = None
    color: Optional[str] = None
    description: Optional[str] = None
    condition: Optional[str] = None
    images: Optional[List[str]] = None
    is_available: Optional[bool] = None

class Motorcycle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    brand: str
    model: str
    year: int
    price: float  # Koop nu prijs
    starting_price: Optional[float] = None  # Vanaf prijs
    mileage: int
    color: str
    description: str
    condition: str
    images: List[str] = []
    is_available: bool = True
    auction_end_time: Optional[str] = None  # Wanneer de veiling eindigt
    highest_bid: Optional[float] = None
    highest_bidder_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: str = ""

class BidCreate(BaseModel):
    motorcycle_id: str
    amount: float

class Bid(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    motorcycle_id: str
    dealer_id: str
    dealer_company: str
    amount: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OrderCreate(BaseModel):
    motorcycle_id: str
    notes: Optional[str] = ""
    needs_delivery: bool = False

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    motorcycle_id: str
    dealer_id: str
    dealer_email: str
    dealer_company: str
    status: str = "pending"  # pending, paid, approved, rejected, completed
    notes: str = ""
    needs_delivery: bool = False
    delivery_cost: float = 0.0
    deposit_amount: float = 0.0
    total_price: float = 0.0
    payment_status: str = "unpaid"  # unpaid, pending, paid
    stripe_session_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OrderWithMotorcycle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    motorcycle_id: str
    dealer_id: str
    dealer_email: str
    dealer_company: str
    status: str
    notes: str = ""
    needs_delivery: bool = False
    delivery_cost: float = 0.0
    deposit_amount: float = 0.0
    total_price: float = 0.0
    payment_status: str = "unpaid"
    created_at: str
    motorcycle: Optional[dict] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # "new_motorcycle", "order_update"
    title: str
    message: str
    motorcycle_id: Optional[str] = None
    is_read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str  # Usually dealer_id for dealer-admin chats
    sender_id: str
    sender_name: str
    sender_role: str  # "admin" or "dealer"
    message: str
    is_read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ChatMessageCreate(BaseModel):
    message: str
    conversation_id: Optional[str] = None  # Optional for dealers (defaults to their own ID)

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # Contains p256dh and auth keys

class Voucher(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # Unique voucher code like "WELKOM-XXXXX"
    dealer_id: str
    amount: float = 250.0  # €250 voucher
    is_used: bool = False
    used_on_order_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    used_at: Optional[str] = None

# ============ ROOT ENDPOINT ============

@api_router.get("/")
async def root():
    return {"message": "Moto Import API is running"}

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_approved_dealer(user: dict = Depends(get_current_user)):
    """Helper to check if a dealer is approved"""
    if user["role"] == "dealer" and not user.get("is_approved", False):
        raise HTTPException(status_code=403, detail="Uw account wacht nog op goedkeuring door Moto Import")
    return user

# ============ EMAIL HELPER ============

async def send_email(to_email: str, subject: str, html_content: str):
    """Send email via Gmail SMTP"""
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Moto Import <{GMAIL_EMAIL}>"
        msg['To'] = to_email
        
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        def send_sync():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
                server.sendmail(GMAIL_EMAIL, to_email, msg.as_string())
        
        await asyncio.to_thread(send_sync)
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False

async def send_admin_notification(subject: str, html_content: str):
    """Send email notification to admin"""
    await send_email(ADMIN_EMAIL, subject, html_content)

# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/register")
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
            html_content
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

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if dealer is approved
    is_approved = user.get("is_approved", True)  # Default True for backwards compatibility
    if user["role"] == "dealer" and not is_approved:
        raise HTTPException(status_code=403, detail="Uw account wacht nog op goedkeuring door Moto Import")
    
    token = create_token(user["id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "company_name": user["company_name"],
            "role": user["role"],
            "is_approved": is_approved
        }
    }

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

@api_router.post("/auth/forgot-password")
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
    
    # Get base URL from request origin or fallback to env
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base_url = os.environ.get("BASE_URL", "https://www.motoimportbv.nl")
    
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
            <p style="margin: 5px 0;">Moto Import B.V. | Horsterhoekweg 11, 7433 SV Schalkhaar</p>
        </div>
    </div>
    """
    
    try:
        await send_email(data.email, "🔐 Wachtwoord Resetten - Moto Import", html_content)
    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")
    
    return {"message": "Als dit e-mailadres bij ons bekend is, ontvangt u een e-mail met instructies."}

@api_router.post("/auth/reset-password")
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

# ============ MOTORCYCLE ENDPOINTS ============

@api_router.post("/motorcycles", response_model=Motorcycle)
async def create_motorcycle(data: MotorcycleCreate, user: dict = Depends(require_admin)):
    # Bereken auction end time (3 uur vanaf nu)
    auction_end = datetime.now(timezone.utc) + timedelta(hours=data.auction_duration_hours)
    
    motorcycle = Motorcycle(
        brand=data.brand,
        model=data.model,
        year=data.year,
        price=data.price,
        starting_price=data.starting_price,
        mileage=data.mileage,
        color=data.color,
        description=data.description,
        condition=data.condition,
        images=data.images,
        auction_end_time=auction_end.isoformat(),
        created_by=user["id"]
    )
    doc = motorcycle.model_dump()
    await db.motorcycles.insert_one(doc)
    
    # Get all approved dealers
    dealers = await db.users.find({"role": "dealer", "is_approved": True}, {"_id": 0}).to_list(1000)
    
    if dealers:
        # Create in-app notifications (batch insert for efficiency)
        notifications = [
            Notification(
                user_id=dealer["id"],
                type="new_motorcycle",
                title="Nieuwe motor toegevoegd",
                message=f"{motorcycle.brand} {motorcycle.model} ({motorcycle.year}) - Koop Nu voor €{motorcycle.price:,.0f}",
                motorcycle_id=motorcycle.id
            ).model_dump()
            for dealer in dealers
        ]
        await db.notifications.insert_many(notifications)
        
        # Send email notifications to all approved dealers
        asyncio.create_task(notify_dealers_new_motorcycle_email(motorcycle, dealers))
        
        # Send push notifications to all dealers
        asyncio.create_task(send_push_to_all_dealers(
            title="🏍️ Nieuwe Motor!",
            body=f"{motorcycle.brand} {motorcycle.model} ({motorcycle.year}) - €{motorcycle.price:,.0f}",
            url=f"/motorcycle/{motorcycle.id}"
        ))
    
    return motorcycle

async def notify_dealers_new_motorcycle_email(motorcycle, dealers):
    """Send email notifications to all approved dealers about a new motorcycle"""
    base_url = os.environ.get("BASE_URL", "")
    
    for dealer in dealers:
        if not dealer.get("email"):
            continue
            
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #DC2626; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">🏍️ NIEUWE MOTOR!</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <p>Beste {dealer.get('company_name', 'Dealer')},</p>
                    <p>Er is een nieuwe motorfiets toegevoegd aan ons aanbod:</p>
                    
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                        <h2 style="margin: 0 0 10px 0; color: #DC2626;">
                            {motorcycle.brand} {motorcycle.model}
                        </h2>
                        <p style="color: #6b7280; margin: 5px 0;">Bouwjaar: {motorcycle.year}</p>
                        <p style="color: #6b7280; margin: 5px 0;">Kleur: {motorcycle.color}</p>
                        <p style="color: #6b7280; margin: 5px 0;">Kilometerstand: {motorcycle.mileage:,} km</p>
                        <p style="font-size: 28px; font-weight: bold; color: #18181b; margin: 15px 0;">
                            €{motorcycle.price:,.0f}
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="{base_url}/motorcycle/{motorcycle.id}" 
                           style="background: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            BEKIJK MOTOR
                        </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; text-align: center;">
                        Wees er snel bij - op is op!
                    </p>
                </div>
                <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
                    <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
                    <p style="margin: 5px 0;">Horsterhoekweg 11, 7433 SV Schalkhaar</p>
                    <p style="margin: 5px 0;">Tel: +31 6 81792660</p>
                </div>
            </div>
            """
            await send_email(dealer["email"], f"🏍️ Nieuwe motor: {motorcycle.brand} {motorcycle.model}", html_content)
            # Small delay to avoid rate limiting
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.error(f"Failed to send new motorcycle email to {dealer.get('email')}: {e}")

@api_router.get("/motorcycles", response_model=List[Motorcycle])
async def get_motorcycles(user: dict = Depends(require_approved_dealer)):
    motorcycles = await db.motorcycles.find({}, {"_id": 0}).to_list(1000)
    # Add default starting_price if missing
    for m in motorcycles:
        if "starting_price" not in m or m["starting_price"] is None:
            m["starting_price"] = m.get("price", 0) * 0.8
    return motorcycles

@api_router.get("/motorcycles/available", response_model=List[Motorcycle])
async def get_available_motorcycles(user: dict = Depends(require_approved_dealer)):
    motorcycles = await db.motorcycles.find({"is_available": True}, {"_id": 0}).to_list(1000)
    # Add default starting_price if missing
    for m in motorcycles:
        if "starting_price" not in m or m["starting_price"] is None:
            m["starting_price"] = m.get("price", 0) * 0.8
    return motorcycles

@api_router.get("/motorcycles/{motorcycle_id}", response_model=Motorcycle)
async def get_motorcycle(motorcycle_id: str, user: dict = Depends(require_approved_dealer)):
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motorcycle not found")
    # Add default starting_price if missing
    if "starting_price" not in motorcycle or motorcycle["starting_price"] is None:
        motorcycle["starting_price"] = motorcycle.get("price", 0) * 0.8
    return motorcycle

@api_router.put("/motorcycles/{motorcycle_id}", response_model=Motorcycle)
async def update_motorcycle(motorcycle_id: str, data: MotorcycleUpdate, user: dict = Depends(require_admin)):
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motorcycle not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.motorcycles.update_one({"id": motorcycle_id}, {"$set": update_data})
    
    updated = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    return updated

@api_router.delete("/motorcycles/{motorcycle_id}")
async def delete_motorcycle(motorcycle_id: str, user: dict = Depends(require_admin)):
    result = await db.motorcycles.delete_one({"id": motorcycle_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Motorcycle not found")
    return {"message": "Motorcycle deleted"}

# ============ ORDER ENDPOINTS ============

@api_router.post("/orders", response_model=Order)
async def create_order(data: OrderCreate, user: dict = Depends(get_current_user)):
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
    
    order = Order(
        motorcycle_id=data.motorcycle_id,
        dealer_id=user["id"],
        dealer_email=user["email"],
        dealer_company=user["company_name"],
        notes=data.notes or ""
    )
    doc = order.model_dump()
    await db.orders.insert_one(doc)
    return order

@api_router.get("/orders", response_model=List[OrderWithMotorcycle])
async def get_orders(user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    else:
        orders = await db.orders.find({"dealer_id": user["id"]}, {"_id": 0}).to_list(1000)
    
    # Batch fetch motorcycles to avoid N+1 query
    motorcycle_ids = list(set(order["motorcycle_id"] for order in orders))
    motorcycles_list = await db.motorcycles.find(
        {"id": {"$in": motorcycle_ids}}, 
        {"_id": 0}
    ).to_list(1000)
    motorcycles_map = {m["id"]: m for m in motorcycles_list}
    
    # Enrich orders with motorcycle data
    result = []
    for order in orders:
        order["motorcycle"] = motorcycles_map.get(order["motorcycle_id"])
        result.append(order)
    
    return result

@api_router.put("/orders/{order_id}/status")
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

# ============ DIRECT ORDER ENDPOINTS ============

class BuyNowRequest(BaseModel):
    motorcycle_id: str
    needs_delivery: bool = False
    voucher_code: Optional[str] = None

@api_router.get("/voucher/check/{code}")
async def check_voucher(code: str, user: dict = Depends(get_current_user)):
    """Check if a voucher code is valid for the current user"""
    voucher = await db.vouchers.find_one({
        "code": code.upper(),
        "dealer_id": user["id"],
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

@api_router.get("/voucher/my-voucher")
async def get_my_voucher(user: dict = Depends(get_current_user)):
    """Get the user's voucher if they have one"""
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

@api_router.post("/orders/buy-now")
async def create_buy_now_order(data: BuyNowRequest, user: dict = Depends(get_current_user)):
    """Create a direct order without payment - sends emails to dealer and admin"""
    
    # Get motorcycle
    motorcycle = await db.motorcycles.find_one({"id": data.motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    if not motorcycle.get("is_available", True):
        raise HTTPException(status_code=400, detail="Motor is niet meer beschikbaar")
    
    # Calculate delivery cost
    delivery_cost = DELIVERY_COST if data.needs_delivery else 0.0
    
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
    
    total_price = max(0, motorcycle["price"] + delivery_cost - voucher_discount)
    
    # Create order
    order = Order(
        motorcycle_id=data.motorcycle_id,
        dealer_id=user["id"],
        dealer_email=user["email"],
        dealer_company=user.get("company_name", ""),
        status="pending",
        needs_delivery=data.needs_delivery,
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
    
    await db.orders.insert_one(order_dict)
    
    # Mark motorcycle as unavailable
    await db.motorcycles.update_one(
        {"id": data.motorcycle_id},
        {"$set": {"is_available": False}}
    )
    
    # Get dealer info
    dealer = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    delivery_text = "Ja (€50 bezorging)" if data.needs_delivery else "Nee (ophalen)"
    voucher_text = f"€{voucher_discount:,.2f} korting (code: {voucher_applied})" if voucher_applied else "Geen"
    
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
            <p style="margin: 5px 0;">Horsterhoekweg 11, 7433 SV Schalkhaar</p>
            <p style="margin: 5px 0;">Tel: +31 6 81792660 | Email: Motoimportbv@gmail.com</p>
        </div>
    </div>
    """
    
    try:
        await send_email(user["email"], "✅ Bestelling Bevestigd - Moto Import", dealer_html)
    except Exception as e:
        logger.error(f"Failed to send dealer confirmation email: {e}")
    
    # Send email to Admin with Pakbon
    base_url = os.environ.get("BASE_URL", "")
    order_date = datetime.now(timezone.utc).strftime('%d-%m-%Y')
    order_time = datetime.now(timezone.utc).strftime('%H:%M')
    
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
                            <p style="margin: 5px 0; color: #52525b;">Horsterhoekweg 11</p>
                            <p style="margin: 5px 0; color: #52525b;">7433 SV Schalkhaar</p>
                            <p style="margin: 10px 0 0 0; color: #52525b;">Tel: +31 6 81792660</p>
                            <p style="margin: 5px 0; color: #52525b;">Motoimportbv@gmail.com</p>
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
                <p style="margin: 0;">Moto Import B.V. | KVK: 94622086 | Horsterhoekweg 11, 7433 SV Schalkhaar</p>
            </div>
        </div>
        
        <!-- Link naar online pakbon -->
        <div style="padding: 20px; text-align: center;">
            <a href="{base_url}/pakbon/{order.id}" style="display: inline-block; background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Bekijk Pakbon Online
            </a>
            <p style="color: #71717a; font-size: 12px; margin-top: 10px;">Of print deze email direct uit</p>
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

# ============ PAYMENT ENDPOINTS ============

class PaymentRequest(BaseModel):
    motorcycle_id: str
    needs_delivery: bool = False
    order_type: str = "buy_now"  # "buy_now" or "bid_won"
    origin_url: str

@api_router.post("/payments/create-checkout")
async def create_checkout(data: PaymentRequest, user: dict = Depends(get_current_user)):
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
        payment_status="pending"
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

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, user: dict = Depends(get_current_user)):
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
                                <p style="margin: 5px 0;">Horsterhoekweg 11, 7433 SV Schalkhaar</p>
                                <p style="margin: 5px 0;">Tel: +31 6 81792660 | Email: Motoimportbv@gmail.com</p>
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

@api_router.post("/webhook/stripe")
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

@api_router.get("/payments/calculate")
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

# ============ UPLOAD ENDPOINT ============

@api_router.post("/upload")
async def upload_image(request: Request, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    # Check file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Alleen JPG, PNG of WEBP afbeeldingen toegestaan")
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = UPLOAD_DIR / filename
    
    # Save file
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kon bestand niet opslaan: {str(e)}")
    
    # Return URL - use request origin or BASE_URL as fallback
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if origin:
        # Extract base URL from origin/referer
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base_url = os.environ.get("BASE_URL", "")
    
    if not base_url:
        raise HTTPException(status_code=500, detail="BASE_URL niet geconfigureerd")
    
    image_url = f"{base_url}/api/uploads/{filename}"
    
    return {"url": image_url, "filename": filename}

@api_router.post("/upload/multiple")
async def upload_multiple_images(request: Request, files: List[UploadFile] = File(...), user: dict = Depends(get_current_user)):
    urls = []
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    
    # Get base URL from request
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base_url = os.environ.get("BASE_URL", "")
    
    for file in files:
        if file.content_type not in allowed_types:
            continue
        
        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = UPLOAD_DIR / filename
        
        try:
            with open(filepath, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            if base_url:
                urls.append(f"{base_url}/api/uploads/{filename}")
        except:
            continue
    
    return {"urls": urls}

# ============ BID ENDPOINTS ============

@api_router.post("/bids")
async def place_bid(data: BidCreate, user: dict = Depends(get_current_user)):
    # Get motorcycle
    motorcycle = await db.motorcycles.find_one({"id": data.motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    if not motorcycle.get("is_available", True):
        raise HTTPException(status_code=400, detail="Motor is niet meer beschikbaar")
    
    # Check if auction is still active
    auction_end = datetime.fromisoformat(motorcycle.get("auction_end_time", datetime.now(timezone.utc).isoformat()))
    if datetime.now(timezone.utc) > auction_end:
        raise HTTPException(status_code=400, detail="Veiling is afgelopen")
    
    # Check minimum bid
    current_highest = motorcycle.get("highest_bid") or motorcycle.get("starting_price", 0)
    min_bid = current_highest + 100 if motorcycle.get("highest_bid") else motorcycle.get("starting_price", 0)
    
    if data.amount < min_bid:
        raise HTTPException(status_code=400, detail=f"Minimum bod is €{min_bid:,.0f}")
    
    # Check if bid is not higher than buy now price
    if data.amount >= motorcycle.get("price", float('inf')):
        raise HTTPException(status_code=400, detail="Bod is hoger dan Koop Nu prijs. Gebruik Koop Nu optie.")
    
    # Save bid
    bid = Bid(
        motorcycle_id=data.motorcycle_id,
        dealer_id=user["id"],
        dealer_company=user["company_name"],
        amount=data.amount
    )
    await db.bids.insert_one(bid.model_dump())
    
    # Update motorcycle with highest bid
    await db.motorcycles.update_one(
        {"id": data.motorcycle_id},
        {"$set": {"highest_bid": data.amount, "highest_bidder_id": user["id"]}}
    )
    
    return {"message": f"Bod van €{data.amount:,.0f} geplaatst", "bid": bid.model_dump()}

@api_router.get("/bids/{motorcycle_id}")
async def get_bids(motorcycle_id: str, user: dict = Depends(get_current_user)):
    bids = await db.bids.find(
        {"motorcycle_id": motorcycle_id},
        {"_id": 0}
    ).sort("amount", -1).to_list(100)
    return bids

@api_router.post("/motorcycles/{motorcycle_id}/buy-now")
async def buy_now(motorcycle_id: str, user: dict = Depends(get_current_user)):
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    if not motorcycle.get("is_available", True):
        raise HTTPException(status_code=400, detail="Motor is niet meer beschikbaar")
    
    # Create order with buy now
    order = Order(
        motorcycle_id=motorcycle_id,
        dealer_id=user["id"],
        dealer_email=user["email"],
        dealer_company=user["company_name"],
        status="approved",
        notes=f"Koop Nu voor €{motorcycle['price']:,.0f}"
    )
    await db.orders.insert_one(order.model_dump())
    
    # Mark motorcycle as unavailable
    await db.motorcycles.update_one(
        {"id": motorcycle_id},
        {"$set": {"is_available": False}}
    )
    
    return {"message": "Motor gekocht!", "order": order.model_dump()}

# ============ DEALER MANAGEMENT ENDPOINTS ============

@api_router.get("/dealers")
async def get_dealers(user: dict = Depends(require_admin)):
    dealers = await db.users.find(
        {"role": "dealer"},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return dealers

@api_router.get("/dealers/pending")
async def get_pending_dealers(user: dict = Depends(require_admin)):
    dealers = await db.users.find(
        {"role": "dealer", "is_approved": False},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return dealers

@api_router.put("/dealers/{dealer_id}/approve")
async def approve_dealer(request: Request, dealer_id: str, user: dict = Depends(require_admin)):
    dealer = await db.users.find_one({"id": dealer_id, "role": "dealer"})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    await db.users.update_one(
        {"id": dealer_id},
        {"$set": {"is_approved": True}}
    )
    
    # Genereer unieke voucher code voor nieuwe dealer
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
    
    # Get base URL from request origin or fallback
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base_url = os.environ.get("BASE_URL", "https://www.motoimportbv.nl")
    
    login_url = f"{base_url}/login"
    
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
                <p style="margin: 5px 0;">Horsterhoekweg 11, 7433 SV Schalkhaar</p>
                <p style="margin: 5px 0;">Tel: +31 6 81792660 | Email: Motoimportbv@gmail.com</p>
            </div>
        </div>
        """
        await send_email(dealer["email"], "🎁 Welkom bij Moto Import + €250 Voucher!", html_content)
    except Exception as e:
        logger.error(f"Failed to send approval email: {str(e)}")
    
    return {"message": f"Dealer {dealer['company_name']} is goedgekeurd", "voucher_code": voucher_code}

@api_router.put("/dealers/{dealer_id}/reject")
async def reject_dealer(dealer_id: str, user: dict = Depends(require_admin)):
    dealer = await db.users.find_one({"id": dealer_id, "role": "dealer"})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    # Verwijder de dealer
    await db.users.delete_one({"id": dealer_id})
    
    return {"message": f"Dealer {dealer['company_name']} is afgewezen en verwijderd"}

@api_router.delete("/dealers/{dealer_id}")
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

# ============ NOTIFICATION ENDPOINTS ============

@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifications

@api_router.get("/notifications/unread-count")
async def get_unread_count(user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user["id"], "is_read": False})
    return {"count": count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

# ============ PUSH NOTIFICATIONS ============

class PushTokenCreate(BaseModel):
    token: str
    platform: str  # "ios", "android", or "web"

class WebPushSubscriptionCreate(BaseModel):
    subscription: dict  # Contains endpoint, keys (p256dh, auth)

@api_router.get("/push/vapid-key")
async def get_vapid_key():
    """Get the public VAPID key for web push subscriptions"""
    return {"vapidKey": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def subscribe_to_push(data: WebPushSubscriptionCreate, user: dict = Depends(get_current_user)):
    """Subscribe to web push notifications"""
    subscription = data.subscription
    
    # Store subscription in database
    await db.push_subscriptions.update_one(
        {"user_id": user["id"]},
        {
            "$set": {
                "user_id": user["id"],
                "subscription": subscription,
                "platform": "web",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    return {"message": "Subscribed to push notifications"}

@api_router.delete("/push/subscribe")
async def unsubscribe_from_push(user: dict = Depends(get_current_user)):
    """Unsubscribe from web push notifications"""
    await db.push_subscriptions.delete_many({"user_id": user["id"]})
    return {"message": "Unsubscribed from push notifications"}

async def send_push_notification_to_user(user_id: str, title: str, body: str, url: str = "/"):
    """Send a web push notification to a specific user"""
    try:
        subscription_doc = await db.push_subscriptions.find_one({"user_id": user_id})
        if not subscription_doc:
            return False
        
        subscription = subscription_doc.get("subscription")
        if not subscription:
            return False
        
        # Get private key - try base64 env var first, then file
        private_key = None
        
        # Option 1: Base64 encoded key from environment variable (for production)
        if VAPID_PRIVATE_KEY_B64:
            import base64
            try:
                private_key = base64.b64decode(VAPID_PRIVATE_KEY_B64).decode('utf-8')
            except Exception as e:
                logger.warning(f"Failed to decode VAPID_PRIVATE_KEY_B64: {e}")
        
        # Option 2: Read from file path (for local development)
        if not private_key and VAPID_PRIVATE_KEY_PATH:
            if os.path.exists(VAPID_PRIVATE_KEY_PATH):
                with open(VAPID_PRIVATE_KEY_PATH, 'r') as f:
                    private_key = f.read().strip()
        
        if not private_key:
            logger.warning("VAPID private key not configured - push notifications disabled")
            return False
        
        # Prepare notification payload
        payload = json.dumps({
            "title": title,
            "body": body,
            "icon": "/icons/icon-192x192.png",
            "badge": "/icons/icon-72x72.png",
            "url": url,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Send notification
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=private_key,
            vapid_claims={"sub": VAPID_CLAIMS_EMAIL}
        )
        
        logger.info(f"Push notification sent to user {user_id}")
        return True
    except WebPushException as e:
        logger.error(f"Web push failed for user {user_id}: {e}")
        # If subscription is expired/invalid, remove it
        if e.response and e.response.status_code in [404, 410]:
            await db.push_subscriptions.delete_one({"user_id": user_id})
        return False
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return False

async def send_push_to_all_dealers(title: str, body: str, url: str = "/"):
    """Send push notification to all approved dealers"""
    try:
        # Get all approved dealers
        dealers = await db.users.find(
            {"role": "dealer", "is_approved": True},
            {"_id": 0, "id": 1}
        ).to_list(1000)
        
        sent_count = 0
        for dealer in dealers:
            success = await send_push_notification_to_user(dealer["id"], title, body, url)
            if success:
                sent_count += 1
        
        logger.info(f"Push notifications sent to {sent_count} dealers")
        return sent_count
    except Exception as e:
        logger.error(f"Error sending push to all dealers: {e}")
        return 0

@api_router.post("/push-token")
async def register_push_token(data: PushTokenCreate, user: dict = Depends(get_current_user)):
    """Register or update a push notification token for the current user"""
    # Update or insert the token
    await db.push_tokens.update_one(
        {"user_id": user["id"], "platform": data.platform},
        {
            "$set": {
                "user_id": user["id"],
                "token": data.token,
                "platform": data.platform,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    return {"message": "Push token registered"}

@api_router.delete("/push-token")
async def remove_push_token(user: dict = Depends(get_current_user)):
    """Remove push token when user logs out"""
    await db.push_tokens.delete_many({"user_id": user["id"]})
    return {"message": "Push token removed"}

# ============ CHAT ENDPOINTS ============

@api_router.get("/chat/conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    """Get all conversations for admin, or single conversation for dealer"""
    if user["role"] == "admin":
        # Admin sees all conversations with unread counts
        pipeline = [
            {"$group": {
                "_id": "$conversation_id",
                "last_message": {"$last": "$message"},
                "last_sender": {"$last": "$sender_name"},
                "last_time": {"$last": "$created_at"},
                "unread_count": {
                    "$sum": {"$cond": [{"$and": [{"$eq": ["$is_read", False]}, {"$eq": ["$sender_role", "dealer"]}]}, 1, 0]}
                }
            }},
            {"$sort": {"last_time": -1}}
        ]
        conversations = await db.chat_messages.aggregate(pipeline).to_list(100)
        
        # Enrich with dealer info
        result = []
        for conv in conversations:
            dealer = await db.users.find_one({"id": conv["_id"]}, {"_id": 0, "company_name": 1, "email": 1})
            result.append({
                "conversation_id": conv["_id"],
                "dealer_name": dealer.get("company_name", "Onbekend") if dealer else "Onbekend",
                "dealer_email": dealer.get("email", "") if dealer else "",
                "last_message": conv["last_message"][:50] + "..." if len(conv["last_message"]) > 50 else conv["last_message"],
                "last_sender": conv["last_sender"],
                "last_time": conv["last_time"],
                "unread_count": conv["unread_count"]
            })
        return result
    else:
        # Dealer sees only their conversation
        return [{"conversation_id": user["id"]}]

@api_router.get("/chat/messages/{conversation_id}")
async def get_messages(conversation_id: str, user: dict = Depends(get_current_user)):
    """Get messages for a conversation"""
    # Dealers can only access their own conversation
    actual_conv_id = user["id"] if conversation_id == "me" else conversation_id
    
    if user["role"] != "admin" and actual_conv_id != user["id"]:
        raise HTTPException(status_code=403, detail="Geen toegang tot dit gesprek")
    
    messages = await db.chat_messages.find(
        {"conversation_id": actual_conv_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    # Mark messages as read
    if user["role"] == "admin":
        await db.chat_messages.update_many(
            {"conversation_id": actual_conv_id, "sender_role": "dealer", "is_read": False},
            {"$set": {"is_read": True}}
        )
    else:
        await db.chat_messages.update_many(
            {"conversation_id": actual_conv_id, "sender_role": "admin", "is_read": False},
            {"$set": {"is_read": True}}
        )
    
    return messages

@api_router.post("/chat/messages")
async def send_message(data: ChatMessageCreate, user: dict = Depends(get_current_user)):
    """Send a chat message"""
    # Determine conversation_id
    if user["role"] == "admin":
        if not data.conversation_id:
            raise HTTPException(status_code=400, detail="conversation_id is verplicht voor admin")
        conversation_id = data.conversation_id
    else:
        conversation_id = user["id"]  # Dealer's conversation is their own ID
    
    message = ChatMessage(
        conversation_id=conversation_id,
        sender_id=user["id"],
        sender_name=user.get("company_name", user.get("email", "Admin")),
        sender_role=user["role"],
        message=data.message
    )
    
    await db.chat_messages.insert_one(message.model_dump())
    
    # Send email notification if admin sends message to dealer
    if user["role"] == "admin":
        dealer = await db.users.find_one({"id": conversation_id}, {"_id": 0, "email": 1, "company_name": 1})
        if dealer and dealer.get("email"):
            try:
                html_content = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                    <h2 style="color: #DC2626;">📩 Nieuw bericht van Moto Import</h2>
                    <p>Beste {dealer.get('company_name', 'Dealer')},</p>
                    <p>U heeft een nieuw bericht ontvangen:</p>
                    <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-style: italic;">"{data.message}"</p>
                    </div>
                    <p>Log in op het platform om te reageren.</p>
                    <p style="color: #71717a; margin-top: 30px;">
                        Met vriendelijke groet,<br>
                        Moto Import B.V.
                    </p>
                </div>
                """
                await send_email(dealer["email"], "📩 Nieuw bericht van Moto Import", html_content)
            except Exception as e:
                logger.error(f"Failed to send chat notification email: {e}")
    
    return {"id": message.id, "message": "Bericht verzonden"}

@api_router.get("/chat/unread-count")
async def get_unread_count(user: dict = Depends(get_current_user)):
    """Get unread message count"""
    if user["role"] == "admin":
        count = await db.chat_messages.count_documents({"sender_role": "dealer", "is_read": False})
    else:
        count = await db.chat_messages.count_documents({
            "conversation_id": user["id"],
            "sender_role": "admin",
            "is_read": False
        })
    return {"unread_count": count}

# ============ STATS ENDPOINTS ============

@api_router.get("/stats")
async def get_stats(user: dict = Depends(require_admin)):
    total_motorcycles = await db.motorcycles.count_documents({})
    available_motorcycles = await db.motorcycles.count_documents({"is_available": True})
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    total_dealers = await db.dealers.count_documents({}) if await db.users.count_documents({"role": "dealer"}) else await db.users.count_documents({"role": "dealer"})
    
    return {
        "total_motorcycles": total_motorcycles,
        "available_motorcycles": available_motorcycles,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "total_dealers": total_dealers
    }

# Include the router
app.include_router(api_router)

# Mount static files for uploads AFTER router (via /api/uploads)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
