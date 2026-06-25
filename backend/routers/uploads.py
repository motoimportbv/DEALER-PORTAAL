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
import shutil

router = APIRouter(tags=["Uploads"])

# ============ UPLOAD ENDPOINT ============

@router.post("/upload")
async def upload_image(request: Request, file: UploadFile = File(...), blur_corner: str = "", user: dict = Depends(get_current_user)):
    """Upload image to cloud storage for fast delivery.
    
    blur_corner: optionele hoek waar dealer-logo's worden geblurd.
      Mogelijke waardes: 'bottom-right', 'bottom-left', 'top-right', 'top-left'.
      Leeg = geen blur.
    """
    from PIL import Image, ImageFilter
    import io
    
    # Check file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Alleen JPG, PNG of WEBP afbeeldingen toegestaan")
    
    # Read file content
    content = await file.read()
    
    # Check file size (max 10MB before compression)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Bestand te groot (max 10MB)")
    
    # Compress image using Pillow
    try:
        img = Image.open(io.BytesIO(content))
        
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Resize if too large (max 1920px on longest side)
        max_size = 1920
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        # Blur dealer-logo in opgegeven hoek (~20% breedte × 15% hoogte)
        if blur_corner in ("bottom-right", "bottom-left", "top-right", "top-left"):
            try:
                w, h = img.size
                box_w = int(w * 0.22)
                box_h = int(h * 0.16)
                if blur_corner == "bottom-right":
                    box = (w - box_w, h - box_h, w, h)
                elif blur_corner == "bottom-left":
                    box = (0, h - box_h, box_w, h)
                elif blur_corner == "top-right":
                    box = (w - box_w, 0, w, box_h)
                else:  # top-left
                    box = (0, 0, box_w, box_h)
                region = img.crop(box).filter(ImageFilter.GaussianBlur(radius=20))
                img.paste(region, box)
            except Exception as _e:
                pass  # blur failure is non-fatal — keep original
        
        # Compress to JPEG with quality 80
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=80, optimize=True)
        compressed_content = output.getvalue()
        
        # Also create thumbnail (400px) for fast loading in lists
        thumb_size = 400
        thumb_ratio = thumb_size / max(img.size)
        thumb_dimensions = (int(img.size[0] * thumb_ratio), int(img.size[1] * thumb_ratio))
        thumb = img.resize(thumb_dimensions, Image.Resampling.LANCZOS)
        thumb_output = io.BytesIO()
        thumb.save(thumb_output, format='JPEG', quality=70, optimize=True)
        thumbnail_content = thumb_output.getvalue()
        
        logger.info(f"Image compressed: {len(content)/1024:.0f}KB -> {len(compressed_content)/1024:.0f}KB (thumb: {len(thumbnail_content)/1024:.0f}KB)")
        
    except Exception as e:
        logger.error(f"Image compression failed: {e}")
        compressed_content = content
        thumbnail_content = content
    
    # Generate unique ID
    image_id = str(uuid.uuid4())
    
    # Try cloud storage first, fallback to MongoDB
    cloud_stored = False
    try:
        if init_storage():
            # Upload full image to cloud
            full_path = f"{APP_NAME}/images/{image_id}.jpg"
            put_object(full_path, compressed_content, "image/jpeg")
            
            # Upload thumbnail to cloud
            thumb_path = f"{APP_NAME}/thumbs/{image_id}.jpg"
            put_object(thumb_path, thumbnail_content, "image/jpeg")
            
            cloud_stored = True
            logger.info(f"Image {image_id} stored in cloud")
    except Exception as e:
        logger.error(f"Cloud storage failed, falling back to MongoDB: {e}")
    
    # Store metadata in MongoDB (and fallback data if cloud failed)
    import base64
    image_doc = {
        "id": image_id,
        "filename": f"{image_id}.jpg",
        "content_type": "image/jpeg",
        "cloud_stored": cloud_stored,
        "storage_path": f"{APP_NAME}/images/{image_id}.jpg" if cloud_stored else None,
        "thumb_path": f"{APP_NAME}/thumbs/{image_id}.jpg" if cloud_stored else None,
        "original_size": len(content),
        "compressed_size": len(compressed_content),
        "uploaded_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Only store base64 data if cloud storage failed
    if not cloud_stored:
        image_doc["data"] = base64.b64encode(compressed_content).decode('utf-8')
        image_doc["thumbnail"] = base64.b64encode(thumbnail_content).decode('utf-8')
    
    await db.images.insert_one(image_doc)
    
    # Return URL
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base_url = PRODUCTION_BASE_URL
    
    image_url = f"{base_url}/api/images/{image_id}"
    
    return {"url": image_url, "filename": f"{image_id}.jpg"}

@router.get("/images/{image_id}")
async def get_image(image_id: str, thumb: bool = False):
    """Serve image - from cloud storage (fast) or MongoDB (fallback)"""
    import base64
    from fastapi.responses import Response
    
    image = await db.images.find_one({"id": image_id}, {"_id": 0})
    if not image:
        raise HTTPException(status_code=404, detail="Afbeelding niet gevonden")
    
    # Try cloud storage first (much faster)
    if image.get("cloud_stored") and init_storage():
        try:
            if thumb and image.get("thumb_path"):
                image_data, content_type = get_object(image["thumb_path"])
            elif image.get("storage_path"):
                image_data, content_type = get_object(image["storage_path"])
            else:
                raise Exception("No cloud path found")
            
            return Response(
                content=image_data,
                media_type="image/jpeg",
                headers={"Cache-Control": "public, max-age=31536000"}
            )
        except Exception as e:
            logger.error(f"Cloud retrieval failed for {image_id}: {e}")
    
    # Fallback to MongoDB
    if not image.get("data"):
        raise HTTPException(status_code=404, detail="Afbeelding data niet gevonden")
    
    if thumb and image.get("thumbnail"):
        image_data = base64.b64decode(image["thumbnail"])
    else:
        image_data = base64.b64decode(image["data"])
    
    return Response(
        content=image_data,
        media_type=image.get("content_type", "image/jpeg"),
        headers={"Cache-Control": "public, max-age=31536000"}  # Cache for 1 year
    )

@router.post("/images/optimize-all")
async def optimize_all_images(user: dict = Depends(require_admin), batch_size: int = 5):
    """Admin endpoint to generate thumbnails for existing images - processes in small batches"""
    import base64
    from PIL import Image
    import io
    
    try:
        # Get images without thumbnails - small batch to avoid timeout
        images = await db.images.find(
            {"thumbnail": {"$exists": False}}, 
            {"id": 1, "data": 1, "_id": 0}
        ).to_list(batch_size)
        
        total_remaining = await db.images.count_documents({"thumbnail": {"$exists": False}})
        
        optimized = 0
        errors = 0
        
        for img_doc in images:
            try:
                # Decode existing image
                img_data = base64.b64decode(img_doc["data"])
                img = Image.open(io.BytesIO(img_data))
                
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                # Create thumbnail (400px)
                thumb_size = 400
                if max(img.size) > thumb_size:
                    thumb_ratio = thumb_size / max(img.size)
                    thumb_dimensions = (int(img.size[0] * thumb_ratio), int(img.size[1] * thumb_ratio))
                    thumb = img.resize(thumb_dimensions, Image.Resampling.LANCZOS)
                else:
                    thumb = img
                    
                thumb_output = io.BytesIO()
                thumb.save(thumb_output, format='JPEG', quality=70, optimize=True)
                thumbnail_content = thumb_output.getvalue()
                
                # Update document with thumbnail
                await db.images.update_one(
                    {"id": img_doc["id"]},
                    {"$set": {"thumbnail": base64.b64encode(thumbnail_content).decode('utf-8')}}
                )
                optimized += 1
                
            except Exception as e:
                logger.error(f"Error optimizing {img_doc.get('id', 'unknown')}: {e}")
                errors += 1
        
        return {
            "message": "Batch optimalisatie voltooid",
            "optimized": optimized,
            "errors": errors,
            "remaining": max(0, total_remaining - optimized),
            "batch_size": batch_size
        }
    except Exception as e:
        logger.error(f"Optimize-all endpoint error: {e}")
        return {"message": "Error", "error": str(e), "optimized": 0, "remaining": -1}

@router.post("/images/migrate-to-cloud")
async def migrate_images_to_cloud(user: dict = Depends(require_admin), batch_size: int = 5):
    """Migrate existing MongoDB images to cloud storage for faster delivery"""
    import base64
    
    if not init_storage():
        return {"message": "Cloud storage not available", "migrated": 0}
    
    # Get images not yet migrated
    images = await db.images.find(
        {"cloud_stored": {"$ne": True}, "data": {"$exists": True}},
        {"id": 1, "data": 1, "thumbnail": 1, "_id": 0}
    ).to_list(batch_size)
    
    total_remaining = await db.images.count_documents({"cloud_stored": {"$ne": True}, "data": {"$exists": True}})
    
    migrated = 0
    errors = 0
    
    for img in images:
        try:
            image_id = img["id"]
            
            # Upload full image
            full_data = base64.b64decode(img["data"])
            full_path = f"{APP_NAME}/images/{image_id}.jpg"
            put_object(full_path, full_data, "image/jpeg")
            
            # Upload thumbnail if exists
            thumb_path = None
            if img.get("thumbnail"):
                thumb_data = base64.b64decode(img["thumbnail"])
                thumb_path = f"{APP_NAME}/thumbs/{image_id}.jpg"
                put_object(thumb_path, thumb_data, "image/jpeg")
            
            # Update database - mark as cloud stored and remove base64 data
            await db.images.update_one(
                {"id": image_id},
                {
                    "$set": {
                        "cloud_stored": True,
                        "storage_path": full_path,
                        "thumb_path": thumb_path
                    },
                    "$unset": {"data": "", "thumbnail": ""}
                }
            )
            
            migrated += 1
            logger.info(f"Migrated image {image_id} to cloud")
            
        except Exception as e:
            logger.error(f"Failed to migrate image {img.get('id')}: {e}")
            errors += 1
    
    return {
        "message": "Migratie batch voltooid",
        "migrated": migrated,
        "errors": errors,
        "remaining": max(0, total_remaining - migrated),
        "batch_size": batch_size
    }

@router.post("/upload/multiple")
async def upload_multiple_images(request: Request, files: List[UploadFile] = File(...), blur_corner: str = "", user: dict = Depends(get_current_user)):
    """Upload multiple images and store in MongoDB - with compression.
    blur_corner: 'bottom-right' / 'bottom-left' / 'top-right' / 'top-left' om dealer-logo te blurren. Leeg = geen blur."""
    import base64
    from PIL import Image, ImageFilter
    import io
    
    urls = []
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    
    # Get base URL from request
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base_url = PRODUCTION_BASE_URL
    
    for file in files:
        if file.content_type not in allowed_types:
            continue
        
        content = await file.read()
        
        # Skip if too large (10MB before compression)
        if len(content) > 10 * 1024 * 1024:
            continue
        
        # Compress image
        try:
            img = Image.open(io.BytesIO(content))
            
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            
            # Resize if too large
            max_size = 1920
            if max(img.size) > max_size:
                ratio = max_size / max(img.size)
                new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
            
            # Compress to JPEG
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=80, optimize=True)
            compressed_content = output.getvalue()
            
            # Create thumbnail
            thumb_size = 400
            thumb_ratio = thumb_size / max(img.size)
            thumb_dimensions = (int(img.size[0] * thumb_ratio), int(img.size[1] * thumb_ratio))
            thumb = img.resize(thumb_dimensions, Image.Resampling.LANCZOS)
            thumb_output = io.BytesIO()
            thumb.save(thumb_output, format='JPEG', quality=70, optimize=True)
            thumbnail_content = thumb_output.getvalue()
            
        except Exception as e:
            logger.error(f"Bulk image compression failed: {e}")
            compressed_content = content
            thumbnail_content = content
        
        image_id = str(uuid.uuid4())
        
        # Store in MongoDB with compression
        image_doc = {
            "id": image_id,
            "filename": f"{image_id}.jpg",
            "content_type": "image/jpeg",
            "data": base64.b64encode(compressed_content).decode('utf-8'),
            "thumbnail": base64.b64encode(thumbnail_content).decode('utf-8'),
            "original_size": len(content),
            "compressed_size": len(compressed_content),
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


