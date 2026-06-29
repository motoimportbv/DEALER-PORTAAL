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
      Leeg = geen blur. Mundi Moto gebruikt 🪄 Magische Gum (AI) bij foreign-listing creation — geen auto-blur meer.
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

@router.post("/motorcycles/{motorcycle_id}/blur-images")
async def blur_motorcycle_images(motorcycle_id: str, corner: str = "top-left", user: dict = Depends(require_admin)):
    """Re-process all images of a motorcycle: blur the chosen corner in-place.
    
    Doesn't change image URLs — overwrites stored data (cloud + MongoDB fallback).
    corner: 'top-left' / 'top-right' / 'bottom-left' / 'bottom-right'.
    """
    from PIL import Image, ImageFilter
    import io
    import base64
    
    if corner not in ("bottom-right", "bottom-left", "top-right", "top-left"):
        raise HTTPException(status_code=400, detail="Ongeldige corner waarde")
    
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0, "images": 1})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    image_urls = motorcycle.get("images") or []
    processed = 0
    errors = 0
    
    def _apply_blur(jpeg_bytes: bytes) -> bytes:
        img = Image.open(io.BytesIO(jpeg_bytes))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        w, h = img.size
        box_w = int(w * 0.22)
        box_h = int(h * 0.16)
        if corner == "bottom-right":
            box = (w - box_w, h - box_h, w, h)
        elif corner == "bottom-left":
            box = (0, h - box_h, box_w, h)
        elif corner == "top-right":
            box = (w - box_w, 0, w, box_h)
        else:
            box = (0, 0, box_w, box_h)
        region = img.crop(box).filter(ImageFilter.GaussianBlur(radius=20))
        img.paste(region, box)
        out = io.BytesIO()
        img.save(out, format='JPEG', quality=85, optimize=True)
        return out.getvalue()
    
    for url in image_urls:
        try:
            # Extract image_id from URL: .../api/images/{image_id}
            image_id = url.rstrip("/").split("/api/images/")[-1].split("?")[0].split(".")[0]
            img_doc = await db.images.find_one({"id": image_id}, {"_id": 0})
            if not img_doc:
                errors += 1
                continue
            
            # Get current full-size bytes (cloud or MongoDB)
            full_bytes = None
            if img_doc.get("cloud_stored") and img_doc.get("storage_path") and init_storage():
                try:
                    full_bytes, _ = get_object(img_doc["storage_path"])
                except Exception as ce:
                    logger.error(f"Cloud read failed for {image_id}: {ce}")
            if full_bytes is None and img_doc.get("data"):
                full_bytes = base64.b64decode(img_doc["data"])
            if full_bytes is None:
                errors += 1
                continue
            
            blurred = _apply_blur(full_bytes)
            
            # Re-generate thumbnail from blurred full image
            timg = Image.open(io.BytesIO(blurred))
            thumb_size = 400
            ratio = thumb_size / max(timg.size)
            thumb_dim = (int(timg.size[0] * ratio), int(timg.size[1] * ratio))
            tb = timg.resize(thumb_dim, Image.Resampling.LANCZOS)
            tout = io.BytesIO()
            tb.save(tout, format='JPEG', quality=70, optimize=True)
            thumb_bytes = tout.getvalue()
            
            # Overwrite storage
            if img_doc.get("cloud_stored") and init_storage():
                put_object(img_doc.get("storage_path") or f"{APP_NAME}/images/{image_id}.jpg", blurred, "image/jpeg")
                if img_doc.get("thumb_path"):
                    put_object(img_doc["thumb_path"], thumb_bytes, "image/jpeg")
            else:
                await db.images.update_one(
                    {"id": image_id},
                    {"$set": {
                        "data": base64.b64encode(blurred).decode('utf-8'),
                        "thumbnail": base64.b64encode(thumb_bytes).decode('utf-8'),
                        "compressed_size": len(blurred),
                    }}
                )
            
            await db.images.update_one(
                {"id": image_id},
                {"$set": {"blurred_corner": corner, "blurred_at": datetime.now(timezone.utc).isoformat()}}
            )
            processed += 1
            logger.info(f"Blurred image {image_id} corner={corner}")
        except Exception as e:
            logger.error(f"Blur failed for url {url}: {e}")
            errors += 1
    
    return {"processed": processed, "errors": errors, "total": len(image_urls), "corner": corner}


