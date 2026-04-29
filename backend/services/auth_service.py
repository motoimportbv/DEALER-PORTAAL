# Authentication Service
# JWT token handling, password hashing, user dependencies

import os
import jwt
import bcrypt
import uuid
import random
import string
import logging
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import JWT_SECRET, JWT_ALGORITHM
from database import db

logger = logging.getLogger(__name__)
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_token(user_id: str, email: str, role: str) -> str:
    if role == 'dealer':
        expiry_days = 365
    else:
        expiry_days = 30
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * expiry_days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_notification_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "type": "notification",
        "exp": datetime.now(timezone.utc).timestamp() + 86400
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_permanent_login_token(user_id: str) -> str:
    token_id = str(uuid.uuid4())
    payload = {
        "user_id": user_id,
        "token_id": token_id,
        "type": "permanent",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token verlopen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ongeldig token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        try:
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
            )
        except Exception:
            pass
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security_optional)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        return user
    except:
        return None


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_taxatie_access(user: dict = Depends(get_current_user)) -> dict:
    """Toegang tot Taxatie Facturen + BPM Vermindering — admin of taxateur rol."""
    if user["role"] not in ("admin", "taxateur"):
        raise HTTPException(status_code=403, detail="Taxateur of admin rechten vereist")
    return user


async def require_pakbon(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in ("admin", "pakbon"):
        raise HTTPException(status_code=403, detail="Pakbon access required")
    return user


async def require_approved_dealer(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] == "dealer":
        if not user.get("is_approved", False):
            raise HTTPException(status_code=403, detail="Uw account wacht nog op goedkeuring door Moto Import")
        if user.get("is_offline", False):
            raise HTTPException(status_code=403, detail="Uw account is tijdelijk offline gezet door de beheerder. Neem contact op met Moto Import.")
    return user


async def require_foreign_dealer(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "foreign_dealer":
        raise HTTPException(status_code=403, detail="Buitenlandse leverancier rechten vereist")
    if not user.get("is_approved"):
        raise HTTPException(status_code=403, detail="Account wacht op goedkeuring")
    return user


def generate_short_code() -> str:
    chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return ''.join(random.choice(chars) for _ in range(8))
