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

    # Match op (naam_slug, telefoon) of (naam_slug, email) per gebruiker
    name_slug = _slug(name)
    match: dict = {"created_by": user.get("id"), "name_slug": name_slug}
    if phone:
        match["phone"] = phone
    elif email:
        match["email"] = email.lower()

    update_set = {
        "name": name,
        "name_slug": name_slug,
        "phone": phone,
        "email": email.lower() if email else "",
        "address": address,
        "city": city,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id"),
    }
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
        {"_id": 0, "id": 1, "name": 1, "phone": 1, "email": 1, "address": 1, "city": 1, "usage_count": 1, "updated_at": 1, "default_fee": 1, "default_taxatie_fee": 1},
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
