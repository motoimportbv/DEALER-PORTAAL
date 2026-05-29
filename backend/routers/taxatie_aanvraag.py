"""Public endpoint voor dealer-aanmeldingen op /taxatie landingspagina.
Verzamelt bedrijfsgegevens + 9 vaste motor-foto's + max 20 detail-foto's van schade.
- Slaat een record op in `taxatie_aanvragen`
- Maakt automatisch (of werkt bij) een klant in `customers` (gekoppeld aan motoimportbv@gmail.com)
- Verstuurt een notificatie-email naar motoimportbv@gmail.com
- Admin endpoints om aanvragen te bekijken / status te wijzigen
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Body, Request
from fastapi.responses import FileResponse
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import os
import re
import uuid
import secrets
import hashlib
import logging

from database import db
from services.email_service import send_email, send_email_with_attachment
from services.auth_service import get_current_user, hash_password, verify_password, create_token
from routers.taxatie import _is_admin_team

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads', 'taxatie_aanvragen')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ADMIN_OWNER_EMAIL = "motoimportbv@gmail.com"  # Aanvragen koppelen aan dit admin-account
TAXATIE_DEALER_ROLE = "taxatie_dealer"


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
    # AUTH: alleen ingelogde dealers / admin / taxateur mogen aanvragen indienen
    current_user: dict = Depends(get_current_user),
):
    """Verwerk een nieuwe taxatie-aanvraag van een ingelogde dealer (of admin/taxateur intern)."""
    role = (current_user or {}).get("role")
    if role not in (TAXATIE_DEALER_ROLE, "admin", "taxateur"):
        raise HTTPException(
            status_code=403,
            detail="U moet inloggen als dealer om een taxatie-aanvraag in te dienen.",
        )
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

    # Kort, leesbaar referentienummer voor de dealer (bv. "TX-A1B2C3D4")
    ref_nr = f"TX-{aanvraag_id[:8].upper()}"
    record["ref_nr"] = ref_nr

    await db.taxatie_aanvragen.insert_one(record)

    # 1) Admin notificatie-email
    try:
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #18181b; color: white; padding: 20px;">
            <h2 style="margin: 0; color: #f87171;">Nieuwe taxatie-aanvraag</h2>
            <p style="margin: 4px 0 0; color: #a1a1aa; font-size: 13px;">via motoimportbv.nl/taxatie — ref. {ref_nr}</p>
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
            subject=f"📄 Nieuwe taxatie-aanvraag {ref_nr}: {bedrijfsnaam}",
            html_content=html,
        )
    except Exception as ee:
        logger.warning(f"Could not send admin notification email: {ee}")

    # 2) Dealer bevestigingsmail (met referentienummer + overzicht)
    try:
        dealer_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fafafa;">
          <div style="background: linear-gradient(135deg, #18181b, #7f1d1d); color: white; padding: 28px 24px;">
            <h1 style="margin: 0 0 6px; font-size: 22px;">Bedankt voor uw aanvraag!</h1>
            <p style="margin: 0; color: #fecaca; font-size: 14px;">Uw taxatieverslag is onderweg.</p>
          </div>
          <div style="background: white; padding: 24px;">
            <p style="font-size: 15px; color: #18181b; margin: 0 0 12px;">Beste {contactpersoon or bedrijfsnaam},</p>
            <p style="font-size: 14px; color: #3f3f46; line-height: 1.6;">
              Wij hebben uw taxatie-aanvraag goed ontvangen. Onze taxateur gaat er binnen
              <strong>48 uur</strong> mee aan de slag en stuurt u het officiële taxatieverslag
              (PDF) plus de BPM-berekening per e-mail toe.
            </p>

            <div style="margin: 20px 0; padding: 16px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 6px;">
              <p style="margin: 0; font-size: 12px; color: #991b1b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Uw referentienummer</p>
              <p style="margin: 4px 0 0; font-size: 22px; font-weight: bold; color: #18181b; letter-spacing: 1px;">{ref_nr}</p>
              <p style="margin: 6px 0 0; font-size: 12px; color: #71717a;">Vermeld dit nummer bij vragen of contact.</p>
            </div>

            <h3 style="font-size: 14px; color: #18181b; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Overzicht van uw aanvraag</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding: 5px 0; color: #71717a; width: 35%;">Bedrijf</td><td style="padding: 5px 0; color: #18181b;"><strong>{bedrijfsnaam}</strong></td></tr>
              <tr><td style="padding: 5px 0; color: #71717a;">Contactpersoon</td><td style="padding: 5px 0; color: #18181b;">{contactpersoon or '—'}</td></tr>
              <tr><td style="padding: 5px 0; color: #71717a;">E-mail</td><td style="padding: 5px 0; color: #18181b;">{email}</td></tr>
              <tr><td style="padding: 5px 0; color: #71717a;">Telefoon</td><td style="padding: 5px 0; color: #18181b;">{telefoon or '—'}</td></tr>
              <tr><td style="padding: 5px 0; color: #71717a;">Adres</td><td style="padding: 5px 0; color: #18181b;">{adres}, {woonplaats}</td></tr>
              <tr><td style="padding: 5px 0; color: #71717a;">RSIN/BSN</td><td style="padding: 5px 0; color: #18181b;">{rsin}</td></tr>
              <tr><td style="padding: 5px 0; color: #71717a;">Foto's ontvangen</td><td style="padding: 5px 0; color: #18181b;"><strong>{aantal_vast} vaste foto's</strong> + {aantal_detail} detailfoto's</td></tr>
            </table>

            {'<p style="margin: 16px 0 0; padding: 12px; background: #f4f4f5; border-radius: 6px; font-size: 13px; color: #3f3f46;"><strong>Uw opmerking:</strong><br>' + opmerking.replace(chr(10), '<br>') + '</p>' if opmerking else ''}

            <h3 style="font-size: 14px; color: #18181b; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Wat gebeurt er nu?</h3>
            <ol style="font-size: 13px; color: #3f3f46; line-height: 1.7; padding-left: 18px; margin: 0;">
              <li>Onze taxateur controleert uw foto's en gegevens</li>
              <li>Hij stelt het officiële taxatieverslag op (Belastingdienst-proof)</li>
              <li>U ontvangt het PDF-rapport en factuur binnen 48 uur op <a href="mailto:{email}" style="color: #dc2626;">{email}</a></li>
            </ol>

            <div style="margin: 28px 0 8px; padding: 16px; background: #18181b; border-radius: 8px; text-align: center;">
              <p style="margin: 0 0 8px; color: #fafafa; font-size: 13px;">Vragen? Bel of mail Sandro direct:</p>
              <p style="margin: 0;">
                <a href="tel:+31624264861" style="color: #fca5a5; font-weight: bold; text-decoration: none; margin-right: 16px;">📞 06-24264861</a>
                <a href="mailto:motoimportbv@gmail.com" style="color: #fca5a5; font-weight: bold; text-decoration: none;">✉️ motoimportbv@gmail.com</a>
              </p>
            </div>
          </div>
          <div style="background: #18181b; padding: 16px; text-align: center; color: #a1a1aa; font-size: 11px;">
            <p style="margin: 2px 0;"><strong style="color: white;">Moto Import B.V.</strong> — gespecialiseerd in motorfiets-taxaties</p>
            <p style="margin: 2px 0;">www.motoimportbv.nl</p>
          </div>
        </div>
        """
        await send_email(
            to_email=email.strip(),
            subject=f"Bevestiging taxatie-aanvraag {ref_nr} — Moto Import",
            html_content=dealer_html,
        )
    except Exception as ee:
        logger.warning(f"Could not send dealer confirmation email: {ee}")

    return {
        "status": "ok",
        "id": aanvraag_id,
        "ref_nr": ref_nr,
        "files_uploaded": len(saved_files),
        "customer_id": customer_id,
        "message": f"Bedankt! Uw referentienummer is {ref_nr}. We nemen binnen 24 uur contact met u op.",
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


# ============ PAGE VIEW TRACKING ============

def _parse_user_agent(ua: str) -> str:
    """Extract een korte apparaat-omschrijving uit een user-agent string."""
    ua_lower = (ua or "").lower()
    if "iphone" in ua_lower:
        return "iPhone"
    if "ipad" in ua_lower:
        return "iPad"
    if "android" in ua_lower:
        return "Android"
    if "macintosh" in ua_lower or "mac os" in ua_lower:
        return "Mac"
    if "windows" in ua_lower:
        return "Windows"
    if "linux" in ua_lower:
        return "Linux"
    return "Onbekend apparaat"


async def _lookup_geo(ip: str) -> dict:
    """Probeer een ruwe locatie te bepalen via ip-api.com (gratis, geen key)."""
    if not ip or ip.startswith(("127.", "10.", "192.168.", "172.")) or ip == "::1":
        return {"country": "", "city": "", "isp": ""}
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"http://ip-api.com/json/{ip}?fields=status,country,city,isp")
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == "success":
                    return {
                        "country": data.get("country", ""),
                        "city": data.get("city", ""),
                        "isp": data.get("isp", ""),
                    }
    except Exception:
        pass
    return {"country": "", "city": "", "isp": ""}


