# Database Configuration
# MongoDB connection en utilities

import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Collections referenties (voor type hints en autocomplete)
users = db.users
motorcycles = db.motorcycles
orders = db.orders
bids = db.bids
notifications = db.notifications
chat_messages = db.chat_messages
vouchers = db.vouchers
wanted_requests = db.wanted_requests
price_proposals = db.price_proposals
parts = db.parts
part_categories = db.part_categories
part_orders = db.part_orders
license_plates = db.license_plates
images = db.images
settings = db.settings
activity_logs = db.activity_logs
pending_motorcycle_emails = db.pending_motorcycle_emails
password_reset_tokens = db.password_reset_tokens
permanent_login_tokens = db.permanent_login_tokens
push_subscriptions = db.push_subscriptions
