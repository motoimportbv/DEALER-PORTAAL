"""Branding helper — geeft de juiste bedrijfsgegevens terug per gebruiker.

- Admin / generieke gebruikers → Moto Import B.V.
- Taxateur (eigen bedrijf) → user's company_name + KvK/BTW/adres
"""

DEFAULT_MOTO_IMPORT = {
    "name": "Moto Import B.V.",
    "kvk": "94622086",
    "btw": "NL867456982B01",
    "rsin": "867456982",
    "phone": "+31 6 24264861",
    "email": "motoimportbv@gmail.com",
    "address": "Horsterhoekweg 11, 7433 SV Schalkhaar",
    "vehicle_type": "motorfiets",  # default: motorfietsen
    "vehicle_label": "motorfiets",
    "vehicle_label_plural": "motorfietsen",
    "branche_label": "motorfietsbranche",
    "taxateur_name": "S. Milone",
    "taxateur_full_name": "Sandro Milone",
    "city": "Schalkhaar",
}


def _format_director_name(user: dict) -> tuple[str, str]:
    """Bepaal taxateur-/directeur-naam (verkort + volledig) op basis van user-velden."""
    full = (user.get("full_name") or "").strip()
    if not full:
        # afleiden uit username/email
        username = user.get("username") or ""
        # bv "Denizkabakolak23" → splits hoofdletter heuristisch
        if username:
            full = username
        else:
            full = (user.get("email") or "").split("@")[0]
    # Probeer initiaal + achternaam te maken
    parts = [p for p in full.replace(".", " ").split() if p]
    if len(parts) >= 2:
        short = f"{parts[0][0].upper()}. {parts[-1].capitalize()}"
        full_clean = " ".join(p.capitalize() for p in parts)
    else:
        short = full
        full_clean = full
    return short, full_clean


def get_branding(user: dict | None) -> dict:
    """Return company branding info for the given user."""
    if not user or user.get("role") != "taxateur":
        return DEFAULT_MOTO_IMPORT.copy()

    vehicle_type = (user.get("vehicle_type") or "motorfiets").lower()
    if vehicle_type == "auto":
        vehicle_label = "auto"
        vehicle_label_plural = "auto's"
        branche_label = "automotive branche"
    else:
        vehicle_label = "motorfiets"
        vehicle_label_plural = "motorfietsen"
        branche_label = "motorfietsbranche"

    short_name, full_name = _format_director_name(user)
    # Stad afleiden uit adres (laatste woord meestal stad)
    addr = user.get("address", "") or ""
    city = ""
    if addr:
        # Laatste comma-deel of laatste woord
        parts = [p.strip() for p in addr.replace(",", " ").split() if p.strip()]
        if parts:
            city = parts[-1]

    return {
        "name": user.get("company_name") or user.get("username") or "Taxateur",
        "kvk": user.get("kvk_number", ""),
        "btw": user.get("btw_number", ""),
        "rsin": "",
        "phone": user.get("phone", ""),
        "email": user.get("email", ""),
        "address": user.get("address", ""),
        "vehicle_type": vehicle_type,
        "vehicle_label": vehicle_label,
        "vehicle_label_plural": vehicle_label_plural,
        "branche_label": branche_label,
        "taxateur_name": short_name,
        "taxateur_full_name": full_name,
        "city": city or "Lettele",
    }
