"""Public endpoint voor dealer-aanmeldingen op /taxatie landingspagina.
Verzamelt bedrijfsgegevens + 9 vaste motor-foto's + max 20 detail-foto's van schade.
Verstuurt een notificatie-email naar Sandro en maakt een record aan in `taxatie_aanvragen`.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from datetime import datetime, timezone
import os
import uuid
import logging
from typing import List
from config import db
import re

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads', 'taxatie_aanvragen')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 9 vaste foto-slots
FIXED_PHOTO_SLOTS = [
    "voorwiel", "achterwiel", "km_stand", "chassisnummer",
    "motorfiets_links", "motorfiets_rechts",
    "inkoop_verklaring", "kenteken_voor", "kenteken_achter",
]


def _save_file(prefix: str, upload: UploadFile) -> dict:
    """Sla een uploadbestand op en retourneer metadata."""
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", upload.filename or "")
    fname = f"{prefix}_{uuid.uuid4().hex[:8]}_{safe_name}"
    path = os.path.join(UPLOAD_DIR, fname)
    with open(path, "wb") as f:
        content = upload.file.read()
        f.write(content)
    return {
        "field": prefix,
        "filename": fname,
        "original_name": upload.filename,
        "size": len(content),
        "content_type": upload.content_type,
    }


@router.post("/public/taxatie-aanvraag")
async def submit_taxatie_aanvraag(
    bedrijfsnaam: str = Form(...),
    contactpersoon: str = Form(""),
    email: str = Form(...),
    telefoon: str = Form(""),
    adres: str = Form(...),
    woonplaats: str = Form(...),
    rsin: str = Form(...),
    opmerking: str = Form(""),
    # 9 vaste foto's
    foto_voorwiel: UploadFile = File(...),
    foto_achterwiel: UploadFile = File(...),
    foto_km_stand: UploadFile = File(...),
    foto_chassisnummer: UploadFile = File(...),
    foto_motorfiets_links: UploadFile = File(...),
    foto_motorfiets_rechts: UploadFile = File(...),
    foto_inkoop_verklaring: UploadFile = File(...),
    foto_kenteken_voor: UploadFile = File(...),
    foto_kenteken_achter: UploadFile = File(...),
    # Optionele detail-foto's (max 20)
    detail_fotos: List[UploadFile] = File(default=[]),
):
    """Verwerk een nieuwe taxatie-aanvraag van een dealer."""
    if len(detail_fotos) > 20:
        raise HTTPException(status_code=400, detail="Maximaal 20 detailfoto's toegestaan")

    aanvraag_id = str(uuid.uuid4())
    saved_files: list = []

    # 9 vaste foto-slots
    fixed_uploads = {
        "voorwiel": foto_voorwiel,
        "achterwiel": foto_achterwiel,
        "km_stand": foto_km_stand,
        "chassisnummer": foto_chassisnummer,
        "motorfiets_links": foto_motorfiets_links,
        "motorfiets_rechts": foto_motorfiets_rechts,
        "inkoop_verklaring": foto_inkoop_verklaring,
        "kenteken_voor": foto_kenteken_voor,
        "kenteken_achter": foto_kenteken_achter,
    }
    for field, upload in fixed_uploads.items():
        if not upload:
            continue
        try:
            saved_files.append(_save_file(f"{aanvraag_id}_{field}", upload))
        except Exception as e:
            logger.error(f"Failed to save {field}: {e}")
            raise HTTPException(status_code=500, detail=f"Foto '{field}' opslaan mislukt")

    # Detailfoto's
    for idx, upload in enumerate(detail_fotos, start=1):
        if not upload or not upload.filename:
            continue
        try:
            saved_files.append(_save_file(f"{aanvraag_id}_detail_{idx:02d}", upload))
        except Exception as e:
            logger.warning(f"Failed to save detail photo {idx}: {e}")

    # Sla op in MongoDB
    record = {
        "id": aanvraag_id,
        "bedrijfsnaam": bedrijfsnaam.strip(),
        "contactpersoon": contactpersoon.strip(),
        "email": email.strip().lower(),
        "telefoon": telefoon.strip(),
        "adres": adres.strip(),
        "woonplaats": woonplaats.strip(),
        "rsin": rsin.strip(),
        "opmerking": opmerking.strip(),
        "files": saved_files,
        "status": "nieuw",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.taxatie_aanvragen.insert_one(record)

    # Notificatie-email proberen te sturen
    try:
        from services.email_service import send_email
        await send_email(
            to="motoimportbv@gmail.com",
            subject=f"📄 Nieuwe taxatie-aanvraag: {bedrijfsnaam}",
            body=(
                f"Nieuwe taxatie-aanvraag ontvangen via motoimportbv.nl/taxatie:\n\n"
                f"Bedrijf: {bedrijfsnaam}\n"
                f"Contact: {contactpersoon}\n"
                f"Email: {email}\n"
                f"Telefoon: {telefoon}\n"
                f"Adres: {adres}, {woonplaats}\n"
                f"RSIN: {rsin}\n\n"
                f"Opmerking:\n{opmerking}\n\n"
                f"Aantal foto's: {len(saved_files)} (9 vast + {len(saved_files) - 9} detail)\n\n"
                f"Bekijk in admin → Taxatie-aanvragen."
            ),
        )
    except Exception as ee:
        logger.warning(f"Could not send notification email: {ee}")

    return {
        "status": "ok",
        "id": aanvraag_id,
        "files_uploaded": len(saved_files),
        "message": "Bedankt! We nemen binnen 24 uur contact met u op.",
    }


@router.get("/admin/taxatie-aanvragen")
async def list_aanvragen(current_user: dict = None):
    """Admin-only: lijst alle aanvragen."""
    # Hergebruik admin auth check via taxatie router
    from routers.taxatie import _is_admin_team, require_taxatie_access
    # Vraag op zonder dependency-injection: handmatige check via header
    aanvragen = await db.taxatie_aanvragen.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"aanvragen": aanvragen}
