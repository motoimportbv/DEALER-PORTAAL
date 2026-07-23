"""
MotoDirect.nl - PDF Factuur + Pakbon Generator
Gebruikt fpdf2 voor snelle PDF generatie.
"""
from fpdf import FPDF
from datetime import datetime
from io import BytesIO
from typing import Dict, Any


# MotoDirect branding kleuren
BRAND_BLUE = (0, 71, 255)        # #0047FF cobalt
BRAND_BLACK = (5, 5, 5)          # #050505 obsidian
BRAND_GRAY = (100, 100, 100)
BRAND_LIGHT_GRAY = (200, 200, 200)
BRAND_GREEN = (0, 200, 100)

COMPANY = {
    "name": "MotoDirect.nl",
    "parent": "Onderdeel van MotoImport BV",
    "kvk": "KVK 94622086",
    "email": "info@moto-direct.nl",
    "phone": "+31 6 38 52 55 41",
    "website": "www.moto-direct.nl",
}


def _header(pdf: FPDF, title: str, subtitle: str = ""):
    """Draw MotoDirect branded header."""
    # Left: logo/name
    pdf.set_fill_color(*BRAND_BLUE)
    pdf.rect(15, 15, 8, 8, style="F")
    pdf.set_xy(25, 14)
    pdf.set_font("helvetica", "B", 18)
    pdf.set_text_color(*BRAND_BLACK)
    pdf.cell(60, 10, "MOTODIRECT")
    pdf.set_xy(25, 22)
    pdf.set_font("helvetica", "", 7)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.cell(60, 4, "Direct van de importeur")

    # Right: document title
    pdf.set_xy(140, 15)
    pdf.set_font("helvetica", "B", 20)
    pdf.set_text_color(*BRAND_BLACK)
    pdf.cell(55, 10, title, align="R")
    if subtitle:
        pdf.set_xy(140, 25)
        pdf.set_font("helvetica", "", 9)
        pdf.set_text_color(*BRAND_GRAY)
        pdf.cell(55, 5, subtitle, align="R")

    # Divider line
    pdf.set_draw_color(*BRAND_LIGHT_GRAY)
    pdf.set_line_width(0.3)
    pdf.line(15, 34, 195, 34)


def _company_and_customer_block(pdf: FPDF, order: Dict[str, Any]):
    """Draw sender/recipient blocks."""
    y0 = 42

    # From (left)
    pdf.set_xy(15, y0)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.cell(80, 4, "VAN")
    pdf.set_xy(15, y0 + 5)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(*BRAND_BLACK)
    pdf.cell(80, 5, COMPANY["name"])
    pdf.set_xy(15, y0 + 11)
    pdf.set_font("helvetica", "", 8)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.multi_cell(80, 4, f"{COMPANY['parent']}\n{COMPANY['kvk']}\n{COMPANY['email']}\n{COMPANY['phone']}")

    # To (right)
    pdf.set_xy(115, y0)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.cell(80, 4, "AAN")
    pdf.set_xy(115, y0 + 5)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(*BRAND_BLACK)
    pdf.cell(80, 5, order.get("buyer_name", ""))
    pdf.set_xy(115, y0 + 11)
    pdf.set_font("helvetica", "", 8)
    pdf.set_text_color(*BRAND_GRAY)
    address_lines = [
        order.get("buyer_address", ""),
        f"{order.get('buyer_postal_code', '')}  {order.get('buyer_city', '')}".strip(),
        order.get("buyer_email", ""),
        order.get("buyer_phone", ""),
    ]
    pdf.multi_cell(80, 4, "\n".join([l for l in address_lines if l.strip()]))


def _meta_row(pdf: FPDF, order: Dict[str, Any], y: float, doc_number: str):
    """Small meta row with document number + dates."""
    pdf.set_xy(15, y)
    pdf.set_draw_color(*BRAND_LIGHT_GRAY)
    pdf.set_fill_color(248, 248, 248)
    pdf.rect(15, y, 180, 10, style="F")
    pdf.set_font("helvetica", "B", 7)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.set_xy(17, y + 1.5)
    pdf.cell(30, 3, "NUMMER")
    pdf.set_xy(70, y + 1.5)
    pdf.cell(30, 3, "DATUM")
    pdf.set_xy(120, y + 1.5)
    pdf.cell(30, 3, "BESTELLING")
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(*BRAND_BLACK)
    pdf.set_xy(17, y + 4.5)
    pdf.cell(50, 5, doc_number)
    pdf.set_xy(70, y + 4.5)
    pdf.cell(50, 5, datetime.now().strftime("%d-%m-%Y"))
    pdf.set_xy(120, y + 4.5)
    pdf.cell(60, 5, order.get("id", "")[:8].upper())


