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
import urllib.parse
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
from twilio.rest import Client as TwilioClient

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

# Twilio SMS Config
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER', '')

# Initialize Twilio client if credentials are available
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logging.info("Twilio client initialized successfully")
    except Exception as e:
        logging.warning(f"Failed to initialize Twilio client: {e}")

# ============ EXCHANGE RATE CONFIG ============
import httpx

# Cache for exchange rates (to avoid too many API calls)
exchange_rate_cache = {
    "CHF_EUR": None,
    "last_updated": None
}
EXCHANGE_RATE_CACHE_DURATION = 300  # 5 minutes cache
DEFAULT_CHF_EUR_MARGIN = 0.0  # No default margin - admin sets prices manually

async def get_chf_eur_margin():
    """Get the current CHF to EUR margin from database, or use default"""
    settings = await db.settings.find_one({"key": "chf_eur_margin"}, {"_id": 0})
    if settings and "value" in settings:
        return settings["value"]
    return DEFAULT_CHF_EUR_MARGIN

async def set_chf_eur_margin(margin: float):
    """Set the CHF to EUR margin in database"""
    await db.settings.update_one(
        {"key": "chf_eur_margin"},
        {"$set": {"key": "chf_eur_margin", "value": margin, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

async def get_chf_to_eur_rate():
    """Get real-time CHF to EUR exchange rate with caching"""
    global exchange_rate_cache
    
    now = datetime.now(timezone.utc)
    
    # Check cache validity
    if (exchange_rate_cache["CHF_EUR"] is not None and 
        exchange_rate_cache["last_updated"] is not None and
        (now - exchange_rate_cache["last_updated"]).total_seconds() < EXCHANGE_RATE_CACHE_DURATION):
        return exchange_rate_cache["CHF_EUR"]
    
    try:
        # Use exchangerate-api.com (free tier: 1500 requests/month)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.exchangerate-api.com/v4/latest/CHF",
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                rate = data.get("rates", {}).get("EUR", 0.95)  # Fallback to ~0.95
                exchange_rate_cache["CHF_EUR"] = rate
                exchange_rate_cache["last_updated"] = now
                logger.info(f"Exchange rate updated: 1 CHF = {rate} EUR")
                return rate
    except Exception as e:
        logger.error(f"Failed to fetch exchange rate: {e}")
    
    # Fallback rate if API fails
    if exchange_rate_cache["CHF_EUR"] is not None:
        return exchange_rate_cache["CHF_EUR"]
    return 0.95  # Default fallback

async def convert_chf_to_eur_with_margin(chf_amount: float, rate: float) -> float:
    """Convert CHF to EUR with margin from database"""
    margin = await get_chf_eur_margin()
    base_conversion = chf_amount * rate
    return round(base_conversion * (1 + margin), 2)

def convert_chf_to_eur(chf_amount: float, rate: float, margin: float = 0) -> float:
    """Convert CHF to EUR with optional margin"""
    base_conversion = chf_amount * rate
    if margin > 0:
        return round(base_conversion * (1 + margin), 2)
    return round(base_conversion, 2)

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
    currency: str = "EUR"  # Currency for price (EUR or CHF)
    auto_delete_hours: int = 24  # Auto-delete after X hours if not sold (0 = no auto-delete)

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
    auto_delete_at: Optional[str] = None  # Auto-delete time if not sold
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
    original_currency: str = "EUR"  # Currency of original price (EUR or CHF)

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
    document_url: Optional[str] = None  # URL to uploaded RDW document
    document_filename: Optional[str] = None  # Original filename
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

# ============ PRICE PROPOSAL MODELS ============

class PriceProposalCreate(BaseModel):
    motorcycle_id: str
    proposed_price: float
    reason: str = ""

class PriceProposal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    motorcycle_id: str
    dealer_id: str
    dealer_company: str
    dealer_email: str
    original_price: float
    proposed_price: float
    reason: str = ""
    status: str = "pending"  # pending, accepted, rejected, counter
    admin_response: str = ""
    counter_price: Optional[float] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None

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

def create_notification_token(user_id: str, email: str, role: str) -> str:
    """Create a token for push notification auto-login (24 hours)"""
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "type": "notification",
        "exp": datetime.now(timezone.utc).timestamp() + 86400  # 24 hours (was 10 min)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_permanent_login_token(user_id: str) -> str:
    """Create a permanent auto-login token that never expires (stored in user profile)"""
    # Generate a unique token ID
    token_id = str(uuid.uuid4())
    payload = {
        "user_id": user_id,
        "token_id": token_id,
        "type": "permanent",
        # No expiration - permanent token
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_short_code() -> str:
    """Generate a short 8-character alphanumeric code for easy login links"""
    import random
    import string
    # Use only uppercase letters and numbers, excluding confusing characters (0, O, I, 1, L)
    chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return ''.join(random.choice(chars) for _ in range(8))

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Update last_active timestamp for activity tracking (fire-and-forget)
        try:
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
            )
        except Exception:
            pass  # Non-critical, don't break the request
        
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
    """Send email notification to admin and additional recipients"""
    # Primary admin email
    await send_email(ADMIN_EMAIL, subject, html_content)
    
    # Additional recipient for sales notifications
    additional_sales_email = "daniel2002jay@hotmail.com"
    try:
        await send_email(additional_sales_email, subject, html_content)
    except Exception as e:
        logger.error(f"Failed to send to additional recipient: {e}")

# ============ EXCHANGE RATE ENDPOINTS ============

@api_router.get("/exchange-rate/chf-eur")
async def get_exchange_rate():
    """Get current CHF to EUR exchange rate with margin info"""
    rate = await get_chf_to_eur_rate()
    margin = await get_chf_eur_margin()
    margin_percent = margin * 100
    
    # Example calculation with margin
    example_chf = 10000
    example_eur_base = round(example_chf * rate, 2)
    example_eur_with_margin = round(example_chf * rate * (1 + margin), 2)
    
    return {
        "from": "CHF",
        "to": "EUR",
        "rate": rate,
        "margin": margin,
        "margin_percent": margin_percent,
        "effective_rate": round(rate * (1 + margin), 4),
        "example": f"CHF {example_chf:,} = €{example_eur_base:,} + {margin_percent}% marge = €{example_eur_with_margin:,}"
    }

@api_router.get("/exchange-rate/margin")
async def get_margin():
    """Get current CHF to EUR margin"""
    margin = await get_chf_eur_margin()
    return {
        "margin": margin,
        "margin_percent": margin * 100,
        "default_margin": DEFAULT_CHF_EUR_MARGIN,
        "default_margin_percent": DEFAULT_CHF_EUR_MARGIN * 100
    }

@api_router.put("/exchange-rate/margin")
async def update_margin(margin_percent: float, user: dict = Depends(require_admin)):
    """Update CHF to EUR margin (admin only)"""
    if margin_percent < 0 or margin_percent > 50:
        raise HTTPException(status_code=400, detail="Marge moet tussen 0% en 50% liggen")
    
    margin = margin_percent / 100  # Convert percentage to decimal
    await set_chf_eur_margin(margin)
    
    return {
        "message": f"Marge bijgewerkt naar {margin_percent}%",
        "margin": margin,
        "margin_percent": margin_percent
    }

@api_router.post("/exchange-rate/convert")
async def convert_currency(amount: float, from_currency: str = "CHF", to_currency: str = "EUR"):
    """Convert currency amount with margin"""
    margin = await get_chf_eur_margin()
    
    if from_currency == "CHF" and to_currency == "EUR":
        rate = await get_chf_to_eur_rate()
        converted = convert_chf_to_eur(amount, rate, margin)
        return {
            "original_amount": amount,
            "original_currency": from_currency,
            "converted_amount": converted,
            "converted_currency": to_currency,
            "rate": rate,
            "margin_percent": margin * 100
        }
    elif from_currency == "EUR" and to_currency == "CHF":
        rate = await get_chf_to_eur_rate()
        converted = round(amount / rate, 2) if rate > 0 else amount
        return {
            "original_amount": amount,
            "original_currency": from_currency,
            "converted_amount": converted,
            "converted_currency": to_currency,
            "rate": 1/rate if rate > 0 else 1
        }
    else:
        raise HTTPException(status_code=400, detail="Only CHF/EUR conversion supported")

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

class NotificationAutoLogin(BaseModel):
    token: str

@api_router.post("/auth/notification-login")
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

@api_router.post("/auth/accept-terms")
async def accept_terms(user: dict = Depends(get_current_user)):
    """Accept terms and conditions"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"terms_accepted": True, "terms_accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Voorwaarden geaccepteerd", "terms_accepted": True}

@api_router.post("/auth/generate-permanent-link")
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
    base_url = os.environ.get("FRONTEND_URL", "https://motoimportbv.nl")
    permanent_url = f"{base_url}/login?code={short_code}"
    
    return {
        "permanent_url": permanent_url,
        "short_code": short_code,
        "token": permanent_token,
        "message": "Permanente login link aangemaakt"
    }

@api_router.get("/auth/my-permanent-link")
async def get_my_permanent_link(user: dict = Depends(get_current_user)):
    """Get the user's permanent login link"""
    permanent_token = user.get("permanent_login_token")
    short_code = user.get("login_short_code")
    
    if not permanent_token or not short_code:
        return {"has_permanent_link": False, "permanent_url": None}
    
    # Use query parameter format (works better with iOS bookmarks)
    base_url = os.environ.get("FRONTEND_URL", "https://motoimportbv.nl")
    permanent_url = f"{base_url}/login?code={short_code}"
    
    return {
        "has_permanent_link": True,
        "permanent_url": permanent_url,
        "short_code": short_code,
        "created_at": user.get("permanent_link_created_at")
    }

class PermanentLoginRequest(BaseModel):
    token: str

class ShortCodeLoginRequest(BaseModel):
    code: str

@api_router.post("/auth/permanent-login")
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

@api_router.post("/auth/shortcode-login")
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

@api_router.get("/auth/shortcode/{code}")
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

@api_router.post("/auth/revoke-permanent-link")
async def revoke_permanent_link(user: dict = Depends(get_current_user)):
    """Revoke the user's permanent login link"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$unset": {"permanent_login_token": "", "permanent_link_created_at": ""}}
    )
    return {"message": "Permanente login link ingetrokken"}

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
    
    # Bereken auto-delete time (standaard 24 uur)
    auto_delete_at = None
    if data.auto_delete_hours > 0:
        auto_delete_at = (datetime.now(timezone.utc) + timedelta(hours=data.auto_delete_hours)).isoformat()
    
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
        created_by=user["id"],
        auto_delete_at=auto_delete_at
    )
    doc = motorcycle.model_dump()
    await db.motorcycles.insert_one(doc)
    
    # Get Dutch dealers only (not foreign dealers) for notifications
    dutch_dealers = await db.users.find({
        "role": "dealer", 
        "is_approved": True,
        "is_foreign_dealer": {"$ne": True}
    }, {"_id": 0}).to_list(1000)
    
    if dutch_dealers:
        # Create in-app notifications only for Dutch dealers
        notifications = [
            Notification(
                user_id=dealer["id"],
                type="new_motorcycle",
                title="Nieuwe motor toegevoegd",
                message=f"{motorcycle.brand} {motorcycle.model} ({motorcycle.year}) - Koop Nu voor €{motorcycle.price:,.0f}",
                motorcycle_id=motorcycle.id
            ).model_dump()
            for dealer in dutch_dealers
        ]
        await db.notifications.insert_many(notifications)
        
        # Send email notifications only to Dutch dealers (not foreign)
        asyncio.create_task(notify_dealers_new_motorcycle_email(motorcycle, dutch_dealers))
        
        # NOTE: Automatic SMS is disabled - use SMS Broadcast page to manually select recipients
        # Twilio trial accounts can only send to verified numbers
        # asyncio.create_task(notify_dealers_new_motorcycle_sms(motorcycle, dutch_dealers))
        
        # Log notification sent
        logger.info(f"Notified {len(dutch_dealers)} Dutch dealers about new motorcycle {motorcycle.brand} {motorcycle.model}")
    
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
    
    # Get currency - default to CHF for Swiss dealers
    currency = data.currency.upper() if data.currency else "CHF"
    if currency not in ["EUR", "CHF"]:
        currency = "CHF"
    
    # Store original price and convert to EUR if needed for display
    original_price = data.price
    display_price = data.price
    
    if currency == "CHF":
        # Convert CHF to EUR for display price (with margin)
        rate = await get_chf_to_eur_rate()
        margin = await get_chf_eur_margin()
        display_price = convert_chf_to_eur(data.price, rate, margin)
    
    motorcycle = Motorcycle(
        brand=data.brand,
        model=data.model,
        year=data.year,
        price=display_price,  # EUR price for display (with margin)
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
        original_price=original_price,
        original_currency=currency
    )
    doc = motorcycle.model_dump()
    await db.motorcycles.insert_one(doc)
    
    # Format price display for email
    price_display = f"CHF {original_price:,.0f}" if currency == "CHF" else f"€{original_price:,.0f}"
    eur_display = f"€{display_price:,.0f}" if currency == "CHF" else ""
    
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
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Inkoopprijs ({currency})</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7; font-weight: bold;">{price_display} {f'(≈ {eur_display})' if eur_display else ''}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;"><strong>Kilometerstand</strong></td>
                    <td style="padding: 12px; border: 1px solid #e4e4e7;">{motorcycle.mileage:,} km</td>
                </tr>
            </table>
            <p style="margin-top: 15px; color: #6b7280;">Log in om de verkoopprijs aan te passen en de motor te activeren.</p>
        </div>
    </div>
    """
    await send_admin_notification(f"🌍 Nieuwe Motor van {user.get('company_name', 'Buitenlandse Dealer')}", admin_html)
    
    return {"message": "Motor ingediend voor beoordeling", "motorcycle_id": motorcycle.id}

@api_router.get("/motorcycles/{motorcycle_id}/whatsapp-share")
async def get_whatsapp_share_link(motorcycle_id: str, user: dict = Depends(require_admin)):
    """Generate a WhatsApp share link with auto-login tokens for all dealers"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Get the base URL from environment or use default
    base_url = os.environ.get("FRONTEND_URL", "https://motoimportbv.nl")
    
    # Create a generic share message (dealers will get auto-login when they click their personalized link)
    brand = motorcycle.get("brand", "")
    model = motorcycle.get("model", "")
    year = motorcycle.get("year", "")
    price = motorcycle.get("price", 0)
    mileage = motorcycle.get("mileage", 0)
    condition = motorcycle.get("condition", "goed").title()
    vin = motorcycle.get("vin", "")
    
    # Build the message
    message = f"""🏍️ *NIEUWE MOTOR BESCHIKBAAR*

*{brand} {model}* ({year})

💰 Prijs: €{price:,.0f}
📍 KM-stand: {mileage:,} km
⭐ Conditie: {condition}
🔑 Chassisnr: {vin if vin else 'Zie website'}

👉 Bekijk en bestel direct:
{base_url}/motorcycle/{motorcycle_id}

_Moto Import - Uw partner in motoren_"""

    # URL encode the message for WhatsApp
    import urllib.parse
    encoded_message = urllib.parse.quote(message)
    
    whatsapp_url = f"https://wa.me/?text={encoded_message}"
    
    return {
        "whatsapp_url": whatsapp_url,
        "message": message,
        "motorcycle_id": motorcycle_id
    }

@api_router.get("/motorcycles/{motorcycle_id}/whatsapp-share-personal")
async def get_personal_whatsapp_share(motorcycle_id: str, dealer_id: str, user: dict = Depends(require_admin)):
    """Generate a personalized WhatsApp share link with auto-login for a specific dealer"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    dealer = await db.users.find_one({"id": dealer_id}, {"_id": 0, "password_hash": 0})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer niet gevonden")
    
    # Create auto-login token for this dealer
    auto_token = create_notification_token(dealer["id"], dealer.get("email", ""), dealer.get("role", "dealer"))
    
    # Get the base URL
    base_url = os.environ.get("FRONTEND_URL", "https://motoimportbv.nl")
    
    # Build personalized URL with auto-login
    auto_login_url = f"{base_url}/auto-login?token={auto_token}&redirect=/motorcycle/{motorcycle_id}"
    
    brand = motorcycle.get("brand", "")
    model = motorcycle.get("model", "")
    year = motorcycle.get("year", "")
    price = motorcycle.get("price", 0)
    
    message = f"""🏍️ *NIEUWE MOTOR*

*{brand} {model}* ({year})
💰 €{price:,.0f}

👉 Klik hier om direct te bekijken:
{auto_login_url}

_Moto Import_"""

    import urllib.parse
    encoded_message = urllib.parse.quote(message)
    
    # If dealer has a phone number, create direct link
    phone = dealer.get("phone", "").replace(" ", "").replace("-", "")
    if phone:
        whatsapp_url = f"https://wa.me/{phone}?text={encoded_message}"
    else:
        whatsapp_url = f"https://wa.me/?text={encoded_message}"
    
    return {
        "whatsapp_url": whatsapp_url,
        "message": message,
        "dealer_phone": phone,
        "dealer_company": dealer.get("company_name", "")
    }

@api_router.get("/motorcycles/{motorcycle_id}/whatsapp-share-all-dealers")
async def get_whatsapp_share_all_dealers(motorcycle_id: str, user: dict = Depends(require_admin)):
    """Get WhatsApp share links for DUTCH dealers only (not foreign dealers) with phone numbers"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Get only Dutch approved dealers with phone numbers (exclude foreign dealers)
    dealers = await db.users.find(
        {
            "role": "dealer", 
            "is_approved": True, 
            "phone": {"$exists": True, "$ne": ""},
            "is_foreign_dealer": {"$ne": True}  # Only Dutch dealers
        },
        {"_id": 0, "id": 1, "company_name": 1, "phone": 1, "email": 1}
    ).to_list(500)
    
    base_url = os.environ.get("FRONTEND_URL", "https://motoimportbv.nl")
    
    # Create message
    message = f"""🏍️ *Nieuwe Motor Beschikbaar!*

*{motorcycle.get('brand', '')} {motorcycle.get('model', '')}*
• Jaar: {motorcycle.get('year', '')}
• KM stand: {motorcycle.get('mileage', 0):,} km
• Prijs: €{motorcycle.get('price', 0):,.0f}

👉 Bekijk direct: {base_url}/dealer/motorcycles/{motorcycle_id}

_Moto Import BV_"""
    
    encoded_message = urllib.parse.quote(message)
    
    dealer_links = []
    for dealer in dealers:
        phone = dealer.get("phone", "").replace(" ", "").replace("-", "").replace("+", "")
        if not phone.startswith("31") and not phone.startswith("32") and not phone.startswith("41"):
            if phone.startswith("0"):
                phone = "31" + phone[1:]  # Dutch number
        
        if phone:
            dealer_links.append({
                "dealer_id": dealer.get("id"),
                "company_name": dealer.get("company_name", dealer.get("email", "")),
                "phone": phone,
                "whatsapp_url": f"https://wa.me/{phone}?text={encoded_message}"
            })
    
    return {
        "motorcycle": {
            "id": motorcycle_id,
            "brand": motorcycle.get("brand"),
            "model": motorcycle.get("model"),
            "price": motorcycle.get("price")
        },
        "message": message,
        "dealers": dealer_links,
        "total_dealers": len(dealer_links)
    }

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
        
        # Create a simple motorcycle object for notifications
        class MotorcycleNotify:
            def __init__(self, moto, new_price):
                self.id = moto.get('id')
                self.brand = moto.get('brand', '')
                self.model = moto.get('model', '')
                self.year = moto.get('year', '')
                self.price = new_price
                self.mileage = moto.get('mileage', 0)
                self.color = moto.get('color', '')
        
        moto_notify = MotorcycleNotify(motorcycle, price)
        
        # Send email notifications to Dutch dealers
        asyncio.create_task(notify_dealers_new_motorcycle_email(moto_notify, dealers))
        
        # NOTE: Automatic SMS is disabled - use SMS Broadcast page to manually select recipients
        # Twilio trial accounts can only send to verified numbers
        # asyncio.create_task(notify_dealers_new_motorcycle_sms(moto_notify, dealers))
    
    return {"message": "Motor geactiveerd", "price": price}

async def notify_dealers_new_motorcycle_email(motorcycle, dealers):
    """Send email notifications to DUTCH dealers only (not foreign dealers) about a new motorcycle"""
    # Always use production URL for email links
    base_url = os.environ.get("BASE_URL", "https://www.motoimportbv.nl")
    
    for dealer in dealers:
        # Skip dealers without email, who are offline, or who are foreign dealers
        # Foreign dealers should NOT receive notifications about new motorcycles
        if not dealer.get("email") or dealer.get("is_offline", False) or dealer.get("is_foreign_dealer", False):
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

async def notify_dealers_new_motorcycle_sms(motorcycle, dealers):
    """Send SMS notifications to Dutch dealers with phone numbers about a new motorcycle"""
    if not twilio_client:
        logger.warning("Twilio client not configured - skipping SMS notifications")
        return
    
    base_url = os.environ.get("BASE_URL", "https://www.motoimportbv.nl")
    
    # Short SMS message
    message = f"""🏍️ NIEUWE MOTOR bij Moto Import!

{motorcycle.brand} {motorcycle.model} ({motorcycle.year})
💰 €{motorcycle.price:,.0f}
📍 {motorcycle.mileage:,} km

Bekijk: {base_url}/motorcycle/{motorcycle.id}"""

    sent_count = 0
    for dealer in dealers:
        phone = dealer.get("phone", "")
        if not phone:
            continue
        
        # Skip foreign dealers
        if dealer.get("is_foreign_dealer", False):
            continue
            
        # Format phone number
        phone = phone.replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            if phone.startswith("0"):
                phone = "+31" + phone[1:]  # Dutch number
            elif phone.startswith("31"):
                phone = "+" + phone
            else:
                phone = "+" + phone
        
        try:
            twilio_client.messages.create(
                body=message,
                from_=TWILIO_PHONE_NUMBER,
                to=phone
            )
            sent_count += 1
            logger.info(f"SMS sent to {dealer.get('company_name')} ({phone})")
            # Delay between SMS to avoid rate limiting
            await asyncio.sleep(0.5)
        except Exception as e:
            logger.error(f"Failed to send SMS to {phone}: {e}")
    
    logger.info(f"Sent {sent_count} SMS notifications for new motorcycle {motorcycle.brand} {motorcycle.model}")

@api_router.get("/motorcycles")
async def get_motorcycles(user: dict = Depends(require_approved_dealer)):
    motorcycles = await db.motorcycles.find({}, {"_id": 0}).to_list(1000)
    
    # Get current exchange rate and margin for CHF motorcycles
    chf_eur_rate = await get_chf_to_eur_rate()
    margin = await get_chf_eur_margin()
    
    # Process motorcycles
    for m in motorcycles:
        # Add default starting_price if missing
        if "starting_price" not in m or m["starting_price"] is None:
            m["starting_price"] = m.get("price", 0) * 0.8
        
        # Real-time price conversion for CHF motorcycles (unless admin has overridden)
        if m.get("original_currency") == "CHF" and m.get("original_price") and not m.get("price_override"):
            m["price"] = convert_chf_to_eur(m["original_price"], chf_eur_rate, margin)
            m["starting_price"] = round(m["price"] * 0.8, 2)
            m["exchange_rate"] = chf_eur_rate
            m["margin_percent"] = margin * 100
            m["price_updated_live"] = True
        elif m.get("price_override") and m.get("price_override_amount"):
            m["price"] = m["price_override_amount"]
            m["price_override_active"] = True
    
    return motorcycles

@api_router.get("/motorcycles/with-exchange-rate")
async def get_motorcycles_with_exchange_rate(user: dict = Depends(require_approved_dealer)):
    """Get motorcycles with real-time CHF to EUR conversion for foreign listings"""
    motorcycles = await db.motorcycles.find({}, {"_id": 0}).to_list(1000)
    
    # Get current exchange rate and margin
    chf_eur_rate = await get_chf_to_eur_rate()
    margin = await get_chf_eur_margin()
    
    result = []
    for m in motorcycles:
        # Add default starting_price if missing
        if "starting_price" not in m or m["starting_price"] is None:
            m["starting_price"] = m.get("price", 0) * 0.8
        
        # Real-time price conversion for CHF motorcycles (unless admin has overridden)
        if m.get("original_currency") == "CHF" and m.get("original_price") and not m.get("price_override"):
            m["price"] = convert_chf_to_eur(m["original_price"], chf_eur_rate, margin)
            m["starting_price"] = round(m["price"] * 0.8, 2)
            m["exchange_rate"] = chf_eur_rate
            m["margin_percent"] = margin * 100
        elif m.get("price_override") and m.get("price_override_amount"):
            m["price"] = m["price_override_amount"]
            m["price_override_active"] = True
        
        result.append(m)
    
    return {"motorcycles": result, "exchange_rate": {"CHF_EUR": chf_eur_rate}, "margin_percent": margin * 100}

@api_router.get("/motorcycles/available")
async def get_available_motorcycles(user: dict = Depends(require_approved_dealer)):
    # For dealers, exclude their own listings from the available motorcycles
    query = {"is_available": True}
    if user["role"] == "dealer":
        query["seller_id"] = {"$ne": user["id"]}  # Don't show own listings
    
    motorcycles = await db.motorcycles.find(query, {"_id": 0}).to_list(1000)
    
    # Get current exchange rate and margin for CHF motorcycles
    chf_eur_rate = await get_chf_to_eur_rate()
    margin = await get_chf_eur_margin()
    
    # Process motorcycles - recalculate EUR prices for CHF motorcycles
    for m in motorcycles:
        # Add default starting_price if missing
        if "starting_price" not in m or m["starting_price"] is None:
            m["starting_price"] = m.get("price", 0) * 0.8
        
        # Real-time price conversion for CHF motorcycles (unless admin has overridden)
        if m.get("original_currency") == "CHF" and m.get("original_price") and not m.get("price_override"):
            # Calculate current EUR price based on live rate + margin
            m["price"] = convert_chf_to_eur(m["original_price"], chf_eur_rate, margin)
            m["starting_price"] = round(m["price"] * 0.8, 2)
            # Add exchange info for frontend display
            m["exchange_rate"] = chf_eur_rate
            m["margin_percent"] = margin * 100
            m["price_updated_live"] = True
        elif m.get("price_override") and m.get("price_override_amount"):
            # Use admin's override price
            m["price"] = m["price_override_amount"]
            m["price_override_active"] = True
    
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

@api_router.get("/motorcycles/{motorcycle_id}/public")
async def get_motorcycle_public(motorcycle_id: str):
    """Get motorcycle details without authentication (for sharing links)"""
    # First try to find with is_active=True, then try without the filter
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id, "is_active": True}, {"_id": 0})
    if not motorcycle:
        # Try without is_active filter (for older motorcycles without this field)
        motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Add default starting_price if missing
    if "starting_price" not in motorcycle or motorcycle["starting_price"] is None:
        motorcycle["starting_price"] = motorcycle.get("price", 0) * 0.8
    return motorcycle

@api_router.get("/motorcycles/{motorcycle_id}")
async def get_motorcycle(motorcycle_id: str, user: dict = Depends(require_approved_dealer)):
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motorcycle not found")
    
    # Add default starting_price if missing
    if "starting_price" not in motorcycle or motorcycle["starting_price"] is None:
        motorcycle["starting_price"] = motorcycle.get("price", 0) * 0.8
    
    # Real-time price conversion for CHF motorcycles (unless admin has overridden)
    if motorcycle.get("original_currency") == "CHF" and motorcycle.get("original_price") and not motorcycle.get("price_override"):
        chf_eur_rate = await get_chf_to_eur_rate()
        margin = await get_chf_eur_margin()
        motorcycle["price"] = convert_chf_to_eur(motorcycle["original_price"], chf_eur_rate, margin)
        motorcycle["starting_price"] = round(motorcycle["price"] * 0.8, 2)
        motorcycle["exchange_rate"] = chf_eur_rate
        motorcycle["margin_percent"] = margin * 100
        motorcycle["price_updated_live"] = True
    elif motorcycle.get("price_override") and motorcycle.get("price_override_amount"):
        motorcycle["price"] = motorcycle["price_override_amount"]
        motorcycle["price_override_active"] = True
    
    return motorcycle

@api_router.put("/motorcycles/{motorcycle_id}", response_model=Motorcycle)
async def update_motorcycle(motorcycle_id: str, data: MotorcycleUpdate, user: dict = Depends(require_admin)):
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motorcycle not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    # If admin manually sets price on a CHF motorcycle, mark it as overridden
    # This prevents live exchange rate from overwriting the admin's price
    if "price" in update_data and motorcycle.get("original_currency") == "CHF":
        update_data["price_override"] = True
        update_data["price_override_amount"] = update_data["price"]
        logger.info(f"Admin override price for CHF motorcycle {motorcycle_id}: €{update_data['price']}")
    
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
        # Admin ziet alleen orders van de laatste 24 uur (niet gearchiveerd)
        twenty_four_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        orders = await db.orders.find(
            {"created_at": {"$gte": twenty_four_hours_ago}, "archived": {"$ne": True}}, 
            {"_id": 0}
        ).to_list(1000)
    else:
        # Dealers zien al hun orders (geen tijdslimiet, niet gearchiveerd)
        orders = await db.orders.find(
            {"dealer_id": user["id"], "archived": {"$ne": True}}, 
            {"_id": 0}
        ).to_list(1000)
    
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

@api_router.delete("/orders/{order_id}")
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

@api_router.put("/orders/{order_id}/archive")
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

@api_router.put("/orders/{order_id}/restore")
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

@api_router.get("/orders/archived", response_model=List[OrderWithMotorcycle])
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
    # Foreign dealers cannot use vouchers
    if user.get("is_foreign_dealer"):
        raise HTTPException(status_code=403, detail="Buitenlandse leveranciers kunnen geen vouchers gebruiken")
    
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
                    <p style="margin: 5px 0;">Horsterhoekweg 11, 7433 SV Schalkhaar</p>
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
    # Always use production URL for any links
    base_url = os.environ.get("BASE_URL", "https://www.motoimportbv.nl")
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
        # Always use production URL for email links
        base_url = os.environ.get("BASE_URL", "https://www.motoimportbv.nl")
        
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

# ============ PRICE PROPOSAL ENDPOINTS ============

@api_router.post("/price-proposals")
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
        reason=data.reason
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
                
                <div style="margin-top: 25px; text-align: center;">
                    <a href="https://www.motoimportbv.nl/admin/price-proposals" 
                       style="display: inline-block; background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Bekijk Voorstellen
                    </a>
                </div>
            </div>
            
            <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
                <p>Moto Import B.V. | Horsterhoekweg 11, 7433 SV Schalkhaar</p>
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


@api_router.get("/price-proposals")
async def get_price_proposals(user: dict = Depends(require_admin)):
    """Admin gets all price proposals"""
    proposals = await db.price_proposals.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with motorcycle info
    for proposal in proposals:
        motorcycle = await db.motorcycles.find_one({"id": proposal.get("motorcycle_id")}, {"_id": 0, "brand": 1, "model": 1, "year": 1, "images": 1, "price": 1, "is_available": 1})
        proposal["motorcycle"] = motorcycle
    
    return proposals


@api_router.get("/price-proposals/my")
async def get_my_price_proposals(user: dict = Depends(get_current_user)):
    """Dealer gets their own price proposals"""
    proposals = await db.price_proposals.find({"dealer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Enrich with motorcycle info
    for proposal in proposals:
        motorcycle = await db.motorcycles.find_one({"id": proposal.get("motorcycle_id")}, {"_id": 0, "brand": 1, "model": 1, "year": 1, "images": 1})
        proposal["motorcycle"] = motorcycle
    
    return proposals


@api_router.put("/price-proposals/{proposal_id}/respond")
async def respond_to_proposal(proposal_id: str, response: str, admin_message: str = "", counter_price: float = None, user: dict = Depends(require_admin)):
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
    
    await db.price_proposals.update_one({"id": proposal_id}, {"$set": update_data})
    
    # Get motorcycle info
    motorcycle = await db.motorcycles.find_one({"id": proposal.get("motorcycle_id")}, {"_id": 0})
    
    # Get dealer info
    dealer = await db.users.find_one({"id": proposal.get("dealer_id")}, {"_id": 0, "password_hash": 0})
    
    # If ACCEPTED: Create order, mark as sold, send pakbon
    if response == "accepted":
        # Create order with the accepted price
        order_id = str(uuid.uuid4())
        order = {
            "id": order_id,
            "motorcycle_id": proposal.get("motorcycle_id"),
            "dealer_id": proposal.get("dealer_id"),
            "price": proposal.get("proposed_price"),  # Use the accepted proposal price
            "original_price": proposal.get("original_price"),
            "discount_amount": proposal.get("original_price", 0) - proposal.get("proposed_price", 0),
            "status": "confirmed",
            "payment_status": "pending",
            "needs_delivery": False,
            "delivery_cost": 0,
            "order_type": "price_proposal",
            "proposal_id": proposal_id,
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
                <p style="margin: 0; color: #666;">Horsterhoekweg 11, 7433 SV Schalkhaar</p>
                <p style="margin: 5px 0; color: #666;">📞 +31 6 81792660 | ✉️ motoimportbv@gmail.com</p>
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
                <p>Moto Import B.V. | +31 6 81792660 | motoimportbv@gmail.com</p>
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


@api_router.get("/price-proposals/count")
async def get_pending_proposals_count(user: dict = Depends(require_admin)):
    """Get count of pending proposals for admin badge"""
    count = await db.price_proposals.count_documents({"status": "pending"})
    return {"count": count}


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
    
    # Always use production URL for email links
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

class CreateAdminRequest(BaseModel):
    email: str
    password: str
    company_name: str = "Moto Import Admin"

@api_router.post("/admin/create-admin")
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

class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str

@api_router.post("/admin/reset-password")
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

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
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

class DealerPhoneUpdate(BaseModel):
    phone: str

@api_router.put("/dealers/{dealer_id}/phone")
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


@api_router.delete("/notifications/all")
async def delete_all_notifications(user: dict = Depends(get_current_user)):
    await db.notifications.delete_many({"user_id": user["id"]})
    return {"message": "All notifications deleted"}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, user: dict = Depends(get_current_user)):
    result = await db.notifications.delete_one({"id": notification_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}


# ============ SMS NOTIFICATION ENDPOINTS ============

async def send_sms_to_dealer(phone_number: str, message: str) -> dict:
    """Send SMS to a single phone number using Twilio"""
    if not twilio_client:
        logger.warning("Twilio client not initialized - SMS disabled")
        return {"success": False, "error": "SMS niet geconfigureerd"}
    
    if not TWILIO_PHONE_NUMBER:
        logger.warning("Twilio phone number not configured")
        return {"success": False, "error": "Twilio telefoonnummer niet geconfigureerd"}
    
    try:
        # Normalize phone number (ensure it starts with +)
        if not phone_number.startswith('+'):
            # Assume Dutch number if no country code
            if phone_number.startswith('0'):
                phone_number = '+31' + phone_number[1:]
            else:
                phone_number = '+' + phone_number
        
        # Send SMS via Twilio
        sms = twilio_client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=phone_number
        )
        
        logger.info(f"SMS sent to {phone_number}, SID: {sms.sid}")
        return {"success": True, "sid": sms.sid, "status": sms.status}
    
    except Exception as e:
        logger.error(f"Failed to send SMS to {phone_number}: {e}")
        return {"success": False, "error": str(e)}

async def send_sms_to_all_dealers(message: str, exclude_user_id: str = None) -> dict:
    """Send SMS to all active dealers with phone numbers"""
    if not twilio_client:
        return {"success": False, "error": "SMS niet geconfigureerd", "sent": 0, "failed": 0}
    
    # Get all active dealers with phone numbers
    query = {
        "role": "dealer",
        "is_offline": {"$ne": True},
        "phone": {"$exists": True, "$ne": "", "$ne": None}
    }
    
    if exclude_user_id:
        query["id"] = {"$ne": exclude_user_id}
    
    dealers = await db.users.find(query, {"_id": 0, "phone": 1, "company_name": 1, "id": 1}).to_list(1000)
    
    sent_count = 0
    failed_count = 0
    results = []
    
    for dealer in dealers:
        phone = dealer.get("phone")
        if phone:
            result = await send_sms_to_dealer(phone, message)
            if result.get("success"):
                sent_count += 1
            else:
                failed_count += 1
            results.append({
                "dealer": dealer.get("company_name", "Unknown"),
                "phone": phone,
                "result": result
            })
            # Small delay to avoid rate limiting
            await asyncio.sleep(0.2)
    
    return {
        "success": True,
        "sent": sent_count,
        "failed": failed_count,
        "total_dealers": len(dealers),
        "details": results
    }

class SMSRequest(BaseModel):
    phone_number: str
    message: str

class BulkSMSRequest(BaseModel):
    message: str

class SelectedSMSRequest(BaseModel):
    message: str
    dealer_ids: List[str]

@api_router.post("/sms/send")
async def send_single_sms(data: SMSRequest, user: dict = Depends(require_admin)):
    """Send SMS to a single phone number (admin only)"""
    result = await send_sms_to_dealer(data.phone_number, data.message)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "SMS verzenden mislukt"))
    return result

@api_router.post("/sms/send-to-selected")
async def send_sms_to_selected_dealers(data: SelectedSMSRequest, user: dict = Depends(require_admin)):
    """Send SMS to selected dealers only (admin only)"""
    if not twilio_client:
        raise HTTPException(status_code=400, detail="SMS niet geconfigureerd")
    
    if not data.dealer_ids:
        raise HTTPException(status_code=400, detail="Geen dealers geselecteerd")
    
    # Get selected dealers
    dealers = await db.users.find(
        {
            "id": {"$in": data.dealer_ids},
            "role": "dealer",
            "is_approved": True,
            "phone": {"$exists": True, "$ne": ""}
        },
        {"_id": 0, "id": 1, "company_name": 1, "phone": 1}
    ).to_list(500)
    
    sent_count = 0
    failed_count = 0
    results = []
    
    for dealer in dealers:
        phone = dealer.get("phone", "").replace(" ", "").replace("-", "")
        if not phone:
            continue
            
        # Format phone number
        if not phone.startswith("+"):
            if phone.startswith("0"):
                phone = "+31" + phone[1:]
            elif phone.startswith("31"):
                phone = "+" + phone
            else:
                phone = "+" + phone
        
        try:
            twilio_client.messages.create(
                body=data.message,
                from_=TWILIO_PHONE_NUMBER,
                to=phone
            )
            sent_count += 1
            results.append({"dealer": dealer.get("company_name"), "status": "sent"})
            logger.info(f"SMS sent to {dealer.get('company_name')} ({phone})")
            await asyncio.sleep(0.3)
        except Exception as e:
            failed_count += 1
            results.append({"dealer": dealer.get("company_name"), "status": "failed", "error": str(e)})
            logger.error(f"Failed to send SMS to {phone}: {e}")
    
    return {
        "sent": sent_count,
        "failed": failed_count,
        "total": len(dealers),
        "results": results
    }

@api_router.post("/sms/send-all")
async def send_sms_to_all(data: BulkSMSRequest, user: dict = Depends(require_admin)):
    """Send SMS to all active dealers (admin only)"""
    result = await send_sms_to_all_dealers(data.message)
    return result

@api_router.get("/sms/status")
async def get_sms_status(user: dict = Depends(require_admin)):
    """Check if SMS is configured and working"""
    is_configured = bool(twilio_client and TWILIO_PHONE_NUMBER)
    
    # Count dealers with phone numbers
    dealers_with_phone = await db.users.count_documents({
        "role": "dealer",
        "is_offline": {"$ne": True},
        "phone": {"$exists": True, "$ne": "", "$ne": None}
    })
    
    return {
        "configured": is_configured,
        "twilio_account": bool(TWILIO_ACCOUNT_SID),
        "twilio_phone": bool(TWILIO_PHONE_NUMBER),
        "dealers_with_phone": dealers_with_phone
    }

@api_router.get("/motorcycles/{motorcycle_id}/sms-share")
async def get_sms_share_message(motorcycle_id: str, user: dict = Depends(require_admin)):
    """Generate SMS message for sharing a motorcycle and get list of Dutch dealers with phone"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    # Get Dutch dealers with phone numbers (exclude foreign dealers)
    dealers = await db.users.find(
        {
            "role": "dealer", 
            "is_approved": True, 
            "phone": {"$exists": True, "$ne": ""},
            "is_foreign_dealer": {"$ne": True}
        },
        {"_id": 0, "id": 1, "company_name": 1, "phone": 1}
    ).to_list(500)
    
    base_url = os.environ.get("FRONTEND_URL", "https://motoimportbv.nl")
    
    brand = motorcycle.get("brand", "")
    model = motorcycle.get("model", "")
    year = motorcycle.get("year", "")
    price = motorcycle.get("price", 0)
    
    message = f"""🏍️ NIEUWE MOTOR: {brand} {model} ({year})
💰 €{price:,.0f}

Bekijk: {base_url}/motorcycle/{motorcycle_id}

- Moto Import"""

    dealer_list = []
    for dealer in dealers:
        phone = dealer.get("phone", "").replace(" ", "").replace("-", "")
        if phone:
            dealer_list.append({
                "dealer_id": dealer.get("id"),
                "company_name": dealer.get("company_name", ""),
                "phone": phone
            })

    return {
        "message": message,
        "motorcycle": {
            "id": motorcycle_id,
            "brand": brand,
            "model": model,
            "year": year,
            "price": price
        },
        "dealers": dealer_list
    }

@api_router.post("/motorcycles/{motorcycle_id}/sms-send-all")
async def send_motorcycle_sms_to_all(motorcycle_id: str, user: dict = Depends(require_admin)):
    """Send SMS about a motorcycle to all Dutch dealers with phone numbers"""
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    base_url = os.environ.get("FRONTEND_URL", "https://motoimportbv.nl")
    
    brand = motorcycle.get("brand", "")
    model = motorcycle.get("model", "")
    year = motorcycle.get("year", "")
    price = motorcycle.get("price", 0)
    mileage = motorcycle.get("mileage", 0)
    
    message = f"""🏍️ NIEUWE MOTOR bij Moto Import!

{brand} {model} ({year})
💰 €{price:,.0f}
📍 {mileage:,} km

Bekijk: {base_url}/motorcycle/{motorcycle_id}"""

    # Get only Dutch dealers
    dealers = await db.users.find(
        {
            "role": "dealer", 
            "is_approved": True, 
            "phone": {"$exists": True, "$ne": ""},
            "is_foreign_dealer": {"$ne": True}
        },
        {"_id": 0, "id": 1, "company_name": 1, "phone": 1}
    ).to_list(500)
    
    sent_count = 0
    failed_count = 0
    
    for dealer in dealers:
        phone = dealer.get("phone", "").replace(" ", "").replace("-", "")
        if phone:
            result = await send_sms_to_dealer(phone, message)
            if result.get("success"):
                sent_count += 1
            else:
                failed_count += 1
            await asyncio.sleep(0.3)
    
    return {
        "sent": sent_count,
        "failed": failed_count,
        "total": len(dealers)
    }

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
    # Count dealers from users collection (not dealers collection)
    total_dealers = await db.users.count_documents({"role": "dealer"})
    
    return {
        "total_motorcycles": total_motorcycles,
        "available_motorcycles": available_motorcycles,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "total_dealers": total_dealers
    }

@api_router.get("/stats/top-dealers")
async def get_top_dealers(user: dict = Depends(require_admin)):
    """Get most active dealers by login count with last_active time"""
    dealers = await db.users.find(
        {"role": "dealer", "is_approved": True},
        {"_id": 0, "id": 1, "company_name": 1, "email": 1, "login_count": 1, "last_login": 1, "last_active": 1}
    ).sort("login_count", -1).to_list(10)
    
    return dealers

# ============ BULK EMAIL / MARKETING ENDPOINTS ============

class BulkEmailRequest(BaseModel):
    subject: str
    message: str
    recipient_emails: List[str]
    include_about_us: Optional[bool] = False
    flyer_filename: Optional[str] = None

class BulkEmailResponse(BaseModel):
    total: int
    sent: int
    failed: int
    failed_emails: List[str]

# About Us content for marketing emails
ABOUT_US_HTML = """
<div style="background: #f0f4f8; padding: 25px; border-radius: 10px; margin: 20px 0;">
    <h3 style="color: #DC2626; margin-top: 0;">Over Moto Import B.V.</h3>
    <p style="color: #333; line-height: 1.6;">
        Moto Import B.V. is gespecialiseerd in de import en verkoop van kwaliteitsmotoren voor dealers in Europa. 
        Wij bieden een breed assortiment aan motorfietsen tegen competitieve prijzen, met snelle levering en 
        professionele service.
    </p>
    <p style="color: #333; line-height: 1.6;">
        <strong>Waarom kiezen voor Moto Import?</strong>
    </p>
    <ul style="color: #333; line-height: 1.8;">
        <li>✓ Ruim aanbod uit heel Europa</li>
        <li>✓ Scherpe dealerprijzen</li>
        <li>✓ Snelle levering binnen Europa</li>
        <li>✓ Betrouwbare partner sinds jaren</li>
        <li>✓ Persoonlijke service</li>
    </ul>
    <p style="color: #666; font-size: 14px; margin-bottom: 0;">
        <strong>Contact:</strong> +31 6 81792660 | info@motoimportbv.nl<br>
        <strong>Adres:</strong> Horsterhoekweg 11, 7433 SV Schalkhaar, Nederland
    </p>
</div>
"""

async def send_email_with_attachment(to_email: str, subject: str, html_content: str, attachment_path: str = None):
    """Send email via Gmail SMTP with optional PDF attachment"""
    from email.mime.base import MIMEBase
    from email import encoders
    
    if not GMAIL_EMAIL or not GMAIL_APP_PASSWORD:
        logger.error("Gmail credentials not configured")
        return False
    
    try:
        msg = MIMEMultipart()
        msg['From'] = GMAIL_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Attach HTML body
        msg.attach(MIMEText(html_content, 'html'))
        
        # Attach PDF if provided
        if attachment_path and os.path.exists(attachment_path):
            with open(attachment_path, 'rb') as f:
                part = MIMEBase('application', 'pdf')
                part.set_payload(f.read())
                encoders.encode_base64(part)
                filename = os.path.basename(attachment_path)
                part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
                msg.attach(part)
                logger.info(f"Attached file: {filename}")
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_EMAIL, to_email, msg.as_string())
            return True
    except Exception as e:
        logger.error(f"Failed to send email with attachment: {str(e)}")
        return False

@api_router.post("/admin/bulk-email", response_model=BulkEmailResponse)
async def send_bulk_email(data: BulkEmailRequest, user: dict = Depends(require_admin)):
    """Admin sends bulk marketing emails with optional flyer attachment and about us section"""
    sent = 0
    failed = 0
    failed_emails = []
    
    # Build about us section if requested
    about_us_section = ABOUT_US_HTML if data.include_about_us else ""
    
    # Get attachment path if flyer is specified
    attachment_path = None
    if data.flyer_filename:
        flyer_path = ROOT_DIR / "uploads" / data.flyer_filename
        if flyer_path.exists():
            attachment_path = str(flyer_path)
            logger.info(f"Will attach flyer: {data.flyer_filename}")
    
    html_template = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #DC2626; margin: 0;">🏍️ Moto Import</h1>
            <p style="color: #666; margin-top: 5px;">Uw partner in motoren</p>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 10px;">
            {data.message.replace(chr(10), '<br>')}
        </div>
        {about_us_section}
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
            <p><strong>Moto Import BV</strong></p>
            <p>Horsterhoekweg 11, 7433 SV Schalkhaar</p>
            <p>Tel: +31 6 81792660 | www.motoimportbv.nl</p>
        </div>
    </body>
    </html>
    """
    
    for email in data.recipient_emails:
        try:
            if attachment_path:
                success = await send_email_with_attachment(email, data.subject, html_template, attachment_path)
            else:
                success = await send_email(email, data.subject, html_template)
            
            if success:
                sent += 1
            else:
                failed += 1
                failed_emails.append(email)
        except Exception as e:
            logger.error(f"Failed to send to {email}: {str(e)}")
            failed += 1
            failed_emails.append(email)
        
        # Small delay to avoid rate limiting
        await asyncio.sleep(0.5)
    
    return BulkEmailResponse(
        total=len(data.recipient_emails),
        sent=sent,
        failed=failed,
        failed_emails=failed_emails
    )

@api_router.post("/admin/upload-marketing-csv")
async def upload_marketing_csv(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    """Upload a CSV file with email addresses for marketing"""
    import csv
    from io import StringIO
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Alleen CSV bestanden toegestaan")
    
    try:
        # Read file content
        content = await file.read()
        text = content.decode('utf-8')
        
        # Auto-detect delimiter (semicolon or comma)
        first_line = text.split('\n')[0]
        delimiter = ';' if ';' in first_line else ','
        
        # Parse CSV
        reader = csv.DictReader(StringIO(text), delimiter=delimiter)
        
        # Find email column (case insensitive)
        emails = []
        for row in reader:
            # Try different email column names
            email = None
            for key in row.keys():
                if key and key.lower() in ['email', 'e-mail', 'emailaddress', 'email_address', 'mail']:
                    email = row[key]
                    break
            
            if email and '@' in email:
                name = row.get('Bedrijfsnaam', row.get('Company', row.get('Name', row.get('Naam', ''))))
                emails.append({
                    "email": email.strip(),
                    "name": name.strip() if name else ""
                })
        
        if not emails:
            raise HTTPException(status_code=400, detail="Geen geldige email adressen gevonden in CSV")
        
        # Save file to uploads folder with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"Upload_{timestamp}_{file.filename}"
        filepath = ROOT_DIR / "uploads" / safe_filename
        
        with open(filepath, 'wb') as f:
            f.write(content)
        
        logger.info(f"Uploaded marketing CSV: {safe_filename} with {len(emails)} emails")
        
        return {
            "message": f"Succesvol geüpload: {len(emails)} email adressen gevonden",
            "filename": safe_filename,
            "count": len(emails),
            "emails": emails
        }
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Kan bestand niet lezen. Zorg voor UTF-8 encoding.")
    except Exception as e:
        logger.error(f"Error uploading CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Fout bij uploaden: {str(e)}")

@api_router.post("/admin/upload-flyer")
async def upload_flyer_pdf(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    """Upload a PDF flyer for marketing emails"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Alleen PDF bestanden toegestaan")
    
    try:
        content = await file.read()
        
        # Check file size (max 5MB)
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Bestand te groot (max 5MB)")
        
        # Create safe filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"Flyer_{timestamp}_{file.filename.replace(' ', '_')}"
        filepath = ROOT_DIR / "uploads" / safe_filename
        
        with open(filepath, 'wb') as f:
            f.write(content)
        
        size_kb = len(content) / 1024
        logger.info(f"Uploaded flyer: {safe_filename} ({size_kb:.1f} KB)")
        
        return {
            "message": f"Flyer geüpload: {safe_filename}",
            "filename": safe_filename,
            "size_kb": round(size_kb, 1),
            "url": f"/api/uploads/{safe_filename}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Fout bij uploaden: {str(e)}")