@router.post("/public/taxatie-view")
async def track_taxatie_view(request: Request, body: dict = Body(default={})):
    """Log een bezoek aan /taxatie en stuur een email-notificatie (max 1× per IP per uur)."""
    # Haal IP en user-agent op (achter proxy: X-Forwarded-For of X-Real-IP)
    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "")
        or (request.client.host if request.client else "")
    )
    ua = request.headers.get("user-agent", "")
    referrer = request.headers.get("referer", "") or body.get("referrer", "")
    device = _parse_user_agent(ua)

    geo = await _lookup_geo(ip)
    location = ", ".join(p for p in [geo.get("city"), geo.get("country")] if p) or "Onbekende locatie"

    now = datetime.now(timezone.utc)
    view_doc = {
        "id": str(uuid.uuid4()),
        "ip": ip,
        "user_agent": ua[:200],
        "device": device,
        "country": geo.get("country", ""),
        "city": geo.get("city", ""),
        "isp": geo.get("isp", ""),
        "referrer": referrer[:200],
        "created_at": now.isoformat(),
    }
    await db.taxatie_views.insert_one(view_doc)

    # Stuur notificatie max 1× per IP per uur (anti-spam) — alleen als IP bekend is
    notif_sent = False
    if ip:
        last_notif = await db.taxatie_views.find_one(
            {"ip": ip, "notif_sent": True, "created_at": {"$gte": (now - timedelta(hours=1)).isoformat()}},
            sort=[("created_at", -1)],
        )
        if not last_notif:
            try:
                html = f"""
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
                  <div style="background: #18181b; color: white; padding: 18px 20px;">
                    <h2 style="margin: 0; font-size: 18px;">Bezoeker op /taxatie</h2>
                    <p style="margin: 4px 0 0; color: #a1a1aa; font-size: 12px;">Iemand bekijkt nu uw aanmeldpagina</p>
                  </div>
                  <div style="padding: 20px; background: #fff;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                      <tr><td style="padding: 5px 0; color: #71717a; width: 32%;">Tijdstip</td><td style="padding: 5px 0;"><strong>{now.strftime('%H:%M')}</strong> &middot; {now.strftime('%d-%m-%Y')}</td></tr>
                      <tr><td style="padding: 5px 0; color: #71717a;">Locatie</td><td style="padding: 5px 0;"><strong>{location}</strong></td></tr>
                      <tr><td style="padding: 5px 0; color: #71717a;">Apparaat</td><td style="padding: 5px 0;">{device}</td></tr>
                      {f'<tr><td style="padding: 5px 0; color: #71717a;">Provider</td><td style="padding: 5px 0;">{geo.get("isp")}</td></tr>' if geo.get("isp") else ''}
                      {f'<tr><td style="padding: 5px 0; color: #71717a;">Verwijzer</td><td style="padding: 5px 0; font-size: 11px; color: #555;">{referrer[:80]}</td></tr>' if referrer else ''}
                    </table>
                    <p style="margin: 18px 0 0; padding: 12px; background: #f4f4f5; border-radius: 6px; font-size: 12px; color: #71717a;">
                      Tip: u krijgt max 1× per uur een mail per bezoeker (anti-spam). Volledig overzicht in <a href="https://www.motoimportbv.nl/admin/taxatie-aanvragen" style="color: #dc2626;">admin</a>.
                    </p>
                  </div>
                </div>
                """
                await send_email(
                    to_email=ADMIN_OWNER_EMAIL,
                    subject=f"Bezoeker op /taxatie — {location}",
                    html_content=html,
                )
                notif_sent = True
                await db.taxatie_views.update_one({"id": view_doc["id"]}, {"$set": {"notif_sent": True}})
            except Exception as ee:
                logger.warning(f"Kon view-notificatie niet sturen: {ee}")

    return {"status": "ok", "tracked": True, "notif_sent": notif_sent}


