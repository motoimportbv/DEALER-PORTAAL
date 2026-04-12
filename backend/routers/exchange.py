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

router = APIRouter(tags=["Exchange Rate"])

# ============ EXCHANGE RATE ENDPOINTS ============

@router.get("/exchange-rate/chf-eur")
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

@router.get("/exchange-rate/margin")
async def get_margin():
    """Get current CHF to EUR margin"""
    margin = await get_chf_eur_margin()
    return {
        "margin": margin,
        "margin_percent": margin * 100,
        "default_margin": DEFAULT_CHF_EUR_MARGIN,
        "default_margin_percent": DEFAULT_CHF_EUR_MARGIN * 100
    }

@router.put("/exchange-rate/margin")
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

@router.post("/exchange-rate/convert")
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