@api_router.get("/admin/available-flyers")
async def get_available_flyers(user: dict = Depends(require_admin)):
    """Get list of available PDF flyers for email attachments"""
    import glob
    upload_dir = ROOT_DIR / "uploads"
    pdf_files = glob.glob(str(upload_dir / "*.pdf"))
    
    flyers = []
    for filepath in pdf_files:
        filename = os.path.basename(filepath)
        size_kb = os.path.getsize(filepath) / 1024
        flyers.append({
            "filename": filename,
            "size_kb": round(size_kb, 1),
            "url": f"/api/uploads/{filename}"
        })
    
    return flyers

@api_router.get("/admin/marketing-lists")
async def get_marketing_lists(user: dict = Depends(require_admin)):
    """Get available marketing CSV files (both pre-made and uploaded)"""
    import glob
    upload_dir = ROOT_DIR / "uploads"
    
    # Get both Motorzaken_*.csv and Upload_*.csv files
    csv_patterns = [
        str(upload_dir / "Motorzaken_*.csv"),
        str(upload_dir / "Upload_*.csv")
    ]
    
    all_csv_files = []
    for pattern in csv_patterns:
        all_csv_files.extend(glob.glob(pattern))
    
    lists = []
    for filepath in all_csv_files:
        filename = os.path.basename(filepath)
        # Count lines (excluding header)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                count = len([l for l in lines[1:] if l.strip()])
        except:
            count = 0
        
        # Determine display name
        if filename.startswith("Motorzaken_"):
            display_name = filename.replace('Motorzaken_', '').replace('.csv', '')
        elif filename.startswith("Upload_"):
            display_name = "📤 " + filename.replace('Upload_', '').replace('.csv', '').split('_', 2)[-1] if '_' in filename else filename
        else:
            display_name = filename.replace('.csv', '')
        
        lists.append({
            "filename": filename,
            "display_name": display_name,
            "count": count,
            "url": f"/api/uploads/{filename}",
            "is_uploaded": filename.startswith("Upload_")
        })
    
    # Sort: pre-made lists first, then uploaded
    lists.sort(key=lambda x: (x["is_uploaded"], x["filename"]))
    
    return lists

