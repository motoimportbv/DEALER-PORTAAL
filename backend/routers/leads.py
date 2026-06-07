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
import json
import os
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


@router.post("/admin/leads/import-seed")
async def import_seed_leads(current_user: dict = Depends(get_current_user)):
    """Importeer de 341 leads van motoroccasion.nl (vooraf verzameld in /backend/data/seed_leads.json).

    Idempotent: bestaande e-mails worden overgeslagen (dedup op email_lower).
    """
    _require_admin(current_user)
    await _ensure_indexes()

    seed_path = os.path.join(os.path.dirname(__file__), "..", "data", "seed_leads.json")
    seed_path = os.path.abspath(seed_path)
    if not os.path.exists(seed_path):
        raise HTTPException(status_code=500, detail=f"Seed-bestand niet gevonden op {seed_path}")

    with open(seed_path, "r", encoding="utf-8") as f:
        seed = json.load(f)

    inserted = 0
    duplicates = 0
    skipped = 0
    for lead in seed:
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
            "source_site": "motoroccasion.nl",
            "source_url": "",
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
        "total_in_seed": len(seed),
        "inserted": inserted,
        "duplicates": duplicates,
        "skipped_no_email": skipped,
    }


# ============ FR/BE FOREIGN LEADS ============

# Statische startlijst — geverifieerd via dealer-websites (Feb 2026).
FOREIGN_SEED_LEADS = [
    # ===== BE =====
    {"name": "KM Motos", "email": "info@kmmotos.be", "city": "Lontzen", "postcode": "4710",
     "address": "Rue Mitoyenne 344", "website": "https://kmmotos.be", "country": "BE",
     "source_site": "kmmotos.be", "notes": "Yamaha officieel dealer"},
    {"name": "CLM Motos", "email": "info@clmmotos.be", "city": "Seraing", "postcode": "4100",
     "address": "Rue du Sewage 4", "website": "https://clmmotos.be", "country": "BE",
     "source_site": "clmmotos.be", "notes": "Yamaha officieel dealer Liège"},
    {"name": "Sud Moto", "email": "info@sudmoto.be", "city": "Uccle", "postcode": "1180",
     "address": "", "website": "https://sudmoto.be", "country": "BE",
     "source_site": "sudmoto.be", "notes": "Yamaha Sud Bruxelles"},
    {"name": "Zone Rouge", "email": "info@zonerouge.be", "city": "Fosses-la-Ville", "postcode": "",
     "address": "", "website": "https://www.zonerouge.be", "country": "BE",
     "source_site": "zonerouge.be", "notes": "Yamaha dealer Wallonië — meerdere vestigingen"},
    {"name": "Brussels Moto Store", "email": "info@brussels-moto-store.be", "city": "Woluwe-Saint-Lambert",
     "postcode": "1200", "address": "Chaussée de Louvain 1107", "website": "https://brussels-moto-store.be",
     "country": "BE", "source_site": "brussels-moto-store.be", "notes": "Yamaha Center Brussels (500 m²)"},
    {"name": "Honda Mertens Brussel", "email": "info@hondamertens.be", "city": "Zaventem",
     "postcode": "1930", "address": "Mechelsesteenweg 560", "website": "https://www.hondamertensbrussel.be",
     "country": "BE", "source_site": "hondamertensbrussel.be", "notes": "Honda exclusief dealer Brussel"},
    # ===== FR =====
    {"name": "La Maison de la Moto", "email": "info@maisondelamoto.fr", "city": "Mougins",
     "postcode": "06250", "address": "", "website": "https://www.maisondelamoto.fr", "country": "FR",
     "source_site": "maisondelamoto.fr", "notes": "Multi-merk dealer Côte d'Azur"},
    {"name": "Planet Racing", "email": "ventemotos@planet-racing.fr", "city": "", "postcode": "",
     "address": "", "website": "https://www.planet-racing.fr", "country": "FR",
     "source_site": "planet-racing.fr", "notes": "Yamaha dealer"},
    {"name": "Superbike Marseille", "email": "contact@superbike-marseille.fr", "city": "Marseille",
     "postcode": "13004", "address": "80 Boulevard Françoise Duparc",
     "website": "https://www.superbike-marseille.fr", "country": "FR",
     "source_site": "superbike-marseille.fr", "notes": "Moto Morini / Royal Enfield / Kymco / Peugeot"},
    {"name": "Moto Expert 31", "email": "motoexpert31@yahoo.com", "city": "Toulouse",
     "postcode": "31200", "address": "2 Av. d'Atlanta", "website": "https://www.motoexpert.fr",
     "country": "FR", "source_site": "motoexpert.fr", "notes": "Multi-merk Toulouse"},
    {"name": "City2Roues", "email": "contact@city2roues.com", "city": "Toulouse",
     "postcode": "31200", "address": "34 Rue Georges Ohnet", "website": "https://www.city2roues.com",
     "country": "FR", "source_site": "city2roues.com", "notes": "Concessionnaire moto Toulouse"},
]