@router.post("/motorcycles/{motorcycle_id}/erase-logo")
async def erase_motorcycle_logo(motorcycle_id: str, prompt_hint: str = "", user: dict = Depends(require_admin)):
    """🪄 Magische gum: gebruikt Gemini Nano Banana om dealer-logo's / watermarks AI-matig te verwijderen.
    
    Verwerkt alle foto's van een motor in-place (URLs blijven gelijk).
    prompt_hint: optionele extra hint zoals "Mundi Moto" om de AI te helpen.
    """
    import base64
    import io
    from PIL import Image
    
    motorcycle = await db.motorcycles.find_one({"id": motorcycle_id}, {"_id": 0, "images": 1, "foreign_dealer_company": 1})
    if not motorcycle:
        raise HTTPException(status_code=404, detail="Motor niet gevonden")
    
    image_urls = motorcycle.get("images") or []
    if not image_urls:
        return {"processed": 0, "errors": 0, "total": 0}
    
    # Bepaal hint
    dealer_hint = prompt_hint or (motorcycle.get("foreign_dealer_company") or "the dealer")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"emergentintegrations niet geïnstalleerd: {e}")
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY ontbreekt in .env")
    
    processed = 0
    errors = 0
    
    for url in image_urls:
        try:
            image_id = url.rstrip("/").split("/api/images/")[-1].split("?")[0].split(".")[0]
            img_doc = await db.images.find_one({"id": image_id}, {"_id": 0})
            if not img_doc:
                errors += 1
                continue
            
            # Get current full-size bytes
            full_bytes = None
            if img_doc.get("cloud_stored") and img_doc.get("storage_path") and init_storage():
                try:
                    full_bytes, _ = get_object(img_doc["storage_path"])
                except Exception as ce:
                    logger.error(f"Cloud read failed for {image_id}: {ce}")
            if full_bytes is None and img_doc.get("data"):
                full_bytes = base64.b64decode(img_doc["data"])
            if full_bytes is None:
                errors += 1
                continue
            
            # Call Gemini Nano Banana for inpainting
            b64_in = base64.b64encode(full_bytes).decode('utf-8')
            chat = LlmChat(
                api_key=api_key,
                session_id=f"erase-{motorcycle_id}-{image_id}",
                system_message="You are an expert photo editor specialized in removing dealer watermarks and logos cleanly."
            )
            chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
            
            prompt = (
                f"Remove ALL watermarks, logos, dealer names, brand stamps and overlay text from this motorcycle photo "
                f"(any dealer name like '{dealer_hint}', 'moto', 'mundi', 'dealer', shop names, URLs, phone numbers, etc.). "
                f"Inpaint the background naturally so it looks original and untouched. "
                f"Do NOT change the motorcycle itself."
            )
            msg = UserMessage(text=prompt, file_contents=[ImageContent(b64_in)])
            
            try:
                _txt, images = await chat.send_message_multimodal_response(msg)
            except Exception as ai_err:
                logger.error(f"Nano Banana call failed for {image_id}: {ai_err}")
                errors += 1
                continue
            
            if not images:
                logger.warning(f"Nano Banana returned no image for {image_id}")
                errors += 1
                continue
            
            edited_bytes = base64.b64decode(images[0]['data'])
            
            # Re-encode to JPEG (Nano Banana returns PNG)
            timg = Image.open(io.BytesIO(edited_bytes))
            if timg.mode in ('RGBA', 'P'):
                timg = timg.convert('RGB')
            jout = io.BytesIO()
            timg.save(jout, format='JPEG', quality=85, optimize=True)
            jpeg_bytes = jout.getvalue()
            
            # Thumbnail
            thumb_size = 400
            ratio = thumb_size / max(timg.size)
            tb = timg.resize((int(timg.size[0] * ratio), int(timg.size[1] * ratio)), Image.Resampling.LANCZOS)
            tout = io.BytesIO()
            tb.save(tout, format='JPEG', quality=70, optimize=True)
            thumb_bytes = tout.getvalue()
            
            # Overwrite storage
            if img_doc.get("cloud_stored") and init_storage():
                put_object(img_doc.get("storage_path") or f"{APP_NAME}/images/{image_id}.jpg", jpeg_bytes, "image/jpeg")
                if img_doc.get("thumb_path"):
                    put_object(img_doc["thumb_path"], thumb_bytes, "image/jpeg")
            else:
                await db.images.update_one(
                    {"id": image_id},
                    {"$set": {
                        "data": base64.b64encode(jpeg_bytes).decode('utf-8'),
                        "thumbnail": base64.b64encode(thumb_bytes).decode('utf-8'),
                        "compressed_size": len(jpeg_bytes),
                    }}
                )
            
            await db.images.update_one(
                {"id": image_id},
                {"$set": {"ai_erased": True, "ai_erased_at": datetime.now(timezone.utc).isoformat()}}
            )
            processed += 1
            logger.info(f"🪄 AI-erased logo from image {image_id}")
        except Exception as e:
            logger.error(f"Magic eraser failed for url {url}: {e}")
            errors += 1
    
    return {"processed": processed, "errors": errors, "total": len(image_urls), "method": "ai-inpaint"}