@api_router.get("/admin/marketing-list/{filename}")
async def get_marketing_list_emails(filename: str, user: dict = Depends(require_admin)):
    """Get emails from a marketing CSV file"""
    import csv
    filepath = ROOT_DIR / "uploads" / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    emails = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            if 'Email' in row and row['Email']:
                emails.append({
                    "email": row['Email'],
                    "name": row.get('Bedrijfsnaam', ''),
                    "city": row.get('Stad', ''),
                    "region": row.get('Land/Regio', row.get('Regio', row.get('Kanton/Regio', '')))
                })
    
    return emails

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

# RDW Document upload directory
RDW_UPLOAD_DIR = UPLOAD_DIR / "rdw"
RDW_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@api_router.post("/license-plates/{plate_id}/document")
async def upload_license_plate_document(
    plate_id: str, 
    file: UploadFile = File(...), 
    user: dict = Depends(require_admin)
):
    """Admin uploads an RDW document for a license plate"""
    # Check plate exists
    plate = await db.license_plates.find_one({"id": plate_id}, {"_id": 0})
    if not plate:
        raise HTTPException(status_code=404, detail="Kenteken niet gevonden")
    
    # Validate file type
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail="Alleen PDF, JPG, PNG of WEBP bestanden zijn toegestaan"
        )
    
    # Limit file size (10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Bestand te groot (max 10MB)")
    
    # Delete old document if exists
    if plate.get("document_url"):
        old_filename = plate["document_url"].split("/")[-1]
        old_path = RDW_UPLOAD_DIR / old_filename
        if old_path.exists():
            old_path.unlink()
    
    # Generate unique filename
    ext = Path(file.filename).suffix.lower() if file.filename else ".pdf"
    if ext not in [".pdf", ".jpg", ".jpeg", ".png", ".webp"]:
        ext = ".pdf"
    new_filename = f"{plate_id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = RDW_UPLOAD_DIR / new_filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Update database
    document_url = f"/api/uploads/rdw/{new_filename}"
    await db.license_plates.update_one(
        {"id": plate_id},
        {"$set": {
            "document_url": document_url,
            "document_filename": file.filename or new_filename
        }}
    )
    
    return {
        "message": "Document geüpload",
        "document_url": document_url,
        "document_filename": file.filename or new_filename
    }