@router.get("/admin/taxatie-views")
async def list_taxatie_views(current_user: dict = Depends(get_current_user)):
    """Admin-only: laatste 200 bezoeken aan /taxatie + dag/totaal-tellers."""
    if not _is_admin_team(current_user):
        raise HTTPException(status_code=403, detail="Geen toegang")
    views = await db.taxatie_views.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_count = sum(1 for v in views if v.get("created_at", "").startswith(today))
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    week_count = sum(1 for v in views if v.get("created_at", "") >= week_ago)
    total_count = await db.taxatie_views.count_documents({})
    return {
        "views": views,
        "today": today_count,
        "week": week_count,
        "total": total_count,
    }


# ============ TAXATIE DEALER ACCOUNTS (self-registration) ============


async def _require_taxatie_dealer(current_user: dict = Depends(get_current_user)) -> dict:
    if (current_user or {}).get("role") != TAXATIE_DEALER_ROLE:
        raise HTTPException(status_code=403, detail="Geen toegang — alleen voor dealer-accounts")
    return current_user


@router.post("/public/taxatie-dealer-register")
async def taxatie_dealer_register(request: Request, body: dict = Body(...)):
    """Self-registration voor motordealers die taxatie-aanvragen willen indienen.

    Direct toegang (geen approval), JWT terug, account wordt direct gekoppeld
    aan een customer-record onder motoimportbv@gmail.com.
    """
    # Rate limit: max 3 nieuwe registraties per IP per 10 minuten (anti-misbruik)
    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "")
    )
    if ip:
        recent = await db.users.count_documents({
            "registered_ip": ip,
            "role": TAXATIE_DEALER_ROLE,
            "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()},
        })
        if recent >= 3:
            raise HTTPException(status_code=429, detail="Te veel registraties vanaf dit adres. Probeer over 10 minuten opnieuw.")

    # Valideer verplichte velden
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    bedrijfsnaam = (body.get("bedrijfsnaam") or "").strip()
    kvk = (body.get("kvk") or "").strip()
    rsin = (body.get("rsin") or "").strip()
    contactpersoon = (body.get("contactpersoon") or "").strip()
    telefoon = (body.get("telefoon") or "").strip()
    adres = (body.get("adres") or "").strip()
    postcode = (body.get("postcode") or "").strip()
    woonplaats = (body.get("woonplaats") or "").strip()
    art8_vergunning = bool(body.get("art8_vergunning"))
    art8_nummer = (body.get("art8_nummer") or "").strip()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Geldig e-mailadres is verplicht")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Wachtwoord moet minstens 8 tekens zijn")
    if not bedrijfsnaam:
        raise HTTPException(status_code=400, detail="Bedrijfsnaam is verplicht")
    if not kvk and not rsin:
        raise HTTPException(status_code=400, detail="KVK of RSIN is verplicht")
    if not telefoon:
        raise HTTPException(status_code=400, detail="Telefoonnummer is verplicht")

    # Case-insensitive email-uniciteit
    existing = await db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Dit e-mailadres is al geregistreerd. Log in i.p.v. een nieuw account aan te maken.")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(password),
        "role": TAXATIE_DEALER_ROLE,
        "company_name": bedrijfsnaam,
        "name": contactpersoon or bedrijfsnaam,
        "contact_person": contactpersoon,
        "phone": telefoon,
        "kvk_number": kvk,
        "rsin": rsin,
        "address": adres,
        "postal_code": postcode,
        "city": woonplaats,
        "art8_vergunning": art8_vergunning,
        "art8_nummer": art8_nummer,
        "is_approved": True,
        "created_at": now,
        "registered_ip": ip,
    }
    await db.users.insert_one(user_doc)

    # Maak ook een customer-record onder motoimportbv@gmail.com zodat aanvragen
    # gekoppeld zijn aan jouw klantenbestand
    try:
        record = {
            "bedrijfsnaam": bedrijfsnaam,
            "contactpersoon": contactpersoon,
            "email": email,
            "telefoon": telefoon,
            "adres": adres,
            "woonplaats": woonplaats,
            "rsin": rsin,
        }
        customer_id = await _ensure_customer(record)
        if customer_id:
            # Voeg KVK/postcode/art8 toe op de customer
            update = {"postcode": postcode, "kvk_number": kvk}
            if art8_vergunning:
                update["art8_vergunning"] = True
                update["art8_nummer"] = art8_nummer
            await db.customers.update_one({"id": customer_id}, {"$set": update})
            await db.users.update_one({"id": user_id}, {"$set": {"customer_id": customer_id}})
    except Exception as e:
        logger.warning(f"_ensure_customer voor dealer-register faalde: {e}")

    # Welkomstmail naar dealer + notificatie naar admin
    try:
        await send_email(
            to_email=email,
            subject="Welkom bij Moto Import — uw dealer-account is actief",
            html_content=f"""
            <div style="font-family: Arial; max-width: 560px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #18181b, #7f1d1d); color: white; padding: 24px;">
                <h1 style="margin: 0;">Welkom, {contactpersoon or bedrijfsnaam}!</h1>
              </div>
              <div style="background: white; padding: 24px; font-size: 14px; color: #18181b;">
                <p>Uw dealer-account voor taxatieverslagen is direct actief. U kunt nu:</p>
                <ul style="line-height: 1.8;">
                  <li>Nieuwe taxatie-aanvragen indienen vanuit uw eigen dashboard</li>
                  <li>De status van uw aanvragen volgen</li>
                  <li>Alle eerdere taxaties terugzien</li>
                </ul>
                <p style="margin: 24px 0;">
                  <a href="https://www.motoimportbv.nl/taxatie-dealer/login" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Inloggen op dashboard</a>
                </p>
                <p style="font-size: 12px; color: #71717a;">Vragen? Bel 06-24264861 of mail motoimportbv@gmail.com</p>
              </div>
            </div>
            """,
        )
    except Exception as ee:
        logger.warning(f"Welkomstmail dealer faalde: {ee}")

    try:
        await send_email(
            to_email=ADMIN_OWNER_EMAIL,
            subject=f"Nieuwe taxatie-dealer geregistreerd: {bedrijfsnaam}",
            html_content=f"""
            <p>Nieuwe dealer registratie via /dealer/register:</p>
            <ul>
              <li><strong>Bedrijf:</strong> {bedrijfsnaam}</li>
              <li><strong>Contact:</strong> {contactpersoon or '—'}</li>
              <li><strong>Email:</strong> {email}</li>
              <li><strong>Telefoon:</strong> {telefoon}</li>
              <li><strong>KVK/RSIN:</strong> {kvk or '—'} / {rsin or '—'}</li>
              <li><strong>Art.8:</strong> {'Ja — ' + art8_nummer if art8_vergunning else 'Nee'}</li>
            </ul>
            """,
        )
    except Exception:
        pass

    token = create_token(user_id, email, TAXATIE_DEALER_ROLE)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": email,
            "role": TAXATIE_DEALER_ROLE,
            "company_name": bedrijfsnaam,
            "name": contactpersoon or bedrijfsnaam,
        },
    }