# Italiaanse dealers — geverifieerd via officiële websites (Feb 2026).
ITALIAN_SEED_LEADS = [
    # ===== Roma =====
    {"name": "Euroscooter Moto", "email": "info@euroscootermoto.it", "city": "Roma", "postcode": "00189",
     "address": "Via Cassia 911/919", "website": "https://www.euroscootermoto.it", "country": "IT",
     "source_site": "euroscootermoto.it", "notes": "Rivenditore Ufficiale Honda Roma"},
    {"name": "Honda Moto Roma — Mega Store Tiburtina", "email": "commerciale.tiburtina@hondamotoroma.com",
     "city": "Roma", "postcode": "", "address": "Via Tiburtina, 1166/1168",
     "website": "https://www.hondamotoroma.com", "country": "IT",
     "source_site": "hondamotoroma.com", "notes": "Honda Mega Store"},
    {"name": "Honda Moto Roma — Store Gregorio", "email": "commerciale.gregorio@hondamotoroma.com",
     "city": "Roma", "postcode": "", "address": "Via Gregorio VII, 374/380",
     "website": "https://www.hondamotoroma.com", "country": "IT",
     "source_site": "hondamotoroma.com", "notes": "Honda Store Roma"},
    {"name": "Honda Moto Roma — Store Appia", "email": "commerciale.appia@hondamotoroma.com",
     "city": "Roma", "postcode": "", "address": "Via Appia Nuova, 606",
     "website": "https://www.hondamotoroma.com", "country": "IT",
     "source_site": "hondamotoroma.com", "notes": "Honda Store Roma Appia"},
    {"name": "La Moto Roma Nord", "email": "info.romanord@lamotoroma.com", "city": "Roma", "postcode": "00135",
     "address": "Via Pieve di Cadore, 57", "website": "https://www.lamotoroma.com", "country": "IT",
     "source_site": "lamotoroma.com", "notes": "Concessionaria Triumph Roma Nord"},
    {"name": "La Moto Roma Ovest", "email": "info@lamotoroma.com", "city": "Roma", "postcode": "00146",
     "address": "LungoTevere degli Inventori, 110", "website": "https://www.lamotoroma.com", "country": "IT",
     "source_site": "lamotoroma.com", "notes": "Concessionaria multimarca"},
    # ===== Milano / Brescia / Bergamo =====
    {"name": "Pogliani", "email": "infomotoescooter@pogliani.com", "city": "Sesto San Giovanni",
     "postcode": "20099", "address": "Viale Casiraghi 427", "website": "https://pogliani.com",
     "country": "IT", "source_site": "pogliani.com", "notes": "Specialisti 2 ruote Milano dal 1952"},
    {"name": "Stamoto Milano", "email": "ricambi@stamoto.it", "city": "Milano", "postcode": "",
     "address": "", "website": "https://stamoto.it", "country": "IT",
     "source_site": "stamoto.it", "notes": "Concessionaria/officina Milano (2 sedi)"},
    {"name": "CMT Motor Brescia", "email": "brescia@cmtmotor.com", "city": "Brescia", "postcode": "",
     "address": "", "website": "https://www.cmtmotor.com", "country": "IT",
     "source_site": "cmtmotor.com", "notes": "Concessionaria Brescia"},
    {"name": "CMT Motor Milano", "email": "umilano@cmtmotor.com", "city": "Milano", "postcode": "",
     "address": "", "website": "https://www.cmtmotor.com", "country": "IT",
     "source_site": "cmtmotor.com", "notes": "Concessionaria Milano"},
    # ===== Firenze / Bari =====
    {"name": "Alma Moto", "email": "info@almamoto.it", "city": "Firenze", "postcode": "",
     "address": "", "website": "https://www.almamoto.it", "country": "IT",
     "source_site": "almamoto.it", "notes": "Concessionaria ufficiale Beta Firenze"},
    {"name": "CeB Group Motor", "email": "info@cebmotor.it", "city": "Firenze", "postcode": "",
     "address": "", "website": "https://cebmotor.it", "country": "IT",
     "source_site": "cebmotor.it", "notes": "Concessionaria ufficiale Piaggio Firenze"},
    {"name": "Baldassarre Moto", "email": "info@baldassarremoto.bmw.it", "city": "Bari", "postcode": "",
     "address": "", "website": "https://www.baldassarremoto.it", "country": "IT",
     "source_site": "baldassarremoto.it", "notes": "BMW Motorrad / Kawasaki / Vervemoto"},
]


