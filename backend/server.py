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

# VAPID Config for Push Notifications - Hardcoded to ensure consistency between preview and production
# These keys are a matching pair and must stay together
VAPID_PUBLIC_KEY = 'BOxwQdD7jKfEIziijbv7Gz7lffbc6pOcO7iHI90tUhIkX_VbCcbNQCMq3FEx5jnRYRgNg9_ObiT4XnSta4X9jeY'
VAPID_PRIVATE_KEY_DER = 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgTTZnHAl9dVGQz5Zi7FqHDy8wR3SwLN6lpi5RIKFhmcShRANCAATscEHQ+4ynxCM4oo27+xs+5X323OqTnDu4hyPdLVISJF/1WwnGzUAjKtxRMeY50WEYDYPfzm4k+F50rWuF/Y3m'
VAPID_CLAIMS_EMAIL = os.environ.get('VAPID_CLAIMS_EMAIL', 'mailto:Motoimportbv@gmail.com')

def get_vapid_private_key():
    """Get VAPID private key in raw base64 format for pywebpush"""
    import base64
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend
    
    try:
        # Decode PKCS8 DER format
        der_bytes = base64.b64decode(VAPID_PRIVATE_KEY_DER)
        private_key = serialization.load_der_private_key(der_bytes, password=None, backend=default_backend())
        
        # Extract raw 32-byte private key value (required by py_vapid/pywebpush)
        private_numbers = private_key.private_numbers()
        raw_private_bytes = private_numbers.private_value.to_bytes(32, 'big')
        
        # Return as URL-safe base64 without padding (VAPID format)
        return base64.urlsafe_b64encode(raw_private_bytes).decode('utf-8').rstrip('=')
    except Exception as e:
        logger.error(f"Failed to load VAPID private key: {e}")
        return None

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

class SupplierCreate(BaseModel):
    email: str
    password: str
    company_name: str
    country: str
    contact_person: str = ""
    phone: str = ""

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
    role: str  # "admin", "dealer", or "foreign_dealer"
    is_approved: bool = False  # Dealer moet goedgekeurd worden
    is_foreign_dealer: bool = False  # Buitenlandse dealer (leverancier)
    is_offline: bool = False  # Tijdelijk offline - ontvangt geen meldingen
    country: str = ""  # Land van buitenlandse dealer
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MotorcycleCreate(BaseModel):
    brand: str
    model: str
    year: int
    price: float  # Koop nu prijs
    starting_price: Optional[float] = None  # Vanaf prijs voor bieden
    mileage: int = 0
    color: str = ""
    description: str = ""
    condition: str = "good"  # "new", "excellent", "good", "fair"
    images: List[str] = []
    auction_duration_hours: int = 3  # Standaard 3 uur
    chassis_number: str = ""  # VIN/Chassisnummer

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
    chassis_number: Optional[str] = None  # VIN/Chassisnummer
    license_plate: Optional[str] = None  # Kenteken (set by admin later)

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
    is_paused: bool = False  # Dealer can pause listing temporarily
    auction_end_time: Optional[str] = None  # Wanneer de veiling eindigt
    highest_bid: Optional[float] = None
    highest_bidder_id: Optional[str] = None
    chassis_number: str = ""  # VIN/Chassisnummer
    license_plate: Optional[str] = None  # Kenteken (set by admin)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: str = ""
    # Dealer marketplace fields
    is_dealer_listing: bool = False  # True if listed by dealer
    seller_company: Optional[str] = None  # Company name of selling dealer
    seller_id: Optional[str] = None  # ID of selling dealer
    listing_fee_invoiced: bool = False  # Admin marks when €250 fee is invoiced
    # Foreign dealer fields
    is_foreign_listing: bool = False  # True if from foreign dealer
    is_pending_approval: bool = False  # True if waiting for admin to set price/activate
    foreign_dealer_id: Optional[str] = None  # ID of foreign dealer
    foreign_dealer_company: Optional[str] = None  # Company name of foreign dealer
    original_price: Optional[float] = None  # Price suggested by foreign dealer

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

# License plate (Kenteken) model - admin adds these for dealers
class LicensePlateCreate(BaseModel):
    dealer_id: str
    license_plate: str
    chassis_number: Optional[str] = None  # Optional link to motorcycle
    brand: Optional[str] = None
    model: Optional[str] = None
    notes: Optional[str] = ""

class LicensePlate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dealer_id: str
    dealer_company: str
    dealer_email: str
    license_plate: str
    chassis_number: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    notes: str = ""
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
    motorcycle_snapshot: Optional[dict] = None  # Snapshot of motorcycle data at time of order
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
    motorcycle_snapshot: Optional[dict] = None  # Fallback data if motorcycle is deleted

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

# ============ PARTS SHOP MODELS ============

# Predefined motorcycle brands for parts compatibility
MOTORCYCLE_BRANDS = ["Yamaha", "Honda", "Kawasaki", "Ducati", "Triumph", "KTM", "Suzuki", "BMW"]

class PartCategory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PartCategoryCreate(BaseModel):
    name: str
    description: str = ""

