"""Klantenbestand — gedeelde klantgegevens database voor facturen + taxaties.

Wordt automatisch gevuld bij elke nieuwe factuur of taxatie-programma create
zodat de gebruiker niet steeds opnieuw klantgegevens hoeft in te tikken.
"""
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException

from database import db
from services.auth_service import get_current_user, require_taxatie_access

router = APIRouter()


def _slug(s: str) -> str:
    """Normaliseer naam voor uniciteits-check (case + whitespace insensitive)."""
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _owner_filter(user: dict) -> dict:
    """Iedere taxateur/admin ziet alleen zijn/haar eigen klanten."""
    return {"created_by": user.get("id")}


async def upsert_customer_from_form(user: dict, data: dict) -> None:
    """Upsert helper — wordt aangeroepen vanuit factuur/taxatie create endpoints.
    Slaat een klant op (of werkt bij) op basis van naam + telefoon match.
    """
    name = (data.get("customer_name") or data.get("name") or "").strip()
    if not name or not user or not user.get("id"):
        return

    phone = (data.get("customer_phone") or data.get("phone") or "").strip()
    email = (data.get("customer_email") or data.get("email") or "").strip()
    address = (data.get("customer_address") or data.get("address") or "").strip()
    city = (data.get("customer_city") or data.get("city") or "").strip()

    # Match strict op (created_by, name_slug) — een klant met dezelfde naam is dezelfde klant.
    # (Vroeger werd phone/email óók in de match meegenomen, dat zorgde voor dubbele records
    # wanneer je achteraf een telefoon/email toevoegde aan een bestaande klant.)
    name_slug = _slug(name)
    match: dict = {"created_by": user.get("id"), "name_slug": name_slug}

    update_set = {
        "name": name,
        "name_slug": name_slug,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id"),
    }
    # Alleen niet-lege waarden updaten — anders wist je per ongeluk gegevens
    # bij hergebruik (bv. PDF-generation pad geeft soms lege strings door).
    if phone:
        update_set["phone"] = phone
    if email:
        update_set["email"] = email.lower()
    if address:
        update_set["address"] = address
    if city:
        update_set["city"] = city
    # Optionele default_fee (extra fee, BTW-vrij) — voor Gielen/Wijma/Wilderman
    if "default_fee" in data:
        if data["default_fee"] in (None, ""):
            update_set["default_fee"] = None
        else:
            try:
                update_set["default_fee"] = float(data["default_fee"])
            except (TypeError, ValueError):
                pass
    # Optionele default_taxatie_fee (taxatietarief, standaard €160) — per klant aanpasbaar
    if "default_taxatie_fee" in data:
        if data["default_taxatie_fee"] in (None, ""):
            update_set["default_taxatie_fee"] = None
        else:
            try:
                update_set["default_taxatie_fee"] = float(data["default_taxatie_fee"])
            except (TypeError, ValueError):
                pass
    # Optionele RSIN — wordt automatisch ingevuld bij Aangifte BPM (veld 1.2_BSR)
    if "rsin" in data:
        rsin_val = (str(data["rsin"]) if data["rsin"] is not None else "").strip()
        update_set["rsin"] = rsin_val
    # Artikel 8-vergunning (sommige klanten hebben deze BPM-vrijstelling)
    if "art8_vergunning" in data:
        update_set["art8_vergunning"] = bool(data["art8_vergunning"])
    if "art8_nummer" in data:
        update_set["art8_nummer"] = (str(data["art8_nummer"]) if data["art8_nummer"] is not None else "").strip()
    # Postcode (auto-fill voor Aangifte BPM veld 4.7_PC)
    if "postcode" in data:
        update_set["postcode"] = (str(data["postcode"]) if data["postcode"] is not None else "").strip()
    # Contact-persoon / tekenbevoegde (Aangifte BPM velden 4.2.1-3)
    if "contact_person" in data:
        update_set["contact_person"] = (str(data["contact_person"]) if data["contact_person"] is not None else "").strip()
    update_set_on_insert = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.customers.update_one(
        match,
        {
            "$set": update_set,
            "$setOnInsert": update_set_on_insert,
            "$inc": {"usage_count": 1},
        },
        upsert=True,
    )


@router.get("/customers")
async def list_customers(
    q: str = "",
    current_user: dict = Depends(require_taxatie_access),
):
    """Lijst van klanten van de huidige gebruiker. Optionele zoekterm `q`."""
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")

    query: dict = _owner_filter(current_user)
    if q:
        regex = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [
            {"name": regex}, {"phone": regex}, {"email": regex}, {"city": regex},
        ]

    docs = await db.customers.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "phone": 1, "email": 1, "address": 1, "city": 1, "usage_count": 1, "updated_at": 1, "default_fee": 1, "default_taxatie_fee": 1, "rsin": 1, "art8_vergunning": 1, "art8_nummer": 1, "postcode": 1, "contact_person": 1, "source": 1, "intro_used": 1},
    ).sort([("usage_count", -1), ("updated_at", -1)]).to_list(200)
    return docs