def _line_items_header(pdf: FPDF, y: float):
    pdf.set_xy(15, y)
    pdf.set_fill_color(*BRAND_BLACK)
    pdf.rect(15, y, 180, 8, style="F")
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(17, y + 2)
    pdf.cell(100, 4, "OMSCHRIJVING")
    pdf.set_xy(140, y + 2)
    pdf.cell(20, 4, "AANTAL", align="R")
    pdf.set_xy(165, y + 2)
    pdf.cell(28, 4, "BEDRAG", align="R")


def _line_item(pdf: FPDF, y: float, description: str, qty: str, amount: str, bold: bool = False):
    pdf.set_xy(17, y + 2)
    pdf.set_font("helvetica", "B" if bold else "", 9)
    pdf.set_text_color(*BRAND_BLACK)
    pdf.cell(120, 5, description)
    pdf.set_xy(140, y + 2)
    pdf.cell(20, 5, qty, align="R")
    pdf.set_xy(165, y + 2)
    pdf.cell(28, 5, amount, align="R")
    # bottom line
    pdf.set_draw_color(*BRAND_LIGHT_GRAY)
    pdf.line(15, y + 9, 195, y + 9)


def _footer(pdf: FPDF):
    pdf.set_y(-25)
    pdf.set_draw_color(*BRAND_LIGHT_GRAY)
    pdf.line(15, 275, 195, 275)
    pdf.set_font("helvetica", "", 7)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.set_xy(15, 278)
    pdf.cell(180, 3, f"{COMPANY['name']} · {COMPANY['parent']} · {COMPANY['kvk']}", align="C")
    pdf.set_xy(15, 282)
    pdf.cell(180, 3, f"{COMPANY['email']} · {COMPANY['phone']} · {COMPANY['website']}", align="C")


def _format_eur(v) -> str:
    try:
        n = float(v or 0)
        return f"EUR {n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return "EUR 0,00"


def generate_deposit_invoice(order: Dict[str, Any]) -> bytes:
    """
    Aanbetalingsfactuur: gefactureerd bedrag = aanbetaling (35% + extras).
    """
    pdf = FPDF(format="A4", unit="mm")
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=25)

    doc_nr = f"AF-{(order.get('id') or '')[:8].upper()}"
    _header(pdf, "FACTUUR", "Aanbetaling")
    _company_and_customer_block(pdf, order)
    _meta_row(pdf, order, 90, doc_nr)
    _line_items_header(pdf, 105)

    snap = order.get("motorcycle_snapshot") or {}
    motor_desc = f"{snap.get('brand', '')} {snap.get('model', '')} ({snap.get('year', '')})"
    y = 113
    _line_item(pdf, y, f"Aanbetaling motor - {motor_desc.strip()}", "1x", _format_eur(order.get("deposit_amount")))
    y += 9
    if order.get("include_taxatie"):
        _line_item(pdf, y, "  incl. taxatie voor BPM-vermindering", "1x", "-", bold=False)
        y += 9
    if order.get("keuring_choice") == "motodirect":
        _line_item(pdf, y, "  incl. RDW-keuring door Moto-direct", "1x", "-", bold=False)
        y += 9

    # Totals block
    y_totals = y + 6
    pdf.set_xy(120, y_totals)
    pdf.set_font("helvetica", "", 9)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.cell(50, 5, "Nu te voldoen:")
    pdf.set_xy(120, y_totals + 8)
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(*BRAND_BLUE)
    pdf.cell(74, 8, _format_eur(order.get("deposit_amount")), align="R")

    pdf.set_xy(120, y_totals + 20)
    pdf.set_font("helvetica", "", 8)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.cell(74, 4, f"Restant bij aflevering: {_format_eur(order.get('remaining_amount'))}", align="R")
    pdf.set_xy(120, y_totals + 25)
    pdf.cell(74, 4, f"Totale koopprijs: {_format_eur(order.get('total_price'))}", align="R")

    # Payment info
    pdf.set_xy(15, y_totals + 40)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(*BRAND_BLACK)
    pdf.cell(100, 5, "BETALING")
    pdf.set_xy(15, y_totals + 46)
    pdf.set_font("helvetica", "", 8)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.multi_cell(180, 4,
        "Deze aanbetaling is voldaan via Stripe (iDEAL of creditcard). "
        "De motor is voor u gereserveerd. Restant wordt bij aflevering voldaan."
    )

    _footer(pdf)
    out = BytesIO()
    pdf.output(out)
    return out.getvalue()