class Part(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    price: float
    category_id: str
    category_name: str = ""
    compatible_brands: List[str] = []  # Which motorcycle brands this part fits
    stock: int = 0
    sku: str = ""  # Article number
    images: List[str] = []
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PartCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    category_id: str
    compatible_brands: List[str] = []
    stock: int = 0
    sku: str = ""
    images: List[str] = []

class PartUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category_id: Optional[str] = None
    compatible_brands: Optional[List[str]] = None
    stock: Optional[int] = None
    sku: Optional[str] = None
    images: Optional[List[str]] = None
    is_active: Optional[bool] = None

class PartOrderItem(BaseModel):
    part_id: str
    part_name: str = ""
    quantity: int
    price: float

class PartOrderCreate(BaseModel):
    items: List[PartOrderItem]
    needs_shipping: bool = True  # True = €9.95 shipping, False = free pickup
    notes: str = ""

class PartOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str = ""  # e.g. "PO-2026-0001"
    dealer_id: str
    dealer_email: str
    dealer_company: str
    dealer_address: str = ""
    dealer_postal_code: str = ""
    dealer_city: str = ""
    dealer_phone: str = ""
    items: List[dict] = []
    subtotal: float = 0.0
    shipping_cost: float = 0.0  # €9.95 or €0
    total: float = 0.0
    status: str = "pending"  # pending, paid, shipped, completed, cancelled
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    paid_at: Optional[str] = None

# ============ ROOT ENDPOINT ============

@api_router.get("/")
async def root():
    return {"message": "Moto Import API is running"}

@api_router.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    """Health check endpoint for keeping the service warm"""
    try:
        # Quick database ping
        await db.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "degraded", "database": "error", "detail": str(e)}

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    # Dealers krijgen een lang geldig token (1 jaar) zodat ze altijd ingelogd blijven
    # Admins krijgen een korter token (30 dagen) voor extra veiligheid
    if role == 'dealer':
        expiry_days = 365  # 1 jaar voor dealers
    else:
        expiry_days = 30   # 30 dagen voor admins
    
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * expiry_days
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
    """Helper to check if a dealer is approved and not offline"""
    if user["role"] == "dealer":
        if not user.get("is_approved", False):
            raise HTTPException(status_code=403, detail="Uw account wacht nog op goedkeuring door Moto Import")
        if user.get("is_offline", False):
            raise HTTPException(status_code=403, detail="Uw account is tijdelijk offline gezet door de beheerder. Neem contact op met Moto Import.")
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

@api_router.post("/auth/register-supplier")
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
        "address": "",
        "postal_code": "",
        "city": "",
        "phone": supplier_data.phone,
        "contact_person": supplier_data.contact_person,
        "role": "dealer",
        "is_approved": False,
        "is_foreign_dealer": True,
        "country": supplier_data.country,
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
        html_content
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

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
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
            "company_name": user["company_name"],
            "role": user["role"],
            "is_approved": is_approved,
            "terms_accepted": user.get("terms_accepted", False),
            "is_foreign_dealer": user.get("is_foreign_dealer", False),
            "country": user.get("country", "")
        }
    }

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@api_router.post("/auth/accept-terms")
async def accept_terms(user: dict = Depends(get_current_user)):
    """Accept terms and conditions"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"terms_accepted": True, "terms_accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Voorwaarden geaccepteerd", "terms_accepted": True}

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

# ============ DEALER MANAGEMENT ============

@api_router.post("/dealers/{dealer_id}/set-foreign")
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

@api_router.post("/dealers/{dealer_id}/unset-foreign")
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
        
        # Send push notifications to all dealers with detailed motor info
        asyncio.create_task(send_push_to_all_dealers(
            title=f"🏍️ {motorcycle.brand} {motorcycle.model}",
            body=f"Jaar: {motorcycle.year} | Prijs: €{motorcycle.price:,.0f} | {motorcycle.condition.title() if motorcycle.condition else 'Goed'}",
            url=f"/motorcycle/{motorcycle.id}"
        ))
    
    return motorcycle

# Dealer marketplace - dealers can list their own motorcycles
@api_router.post("/motorcycles/dealer-listing", response_model=Motorcycle)
async def create_dealer_listing(data: MotorcycleCreate, user: dict = Depends(require_approved_dealer)):
    """Allow dealers to list their own motorcycles for sale to other dealers"""
    
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
        created_by=user["id"],
        # Dealer marketplace fields
        is_dealer_listing=True,
        seller_company=user.get("company_name", ""),
        seller_id=user["id"]
    )
    doc = motorcycle.model_dump()
    await db.motorcycles.insert_one(doc)
    
    # Get all OTHER approved dealers (not the seller)
    dealers = await db.users.find({
        "role": "dealer", 
        "is_approved": True,
        "id": {"$ne": user["id"]}  # Exclude the seller
    }, {"_id": 0}).to_list(1000)
    
    if dealers:
        # Create in-app notifications
        notifications = [
            Notification(
                user_id=dealer["id"],
                type="new_motorcycle",
                title="Nieuwe dealer motor",
                message=f"{motorcycle.brand} {motorcycle.model} ({motorcycle.year}) - €{motorcycle.price:,.0f} (van {user.get('company_name', 'dealer')})",
                motorcycle_id=motorcycle.id
            ).model_dump()
            for dealer in dealers
        ]
        await db.notifications.insert_many(notifications)
        
        # Send push notifications with detailed motor info
        asyncio.create_task(send_push_to_all_dealers(
            title=f"🏍️ {motorcycle.brand} {motorcycle.model}",
            body=f"Jaar: {motorcycle.year} | Prijs: €{motorcycle.price:,.0f} | Van: {user.get('company_name', 'dealer')}",
            url=f"/motorcycle/{motorcycle.id}",
            exclude_user_id=user["id"]
        ))
    
    # Notify admin about new dealer listing
    admin_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #DC2626;">🏍️ Nieuwe Dealer Motor Geplaatst</h2>
        <p>Een dealer heeft een motor te koop aangeboden:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f4f4f5;">
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Verkoper</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">{user.get('company_name', 'Dealer')}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Motor</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">{motorcycle.brand} {motorcycle.model} ({motorcycle.year})</td>
            </tr>
            <tr style="background: #f4f4f5;">
                <td style="padding: 10px; border: 1px solid #e4e4e7;"><strong>Prijs</strong></td>
                <td style="padding: 10px; border: 1px solid #e4e4e7;">€{motorcycle.price:,.0f}</td>
            </tr>
        </table>
        <p style="color: #71717a;">Bij verkoop: €250 plaatsingskosten factureren aan {user.get('company_name', 'dealer')}.</p>
    </div>
    """
    await send_admin_notification(f"🏍️ Nieuwe Dealer Motor: {motorcycle.brand} {motorcycle.model}", admin_html)
    
    return motorcycle