@router.get("/dealer/me")
async def dealer_me(current_user: dict = Depends(_require_taxatie_dealer)):
    """Profiel van de ingelogde dealer (zonder password_hash)."""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "company_name": current_user.get("company_name", ""),
        "name": current_user.get("name", ""),
        "contact_person": current_user.get("contact_person", ""),
        "phone": current_user.get("phone", ""),
        "kvk_number": current_user.get("kvk_number", ""),
        "rsin": current_user.get("rsin", ""),
        "address": current_user.get("address", ""),
        "postal_code": current_user.get("postal_code", ""),
        "city": current_user.get("city", ""),
        "art8_vergunning": current_user.get("art8_vergunning", False),
        "art8_nummer": current_user.get("art8_nummer", ""),
        "role": current_user.get("role"),
    }


@router.patch("/dealer/me")
async def dealer_update_me(
    body: dict = Body(...),
    current_user: dict = Depends(_require_taxatie_dealer),
):
    """Dealer kan eigen bedrijfsgegevens bijwerken (geen email/role/password)."""
    allowed = {
        "company_name", "contact_person", "phone", "kvk_number", "rsin",
        "address", "postal_code", "city", "art8_vergunning", "art8_nummer",
    }
    update: dict = {}
    for k, v in (body or {}).items():
        if k in allowed:
            if k == "art8_vergunning":
                update[k] = bool(v)
            else:
                update[k] = (str(v) if v is not None else "").strip()
    # Houd 'name' in sync met contact_person (gebruikt voor display)
    if "contact_person" in update:
        update["name"] = update["contact_person"] or update.get("company_name") or current_user.get("name", "")

    if not update:
        raise HTTPException(status_code=400, detail="Geen geldige velden om bij te werken")

    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"id": current_user["id"]}, {"$set": update})

    # Sync ook customer-record onder motoimportbv@gmail.com
    customer_id = current_user.get("customer_id")
    if customer_id:
        cust_update: dict = {}
        if "company_name" in update:
            cust_update["name"] = update["company_name"]
        if "contact_person" in update:
            cust_update["contact_person"] = update["contact_person"]
        if "phone" in update:
            cust_update["phone"] = update["phone"]
        if "address" in update:
            cust_update["address"] = update["address"]
        if "city" in update:
            cust_update["city"] = update["city"]
        if "postal_code" in update:
            cust_update["postcode"] = update["postal_code"]
        if "kvk_number" in update:
            cust_update["kvk_number"] = update["kvk_number"]
        if "rsin" in update:
            cust_update["rsin"] = update["rsin"]
        if "art8_vergunning" in update:
            cust_update["art8_vergunning"] = update["art8_vergunning"]
        if "art8_nummer" in update:
            cust_update["art8_nummer"] = update["art8_nummer"]
        if cust_update:
            await db.customers.update_one({"id": customer_id}, {"$set": cust_update})

    # Stuur bijgewerkte profielversie terug
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    return updated


