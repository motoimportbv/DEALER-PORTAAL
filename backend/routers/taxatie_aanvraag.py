"""Public endpoint voor dealer-aanmeldingen op /taxatie landingspagina.
Verzamelt bedrijfsgegevens + 9 vaste motor-foto's + max 20 detail-foto's van schade.
- Slaat een record op in `taxatie_aanvragen`
- Maakt automatisch (of werkt bij) een klant in `customers` (gekoppeld aan motoimportbv@gmail.com)
- Verstuurt een notificatie-email naar motoimportbv@gmail.com
- Admin endpoints om aanvragen te bekijken / status te wijzigen
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Body
from fastapi.responses import FileResponse
from datetime import datetime, timezone
from typing import List, Optional
import os
import re
import uuid
import logging

from database import db
from services.email_service import send_email
from services.auth_service import get_current_user
from routers.taxatie import _is_admin_team

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads', 'taxatie_aanvragen')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ADMIN_OWNER_EMAIL = "motoimportbv@gmail.com"  # Aanvragen koppelen aan dit admin-account


def _save_file(prefix: str, upload: UploadFile, field_key: str = "") -> dict:
    """Sla een uploadbestand op en retourneer metadata."""
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", upload.filename or "upload")
    fname = f"{prefix}_{uuid.uuid4().hex[:8]}_{safe_name}"
    path = os.path.join(UPLOAD_DIR, fname)
    with open(path, "wb") as f:
        content = upload.file.read()
        f.write(content)
    return {
        "field": field_key,
        "filename": fname,
        "url": f"/api/uploads/taxatie_aanvragen/{fname}",
        "original_name": upload.filename,
        "size": len(content),
        "content_type": upload.content_type,
    }


async def _ensure_customer(record: dict) -> Optional[str]:
    """Maak (of update) een customer-record gekoppeld aan het Moto Import admin-account.
    Retourneert het customer.id.
    """
    try:
        # Vind admin user id voor motoimportbv@gmail.com
        admin_user = await db.users.find_one({"email": ADMIN_OWNER_EMAIL})
        if not admin_user:
            return None
        admin_id = admin_user.get("id") or str(admin_user.get("_id"))

        name = (record.get("bedrijfsnaam") or "").strip()
        if not name:
            return None
        name_slug = re.sub(r"\s+", " ", name.lower())

        update_set = {
            "name": name,
            "name_slug": name_slug,
            "phone": record.get("telefoon", ""),
            "email": (record.get("email") or "").lower(),
            "address": record.get("adres", ""),
            "city": record.get("woonplaats", ""),
            "rsin": record.get("rsin", ""),
            "contact_person": record.get("contactpersoon", ""),
            "source": "taxatie_aanvraag",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": admin_id,
        }
        update_set_on_insert = {
            "id": str(uuid.uuid4()),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.customers.update_one(
            {"created_by": admin_id, "name_slug": name_slug},
            {
                "$set": update_set,
                "$setOnInsert": update_set_on_insert,
                "$inc": {"usage_count": 1},
            },
            upsert=True,
        )
        # Haal id op
        cust = await db.customers.find_one(
            {"created_by": admin_id, "name_slug": name_slug},
            {"_id": 0, "id": 1},
        )
        return cust.get("id") if cust else None
    except Exception as e:
        logger.warning(f"_ensure_customer failed: {e}")
        return None


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
            saved_files.append(_save_file(f"{aanvraag_id}_{field}", upload, field_key=field))
        except Exception as e:
            logger.error(f"Failed to save {field}: {e}")
            raise HTTPException(status_code=500, detail=f"Foto '{field}' opslaan mislukt")

    # Detailfoto's
    for idx, upload in enumerate(detail_fotos, start=1):
        if not upload or not upload.filename:
            continue
        try:
            saved_files.append(_save_file(f"{aanvraag_id}_detail_{idx:02d}", upload, field_key=f"detail_{idx:02d}"))
        except Exception as e:
            logger.warning(f"Failed to save detail photo {idx}: {e}")

    # Bereken aantallen voor opslag
    aantal_detail = sum(1 for f in saved_files if "_detail_" in f["filename"])
    aantal_vast = len(saved_files) - aantal_detail

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

    # Auto-create / update customer (gekoppeld aan admin motoimportbv@gmail.com)
    customer_id = await _ensure_customer(record)
    if customer_id:
        record["customer_id"] = customer_id

    await db.taxatie_aanvragen.insert_one(record)

    # Notificatie-email
    try:
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #18181b; color: white; padding: 20px;">
            <h2 style="margin: 0; color: #f87171;">Nieuwe taxatie-aanvraag</h2>
            <p style="margin: 4px 0 0; color: #a1a1aa; font-size: 13px;">via motoimportbv.nl/taxatie</p>
          </div>
          <div style="padding: 20px; background: #fff;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #71717a;">Bedrijf</td><td style="padding: 6px 0; font-weight: bold;">{bedrijfsnaam}</td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">Contact</td><td style="padding: 6px 0;">{contactpersoon or '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">E-mail</td><td style="padding: 6px 0;"><a href="mailto:{email}">{email}</a></td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">Telefoon</td><td style="padding: 6px 0;">{telefoon or '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">Adres</td><td style="padding: 6px 0;">{adres}, {woonplaats}</td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">RSIN/BSN</td><td style="padding: 6px 0;">{rsin}</td></tr>
            </table>
            <hr style="margin: 16px 0; border: none; border-top: 1px solid #e4e4e7;">
            <p style="font-size: 13px;"><strong>Opmerking:</strong><br>{(opmerking or '—').replace(chr(10), '<br>')}</p>
            <p style="margin: 16px 0; padding: 12px; background: #fef3c7; border-left: 4px solid #f59e0b; font-size: 13px;">
              <strong>{aantal_vast} vaste foto's</strong> + <strong>{aantal_detail} detailfoto's</strong> geüpload.
            </p>
            <p style="font-size: 13px; color: #71717a;">Bekijk in admin: <a href="https://www.motoimportbv.nl/admin/taxatie-aanvragen">/admin/taxatie-aanvragen</a></p>
          </div>
        </div>
        """
        await send_email(
            to_email=ADMIN_OWNER_EMAIL,
            subject=f"📄 Nieuwe taxatie-aanvraag: {bedrijfsnaam}",
            html_content=html,
        )
    except Exception as ee:
        logger.warning(f"Could not send notification email: {ee}")

    return {
        "status": "ok",
        "id": aanvraag_id,
        "files_uploaded": len(saved_files),
        "customer_id": customer_id,
        "message": "Bedankt! We nemen binnen 24 uur contact met u op.",
    }


