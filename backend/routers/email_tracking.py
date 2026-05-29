"""Email-tracking router: tracking pixel + campagne-resultaten dashboard.

Concept:
- Per uitgaande e-mail genereren we een `tracking_id` (UUID).
- We injecteren een 1×1 transparente GIF in de HTML: <img src=".../api/track/open/{id}.gif">.
- Bij open haalt de mailclient die pixel op → backend markeert de lead als geopend.
- Dashboard `/admin/campaign-results` toont per `batch_id` aantallen + per-recipient details.

Collection: `email_tracking`
  {id, tracking_id, batch_id, lead_email, lead_id?, subject, sent_at,
   opened_at?, open_count, last_opened_at?, user_agent?}
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Body
from fastapi.responses import Response

from database import db
from services.auth_service import get_current_user
from routers.taxatie import _is_admin_team

logger = logging.getLogger(__name__)
router = APIRouter()

# 1×1 transparente GIF (43 bytes)
TRANSPARENT_GIF = bytes([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
    0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00,
    0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
    0x44, 0x01, 0x00, 0x3B,
])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin(user: dict):
    if not _is_admin_team(user):
        raise HTTPException(status_code=403, detail="Geen toegang")


# ============ PUBLIC: tracking pixel ============

@router.get("/track/open/{tracking_id}.gif")
async def track_open(tracking_id: str, request: Request):
    """Tracking pixel: markeer e-mail als geopend. Geeft 1×1 transparente GIF terug."""
    try:
        existing = await db.email_tracking.find_one({"tracking_id": tracking_id}, {"_id": 0, "id": 1, "opened_at": 1})
        if existing:
            now = _now_iso()
            ua = request.headers.get("user-agent", "")[:200]
            update = {
                "$set": {"last_opened_at": now, "user_agent": ua},
                "$inc": {"open_count": 1},
            }
            # Markeer eerste keer geopend
            if not existing.get("opened_at"):
                update["$set"]["opened_at"] = now
            await db.email_tracking.update_one({"tracking_id": tracking_id}, update)

            # Update bijbehorende lead met opens-info (best-effort, non-fatal)
            doc = await db.email_tracking.find_one({"tracking_id": tracking_id}, {"_id": 0, "lead_email": 1})
            if doc and doc.get("lead_email"):
                await db.taxatie_leads.update_one(
                    {"email_lower": doc["lead_email"]},
                    {"$set": {"last_opened_at": now}, "$inc": {"open_count": 1}},
                )
    except Exception as e:
        logger.warning(f"track_open error: {e}")
    return Response(
        content=TRANSPARENT_GIF,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


# ============ ADMIN: dashboard ============

@router.get("/admin/campaign-results")
async def list_campaign_results(current_user: dict = Depends(get_current_user)):
    """Lijst alle batches met aggregated stats."""
    _require_admin(current_user)

    # Aggregatie per batch
    pipeline = [
        {"$group": {
            "_id": "$batch_id",
            "subject": {"$first": "$subject"},
            "sent_at": {"$min": "$sent_at"},
            "total_sent": {"$sum": 1},
            "total_opened": {"$sum": {"$cond": [{"$ifNull": ["$opened_at", False]}, 1, 0]}},
            "total_open_events": {"$sum": "$open_count"},
        }},
        {"$sort": {"sent_at": -1}},
        {"$limit": 100},
    ]
    batches_raw = await db.email_tracking.aggregate(pipeline).to_list(100)
    batches = []
    for b in batches_raw:
        sent = b.get("total_sent", 0)
        opened = b.get("total_opened", 0)
        batches.append({
            "batch_id": b["_id"],
            "subject": b.get("subject", ""),
            "sent_at": b.get("sent_at"),
            "total_sent": sent,
            "total_opened": opened,
            "total_open_events": b.get("total_open_events", 0),
            "open_rate": round((opened / sent * 100), 1) if sent else 0,
        })

    # Totalen overall
    total_sent = await db.email_tracking.count_documents({})
    total_opened = await db.email_tracking.count_documents({"opened_at": {"$ne": None}})

    return {
        "batches": batches,
        "totals": {
            "total_sent": total_sent,
            "total_opened": total_opened,
            "overall_open_rate": round((total_opened / total_sent * 100), 1) if total_sent else 0,
        },
    }


@router.get("/admin/campaign-results/{batch_id}")
async def batch_details(batch_id: str, current_user: dict = Depends(get_current_user)):
    """Per-recipient details van één batch."""
    _require_admin(current_user)
    rows = await db.email_tracking.find(
        {"batch_id": batch_id}, {"_id": 0}
    ).sort("opened_at", -1).to_list(1000)

    # Verrijk met lead-namen
    emails = [r["lead_email"] for r in rows if r.get("lead_email")]
    leads = await db.taxatie_leads.find(
        {"email_lower": {"$in": emails}}, {"_id": 0, "email_lower": 1, "name": 1, "city": 1}
    ).to_list(len(emails) + 1)
    lead_map = {lead_row["email_lower"]: lead_row for lead_row in leads}
    for r in rows:
        lead = lead_map.get((r.get("lead_email") or "").lower(), {})
        r["lead_name"] = lead.get("name", "")
        r["lead_city"] = lead.get("city", "")

    sent = len(rows)
    opened = sum(1 for r in rows if r.get("opened_at"))
    return {
        "batch_id": batch_id,
        "subject": rows[0].get("subject") if rows else "",
        "sent_at": rows[0].get("sent_at") if rows else None,
        "total_sent": sent,
        "total_opened": opened,
        "open_rate": round((opened / sent * 100), 1) if sent else 0,
        "rows": rows,
    }



# ============ FOLLOW-UP CAMPAIGN ============

@router.get("/admin/follow-up-candidates")
async def follow_up_candidates(
    min_days_since_send: int = 3,
    current_user: dict = Depends(get_current_user),
):
    """Lijst leads die de mail wél hebben geopend maar nog NIET zijn geregistreerd als dealer.

    Filters:
    - Lead heeft `opened_at` (= mail geopend)
    - Lead heeft `follow_up_sent` is False/missing
    - Mail is minimaal X dagen geleden verstuurd (default 3)
    - E-mail komt NIET voor in users met role=taxatie_dealer (= nog niet geregistreerd)
    """
    _require_admin(current_user)

    cutoff = datetime.now(timezone.utc) - timedelta(days=min_days_since_send)
    cutoff_iso = cutoff.isoformat()

    # Pull geopende tracking-records ouder dan cutoff
    opened = await db.email_tracking.find(
        {"opened_at": {"$ne": None}, "sent_at": {"$lt": cutoff_iso}},
        {"_id": 0, "lead_email": 1, "opened_at": 1, "batch_id": 1, "sent_at": 1},
    ).to_list(2000)

    # Per e-mail: meest recente open
    by_email: dict = {}
    for r in opened:
        e = (r.get("lead_email") or "").lower()
        if not e:
            continue
        prev = by_email.get(e)
        if not prev or (r.get("opened_at") or "") > (prev.get("opened_at") or ""):
            by_email[e] = r

    if not by_email:
        return {"candidates": [], "min_days_since_send": min_days_since_send}

    # Filter: niet geregistreerd als dealer
    emails = list(by_email.keys())
    registered = await db.users.find(
        {"email": {"$in": emails}, "role": "taxatie_dealer"},
        {"_id": 0, "email": 1},
    ).to_list(len(emails) + 1)
    registered_emails = {u["email"].lower() for u in registered if u.get("email")}

    # Filter: nog geen follow-up gestuurd
    leads = await db.taxatie_leads.find(
        {"email_lower": {"$in": emails}},
        {"_id": 0, "email_lower": 1, "name": 1, "city": 1, "follow_up_sent": 1},
    ).to_list(len(emails) + 1)
    lead_map = {lead_row["email_lower"]: lead_row for lead_row in leads}

    candidates = []
    for email, track in by_email.items():
        if email in registered_emails:
            continue
        lead = lead_map.get(email, {})
        if lead.get("follow_up_sent"):
            continue
        candidates.append({
            "email": email,
            "name": lead.get("name", ""),
            "city": lead.get("city", ""),
            "opened_at": track.get("opened_at"),
            "sent_at": track.get("sent_at"),
            "original_batch_id": track.get("batch_id"),
        })

    # Sorteer: meest recent geopend bovenaan
    candidates.sort(key=lambda c: c.get("opened_at") or "", reverse=True)

    return {
        "candidates": candidates,
        "min_days_since_send": min_days_since_send,
        "count": len(candidates),
    }


@router.post("/admin/follow-up-mark-sent")
async def mark_follow_up_sent(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Markeer leads als 'follow_up_sent' = true zodat ze niet nogmaals worden gepakt.

    Body: { emails: [...] }
    """
    _require_admin(current_user)
    emails = (body or {}).get("emails") or []
    emails_lower = [e.lower() for e in emails if isinstance(e, str)]
    if not emails_lower:
        raise HTTPException(status_code=400, detail="Geef minimaal 1 e-mailadres op")
    r = await db.taxatie_leads.update_many(
        {"email_lower": {"$in": emails_lower}},
        {"$set": {
            "follow_up_sent": True,
            "follow_up_sent_at": _now_iso(),
        }},
    )
    return {"updated": r.modified_count}