@router.get("/admin/taxatie-dealers")
async def list_taxatie_dealers(current_user: dict = Depends(get_current_user)):
    """Admin-only: lijst alle geregistreerde taxatie-dealers + aantal aanvragen per dealer."""
    if not _is_admin_team(current_user):
        raise HTTPException(status_code=403, detail="Geen toegang")
    dealers = await db.users.find(
        {"role": "taxatie_dealer"},
        {"_id": 0, "password_hash": 0, "registered_ip": 0},
    ).sort("created_at", -1).to_list(500)

    # Tel aanvragen per dealer (op email match)
    emails = [d.get("email", "").lower() for d in dealers]
    counts: dict = {}
    if emails:
        pipeline = [
            {"$match": {"email": {"$in": emails}}},
            {"$group": {"_id": "$email", "count": {"$sum": 1}, "last": {"$max": "$created_at"}}},
        ]
        async for row in db.taxatie_aanvragen.aggregate(pipeline):
            counts[row["_id"]] = {"count": row["count"], "last": row.get("last")}

    for d in dealers:
        info = counts.get(d.get("email", "").lower(), {})
        d["aanvragen_count"] = info.get("count", 0)
        d["last_aanvraag_at"] = info.get("last")

    return {"dealers": dealers}


@router.get("/dealer/aanvragen")
async def dealer_list_aanvragen(current_user: dict = Depends(_require_taxatie_dealer)):
    """Alle taxatie-aanvragen van de ingelogde dealer (gematcht op email)."""
    email = current_user.get("email", "").lower()
    aanvragen = await db.taxatie_aanvragen.find(
        {"email": email}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"aanvragen": aanvragen}