# Foreign dealer endpoint - submit motorcycles for admin approval
@api_router.post("/motorcycles/foreign-listing")
async def create_foreign_listing(data: MotorcycleCreate, user: dict = Depends(get_current_user)):
    """Allow foreign dealers to submit motorcycles for admin approval"""
    
    # Check if user is a foreign dealer
    if not user.get("is_foreign_dealer", False):
        raise HTTPException(status_code=403, detail="Alleen buitenlandse dealers kunnen deze functie gebruiken")
    
    motorcycle = Motorcycle(
        brand=data.brand,
        model=data.model,
        year=data.year,
        price=data.price,  # Suggested price by foreign dealer
        starting_price=data.starting_price,
        mileage=data.mileage,
        color=data.color,
        description=data.description,
        condition=data.condition,
        images=data.images,
        created_by=user["id"],
        is_available=False,  # Not visible until admin activates
        # Foreign dealer fields
        is_foreign_listing=True,
        is_pending_approval=True,
        foreign_dealer_id=user["id"],
        foreign_dealer_company=user.get("company_name", ""),
        original_price=data.price
    )
    doc = motorcycle.model_dump()
    await db.motorcycles.insert_one(doc)
    
    # Notify admin about new foreign dealer submission
    admin_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #8B5CF6; padding: 15px; text-align: center;">
            <h2 style="color: white; margin: 0;">🌍 Nieuwe Motor van Buitenlandse Dealer</h2>
        </div>
        <div style="padding: 20px; background: #f5f3ff;">
            <p style="font-size: 16px; margin-bottom: 15px;"><strong>Actie vereist:</strong> Beoordeel en stel de prijs in.</p>
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px;">
                <tr style="background: #f4f4f5;">
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Buitenlandse Dealer</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7; color: #8B5CF6; font-weight: bold;">{user.get('company_name', 'Dealer')} ({user.get('country', '')})</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Motor</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;">{motorcycle.brand} {motorcycle.model} ({motorcycle.year})</td>
                </tr>
                <tr style="background: #f4f4f5;">
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Voorgestelde Prijs</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;">€{motorcycle.price:,.0f}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Kilometerstand</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;">{motorcycle.mileage:,} km</td>
                </tr>
            </table>
            <p style="margin-top: 15px; color: #6b7280;">Log in om de prijs aan te passen en de motor te activeren.</p>
        </div>
    </div>
    """
    await send_admin_notification(f"🌍 Nieuwe Motor van {user.get('company_name', 'Buitenlandse Dealer')}", admin_html)
    
    return {"message": "Motor ingediend voor beoordeling", "motorcycle_id": motorcycle.id}

@api_router.get("/motorcycles/foreign-listings")
async def get_foreign_listings(user: dict = Depends(get_current_user)):
    """Get motorcycles submitted by the current foreign dealer"""
    if not user.get("is_foreign_dealer", False):
        raise HTTPException(status_code=403, detail="Alleen voor buitenlandse dealers")
    
    motorcycles = await db.motorcycles.find(
        {"foreign_dealer_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    return motorcycles

@api_router.get("/motorcycles/pending-foreign")
async def get_pending_foreign_listings(user: dict = Depends(require_admin)):
    """Get all pending motorcycles from foreign dealers (admin only)"""
    motorcycles = await db.motorcycles.find(
        {"is_foreign_listing": True, "is_pending_approval": True},
        {"_id": 0}
    ).to_list(100)
    return motorcycles

@api_router.post("/motorcycles/{motorcycle_id}/activate")
async def activate_foreign_listing(motorcycle_id: str, price: float, starting_price: Optional[float] = None, user: dict = Depends(require_admin)):
    """Activate a foreign dealer listing with new price (admin only)"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    if not motorcycle.get("is_foreign_listing", False):
        raise HTTPException(status_code=400, detail="Dit is geen buitenlandse dealer motor")
    
    # Update motorcycle with new price and activate it
    await db.motorcycles.update_one(
        {"id": motorcycle_id},
        {"$set": {
            "price": price,
            "starting_price": starting_price or price * 0.8,
            "is_available": True,
            "is_pending_approval": False
        }}
    )
    
    # Get all approved dealers for notifications
    dealers = await db.users.find(
        {"role": "dealer", "is_approved": True, "is_foreign_dealer": {"$ne": True}},
        {"_id": 0}
    ).to_list(1000)
    
    if dealers:
        # Create in-app notifications
        notifications = [
            Notification(
                user_id=dealer["id"],
                type="new_motorcycle",
                title="Nieuwe motor beschikbaar",
                message=f"{motorcycle['brand']} {motorcycle['model']} ({motorcycle['year']}) - €{price:,.0f}",
                motorcycle_id=motorcycle_id
            ).model_dump()
            for dealer in dealers
        ]
        await db.notifications.insert_many(notifications)
        
        # Send push notifications with detailed motor info
        asyncio.create_task(send_push_to_all_dealers(
            title=f"🏍️ {motorcycle['brand']} {motorcycle['model']}",
            body=f"Jaar: {motorcycle.get('year', 'N/A')} | Prijs: €{price:,.0f} | Import motor",
            url=f"/motorcycle/{motorcycle_id}"
        ))
    
    return {"message": "Motor geactiveerd", "price": price}

