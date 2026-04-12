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

router = APIRouter(tags=["License Plates"])

# ============ LICENSE PLATE (KENTEKEN) ENDPOINTS ============

@router.post("/license-plates")
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

@router.get("/license-plates")
async def get_all_license_plates(user: dict = Depends(require_admin)):
    """Admin gets all license plates"""
    plates = await db.license_plates.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return plates

@router.get("/license-plates/my")
async def get_my_license_plates(user: dict = Depends(require_approved_dealer)):
    """Dealer gets their own license plates"""
    plates = await db.license_plates.find(
        {"dealer_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return plates

@router.get("/license-plates/dealer/{dealer_id}")
async def get_dealer_license_plates(dealer_id: str, user: dict = Depends(require_admin)):
    """Admin gets license plates for a specific dealer"""
    plates = await db.license_plates.find(
        {"dealer_id": dealer_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return plates

@router.delete("/license-plates/{plate_id}")
async def delete_license_plate(plate_id: str, user: dict = Depends(require_admin)):
    """Admin deletes a license plate"""
    result = await db.license_plates.delete_one({"id": plate_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kenteken niet gevonden")
    return {"message": "Kenteken verwijderd"}

@router.put("/license-plates/{plate_id}")
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

@router.post("/license-plates/{plate_id}/document")
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

@router.delete("/license-plates/{plate_id}/document")
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