# ============ PASSWORD RESET (forgot password) ============

PASSWORD_RESET_TTL_MINUTES = 60
PASSWORD_RESET_RATE_LIMIT = 3  # max per email per 15 min


def _hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@router.post("/public/taxatie-dealer-forgot-password")
async def taxatie_dealer_forgot_password(body: dict = Body(...)):
    """Stuur een password-reset e-mail. Reveal nooit of het e-mailadres bestaat."""
    email = (body.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Geldig e-mailadres is verplicht")

    now = datetime.now(timezone.utc)

    # Rate limit
    recent = await db.password_resets.count_documents({
        "email": email,
        "created_at": {"$gte": (now - timedelta(minutes=15)).isoformat()},
    })
    if recent >= PASSWORD_RESET_RATE_LIMIT:
        # Geef alsnog 200 terug om enumeration te voorkomen
        return {"status": "ok", "message": "Als dit e-mailadres bekend is ontvangt u zo een reset-link."}

    # Vind gebruiker (case-insensitive)
    user = await db.users.find_one({
        "email": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
        "role": TAXATIE_DEALER_ROLE,
    })

    if user:
        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_reset_token(raw_token)
        expires_at = now + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES)
        await db.password_resets.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "user_id": user["id"],
            "token_hash": token_hash,
            "expires_at": expires_at.isoformat(),
            "used": False,
            "created_at": now.isoformat(),
        })

        reset_link = f"https://www.motoimportbv.nl/taxatie-dealer/reset/{raw_token}"
        try:
            await send_email(
                to_email=email,
                subject="Wachtwoord resetten — Moto Import dealer-account",
                html_content=f"""
                <div style="font-family: Arial; max-width: 560px; margin: 0 auto;">
                  <div style="background: #18181b; color: white; padding: 20px;">
                    <h2 style="margin: 0;">Wachtwoord resetten</h2>
                  </div>
                  <div style="background: white; padding: 24px; font-size: 14px;">
                    <p>U vroeg een nieuw wachtwoord aan voor uw Moto Import dealer-account.</p>
                    <p>Klik op onderstaande knop om een nieuw wachtwoord in te stellen. Deze link is <strong>60 minuten</strong> geldig.</p>
                    <p style="text-align: center; margin: 28px 0;">
                      <a href="{reset_link}" style="background: #dc2626; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold;">Nieuw wachtwoord instellen</a>
                    </p>
                    <p style="font-size: 12px; color: #71717a;">Werkt de knop niet? Kopieer deze link:<br><span style="word-break: break-all;">{reset_link}</span></p>
                    <p style="font-size: 12px; color: #71717a; margin-top: 24px;">Niet aangevraagd? Negeer deze e-mail — uw wachtwoord blijft hetzelfde.</p>
                  </div>
                </div>
                """,
            )
        except Exception as e:
            logger.warning(f"Wachtwoord-resetmail kon niet verstuurd worden: {e}")

    return {"status": "ok", "message": "Als dit e-mailadres bekend is ontvangt u zo een reset-link."}


