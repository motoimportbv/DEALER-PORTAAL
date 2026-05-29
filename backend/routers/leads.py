"""Admin endpoints voor lead-scraping & beheer.

Verzamelt e-mailadressen van motoroccasion.nl (dealer-overzicht) voor de bulk-mail
campagne in /admin/taxatie-sales-mail.

Collection: `taxatie_leads` met velden:
  id, name, email, email_lower, address, postcode, city, website, source_site,
  source_url, dealer_id, status (new|sent|bounced|skipped), notes, created_at,
  updated_at, sent_at, batch_id
"""

from __future__ import annotations

import csv
import io
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from fastapi.responses import StreamingResponse

from database import db
from services.auth_service import get_current_user
from services.leads_scraper import parse_motoroccasion_html, try_auto_fetch_motoroccasion
from routers.taxatie import _is_admin_team

logger = logging.getLogger(__name__)
router = APIRouter()

EMAIL_RE = re.compile(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')


def _require_admin(user: dict):
    if not _is_admin_team(user):
        raise HTTPException(status_code=403, detail="Geen toegang")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _ensure_indexes():
    """Idempotent: maak indexen voor de leads-collection bij eerste gebruik."""
    try:
        await db.taxatie_leads.create_index("email_lower", unique=False)
        await db.taxatie_leads.create_index("status")
        await db.taxatie_leads.create_index("source_site")
    except Exception as e:
        logger.warning(f"_ensure_indexes leads: {e}")


# ============ SCRAPE / IMPORT ============

@router.post("/admin/leads/scrape-paste")
async def scrape_from_pasted_html(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Parseer geplakte HTML van motoroccasion.nl en sla nieuwe leads op.

    Body: { html: "..." }
    Returnt: aantal parsed / nieuwe / duplicates.
    """
    _require_admin(current_user)
    await _ensure_indexes()

    html = (body or {}).get("html", "") or ""
    if len(html) < 200:
        raise HTTPException(status_code=400, detail="HTML lijkt leeg of te kort.")

    parsed = parse_motoroccasion_html(html)
    if not parsed:
        return {"parsed": 0, "inserted": 0, "duplicates": 0, "skipped_no_email": 0}

    inserted = 0
    duplicates = 0
    skipped = 0

    for lead in parsed:
        email = (lead.get("email") or "").strip().lower()
        if not email or not EMAIL_RE.match(email):
            skipped += 1
            continue
        # Dedup op email_lower
        existing = await db.taxatie_leads.find_one({"email_lower": email}, {"_id": 0, "id": 1})
        if existing:
            duplicates += 1
            # Update website/adres als die ontbreekt
            await db.taxatie_leads.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "name": lead.get("name") or "",
                    "address": lead.get("address") or "",
                    "postcode": lead.get("postcode") or "",
                    "city": lead.get("city") or "",
                    "website": lead.get("website") or "",
                    "source_url": lead.get("source_url") or "",
                    "dealer_id": lead.get("dealer_id") or "",
                    "updated_at": _now_iso(),
                }},
            )
            continue

        doc = {
            "id": str(uuid.uuid4()),
            "name": lead.get("name") or "",
            "email": email,
            "email_lower": email,
            "address": lead.get("address") or "",
            "postcode": lead.get("postcode") or "",
            "city": lead.get("city") or "",
            "website": lead.get("website") or "",
            "source_site": lead.get("source_site") or "motoroccasion.nl",
            "source_url": lead.get("source_url") or "",
            "dealer_id": lead.get("dealer_id") or "",
            "status": "new",
            "notes": "",
            "sent_at": None,
            "batch_id": None,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "created_by": current_user.get("id"),
        }
        await db.taxatie_leads.insert_one(doc)
        inserted += 1

    return {
        "parsed": len(parsed),
        "inserted": inserted,
        "duplicates": duplicates,
        "skipped_no_email": skipped,
    }


@router.post("/admin/leads/auto-fetch")
async def auto_fetch(
    body: dict = Body(default={}),
    current_user: dict = Depends(get_current_user),
):
    """Probeer een pagina van motoroccasion.nl direct vanuit de server op te halen.

    Body: { page: int (default 1) }
    Werkt alleen als het uitgaande IP niet geblokkeerd is.
    """
    _require_admin(current_user)
    page = int((body or {}).get("page") or 1)
    if page < 1 or page > 30:
        raise HTTPException(status_code=400, detail="Pagina moet tussen 1 en 30 zijn")

    result = try_auto_fetch_motoroccasion(page=page)
    if not result.get("ok"):
        return {
            "ok": False,
            "status": result.get("status"),
            "error": result.get("error"),
            "hint": "Gebruik de paste-mode: open de pagina in je browser, View Source, kopieer alles en plak hier.",
        }

    # Sla op via dezelfde flow als paste
    await _ensure_indexes()
    inserted = 0
    duplicates = 0
    skipped = 0
    for lead in result.get("leads", []):
        email = (lead.get("email") or "").strip().lower()
        if not email or not EMAIL_RE.match(email):
            skipped += 1
            continue
        existing = await db.taxatie_leads.find_one({"email_lower": email}, {"_id": 0, "id": 1})
        if existing:
            duplicates += 1
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "name": lead.get("name") or "",
            "email": email,
            "email_lower": email,
            "address": lead.get("address") or "",
            "postcode": lead.get("postcode") or "",
            "city": lead.get("city") or "",
            "website": lead.get("website") or "",
            "source_site": lead.get("source_site") or "motoroccasion.nl",
            "source_url": lead.get("source_url") or "",
            "dealer_id": lead.get("dealer_id") or "",
            "status": "new",
            "notes": "",
            "sent_at": None,
            "batch_id": None,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "created_by": current_user.get("id"),
        }
        await db.taxatie_leads.insert_one(doc)
        inserted += 1

    return {
        "ok": True,
        "page": page,
        "parsed": len(result.get("leads", [])),
        "inserted": inserted,
        "duplicates": duplicates,
        "skipped_no_email": skipped,
    }


# ============ LIST / FILTER ============

@router.get("/admin/leads")
async def list_leads(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    limit: int = Query(500, le=2000),
    current_user: dict = Depends(get_current_user),
):
    """Lijst alle leads. Filterbaar op status (new/sent/bounced/skipped), zoekterm of bron."""
    _require_admin(current_user)
    query: dict = {}
    if status:
        query["status"] = status
    if source:
        query["source_site"] = source
    if search:
        # Match name, email of city
        rgx = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [{"name": rgx}, {"email_lower": rgx}, {"city": rgx}]
    cursor = db.taxatie_leads.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    leads = await cursor.to_list(limit)

    # Stats
    total = await db.taxatie_leads.count_documents({})
    new_cnt = await db.taxatie_leads.count_documents({"status": "new"})
    sent_cnt = await db.taxatie_leads.count_documents({"status": "sent"})
    bounced_cnt = await db.taxatie_leads.count_documents({"status": "bounced"})
    return {
        "leads": leads,
        "stats": {
            "total": total,
            "new": new_cnt,
            "sent": sent_cnt,
            "bounced": bounced_cnt,
        },
    }


# ============ MUTATE ============

@router.delete("/admin/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    r = await db.taxatie_leads.delete_one({"id": lead_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead niet gevonden")
    return {"ok": True}


@router.post("/admin/leads/delete-bulk")
async def delete_leads_bulk(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user)
    ids = (body or {}).get("ids") or []
    status_filter = (body or {}).get("status")
    if ids:
        r = await db.taxatie_leads.delete_many({"id": {"$in": ids}})
        return {"deleted": r.deleted_count}
    if status_filter:
        r = await db.taxatie_leads.delete_many({"status": status_filter})
        return {"deleted": r.deleted_count}
    raise HTTPException(status_code=400, detail="Geef 'ids' of 'status' op")


@router.post("/admin/leads/mark-sent")
async def mark_leads_sent(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Markeer geselecteerde leads als 'sent' (na verzending via bulk-mailer)."""
    _require_admin(current_user)
    ids = (body or {}).get("ids") or []
    emails = (body or {}).get("emails") or []
    batch_id = (body or {}).get("batch_id") or str(uuid.uuid4())[:12]

    filt: dict = {}
    if ids:
        filt = {"id": {"$in": ids}}
    elif emails:
        emails_lower = [e.lower() for e in emails if isinstance(e, str)]
        filt = {"email_lower": {"$in": emails_lower}}
    else:
        raise HTTPException(status_code=400, detail="Geef ids of emails op")

    r = await db.taxatie_leads.update_many(
        filt,
        {"$set": {
            "status": "sent",
            "sent_at": _now_iso(),
            "batch_id": batch_id,
            "updated_at": _now_iso(),
        }},
    )
    return {"updated": r.modified_count, "batch_id": batch_id}


@router.patch("/admin/leads/{lead_id}")
async def update_lead(
    lead_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Update status/notes van één lead."""
    _require_admin(current_user)
    allowed = {"status", "notes", "name", "email", "city", "website"}
    update: dict = {}
    for k, v in (body or {}).items():
        if k in allowed:
            update[k] = v
    if "email" in update:
        update["email_lower"] = (update["email"] or "").strip().lower()
        if update["email_lower"] and not EMAIL_RE.match(update["email_lower"]):
            raise HTTPException(status_code=400, detail="Ongeldig e-mailadres")
    if not update:
        raise HTTPException(status_code=400, detail="Niets om bij te werken")
    update["updated_at"] = _now_iso()
    r = await db.taxatie_leads.update_one({"id": lead_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead niet gevonden")
    return {"ok": True}


# ============ EXPORT ============

@router.get("/admin/leads/export.csv")
async def export_leads_csv(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Exporteer leads als CSV (komma-gescheiden)."""
    _require_admin(current_user)
    query: dict = {}
    if status:
        query["status"] = status
    leads = await db.taxatie_leads.find(query, {"_id": 0}).sort("name", 1).to_list(5000)

    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["name", "email", "address", "postcode", "city", "website", "status", "source", "sent_at"])
    for lead_row in leads:
        writer.writerow([
            lead_row.get("name", ""),
            lead_row.get("email", ""),
            lead_row.get("address", ""),
            lead_row.get("postcode", ""),
            lead_row.get("city", ""),
            lead_row.get("website", ""),
            lead_row.get("status", ""),
            lead_row.get("source_site", ""),
            lead_row.get("sent_at") or "",
        ])

    buf.seek(0)
    fname = f"taxatie_leads_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
