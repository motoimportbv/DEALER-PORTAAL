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
# ALWAYS use this for customer-facing links
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
ADMIN_EMAIL_2 = os.environ.get('ADMIN_EMAIL_2', '')  # Limited notifications
ADMIN_EMAIL_3 = os.environ.get('ADMIN_EMAIL_3', '')  # Third admin

# Full admin list (receives ALL notifications)
ADMIN_EMAILS_FULL = [e.strip() for e in [ADMIN_EMAIL, ADMIN_EMAIL_3] if e.strip()]

# Limited admin (only new dealers and new motorcycles)
ADMIN_EMAIL_LIMITED = ADMIN_EMAIL_2.strip() if ADMIN_EMAIL_2 else None

# Combined list for dealer/motorcycle notifications
ADMIN_EMAILS_DEALER_MOTO = [e.strip() for e in [ADMIN_EMAIL, ADMIN_EMAIL_2, ADMIN_EMAIL_3] if e.strip()]

GMAIL_EMAIL = os.environ.get('GMAIL_EMAIL', '')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')

# Email footer templates
EMAIL_FOOTER_DEALER = """
    <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
        <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
        <p style="margin: 5px 0;">Tel: +31 6 81792660</p>
        <p style="margin: 5px 0;">www.motoimportbv.nl</p>
    </div>
"""

EMAIL_FOOTER_SUPPLIER = """
    <div style="background: #18181b; padding: 20px; text-align: center; color: #a1a1aa; font-size: 12px;">
        <p style="margin: 5px 0;"><strong style="color: white;">Moto Import B.V.</strong></p>
        <p style="margin: 5px 0;">www.motoimportbv.nl</p>
        <p style="margin: 5px 0;">Tel: +31 6 81792660</p>
        <p style="margin: 5px 0;">www.motoimportbv.nl</p>
    </div>
"""

# ============ STRIPE CONFIG ============
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
DELIVERY_COST = 50.0  # €50 bezorgkosten
DEPOSIT_PERCENTAGE = 0.10  # 10% aanbetaling

# ============ TWILIO SMS CONFIG ============
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER', '')

# ============ EXCHANGE RATE CONFIG ============
EXCHANGE_RATE_CACHE_DURATION = 300  # 5 minutes cache

# ============ MOTORCYCLE BRANDS ============
MOTORCYCLE_BRANDS = [
    "Yamaha", "Honda", "Kawasaki", "Ducati", "Triumph", 
    "KTM", "Suzuki", "BMW", "Harley-Davidson", "Aprilia",
    "MV Agusta", "Moto Guzzi", "Indian", "Royal Enfield"
]