@router.post("/public/taxatie-dealer-reset-password")
async def taxatie_dealer_reset_password(body: dict = Body(...)):
    """Wissel een reset-token om naar een nieuw wachtwoord."""
    raw_token = (body.get("token") or "").strip()
    new_password = body.get("password") or ""

    if not raw_token:
        raise HTTPException(status_code=400, detail="Reset-token ontbreekt")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Wachtwoord moet minstens 8 tekens zijn")

    token_hash = _hash_reset_token(raw_token)
    now = datetime.now(timezone.utc).isoformat()

    record = await db.password_resets.find_one({
        "token_hash": token_hash,
        "used": False,
        "expires_at": {"$gte": now},
    })
    if not record:
        raise HTTPException(status_code=400, detail="Deze link is ongeldig of verlopen. Vraag een nieuwe aan.")

    user_id = record.get("user_id")
    user = await db.users.find_one({"id": user_id, "role": TAXATIE_DEALER_ROLE})
    if not user:
        raise HTTPException(status_code=400, detail="Account niet gevonden")

    # Hash + opslaan
    new_hash = hash_password(new_password)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": new_hash, "updated_at": now}},
    )
    # Invalidate token (one-time use) + alle andere openstaande tokens van dezelfde user
    await db.password_resets.update_many(
        {"user_id": user_id, "used": False},
        {"$set": {"used": True, "used_at": now}},
    )

    # Issue verse JWT zodat user meteen ingelogd is
    token = create_token(user_id, user.get("email", ""), TAXATIE_DEALER_ROLE)
    return {
        "status": "ok",
        "message": "Wachtwoord gewijzigd. U bent ingelogd.",
        "token": token,
        "user": {
            "id": user_id,
            "email": user.get("email"),
            "role": TAXATIE_DEALER_ROLE,
            "company_name": user.get("company_name", ""),
            "name": user.get("name", ""),
        },
    }


# ============ FLYER DOWNLOAD ============

FLYER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static", "flyers")


@router.get("/public/taxatie-flyer")
async def download_taxatie_flyer():
    """Publieke download van de A4 dealer-flyer (PDF). Genereert opnieuw als die mist."""
    flyer_path = os.path.join(FLYER_DIR, "taxatie_flyer_a4.pdf")
    if not os.path.exists(flyer_path):
        try:
            import sys
            sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
            from generate_taxatie_flyer import create_flyer
            create_flyer()
        except Exception as e:
            logger.error(f"Kon flyer niet genereren: {e}")
            raise HTTPException(status_code=500, detail="Flyer niet beschikbaar")
    if not os.path.exists(flyer_path):
        raise HTTPException(status_code=404, detail="Flyer niet gevonden")
    return FileResponse(
        flyer_path,
        media_type="application/pdf",
        filename="moto-import-taxatie-flyer.pdf",
    )


