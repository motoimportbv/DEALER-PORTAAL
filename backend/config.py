# Backend Configuration
# Alle environment variables en constanten

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ PRODUCTION URL ============
PRODUCTION_BASE_URL = "https://www.motoimportbv.nl"

# ============ EMERGENT OBJECT STORAGE ============
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "moto-import"

# ============ JWT CONFIG ============
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = "HS256"

# ============ EMAIL CONFIG ============
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')
ADMIN_EMAIL_2 = os.environ.get('ADMIN_EMAIL_2', '')
ADMIN_EMAIL_3 = os.environ.get('ADMIN_EMAIL_3', '')

ADMIN_EMAILS_FULL = [e.strip() for e in [ADMIN_EMAIL, ADMIN_EMAIL_3] if e.strip()]
ADMIN_EMAIL_LIMITED = ADMIN_EMAIL_2.strip() if ADMIN_EMAIL_2 else None
ADMIN_EMAILS_DEALER_MOTO = [e.strip() for e in [ADMIN_EMAIL, ADMIN_EMAIL_2, ADMIN_EMAIL_3] if e.strip()]

GMAIL_EMAIL = os.environ.get('GMAIL_EMAIL', '')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')

EMAIL_FOOTER_DEALER = """
    <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
        <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
        <p style="margin: 5px 0;">Tel: +31 6 24264861</p>
        <p style="margin: 5px 0;">www.motoimportbv.nl</p>
    </div>
"""

EMAIL_FOOTER_SUPPLIER = """
    <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
        <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
        <p style="margin: 5px 0;">www.motoimportbv.nl</p>
        <p style="margin: 5px 0;">Tel: +31 6 24264861</p>
        <p style="margin: 5px 0;">www.motoimportbv.nl</p>
    </div>
"""

# ============ STRIPE CONFIG ============
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
DELIVERY_COST = 50.0
DEPOSIT_PERCENTAGE = 0.10

# ============ ORDER COST CONFIG ============
INSPECTION_COST = 125.0
VALUATION_COST = 160.0

# ============ COC/CVO CONFIG (per brand, case-insensitive) ============
COC_PRICES = {
    "yamaha": 75.0,
    "kawasaki": 75.0,
    "triumph": 120.0,
    "ktm": 75.0,
    "honda": 150.0,
}

# ============ TWILIO SMS CONFIG ============
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER', '')

# ============ EXCHANGE RATE CONFIG ============
EXCHANGE_RATE_CACHE_DURATION = 300
DEFAULT_CHF_EUR_MARGIN = 0.0

# ============ PRIVATE LISTING CONFIG ============
PRIVATE_LISTING_PRICE = 4.95
DEALER_CONTACT_FEE = 175.00

# ============ TAXATIE CONFIG ============
ALLOWED_ADMIN_EMAIL_TAXATIE = "motoimportbv@gmail.com"
TAXATIE_DEFAULT_FEE = 160.00
TAXATIE_BTW_PERCENTAGE = 21

# ============ PRIVATE LISTINGS ACCESS ============
ALLOWED_ADMIN_EMAIL_PRIVATE = "motoimportbv@gmail.com"

# ============ GOOGLE MOTORS CONFIG ============
GOOGLE_MOTOR_PRICE_PER_MOTOR = 2.95
GOOGLE_MOTOR_MONTHLY_PRICE = 45.00
ALLOWED_ADMIN_EMAIL_GOOGLE = "motoimportbv@gmail.com"

# ============ MOTORCYCLE BRANDS ============
MOTORCYCLE_BRANDS = [
    "Yamaha", "Honda", "Kawasaki", "Ducati", "Triumph",
    "KTM", "Suzuki", "BMW", "Harley-Davidson", "Aprilia",
    "MV Agusta", "Moto Guzzi", "Indian", "Royal Enfield"
]

# ============ UPLOAD CONFIG ============
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ============ OBJECT STORAGE KEY ============
OBJ_STORAGE_KEY = os.environ.get("OBJECT_STORAGE_KEY", "")