@api_router.delete("/license-plates/{plate_id}/document")
async def delete_license_plate_document(plate_id: str, user: dict = Depends(require_admin)):
    """Admin deletes an RDW document from a license plate"""
    plate = await db.license_plates.find_one({"id": plate_id}, {"_id": 0})
    if not plate:
        raise HTTPException(status_code=404, detail="Kenteken niet gevonden")
    
    if not plate.get("document_url"):
        raise HTTPException(status_code=404, detail="Geen document gevonden")
    
    # Delete file
    filename = plate["document_url"].split("/")[-1]
    file_path = RDW_UPLOAD_DIR / filename
    if file_path.exists():
        file_path.unlink()
    
    # Update database
    await db.license_plates.update_one(
        {"id": plate_id},
        {"$set": {"document_url": None, "document_filename": None}}
    )
    
    return {"message": "Document verwijderd"}

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
    
    # Start background task for auto-deleting expired motorcycles
    asyncio.create_task(auto_delete_expired_motorcycles())

async def auto_delete_expired_motorcycles():
    """Background task to delete motorcycles that have expired (not sold within time limit)"""
    while True:
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            # Find motorcycles that should be auto-deleted
            expired_motorcycles = await db.motorcycles.find({
                "auto_delete_at": {"$lte": now},
                "is_available": True  # Only delete if not sold
            }, {"_id": 0, "id": 1, "brand": 1, "model": 1, "year": 1}).to_list(100)
            
            for moto in expired_motorcycles:
                # Delete the motorcycle
                await db.motorcycles.delete_one({"id": moto["id"]})
                
                # Also delete related notifications
                await db.notifications.delete_many({"motorcycle_id": moto["id"]})
                
                # Delete any pending bids
                await db.bids.delete_many({"motorcycle_id": moto["id"]})
                
                # Delete any pending price proposals
                await db.price_proposals.delete_many({"motorcycle_id": moto["id"]})
                
                logger.info(f"Auto-deleted expired motorcycle: {moto['brand']} {moto['model']} ({moto['year']})")
            
            if expired_motorcycles:
                # Notify admin about deleted motorcycles
                try:
                    deleted_list = "<br>".join([f"• {m['brand']} {m['model']} ({m['year']})" for m in expired_motorcycles])
                    html_content = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #18181b; padding: 25px; text-align: center;">
                            <h1 style="color: white; margin: 0;">⏰ Auto-Verwijdering</h1>
                        </div>
                        <div style="padding: 30px; background: #fef3c7; border: 2px solid #f59e0b;">
                            <p>De volgende {len(expired_motorcycles)} motor(en) zijn automatisch verwijderd omdat ze niet verkocht zijn binnen de gestelde tijd:</p>
                            <div style="padding: 15px; background: white; border-radius: 8px; margin: 15px 0;">
                                {deleted_list}
                            </div>
                            <p style="color: #666; font-size: 12px;">Dit is een automatisch bericht van het Moto Import systeem.</p>
                        </div>
                    </div>
                    """
                    await send_email(ADMIN_EMAIL, f"⏰ {len(expired_motorcycles)} motor(en) automatisch verwijderd", html_content)
                except Exception as e:
                    logger.error(f"Failed to send auto-delete notification: {e}")
        
        except Exception as e:
            logger.error(f"Error in auto_delete_expired_motorcycles: {e}")
        
        # Check every 5 minutes
        await asyncio.sleep(300)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