# ============ BULK SALES MAIL ============

@router.post("/admin/taxatie-sales-mail/send")
async def send_sales_mail_bulk(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Verstuur de sales-mail naar een lijst e-mailadressen via Gmail BCC.
    Body: { subject, html, plain_text, recipients: [email,...], attach_flyer: bool }
    """
    if not _is_admin_team(current_user):
        raise HTTPException(status_code=403, detail="Geen toegang")

    subject = (body.get("subject") or "").strip()
    html = body.get("html") or ""
    recipients = body.get("recipients") or []
    attach_flyer = bool(body.get("attach_flyer", True))

    if not subject:
        raise HTTPException(status_code=400, detail="Onderwerp is verplicht")
    if not html:
        raise HTTPException(status_code=400, detail="Mail-inhoud is verplicht")
    if not isinstance(recipients, list) or not recipients:
        raise HTTPException(status_code=400, detail="Minimaal 1 ontvanger nodig")

    # Valideer en dedupliceer e-mailadressen (case-insensitive)
    email_re = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    seen = set()
    valid: list[str] = []
    invalid: list[str] = []
    for raw in recipients:
        e = (raw or "").strip().lower()
        if not e:
            continue
        if not email_re.match(e):
            invalid.append(raw)
            continue
        if e in seen:
            continue
        seen.add(e)
        valid.append(e)

    if not valid:
        raise HTTPException(status_code=400, detail="Geen geldige e-mailadressen gevonden")

    # Anti-spam cap: max 100 per call
    if len(valid) > 100:
        raise HTTPException(status_code=400, detail=f"Maximaal 100 ontvangers per verzending (u stuurde {len(valid)})")

    flyer_path = os.path.join(FLYER_DIR, "taxatie_flyer_a4.pdf") if attach_flyer else None
    if attach_flyer and (not flyer_path or not os.path.exists(flyer_path)):
        # Probeer flyer te (her-)genereren
        try:
            import sys
            sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
            from generate_taxatie_flyer import create_flyer
            create_flyer()
        except Exception as e:
            logger.warning(f"Kon flyer niet (her)genereren: {e}")
            flyer_path = None

    sent_ok: list[str] = []
    failed: list[str] = []

    # Verstuur 1×1 (Gmail SMTP). Trage maar betrouwbare aanpak voor max 100 stuks.
    import asyncio
    for email in valid:
        try:
            if flyer_path and os.path.exists(flyer_path):
                ok = await send_email_with_attachment(
                    to_email=email,
                    subject=subject,
                    html_content=html,
                    attachment_path=flyer_path,
                    attachment_display_name="Moto-Import-Taxatie-Flyer.pdf",
                )
            else:
                ok = await send_email(email, subject, html)
            if ok:
                sent_ok.append(email)
            else:
                failed.append(email)
        except Exception as e:
            logger.warning(f"Bulk-mail naar {email} faalde: {e}")
            failed.append(email)
        # Korte pauze om Gmail-rate-limits te ontwijken
        await asyncio.sleep(0.4)

    # Log de verzending voor audit
    await db.sales_mail_log.insert_one({
        "id": str(uuid.uuid4()),
        "sent_by": current_user.get("email"),
        "subject": subject,
        "recipients_total": len(valid),
        "recipients_ok": len(sent_ok),
        "recipients_failed": len(failed),
        "failed_addresses": failed,
        "invalid_addresses": invalid,
        "attach_flyer": bool(flyer_path),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "status": "ok",
        "sent": len(sent_ok),
        "failed": len(failed),
        "invalid": len(invalid),
        "failed_addresses": failed,
        "invalid_addresses": invalid,
    }


@router.get("/admin/taxatie-sales-mail/history")
async def sales_mail_history(current_user: dict = Depends(get_current_user)):
    """Admin-only: laatste 50 verzendingen van de sales-mail."""
    if not _is_admin_team(current_user):
        raise HTTPException(status_code=403, detail="Geen toegang")
    log = await db.sales_mail_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"history": log}