async def notify_dealers_new_motorcycle_email(motorcycle, dealers):
    """Send email notifications to all approved dealers who are not offline about a new motorcycle"""
    base_url = os.environ.get("BASE_URL", "")
    
    for dealer in dealers:
        # Skip dealers without email or who are offline
        if not dealer.get("email") or dealer.get("is_offline", False):
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
    # For dealers, exclude their own listings from the available motorcycles
    query = {"is_available": True}
    if user["role"] == "dealer":
        query["seller_id"] = {"$ne": user["id"]}  # Don't show own listings
    
    motorcycles = await db.motorcycles.find(query, {"_id": 0}).to_list(1000)
    # Add default starting_price if missing
    for m in motorcycles:
        if "starting_price" not in m or m["starting_price"] is None:
            m["starting_price"] = m.get("price", 0) * 0.8
    return motorcycles

@api_router.get("/motorcycles/my-listings")
async def get_my_listings(user: dict = Depends(require_approved_dealer)):
    """Get motorcycles listed by the current dealer"""
    motorcycles = await db.motorcycles.find(
        {"seller_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    return motorcycles

@api_router.put("/motorcycles/my-listings/{motorcycle_id}")
async def update_my_listing(motorcycle_id: str, data: MotorcycleUpdate, user: dict = Depends(require_approved_dealer)):
    """Update a dealer's own listing"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Verify ownership
    if motorcycle.get("seller_id") != user["id"]:
        raise HTTPException(status_code=403, detail="U kunt alleen uw eigen listings bewerken")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.motorcycles.update_one({"id": motorcycle_id}, {"$set": update_data})
    
    updated = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    return updated

@api_router.put("/motorcycles/my-listings/{motorcycle_id}/pause")
async def pause_my_listing(motorcycle_id: str, user: dict = Depends(require_approved_dealer)):
    """Pause a dealer's own listing (make it invisible)"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Verify ownership
    if motorcycle.get("seller_id") != user["id"]:
        raise HTTPException(status_code=403, detail="U kunt alleen uw eigen listings pauzeren")
    
    # Toggle pause state
    is_paused = motorcycle.get("is_paused", False)
    await db.motorcycles.update_one(
        {"id": motorcycle_id}, 
        {"$set": {"is_paused": not is_paused, "is_available": is_paused}}
    )
    
    return {"message": "Listing hervat" if is_paused else "Listing gepauzeerd", "is_paused": not is_paused}

@api_router.delete("/motorcycles/my-listings/{motorcycle_id}")
async def delete_my_listing(motorcycle_id: str, user: dict = Depends(require_approved_dealer)):
    """Delete a dealer's own listing"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Verify ownership
    if motorcycle.get("seller_id") != user["id"]:
        raise HTTPException(status_code=403, detail="U kunt alleen uw eigen listings verwijderen")
    
    # Delete associated bids
    await db.bids.delete_many({"motorcycle_id": motorcycle_id})
    
    # Delete the motorcycle
    await db.motorcycles.delete_one({"id": motorcycle_id})
    
    return {"message": "Listing verwijderd"}

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

@api_router.get("/orders", response_model=List[OrderWithMotorcycle])
async def get_orders(user: dict = Depends(require_approved_dealer)):
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
    
    # Enrich orders with motorcycle data (use snapshot as fallback)
    result = []
    for order in orders:
        # Try to get live motorcycle data, fallback to snapshot
        motorcycle_data = motorcycles_map.get(order["motorcycle_id"])
        if not motorcycle_data:
            motorcycle_data = order.get("motorcycle_snapshot")
        order["motorcycle"] = motorcycle_data
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

INSPECTION_COST = 125.0  # Keuring kosten
VALUATION_COST = 160.0   # Taxatie kosten (excl. BTW)

class BuyNowRequest(BaseModel):
    motorcycle_id: str
    needs_delivery: bool = False
    needs_inspection: bool = False  # Keuring
    needs_valuation: bool = False   # Taxatie
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
    
    total_price = max(0, motorcycle["price"] + delivery_cost + inspection_cost + valuation_cost - voucher_discount)
    
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
    
    # Check if this is a dealer-to-dealer sale
    is_dealer_listing = motorcycle.get("is_dealer_listing", False)
    seller_company = motorcycle.get("seller_company", "")
    seller_id = motorcycle.get("seller_id", "")
    
    if is_dealer_listing:
        order_dict["is_dealer_to_dealer"] = True
        order_dict["seller_company"] = seller_company
        order_dict["seller_id"] = seller_id
    
    await db.orders.insert_one(order_dict)
    
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
            # Send email notification to foreign dealer (without price)
            foreign_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #16a34a; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 YOUR MOTORCYCLE HAS BEEN SOLD!</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <p>Dear {foreign_dealer.get('company_name', 'Supplier')},</p>
                    <p>Great news! Your motorcycle has been sold through Moto Import.</p>
                    
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #18181b;">Sold Motorcycle</h3>
                        <p style="font-size: 20px; font-weight: bold; color: #16a34a; margin: 10px 0;">
                            {motorcycle['brand']} {motorcycle['model']}
                        </p>
                        <p><strong>Year:</strong> {motorcycle['year']}</p>
                        <p><strong>Mileage:</strong> {motorcycle.get('mileage', 'N/A'):,} km</p>
                    </div>
                    
                    <p>We will contact you shortly regarding the delivery arrangements.</p>
                    <p style="color: #6b7280; font-size: 14px;">Thank you for working with Moto Import!</p>
                </div>
                <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
                    <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
                    <p style="margin: 5px 0;">Horsterhoekweg 11, 7433 SV Schalkhaar</p>
                </div>
            </div>
            """
            try:
                await send_email(foreign_dealer["email"], "🎉 Your Motorcycle Has Been Sold! - Moto Import", foreign_html)
                # Also send push notification (without price)
                await send_push_notification_to_user(
                    foreign_dealer_id,
                    "🎉 Motorcycle Sold!",
                    f"Your {motorcycle['brand']} {motorcycle['model']} has been sold!",
                    "/foreign-dealer/my-motorcycles"
                )
            except Exception as e:
                logger.error(f"Failed to notify foreign dealer: {str(e)}")
    
    # Get dealer info
    dealer = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    delivery_text = "Ja (€50)" if data.needs_delivery else "Nee (ophalen)"
    inspection_text = "Ja (€125)" if data.needs_inspection else "Nee"
    valuation_text = "Ja (€160 excl. BTW)" if data.needs_valuation else "Nee"
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

@api_router.get("/payments/status/{session_id}")
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
    """Upload image and store in MongoDB for persistence"""
    import base64
    
    # Check file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Alleen JPG, PNG of WEBP afbeeldingen toegestaan")
    
    # Read file content
    content = await file.read()
    
    # Check file size (max 5MB)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Bestand te groot (max 5MB)")
    
    # Generate unique ID
    image_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    
    # Store in MongoDB
    image_doc = {
        "id": image_id,
        "filename": f"{image_id}.{ext}",
        "content_type": file.content_type,
        "data": base64.b64encode(content).decode('utf-8'),
        "uploaded_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.images.insert_one(image_doc)
    
    # Return URL that serves from MongoDB
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base_url = os.environ.get("BASE_URL", "")
    
    if not base_url:
        raise HTTPException(status_code=500, detail="BASE_URL niet geconfigureerd")
    
    image_url = f"{base_url}/api/images/{image_id}"
    
    return {"url": image_url, "filename": f"{image_id}.{ext}"}

@api_router.get("/images/{image_id}")
async def get_image(image_id: str):
    """Serve image from MongoDB"""
    import base64
    from fastapi.responses import Response
    
    image = await db.images.find_one({"id": image_id}, {"_id": 0})
    if not image:
        raise HTTPException(status_code=404, detail="Afbeelding niet gevonden")
    
    # Decode base64 data
    image_data = base64.b64decode(image["data"])
    
    return Response(
        content=image_data,
        media_type=image["content_type"],
        headers={"Cache-Control": "public, max-age=31536000"}  # Cache for 1 year
    )

@api_router.post("/upload/multiple")
async def upload_multiple_images(request: Request, files: List[UploadFile] = File(...), user: dict = Depends(get_current_user)):
    """Upload multiple images and store in MongoDB"""
    import base64
    
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
        
        content = await file.read()
        
        # Skip if too large
        if len(content) > 5 * 1024 * 1024:
            continue
        
        image_id = str(uuid.uuid4())
        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        
        # Store in MongoDB
        image_doc = {
            "id": image_id,
            "filename": f"{image_id}.{ext}",
            "content_type": file.content_type,
            "data": base64.b64encode(content).decode('utf-8'),
            "uploaded_by": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            await db.images.insert_one(image_doc)
            if base_url:
                urls.append(f"{base_url}/api/images/{image_id}")
        except:
            continue
    
    return {"urls": urls}

# ============ BID ENDPOINTS ============

@api_router.post("/bids")
async def place_bid(data: BidCreate, request: Request, user: dict = Depends(get_current_user)):
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
    
    # Check if user is already the highest bidder - prevent self-overbidding
    if motorcycle.get("highest_bidder_id") == user["id"]:
        raise HTTPException(status_code=400, detail="U bent al de hoogste bieder. Wacht op een ander bod.")
    
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
    
    # Send notification to admin about new bid
    try:
        # Get base URL for email links
        base_url = str(request.base_url).rstrip('/')
        if 'preview.emergentagent.com' in base_url:
            base_url = os.environ.get('BASE_URL', base_url)
        
        # Create in-app notification for admin
        admin_user = await db.users.find_one({"role": "admin"}, {"_id": 0})
        if admin_user:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": admin_user["id"],
                "title": "Nieuw bod ontvangen!",
                "message": f"{user['company_name']} heeft €{data.amount:,.0f} geboden op {motorcycle['brand']} {motorcycle['model']}",
                "type": "bid",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "link": "/admin/motorcycles"
            }
            await db.notifications.insert_one(notification)
            
            # Send email to admin
            email_body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #18181b; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">🏍️ MOTO IMPORT</h1>
                </div>
                <div style="padding: 30px; background: #f4f4f5;">
                    <h2 style="color: #dc2626;">💰 Nieuw Bod Ontvangen!</h2>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Motor:</strong> {motorcycle['brand']} {motorcycle['model']} ({motorcycle['year']})</p>
                        <p><strong>Dealer:</strong> {user['company_name']}</p>
                        <p><strong>Bod:</strong> <span style="color: #dc2626; font-size: 24px; font-weight: bold;">€{data.amount:,.0f}</span></p>
                        <p><strong>Vraagprijs:</strong> €{motorcycle['price']:,.0f}</p>
                        <p><strong>Vorig hoogste bod:</strong> €{current_highest:,.0f}</p>
                    </div>
                    <a href="{base_url}/admin/motorcycles" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Bekijk in Dashboard</a>
                </div>
                <div style="padding: 20px; text-align: center; color: #71717a; font-size: 12px;">
                    <p>Moto Import B.V. | Horsterhoekweg 11, 7433 SV Schalkhaar</p>
                </div>
            </div>
            """
            await send_email(
                to_email=ADMIN_EMAIL,
                subject=f"💰 Nieuw bod: €{data.amount:,.0f} op {motorcycle['brand']} {motorcycle['model']}",
                html_content=email_body
            )
            
            # Send push notification to admin
            await send_push_notification_to_user(
                admin_user["id"],
                "💰 Nieuw Bod!",
                f"{user['company_name']} biedt €{data.amount:,.0f} op {motorcycle['brand']} {motorcycle['model']}",
                "/admin/motorcycles"
            )
    except Exception as e:
        logger.error(f"Error sending bid notification: {e}")
    
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
    
    # Create order with buy now
    order = Order(
        motorcycle_id=motorcycle_id,
        dealer_id=user["id"],
        dealer_email=user["email"],
        dealer_company=user["company_name"],
        status="approved",
        notes=f"Koop Nu voor €{motorcycle['price']:,.0f}",
        motorcycle_snapshot=motorcycle_snapshot
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
    
    # Check of het een buitenlandse dealer is
    is_foreign = dealer.get("is_foreign_dealer", False)
    
    # Get base URL from request origin or fallback
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base_url = os.environ.get("BASE_URL", "https://www.motoimportbv.nl")
    
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
                    <p style="margin: 5px 0;">Horsterhoekweg 11, 7433 SV Schalkhaar</p>
                    <p style="margin: 5px 0;">Tel: +31 6 81792660 | Email: Motoimportbv@gmail.com</p>
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

@api_router.put("/dealers/{dealer_id}/toggle-offline")
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
    return {
        "message": f"Dealer {dealer['company_name']} is nu {status_text}",
        "is_offline": new_status
    }

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

@api_router.get("/push/debug")
async def debug_vapid_keys():
    """Debug endpoint to verify VAPID key configuration"""
    import base64
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend
    
    try:
        # Load private key and derive public key
        der_bytes = base64.b64decode(VAPID_PRIVATE_KEY_DER)
        private_key = serialization.load_der_private_key(der_bytes, password=None, backend=default_backend())
        public_key = private_key.public_key()
        public_numbers = public_key.public_numbers()
        x_bytes = public_numbers.x.to_bytes(32, 'big')
        y_bytes = public_numbers.y.to_bytes(32, 'big')
        uncompressed = b'\x04' + x_bytes + y_bytes
        derived_public_key = base64.urlsafe_b64encode(uncompressed).rstrip(b'=').decode('utf-8')
        
        return {
            "configured_public_key": VAPID_PUBLIC_KEY,
            "derived_public_key": derived_public_key,
            "keys_match": VAPID_PUBLIC_KEY == derived_public_key,
            "private_key_loaded": True
        }
    except Exception as e:
        return {
            "error": str(e),
            "configured_public_key": VAPID_PUBLIC_KEY,
            "private_key_loaded": False
        }

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

@api_router.get("/push/status")
async def get_push_status(user: dict = Depends(get_current_user)):
    """Check if user has an active push subscription"""
    sub = await db.push_subscriptions.find_one({"user_id": user["id"]})
    return {"subscribed": sub is not None}

@api_router.get("/push/test")
async def test_push_notification(user: dict = Depends(get_current_user)):
    """Test push notification for current user"""
    # Check if user has subscription
    sub = await db.push_subscriptions.find_one({"user_id": user["id"]})
    if not sub:
        return {"success": False, "error": "Geen push subscription gevonden. Klik eerst op Inschakelen."}
    
    # Check subscription details
    subscription = sub.get("subscription", {})
    endpoint = subscription.get("endpoint", "")
    
    if not endpoint:
        return {"success": False, "error": "Subscription heeft geen endpoint"}
    
    # Debug info
    keys = subscription.get("keys", {})
    p256dh = keys.get("p256dh", "")
    auth = keys.get("auth", "")
    
    debug_info = {
        "endpoint_preview": endpoint[:60] + "..." if len(endpoint) > 60 else endpoint,
        "p256dh_length": len(p256dh),
        "auth_length": len(auth),
        "has_valid_keys": bool(p256dh and auth and len(p256dh) > 50)
    }
    
    # Get VAPID private key
    private_key = get_vapid_private_key()
    
    if not private_key:
        return {"success": False, "error": "VAPID private key niet geconfigureerd", "debug": debug_info}
    
    # Try to send
    try:
        payload = json.dumps({
            "title": "🧪 Test Notificatie",
            "body": "Push notificaties werken!",
            "icon": "/icons/icon-192x192.png",
            "url": "/dealer"
        })
        
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=private_key,
            vapid_claims={"sub": VAPID_CLAIMS_EMAIL}
        )
        return {"success": True, "message": "Test notificatie verzonden!", "debug": debug_info}
    except WebPushException as e:
        error_msg = str(e)
        response_text = ""
        if e.response:
            response_text = e.response.text[:200] if e.response.text else ""
            error_msg = f"Status {e.response.status_code}: {response_text}"
        
        # Check for VAPID key mismatch - multiple error patterns
        vapid_mismatch = (
            "VapidPkHashMismatch" in response_text or 
            "VapidPkHashMismatch" in str(e) or
            "VAPID credentials" in response_text or
            (e.response and e.response.status_code == 403 and "credentials" in response_text.lower())
        )
        
        if vapid_mismatch:
            await db.push_subscriptions.delete_many({"user_id": user["id"]})
            return {
                "success": False, 
                "error": "Push instellingen verouderd. Subscription verwijderd.",
                "needs_resubscribe": True,
                "debug": debug_info
            }
        
        # Check for expired/invalid subscription
        if e.response and e.response.status_code in [404, 410]:
            await db.push_subscriptions.delete_many({"user_id": user["id"]})
            return {
                "success": False,
                "error": "Subscription verlopen. Klik op 'Inschakelen' om opnieuw te registreren.",
                "needs_resubscribe": True,
                "debug": debug_info
            }
        
        return {"success": False, "error": f"Push fout: {error_msg}", "debug": debug_info}
    except Exception as e:
        return {"success": False, "error": f"Fout: {str(e)[:150]}", "debug": debug_info}

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
        
        # Get private key using helper function
        private_key = get_vapid_private_key()
        
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

async def send_push_to_all_dealers(title: str, body: str, url: str = "/", exclude_user_id: str = None):
    """Send push notification to all approved dealers who are not offline"""
    try:
        # Get all approved dealers who are NOT offline and NOT foreign dealers
        query = {"role": "dealer", "is_approved": True, "is_offline": {"$ne": True}, "is_foreign_dealer": {"$ne": True}}
        if exclude_user_id:
            query["id"] = {"$ne": exclude_user_id}
        
        dealers = await db.users.find(query, {"_id": 0, "id": 1}).to_list(1000)
        
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

# ============ PARTS SHOP ENDPOINTS ============

# --- Part Categories ---
@api_router.get("/parts/categories")
async def get_part_categories():
    """Get all part categories"""
    categories = await db.part_categories.find({}, {"_id": 0}).to_list(100)
    return categories

@api_router.post("/parts/categories")
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

@api_router.delete("/parts/categories/{category_id}")
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

@api_router.get("/parts/brands")
async def get_motorcycle_brands():
    """Get list of motorcycle brands for parts compatibility"""
    return MOTORCYCLE_BRANDS

# --- Parts CRUD ---
@api_router.get("/parts")
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

@api_router.get("/parts/all")
async def get_all_parts_admin(user: dict = Depends(require_admin)):
    """Get all parts including inactive (admin only)"""
    parts = await db.parts.find({}, {"_id": 0}).to_list(500)
    return parts

# NOTE: These order routes MUST be before /parts/{part_id} to avoid path matching issues
@api_router.get("/parts/orders/my")
async def get_my_part_orders(user: dict = Depends(require_approved_dealer)):
    """Get current user's parts orders"""
    orders = await db.part_orders.find(
        {"dealer_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return orders

@api_router.get("/parts/orders")
async def get_all_part_orders(user: dict = Depends(require_admin)):
    """Get all parts orders (admin only)"""
    orders = await db.part_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders

@api_router.put("/parts/orders/{order_id}/status")
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

@api_router.get("/parts/{part_id}")
async def get_part(part_id: str):
    """Get a specific part"""
    part = await db.parts.find_one({"id": part_id}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Onderdeel niet gevonden")
    return part

@api_router.post("/parts")
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

@api_router.put("/parts/{part_id}")
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

@api_router.delete("/parts/{part_id}")
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

@api_router.post("/parts/order")
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
        
        # Also notify admin
        if ADMIN_EMAIL and GMAIL_EMAIL and GMAIL_APP_PASSWORD:
            admin_msg = MIMEMultipart()
            admin_msg['Subject'] = f'Nieuwe onderdelen bestelling: {order_number}'
            admin_msg['From'] = GMAIL_EMAIL
            admin_msg['To'] = ADMIN_EMAIL
            
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
            admin_msg.attach(MIMEText(admin_body, 'plain'))
            
            try:
                with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                    smtp.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
                    smtp.send_message(admin_msg)
            except Exception as e:
                logger.error(f"Failed to send admin notification: {e}")
                
    except Exception as e:
        logger.error(f"Failed to generate/send invoice: {e}")
    
    return {
        "message": "Bestelling geplaatst! Factuur is verstuurd naar uw email.",
        "order": order.model_dump()
    }

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

@api_router.get("/stats/top-dealers")
async def get_top_dealers(user: dict = Depends(require_admin)):
    """Get most active dealers by login count"""
    dealers = await db.users.find(
        {"role": "dealer", "is_approved": True},
        {"_id": 0, "id": 1, "company_name": 1, "email": 1, "login_count": 1, "last_login": 1}
    ).sort("login_count", -1).to_list(10)
    
    return dealers

# ============ LICENSE PLATE (KENTEKEN) ENDPOINTS ============

@api_router.post("/license-plates")
async def create_license_plate(data: LicensePlateCreate, user: dict = Depends(require_admin)):
    """Admin adds a license plate for a dealer"""
    # Get dealer info
    dealer = await db.users.find_one({"id": data.dealer_id}, {"_id": 0})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    # Check if license plate already exists
    existing = await db.license_plates.find_one({"license_plate": data.license_plate.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Dit kenteken is al toegevoegd")
    
    license_plate = LicensePlate(
        dealer_id=data.dealer_id,
        dealer_company=dealer.get("company_name", ""),
        dealer_email=dealer.get("email", ""),
        license_plate=data.license_plate.upper(),
        chassis_number=data.chassis_number.upper() if data.chassis_number else None,
        brand=data.brand,
        model=data.model,
        notes=data.notes or ""
    )
    
    await db.license_plates.insert_one(license_plate.model_dump())
    
    # Send notification to dealer
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": data.dealer_id,
        "type": "license_plate",
        "title": "Nieuw kenteken toegevoegd",
        "message": f"Kenteken {data.license_plate.upper()} is toegevoegd aan uw account.",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": f"Kenteken {data.license_plate.upper()} toegevoegd voor {dealer.get('company_name', 'dealer')}", "license_plate": license_plate.model_dump()}

@api_router.get("/license-plates")
async def get_all_license_plates(user: dict = Depends(require_admin)):
    """Admin gets all license plates"""
    plates = await db.license_plates.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return plates

@api_router.get("/license-plates/my")
async def get_my_license_plates(user: dict = Depends(require_approved_dealer)):
    """Dealer gets their own license plates"""
    plates = await db.license_plates.find(
        {"dealer_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return plates

@api_router.get("/license-plates/dealer/{dealer_id}")
async def get_dealer_license_plates(dealer_id: str, user: dict = Depends(require_admin)):
    """Admin gets license plates for a specific dealer"""
    plates = await db.license_plates.find(
        {"dealer_id": dealer_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return plates

@api_router.delete("/license-plates/{plate_id}")
async def delete_license_plate(plate_id: str, user: dict = Depends(require_admin)):
    """Admin deletes a license plate"""
    result = await db.license_plates.delete_one({"id": plate_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kenteken niet gevonden")
    return {"message": "Kenteken verwijderd"}

@api_router.put("/license-plates/{plate_id}")
async def update_license_plate(plate_id: str, data: LicensePlateCreate, user: dict = Depends(require_admin)):
    """Admin updates a license plate"""
    update_data = {
        "license_plate": data.license_plate.upper(),
        "chassis_number": data.chassis_number.upper() if data.chassis_number else None,
        "brand": data.brand,
        "model": data.model,
        "notes": data.notes or ""
    }
    
    # If dealer changed, update dealer info too
    if data.dealer_id:
        dealer = await db.users.find_one({"id": data.dealer_id}, {"_id": 0})
        if dealer:
            update_data["dealer_id"] = data.dealer_id
            update_data["dealer_company"] = dealer.get("company_name", "")
            update_data["dealer_email"] = dealer.get("email", "")
    
    result = await db.license_plates.update_one(
        {"id": plate_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kenteken niet gevonden")
    return {"message": "Kenteken bijgewerkt"}

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

@app.on_event("startup")
async def startup_db_client():
    """Initialize database with default data"""
    # Create default part categories if they don't exist
    default_categories = [
        {"name": "Uitlaten", "description": "Uitlaatsystemen en onderdelen"},
        {"name": "Tanktassen", "description": "Tanktassen en bevestigingen"},
        {"name": "Koffers", "description": "Zijkoffers en topkoffers"},
        {"name": "Luxe Zadels", "description": "Comfort en luxe zadels"}
    ]
    
    for cat in default_categories:
        existing = await db.part_categories.find_one({"name": cat["name"]})
        if not existing:
            category = PartCategory(name=cat["name"], description=cat["description"])
            await db.part_categories.insert_one(category.model_dump())
            logger.info(f"Created default category: {cat['name']}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