def generate_pakbon(order: Dict[str, Any]) -> bytes:
    """
    Pakbon: laat zien welke motor de klant heeft gekocht (voor bij levering).
    """
    pdf = FPDF(format="A4", unit="mm")
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=25)

    doc_nr = f"PB-{(order.get('id') or '')[:8].upper()}"
    _header(pdf, "PAKBON", "Motor overzicht")
    _company_and_customer_block(pdf, order)
    _meta_row(pdf, order, 90, doc_nr)

    # Motor details block
    snap = order.get("motorcycle_snapshot") or {}
    pdf.set_xy(15, 108)
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.cell(180, 5, "GEKOCHTE MOTOR")

    pdf.set_xy(15, 116)
    pdf.set_fill_color(248, 250, 255)
    pdf.rect(15, 116, 180, 60, style="F")

    pdf.set_xy(20, 122)
    pdf.set_font("helvetica", "B", 18)
    pdf.set_text_color(*BRAND_BLACK)
    pdf.cell(170, 8, f"{snap.get('brand', '')} {snap.get('model', '')}")

    pdf.set_xy(20, 132)
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.cell(170, 6, f"Bouwjaar {snap.get('year', '-')}")

    # Spec rows
    specs = [
        ("Bouwjaar", str(snap.get("year", "-"))),
        ("Kilometerstand", f"{snap.get('mileage', 0):,} km".replace(",", ".") if snap.get("mileage") else "-"),
        ("Kleur", snap.get("color", "-") or "-"),
        ("Motor ID", (snap.get("id") or "")[:8].upper()),
    ]
    y = 148
    for label, value in specs:
        pdf.set_xy(20, y)
        pdf.set_font("helvetica", "", 8)
        pdf.set_text_color(*BRAND_GRAY)
        pdf.cell(45, 5, label)
        pdf.set_xy(70, y)
        pdf.set_font("helvetica", "B", 9)
        pdf.set_text_color(*BRAND_BLACK)
        pdf.cell(120, 5, value)
        y += 6

    # Services
    y_services = 185
    pdf.set_xy(15, y_services)
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.cell(180, 5, "MEEGENOMEN SERVICES")

    y = y_services + 8
    pdf.set_xy(15, y)
    pdf.set_font("helvetica", "", 9)
    pdf.set_text_color(*BRAND_BLACK)
    keuring_txt = "RDW-keuring: door Moto-direct" if order.get("keuring_choice") == "motodirect" else "RDW-keuring: klant regelt zelf"
    pdf.cell(180, 5, f"[X] {keuring_txt}")
    y += 6
    pdf.set_xy(15, y)
    tax_txt = "Taxatie voor BPM-vermindering: JA" if order.get("include_taxatie") else "Taxatie voor BPM-vermindering: nee"
    pdf.cell(180, 5, f"[X] {tax_txt}")

    # Contact
    pdf.set_xy(15, 240)
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(*BRAND_BLACK)
    pdf.cell(180, 5, "VRAGEN OVER JOUW MOTOR?")
    pdf.set_xy(15, 246)
    pdf.set_font("helvetica", "", 9)
    pdf.set_text_color(*BRAND_GRAY)
    pdf.cell(180, 5, f"Neem contact op: {COMPANY['email']} of {COMPANY['phone']} - we zijn 24/7 online bereikbaar.")

    _footer(pdf)
    out = BytesIO()
    pdf.output(out)
    return out.getvalue()
