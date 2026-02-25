# Authentication Service
# JWT token handling, password hashing, user dependencies

import os
import jwt
import bcrypt
import logging
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import JWT_SECRET, JWT_ALGORITHM
from database import db

logger = logging.getLogger(__name__)
security = HTTPBearer()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_token(user_id: str, email: str, role: str) -> str:
    """Create a JWT token for a user
    Dealers krijgen 1 jaar, admins 30 dagen
    """
    if role == 'dealer':
        expiry_days = 365  # 1 jaar voor dealers
    else:
        expiry_days = 30   # 30 dagen voor admins
    
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": (datetime.now(timezone.utc) + timedelta(days=expiry_days)).timestamp()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_notification_token(user_id: str, email: str, role: str) -> str:
    """Create a short-lived JWT token for email notification links (24 hours)"""
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": (datetime.now(timezone.utc) + timedelta(hours=24)).timestamp()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_permanent_login_token(user_id: str) -> str:
    """Create a permanent login token (no expiry, for bookmarked links)"""
    payload = {
        "user_id": user_id,
        "type": "permanent",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token verlopen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ongeldig token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current user from JWT token - use as FastAPI dependency"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Gebruiker niet gevonden")
        
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
        raise HTTPException(status_code=401, detail="Token verlopen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ongeldig token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require admin role - use as FastAPI dependency"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin rechten vereist")
    return user


async def require_approved_dealer(user: dict = Depends(get_current_user)) -> dict:
    """Require approved dealer - use as FastAPI dependency"""
    if user.get("role") not in ["dealer", "admin"]:
        raise HTTPException(status_code=403, detail="Dealer rechten vereist")
    if user.get("role") == "dealer" and not user.get("is_approved"):
        raise HTTPException(status_code=403, detail="Account wacht op goedkeuring")
    return user


async def require_foreign_dealer(user: dict = Depends(get_current_user)) -> dict:
    """Require foreign dealer role - use as FastAPI dependency"""
    if user.get("role") != "foreign_dealer":
        raise HTTPException(status_code=403, detail="Buitenlandse leverancier rechten vereist")
    if not user.get("is_approved"):
        raise HTTPException(status_code=403, detail="Account wacht op goedkeuring")
    return user


def generate_short_code() -> str:
    """Generate a short alphanumeric code for easy login"""
    import random
    import string
    chars = string.ascii_uppercase + string.digits
    # Remove confusing characters
    chars = chars.replace('O', '').replace('0', '').replace('I', '').replace('1', '').replace('L', '')
    return ''.join(random.choice(chars) for _ in range(6))
