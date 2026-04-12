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

router = APIRouter(tags=["Reviews"])

# ============ REVIEWS ENDPOINTS ============

@router.get("/reviews")
async def get_reviews():
    """Get all reviews - public endpoint"""
    reviews = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    # Hide dealer info for anonymous reviews
    for r in reviews:
        if r.get("anonymous"):
            r["dealer_company"] = "Anoniem"
    return reviews

@router.post("/reviews")
async def create_review(review_data: ReviewCreate, current_user: dict = Depends(get_current_user)):
    """Create a review - only dealers can post"""
    if current_user.get("role") not in ["dealer"]:
        raise HTTPException(status_code=403, detail="Alleen dealers kunnen reviews plaatsen")
    
    # Check if dealer already has a review
    existing = await db.reviews.find_one({"dealer_id": current_user["id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="U heeft al een review geplaatst")
    
    review = Review(
        dealer_id=current_user["id"],
        dealer_company=current_user.get("company_name", "Dealer"),
        anonymous=review_data.anonymous,
        rating=review_data.rating,
        text=review_data.text,
    )
    await db.reviews.insert_one(review.model_dump())
    return {"message": "Review geplaatst", "review_id": review.id}

# --- Promo video endpoint (serves from cloud storage with Range support) ---
@router.get("/promo/video/{filename}")
async def get_promo_video(filename: str, request: Request):
    """Serve promo videos with Range request support for mobile browsers"""
    allowed = [
        "moto_import_reclame_it.webm", "moto_import_reclame_de.webm",
        "moto_import_reclame_it.mp4", "moto_import_reclame_de.mp4",
        "moto_import_reclame_fr.webm", "moto_import_reclame_fr.mp4",
    ]
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="Not found")
    
    media_type = "video/webm" if filename.endswith(".webm") else "video/mp4"
    
    # Try local file first
    local_path = UPLOAD_DIR / filename
    if not local_path.exists():
        # Download from cloud storage to local cache
        try:
            data, _ = get_object(f"{APP_NAME}/promo/{filename}")
            with open(local_path, 'wb') as f:
                f.write(data)
            logger.info(f"Cached promo video from cloud: {filename}")
        except Exception as e:
            logger.error(f"Failed to get promo video {filename}: {e}")
            raise HTTPException(status_code=404, detail="Video not found")
    
    # Serve with Range support
    file_size = local_path.stat().st_size
    range_header = request.headers.get("range")
    
    if range_header:
        # Parse range header: "bytes=0-1023"
        range_str = range_header.replace("bytes=", "")
        parts = range_str.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        content_length = end - start + 1
        
        with open(local_path, 'rb') as f:
            f.seek(start)
            data = f.read(content_length)
        
        return Response(
            content=data,
            status_code=206,
            media_type=media_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
            }
        )
    
    # No range request - return full file
    return FileResponse(str(local_path), media_type=media_type, headers={"Accept-Ranges": "bytes"})


