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
}


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
    }