@router.post("/images/{image_id}/inpaint-manual")
async def inpaint_image_manual(image_id: str, payload: dict = Body(...), user: dict = Depends(require_admin)):
    """🧽 Handmatige magische gum (gratis, geen AI). 
    
    Body: {"mask_base64": "data:image/png;base64,..."} — een PNG-mask met witte verf op de te verwijderen plekken (zwart = behouden).
    Gebruikt OpenCV cv2.inpaint (Telea algoritme) om de gemaskerde regio te vullen met omliggende pixels.
    Overschrijft de opgeslagen image — URL blijft hetzelfde.
    """
    import base64
    import io
    import numpy as np
    import cv2
    from PIL import Image
    
    img_doc = await db.images.find_one({"id": image_id}, {"_id": 0})
    if not img_doc:
        raise HTTPException(status_code=404, detail="Afbeelding niet gevonden")
    
    mask_b64 = payload.get("mask_base64") or ""
    if "," in mask_b64:
        mask_b64 = mask_b64.split(",", 1)[1]
    if not mask_b64:
        raise HTTPException(status_code=400, detail="mask_base64 ontbreekt")
    
    # Get original image bytes
    full_bytes = None
    if img_doc.get("cloud_stored") and img_doc.get("storage_path") and init_storage():
        try:
            full_bytes, _ = get_object(img_doc["storage_path"])
        except Exception as ce:
            logger.error(f"Cloud read failed for {image_id}: {ce}")
    if full_bytes is None and img_doc.get("data"):
        full_bytes = base64.b64decode(img_doc["data"])
    if full_bytes is None:
        raise HTTPException(status_code=404, detail="Image-data niet beschikbaar")
    
    # Decode source image
    src_np = cv2.imdecode(np.frombuffer(full_bytes, np.uint8), cv2.IMREAD_COLOR)
    if src_np is None:
        raise HTTPException(status_code=500, detail="Kon afbeelding niet decoderen")
    src_h, src_w = src_np.shape[:2]
    
    # Decode mask
    try:
        mask_bytes = base64.b64decode(mask_b64)
        mask_pil = Image.open(io.BytesIO(mask_bytes)).convert("L")  # grayscale
        # Resize mask to match source
        if mask_pil.size != (src_w, src_h):
            mask_pil = mask_pil.resize((src_w, src_h), Image.NEAREST)
        mask_np = np.array(mask_pil)
        # Binarize: anything >50 = inpaint area
        _, mask_bin = cv2.threshold(mask_np, 50, 255, cv2.THRESH_BINARY)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ongeldige mask: {e}")
    
    if int(mask_bin.sum()) == 0:
        raise HTTPException(status_code=400, detail="Mask is leeg — teken eerst over het logo")
    
    # Dilate mask iets zodat randen ook geinpaint worden (anti-halo)
    kernel = np.ones((5, 5), np.uint8)
    mask_dilated = cv2.dilate(mask_bin, kernel, iterations=1)
    
    # 🚀 Performance: alleen het gebied rond de mask verwerken (niet hele foto).
    # Voorkomt Cloudflare 520 (OOM/timeout) bij grote foto's (4000x3000+).
    ys, xs = np.where(mask_dilated > 0)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    pad = max(80, int(0.05 * max(src_w, src_h)))  # 5% padding voor patch-search
    cy0 = max(0, y0 - pad)
    cy1 = min(src_h, y1 + pad)
    cx0 = max(0, x0 - pad)
    cx1 = min(src_w, x1 + pad)
    
    src_crop = src_np[cy0:cy1, cx0:cx1]
    mask_crop = mask_dilated[cy0:cy1, cx0:cx1]
    
    # ⚡ Performance: als crop te groot is voor SHIFTMAP (>1200px), downscale → process → upscale
    crop_h, crop_w = src_crop.shape[:2]
    work_max = 1200
    if max(crop_w, crop_h) > work_max:
        scale = work_max / max(crop_w, crop_h)
        new_w = int(crop_w * scale)
        new_h = int(crop_h * scale)
        src_work = cv2.resize(src_crop, (new_w, new_h), interpolation=cv2.INTER_AREA)
        mask_work = cv2.resize(mask_crop, (new_w, new_h), interpolation=cv2.INTER_NEAREST)
        logger.info(f"Downscale crop {crop_w}x{crop_h} → {new_w}x{new_h} voor SHIFTMAP")
    else:
        src_work = src_crop
        mask_work = mask_crop
    
    # 🎨 Texture-continuation inpainting via xphoto SHIFTMAP
    try:
        src_lab = cv2.cvtColor(src_work, cv2.COLOR_BGR2LAB)
        inv_mask = cv2.bitwise_not(mask_work)
        dst_lab = np.zeros_like(src_lab)
        cv2.xphoto.inpaint(src_lab, inv_mask, dst_lab, cv2.xphoto.INPAINT_SHIFTMAP)
        work_result = cv2.cvtColor(dst_lab, cv2.COLOR_LAB2BGR)
        logger.info(f"Inpainted {image_id} via SHIFTMAP op work-crop {src_work.shape}")
    except Exception as e:
        logger.warning(f"xphoto SHIFTMAP faalde ({e}), fallback naar NS")
        work_result = cv2.inpaint(src_work, mask_work, 3, cv2.INPAINT_NS)
    
    # Upscale terug naar originele crop-grootte indien gedownscaled
    if work_result.shape[:2] != src_crop.shape[:2]:
        crop_result = cv2.resize(work_result, (crop_w, crop_h), interpolation=cv2.INTER_LINEAR)
    else:
        crop_result = work_result
    
    # Composite het inpainted crop terug in de originele foto
    result = src_np.copy()
    result[cy0:cy1, cx0:cx1] = crop_result
    
    # Encode back to JPEG
    ok, buf = cv2.imencode('.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise HTTPException(status_code=500, detail="Kon resultaat niet encoderen")
    jpeg_bytes = buf.tobytes()
    
    # Thumbnail
    timg = Image.open(io.BytesIO(jpeg_bytes))
    thumb_size = 400
    ratio = thumb_size / max(timg.size)
    tb = timg.resize((int(timg.size[0] * ratio), int(timg.size[1] * ratio)), Image.Resampling.LANCZOS)
    tout = io.BytesIO()
    tb.save(tout, format='JPEG', quality=70, optimize=True)
    thumb_bytes = tout.getvalue()
    
    # 💾 Backup huidige bytes vóór overwrite — opslaan in cloud (sneller dan MongoDB voor grote files)
    backup_key = None
    try:
        if img_doc.get("cloud_stored") and init_storage():
            backup_key = f"{APP_NAME}/backups/{image_id}_before_inpaint.jpg"
            put_object(backup_key, full_bytes, "image/jpeg")
    except Exception as be:
        logger.warning(f"Backup naar cloud faalde voor {image_id}: {be}")
        backup_key = None
    
    # Overwrite storage
    if img_doc.get("cloud_stored") and init_storage():
        put_object(img_doc.get("storage_path") or f"{APP_NAME}/images/{image_id}.jpg", jpeg_bytes, "image/jpeg")
        if img_doc.get("thumb_path"):
            put_object(img_doc["thumb_path"], thumb_bytes, "image/jpeg")
    else:
        # Fallback voor non-cloud: backup als base64 in mongo
        backup_b64 = base64.b64encode(full_bytes).decode('utf-8')
        await db.images.update_one(
            {"id": image_id},
            {"$set": {
                "data": base64.b64encode(jpeg_bytes).decode('utf-8'),
                "thumbnail": base64.b64encode(thumb_bytes).decode('utf-8'),
                "compressed_size": len(jpeg_bytes),
                "inpaint_previous_data": backup_b64,
            }}
        )
    
    await db.images.update_one(
        {"id": image_id},
        {"$set": {
            "manually_inpainted_at": datetime.now(timezone.utc).isoformat(),
            **({"inpaint_backup_key": backup_key} if backup_key else {}),
        }}
    )
    logger.info(f"🧽 Manual inpaint applied to {image_id}")
    return {"success": True, "image_id": image_id}


@router.post("/images/{image_id}/undo-inpaint")
async def undo_inpaint(image_id: str, user: dict = Depends(require_admin)):
    """↶ Ongedaan maken: herstel de foto naar de versie vóór de laatste gum-actie."""
    import base64
    import io
    from PIL import Image
    
    img_doc = await db.images.find_one({"id": image_id}, {"_id": 0})
    if not img_doc:
        raise HTTPException(status_code=404, detail="Afbeelding niet gevonden")
    
    # Probeer eerst cloud-backup (snelste route), dan MongoDB-backup
    backup_bytes = None
    backup_key = img_doc.get("inpaint_backup_key")
    if backup_key and init_storage():
        try:
            backup_bytes, _ = get_object(backup_key)
        except Exception as e:
            logger.warning(f"Cloud-backup ophalen faalde: {e}")
    if backup_bytes is None:
        backup_b64 = img_doc.get("inpaint_previous_data")
        if backup_b64:
            backup_bytes = base64.b64decode(backup_b64)
    
    if backup_bytes is None:
        raise HTTPException(status_code=400, detail="Geen backup beschikbaar (gum-actie is al ongedaan gemaakt of er was geen actie)")
    
    # Regenerate thumbnail
    timg = Image.open(io.BytesIO(backup_bytes))
    if timg.mode in ('RGBA', 'P'):
        timg = timg.convert('RGB')
    thumb_size = 400
    ratio = thumb_size / max(timg.size)
    tb = timg.resize((int(timg.size[0] * ratio), int(timg.size[1] * ratio)), Image.Resampling.LANCZOS)
    tout = io.BytesIO()
    tb.save(tout, format='JPEG', quality=70, optimize=True)
    thumb_bytes = tout.getvalue()
    
    if img_doc.get("cloud_stored") and init_storage():
        put_object(img_doc.get("storage_path") or f"{APP_NAME}/images/{image_id}.jpg", backup_bytes, "image/jpeg")
        if img_doc.get("thumb_path"):
            put_object(img_doc["thumb_path"], thumb_bytes, "image/jpeg")
    else:
        await db.images.update_one(
            {"id": image_id},
            {"$set": {
                "data": backup_b64,
                "thumbnail": base64.b64encode(thumb_bytes).decode('utf-8'),
                "compressed_size": len(backup_bytes),
            }}
        )
    
    # Verwijder backup-referenties (cloud-object blijft staan, geen delete-functie beschikbaar)
    unset_fields = {"manually_inpainted_at": ""}
    if img_doc.get("inpaint_previous_data"):
        unset_fields["inpaint_previous_data"] = ""
    if img_doc.get("inpaint_backup_key"):
        unset_fields["inpaint_backup_key"] = ""
    await db.images.update_one(
        {"id": image_id},
        {"$unset": unset_fields}
    )
    logger.info(f"↶ Inpaint undone for {image_id}")
    return {"success": True, "image_id": image_id}


@router.post("/upload/multiple")
async def upload_multiple_images(request: Request, files: List[UploadFile] = File(...), blur_corner: str = "", user: dict = Depends(get_current_user)):
    """Upload multiple images and store in MongoDB - with compression.
    blur_corner: 'bottom-right' / 'bottom-left' / 'top-right' / 'top-left' om dealer-logo te blurren. Leeg = geen blur.
    
    (Mundi Moto: AI Magische Gum draait apart op foreign-listing creation.)"""
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
            
            # Blur dealer-logo in opgegeven hoek (~22% breedte × 16% hoogte)
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
                except Exception:
                    pass  # blur failure is non-fatal — keep original
            
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