# ============ ADMIN ENDPOINTS ============

@router.get("/admin/taxatie-aanvragen")
async def list_aanvragen(current_user: dict = Depends(get_current_user)):
    """Admin-only: lijst alle aanvragen, nieuwste eerst."""
    if not _is_admin_team(current_user):
        raise HTTPException(status_code=403, detail="Geen toegang")
    aanvragen = await db.taxatie_aanvragen.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"aanvragen": aanvragen}


@router.get("/admin/taxatie-aanvragen/{aanvraag_id}")
async def get_aanvraag(aanvraag_id: str, current_user: dict = Depends(get_current_user)):
    """Admin-only: detail van één aanvraag."""
    if not _is_admin_team(current_user):
        raise HTTPException(status_code=403, detail="Geen toegang")
    doc = await db.taxatie_aanvragen.find_one({"id": aanvraag_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Aanvraag niet gevonden")
    return doc


@router.post("/admin/taxatie-aanvragen/{aanvraag_id}/status")
async def update_status(
    aanvraag_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Admin-only: update de status van een aanvraag (nieuw / in_behandeling / afgerond / afgewezen)."""
    if not _is_admin_team(current_user):
        raise HTTPException(status_code=403, detail="Geen toegang")
    status = (body.get("status") or "").strip()
    if status not in {"nieuw", "in_behandeling", "afgerond", "afgewezen"}:
        raise HTTPException(status_code=400, detail="Ongeldige status")
    result = await db.taxatie_aanvragen.update_one(
        {"id": aanvraag_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Aanvraag niet gevonden")
    return {"status": "ok", "new_status": status}


@router.delete("/admin/taxatie-aanvragen/{aanvraag_id}")
async def delete_aanvraag(aanvraag_id: str, current_user: dict = Depends(get_current_user)):
    """Admin-only: verwijder een aanvraag incl. bestanden."""
    if not _is_admin_team(current_user):
        raise HTTPException(status_code=403, detail="Geen toegang")
    doc = await db.taxatie_aanvragen.find_one({"id": aanvraag_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Aanvraag niet gevonden")
    # Verwijder bestanden
    for f in doc.get("files", []):
        try:
            path = os.path.join(UPLOAD_DIR, f["filename"])
            if os.path.exists(path):
                os.remove(path)
        except Exception as e:
            logger.warning(f"Could not delete file {f.get('filename')}: {e}")
    await db.taxatie_aanvragen.delete_one({"id": aanvraag_id})
    return {"status": "deleted"}