async def _import_seed(seed_list, current_user: dict, default_label: str) -> dict:
    """Generieke importer voor seed-lijsten met dedup op email_lower."""
    inserted = 0
    duplicates = 0
    skipped = 0
    for lead in seed_list:
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
            "country": lead.get("country") or "",
            "source_site": lead.get("source_site") or default_label,
            "source_url": "",
            "dealer_id": "",
            "status": "new",
            "notes": lead.get("notes") or "",
            "sent_at": None,
            "batch_id": None,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "created_by": current_user.get("id"),
        }
        await db.taxatie_leads.insert_one(doc)
        inserted += 1
    return {
        "total_in_seed": len(seed_list),
        "inserted": inserted,
        "duplicates": duplicates,
        "skipped_no_email": skipped,
    }


@router.post("/admin/leads/import-foreign-seed")
async def import_foreign_seed_leads(current_user: dict = Depends(get_current_user)):
    """Importeer een statische startlijst van geverifieerde FR/BE motor-dealers met emails.
    Idempotent: bestaande e-mails worden overgeslagen (dedup op email_lower)."""
    _require_admin(current_user)
    await _ensure_indexes()
    return await _import_seed(FOREIGN_SEED_LEADS, current_user, "foreign-seed")


@router.post("/admin/leads/import-italian-seed")
async def import_italian_seed_leads(current_user: dict = Depends(get_current_user)):
    """Importeer een statische startlijst van geverifieerde Italiaanse motor-dealers met emails."""
    _require_admin(current_user)
    await _ensure_indexes()
    return await _import_seed(ITALIAN_SEED_LEADS, current_user, "italian-seed")


@router.post("/admin/leads/scrape-moto-it")
async def scrape_moto_it_endpoint(
    body: dict = Body(default={}),
    current_user: dict = Depends(get_current_user),
):
    """Automatisch dealers + emails scrapen van moto.it concessionari.

    Body: { max_pages: 5 } → per pagina ~17 dealers, totaal ~85.
    Loopt asynchroon door dealer.moto.it/{slug} profielen en /contatti subpaden
    om emails te vinden. Idempotent via email_lower dedup.

    Let op: 1.132 dealers totaal — voer eerst max_pages=2 uit (testbatch) om
    te kijken hoe de site reageert vóór je een grote run doet.
    """
    _require_admin(current_user)
    await _ensure_indexes()
    from services.dealer_scraper import scrape_moto_it

    max_pages = int((body or {}).get("max_pages", 5))
    max_pages = max(1, min(max_pages, 70))  # cap op 70 (~1.190 dealers max)
    result = await scrape_moto_it(max_pages=max_pages, current_user_id=current_user.get("id"))
    return result