@router.post("/customers")
async def create_or_update_customer(
    body: dict = Body(...),
    current_user: dict = Depends(require_taxatie_access),
):
    """Handmatig een klant aanmaken/bewerken vanuit een 'Mijn klanten'-pagina."""
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    if not (body.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Naam is verplicht")
    await upsert_customer_from_form(current_user, body)
    return {"status": "ok"}


@router.delete("/customers/{customer_id}")
async def delete_customer(
    customer_id: str,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")
    res = await db.customers.delete_one({"id": customer_id, **_owner_filter(current_user)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Klant niet gevonden")
    return {"status": "deleted"}


@router.get("/customers/{customer_id}/history")
async def customer_history(
    customer_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Toon alle BPM-taxaties + facturen voor één klant (gematcht op naam-slug)."""
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")

    cust = await db.customers.find_one({"id": customer_id, **_owner_filter(current_user)}, {"_id": 0})
    if not cust:
        raise HTTPException(status_code=404, detail="Klant niet gevonden")

    name = cust.get("name") or ""

    # Owner-filter voor taxatie/factuur — admin-team deelt data-pool. We importeren de helper lazy.
    from routers.taxatie import _owner_filter_for_user
    owner_q = _owner_filter_for_user(current_user)

    # Match op customer_name case-insensitive
    name_q = {"customer_name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}

    # Taxaties
    taxatie_proj = {
        "_id": 0, "id": 1, "taxatie_nummer": 1, "brand": 1, "model": 1,
        "status": 1, "report_date": 1, "first_registration_date": 1,
        "mileage": 1, "vin_number": 1, "netto_bpm": 1, "bpm_vermindering": 1,
        "bpm_received_at": 1, "bpm_amount_received": 1, "bpm_meldcode": 1,
        "created_at": 1,
    }
    taxaties = await db.taxatie_programma.find(
        {"$and": [name_q, owner_q]}, taxatie_proj,
    ).sort("created_at", -1).to_list(200)

    # Facturen
    invoice_proj = {
        "_id": 0, "id": 1, "invoice_number": 1, "status": 1, "created_at": 1,
        "total_incl_btw": 1, "fee_amount": 1, "extra_fee": 1, "invoice_type": 1,
    }
    invoices = await db.taxatie_invoices.find(
        {"$and": [name_q, owner_q]}, invoice_proj,
    ).sort("invoice_number", -1).to_list(200)

    # Stats
    total_bpm_received = sum((t.get("bpm_amount_received") or 0) for t in taxaties)
    total_invoiced = sum((i.get("total_incl_btw") or 0) for i in invoices)

    return {
        "customer": cust,
        "taxaties": taxaties,
        "invoices": invoices,
        "stats": {
            "taxatie_count": len(taxaties),
            "invoice_count": len(invoices),
            "total_bpm_received": total_bpm_received,
            "total_invoiced": total_invoiced,
        },
    }



@router.get("/customers/{customer_id}/intro-pricing")
async def customer_intro_pricing(
    customer_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Bepaal welk taxatietarief van toepassing is voor deze klant.

    Logica:
      - Klant heeft `default_taxatie_fee` ingesteld → die wint (override per klant)
      - Klant kwam binnen via `/taxatie` (source == "taxatie_aanvraag"):
          * 1e taxatie → €60 (intro, is_eligible=true)
          * volgende    → €120 ex BTW (nieuwe-klant tarief)
      - Alle andere klanten (bestaande / handmatig) → €160 ex BTW (default)
    """
    if current_user.get("role") not in ("admin", "taxateur") and current_user.get("email", "").lower() != "motoimportbv@gmail.com":
        raise HTTPException(status_code=403, detail="Geen toegang")

    cust = await db.customers.find_one({"id": customer_id, **_owner_filter(current_user)}, {"_id": 0})
    if not cust:
        raise HTTPException(status_code=404, detail="Klant niet gevonden")

    from routers.taxatie import _owner_filter_for_user
    owner_q = _owner_filter_for_user(current_user)
    name = cust.get("name") or ""
    name_q = {"customer_name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}

    invoice_count = await db.taxatie_invoices.count_documents({"$and": [name_q, owner_q]})

    is_via_aanvraag = cust.get("source") == "taxatie_aanvraag"
    is_eligible = (
        is_via_aanvraag
        and not cust.get("intro_used", False)
        and invoice_count == 0
    )

    # Bepaal applicable fee
    cust_default = cust.get("default_taxatie_fee")
    if cust_default and float(cust_default) > 0:
        applicable_fee = float(cust_default)
        source_label = "klant-default"
    elif is_eligible:
        applicable_fee = 60.0
        source_label = "intro"
    elif is_via_aanvraag:
        applicable_fee = 120.0
        source_label = "nieuwe-klant"
    else:
        applicable_fee = 160.0
        source_label = "vaste-klant"

    return {
        "customer_id": customer_id,
        "is_eligible": is_eligible,
        "source": cust.get("source"),
        "is_via_aanvraag": is_via_aanvraag,
        "intro_used": bool(cust.get("intro_used", False)),
        "invoice_count": invoice_count,
        "applicable_fee_ex_btw": applicable_fee,
        "applicable_fee_source": source_label,
        "intro_fee_ex_btw": 60.0,
        "new_customer_fee_ex_btw": 120.0,
        "regular_fee_ex_btw": 160.0,
        "shipping_fee_ex_btw": 10.0,
        "print_fee_ex_btw": 10.0,
    }


async def mark_intro_used(current_user: dict, customer_name: str) -> None:
    """Markeer intro_used=true voor de klant na hun eerste taxatie-factuur."""
    if not customer_name:
        return
    name_slug = re.sub(r"\s+", " ", customer_name.strip().lower())
    await db.customers.update_one(
        {"created_by": current_user.get("id"), "name_slug": name_slug, "source": "taxatie_aanvraag"},
        {"$set": {"intro_used": True}},
    )