# Generic email-extractor patroon — werkt voor Pages Jaunes, Google Maps copy-paste,
# motoconcess-resultaten en willekeurige andere bronnen. Pakt elke e-mail uit de tekst
# + probeert context-info (bedrijfsnaam, plaats) eromheen te halen.
GENERIC_EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
FR_BE_POSTCODE_RE = re.compile(r'\b(\d{4,5})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\s]{1,40})')


def _guess_name_from_email(email: str) -> str:
    """Best-effort: haal een leesbare bedrijfsnaam uit de domain van een email.
    bv. info@motodupont-paris.fr → 'Motodupont Paris'
    """
    try:
        domain = email.split("@", 1)[1].split(".")[0]
        # Verwijder gangbare prefixes
        domain = re.sub(r'^(www-)?', '', domain, flags=re.IGNORECASE)
        # Splits op -, _ en spatie → woorden capitaliseren
        words = re.split(r'[-_\s]+', domain)
        return " ".join(w.capitalize() for w in words if w)
    except Exception:
        return ""


def _guess_country_from_tld(email: str) -> str:
    """Bepaal land op basis van TLD."""
    try:
        tld = email.rsplit(".", 1)[-1].lower()
        return {"fr": "FR", "be": "BE", "lu": "LU", "nl": "NL", "de": "DE", "es": "ES", "it": "IT"}.get(tld, "")
    except Exception:
        return ""


@router.post("/admin/leads/scrape-paste-generic")
async def scrape_paste_generic(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Generieke email-extractor voor FR/BE/etc bronnen (Pages Jaunes, Google Maps, websites).

    Body: { text: "..." (HTML of plain text), source_label: "pagesjaunes" (optioneel) }
    Returnt: aantal gevonden emails / inserted / duplicates.
    """
    _require_admin(current_user)
    await _ensure_indexes()

    text = (body or {}).get("text") or ""
    source_label = ((body or {}).get("source_label") or "paste-generic").strip().lower()
    if len(text) < 20:
        raise HTTPException(status_code=400, detail="Tekst is leeg of te kort")

    # Vind alle unieke emails, filter generieke
    raw_emails = GENERIC_EMAIL_RE.findall(text)
    skip_domains = {"google.com", "facebook.com", "instagram.com", "youtube.com", "twitter.com",
                    "linkedin.com", "wixstatic.com", "sentry.io", "googletagmanager.com",
                    "googleadservices.com", "doubleclick.net", "wordpress.com", "wp.com",
                    "example.com", "domain.com", "yourdomain.com", "test.com"}
    unique = []
    seen = set()
    for e in raw_emails:
        em = e.strip().lower()
        if em in seen:
            continue
        domain = em.split("@", 1)[1] if "@" in em else ""
        if any(domain.endswith(sd) for sd in skip_domains):
            continue
        if not EMAIL_RE.match(em):
            continue
        seen.add(em)
        unique.append(em)

    # Optioneel: probeer een postcode + plaats uit de tekst te halen (rough context).
    pc_match = FR_BE_POSTCODE_RE.search(text)
    pc, city = ("", "")
    if pc_match:
        pc = pc_match.group(1)
        city = pc_match.group(2).strip()

    inserted = 0
    duplicates = 0
    for em in unique:
        existing = await db.taxatie_leads.find_one({"email_lower": em}, {"_id": 0, "id": 1})
        if existing:
            duplicates += 1
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "name": _guess_name_from_email(em),
            "email": em,
            "email_lower": em,
            "address": "",
            "postcode": pc,
            "city": city,
            "website": "",
            "country": _guess_country_from_tld(em),
            "source_site": source_label,
            "source_url": "",
            "dealer_id": "",
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
        "found_emails": len(unique),
        "inserted": inserted,
        "duplicates": duplicates,
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
