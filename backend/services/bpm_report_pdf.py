"""
BPM-tegenbewijs taxatierapport PDF generator.

Voldoet aan Bijlage 1 — Uitvoeringsregeling BPM 1992 +
de eisen van Belastingdienst voor BPM-afschrijving via taxatierapport.

Verplichte velden:
 1. Naam/adres/woonplaats taxateur
 2. Verklaring onafhankelijke erkende taxateur
 3. Datum + begintijd + eindtijd fysieke opname
 4. Verklaring 'naar waarheid vastgesteld'
 5. Voertuiggegevens (merk, model, type, VIN, km, DET, CO2, brandstof, kenteken)
 6. Beschrijving meer dan normale gebruiksschade
 7. Inkoopwaarde NL door handelaar
 8. Herstelkosten + waardeverminderingspercentage
 9. Onderbouwing waardemethode
10. Foto-bijlage + verwijzing naar inkoopfactuur/inkoopverklaring
"""

from io import BytesIO
from datetime import datetime
import os
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    PageBreak, Image as RLImage,
)


# Default branding = motoimport bv
DEFAULT_BRANDING = {
    "company_name": "motoimport bv",
    "address": "Horsterhoekweg 11",
    "postal_code": "7433 SV",
    "city": "Schalkhaar",
    "phone": "+31 6 24264861",
    "email": "motoimportbv@gmail.com",
    "kvk": "94622086",
    "btw": "NL867456982B01",
    "taxateur_name": "S. Milone",
    "taxateur_title": "Erkend BPM-taxateur",
    "bank_name": "motoimport bv",
    "bank_iban": "NL09BUNQ2159361135",
}


def _fmt_eur(v) -> str:
    return f"\u20ac {float(v or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _safe(v, default="—") -> str:
    s = "" if v is None else str(v).strip()
    return s if s else default


def _branding(rep: dict) -> dict:
    b = dict(DEFAULT_BRANDING)
    override = (rep.get("branding") or {})
    for k, v in override.items():
        if v and str(v).strip():
            b[k] = str(v).strip()
    return b


def _photo_resolve(file_entry: dict) -> Optional[str]:
    """Return absolute disk path for a photo entry from aanvraag.files, or None."""
    if not isinstance(file_entry, dict):
        return None
    filename = file_entry.get("filename")
    if not filename:
        return None
    # Local uploads dir
    p = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..",
        "uploads", "taxatie_aanvragen", filename
    )
    return p if os.path.exists(p) else None


def _photo_caption(file_entry: dict) -> str:
    field = (file_entry or {}).get("field_key") or ""
    labels = {
        "foto_voorwiel": "Voorwiel",
        "foto_achterwiel": "Achterwiel",
        "foto_km_stand": "Kilometerstand",
        "foto_chassisnummer": "Chassisnummer (VIN)",
        "foto_motorfiets_links": "Motorfiets links",
        "foto_motorfiets_rechts": "Motorfiets rechts",
        "foto_inkoop_verklaring": "Inkoopverklaring / -factuur",
        "foto_kenteken_voor": "Kentekenpapier voorzijde",
        "foto_kenteken_achter": "Kentekenpapier achterzijde",
    }
    if field in labels:
        return labels[field]
    if field.startswith("detail_"):
        try:
            return f"Detailfoto {int(field.split('_')[1])}"
        except Exception:
            return "Detailfoto"
    return "Foto"


def generate_bpm_report_pdf(aanvraag: dict, report: dict) -> bytes:
    """
    aanvraag = record from db.taxatie_aanvragen (dealer + customer + foto's)
    report   = bpm_report sub-dict with voertuig/waarde/schade/opname data + branding
    """
    branding = _branding(report)
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm,
        title=f"BPM-tegenbewijs taxatierapport {aanvraag.get('ref_nr','')}",
        author=branding["company_name"],
    )

    styles = getSampleStyleSheet()
    p_n = ParagraphStyle("N", parent=styles["Normal"], fontSize=9.5, leading=13)
    p_sm = ParagraphStyle("SM", parent=p_n, fontSize=8, textColor=colors.HexColor("#666"))
    p_h1 = ParagraphStyle("H1", parent=p_n, fontSize=18, fontName="Helvetica-Bold",
                          textColor=colors.HexColor("#0f172a"), leading=22, spaceAfter=2)
    p_h2 = ParagraphStyle("H2", parent=p_n, fontSize=11, fontName="Helvetica-Bold",
                          textColor=colors.HexColor("#0f172a"), leading=16, spaceBefore=8, spaceAfter=4)
    p_label = ParagraphStyle("L", parent=p_sm, textColor=colors.HexColor("#52525b"),
                             fontName="Helvetica-Bold", fontSize=7.5, leading=10)
    p_right = ParagraphStyle("R", parent=p_n, alignment=TA_RIGHT)
    p_center = ParagraphStyle("C", parent=p_n, alignment=TA_CENTER)
    p_just = ParagraphStyle("J", parent=p_n, alignment=TA_JUSTIFY)

    elements = []

    # ===== HEADER =====
    header_left = [
        Paragraph("BPM-TEGENBEWIJS TAXATIERAPPORT", p_h1),
        Paragraph(
            "Opgesteld conform Bijlage 1 — Uitvoeringsregeling belasting "
            "van personenauto's en motorrijwielen 1992",
            p_sm,
        ),
        Spacer(1, 3*mm),
        Paragraph(f"<b>Rapportnummer:</b> {_safe(report.get('rapportnummer') or aanvraag.get('ref_nr'))}", p_n),
        Paragraph(f"<b>Datum opgesteld:</b> {_safe(report.get('rapport_datum') or datetime.now().strftime('%d-%m-%Y'))}", p_n),
    ]
    header_right = [
        Paragraph(f"<b>{branding['company_name']}</b>", p_right),
        Paragraph(branding["address"], p_right),
        Paragraph(f"{branding['postal_code']} {branding['city']}", p_right),
        Paragraph(branding["phone"], p_right),
        Paragraph(branding["email"], p_right),
        Spacer(1, 2*mm),
        Paragraph(f"<font size=7 color='#666'>KvK {branding['kvk']} · BTW {branding['btw']}</font>", p_right),
    ]
    header = Table([[header_left, header_right]], colWidths=[110*mm, 60*mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LINEBELOW", (0,0), (-1,0), 1.5, colors.HexColor("#dc2626")),
        ("BOTTOMPADDING", (0,0), (-1,0), 10),
    ]))
    elements.append(header)
    elements.append(Spacer(1, 6*mm))

    # ===== SECTION: TAXATEUR (eisen 1, 2) =====
    elements.append(Paragraph("1. Gegevens taxateur", p_h2))
    tax_data = [
        [Paragraph("Naam taxateur", p_label), Paragraph(_safe(branding["taxateur_name"]), p_n),
         Paragraph("Kwalificatie", p_label), Paragraph(_safe(branding.get("taxateur_title", "Erkend BPM-taxateur")), p_n)],
        [Paragraph("Onderneming", p_label), Paragraph(_safe(branding["company_name"]), p_n),
         Paragraph("KvK", p_label), Paragraph(_safe(branding["kvk"]), p_n)],
        [Paragraph("Vestigingsadres", p_label),
         Paragraph(f"{branding['address']}, {branding['postal_code']} {branding['city']}", p_n),
         Paragraph("BTW", p_label), Paragraph(_safe(branding["btw"]), p_n)],
        [Paragraph("Contact", p_label),
         Paragraph(f"{branding['email']} · {branding['phone']}", p_n),
         Paragraph("", p_label), Paragraph("", p_n)],
    ]
    t = Table(tax_data, colWidths=[28*mm, 67*mm, 22*mm, 53*mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fafafa")),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#e4e4e7")),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(
        "<i>Hierbij verklaart de taxateur dat hij <b>onafhankelijk en erkend</b> is, "
        "geen deel uitmaakt van een handelsbedrijf in gebruikte motorrijtuigen en "
        "niet direct of indirect daaraan is verbonden, conform de eisen van de "
        "Belastingdienst voor BPM-tegenbewijs taxaties.</i>",
        p_just,
    ))

    # ===== SECTION: AANVRAGER =====
    elements.append(Paragraph("2. Aanvrager / eigenaar voertuig", p_h2))
    aan_data = [
        [Paragraph("Bedrijfsnaam / Naam", p_label), Paragraph(_safe(aanvraag.get("bedrijfsnaam")), p_n)],
        [Paragraph("Contactpersoon", p_label), Paragraph(_safe(aanvraag.get("contactpersoon")), p_n)],
        [Paragraph("Adres", p_label), Paragraph(f"{_safe(aanvraag.get('adres'))}, {_safe(aanvraag.get('woonplaats'))}", p_n)],
        [Paragraph("E-mail / Telefoon", p_label),
         Paragraph(f"{_safe(aanvraag.get('email'))} · {_safe(aanvraag.get('telefoon'))}", p_n)],
        [Paragraph("RSIN / KvK", p_label), Paragraph(_safe(aanvraag.get("rsin")), p_n)],
    ]
    t = Table(aan_data, colWidths=[35*mm, 135*mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fafafa")),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#e4e4e7")),
    ]))
    elements.append(t)

    # ===== SECTION: VOERTUIG (eis 5) =====
    elements.append(Paragraph("3. Voertuiggegevens", p_h2))
    v = report.get("voertuig", {}) or {}
    voert_data = [
        [Paragraph("Merk", p_label), Paragraph(_safe(v.get("merk")), p_n),
         Paragraph("Model / Type", p_label), Paragraph(_safe(v.get("model")), p_n)],
        [Paragraph("Uitvoering", p_label), Paragraph(_safe(v.get("uitvoering")), p_n),
         Paragraph("Bouwjaar", p_label), Paragraph(_safe(v.get("bouwjaar")), p_n)],
        [Paragraph("VIN / Chassisnr", p_label), Paragraph(_safe(v.get("vin")), p_n),
         Paragraph("Kenteken (NL)", p_label), Paragraph(_safe(aanvraag.get("kenteken")), p_n)],
        [Paragraph("Buitenlands kenteken", p_label), Paragraph(_safe(v.get("buitenlands_kenteken")), p_n),
         Paragraph("DET buitenland", p_label), Paragraph(_safe(v.get("det")), p_n)],
        [Paragraph("Kilometerstand", p_label), Paragraph(_safe(v.get("kilometerstand")), p_n),
         Paragraph("Datum opname", p_label), Paragraph(_safe(v.get("opname_datum")), p_n)],
        [Paragraph("Brandstof", p_label), Paragraph(_safe(v.get("brandstof")), p_n),
         Paragraph("CO\u2082-uitstoot (g/km)", p_label), Paragraph(_safe(v.get("co2")), p_n)],
        [Paragraph("Cilinderinhoud (cc)", p_label), Paragraph(_safe(v.get("cilinderinhoud")), p_n),
         Paragraph("Vermogen (kW)", p_label), Paragraph(_safe(v.get("vermogen")), p_n)],
        [Paragraph("Kleur", p_label), Paragraph(_safe(v.get("kleur")), p_n),
         Paragraph("RDW-keuringsdatum", p_label), Paragraph(_safe(aanvraag.get("rdw_goedkeuring_datum")), p_n)],
    ]
    t = Table(voert_data, colWidths=[35*mm, 50*mm, 35*mm, 50*mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fafafa")),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#e4e4e7")),
        ("INNERGRID", (0,0), (-1,-1), 0.3, colors.HexColor("#e4e4e7")),
    ]))
    elements.append(t)

    # ===== SECTION: FYSIEKE OPNAME (eis 3) =====
    elements.append(Paragraph("4. Fysieke opname", p_h2))
    op = report.get("opname", {}) or {}
    opname_data = [
        [Paragraph("Datum opname", p_label), Paragraph(_safe(op.get("datum")), p_n),
         Paragraph("Begintijd", p_label), Paragraph(_safe(op.get("begintijd")), p_n),
         Paragraph("Eindtijd", p_label), Paragraph(_safe(op.get("eindtijd")), p_n)],
        [Paragraph("Locatie", p_label), Paragraph(_safe(op.get("locatie") or f"{branding['city']}"), p_n),
         Paragraph("Uitgevoerd door", p_label), Paragraph(_safe(branding["taxateur_name"]), p_n),
         Paragraph("", p_label), Paragraph("", p_n)],
    ]
    t = Table(opname_data, colWidths=[28*mm, 40*mm, 22*mm, 30*mm, 22*mm, 28*mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fafafa")),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#e4e4e7")),
        ("INNERGRID", (0,0), (-1,-1), 0.3, colors.HexColor("#e4e4e7")),
    ]))
    elements.append(t)

    # ===== SECTION: STAAT EN SCHADE (eis 6) =====
    elements.append(Paragraph("5. Staat en schade", p_h2))
    schade = report.get("schade", {}) or {}
    algemene_staat = _safe(schade.get("algemene_staat"))
    schade_omschrijving = _safe(schade.get("omschrijving"))
    elements.append(Paragraph(f"<b>Algemene staat:</b> {algemene_staat}", p_just))
    elements.append(Spacer(1, 2*mm))
    elements.append(Paragraph("<b>Specificatie schade / meer dan normale gebruiksschade:</b>", p_n))
    elements.append(Spacer(1, 1*mm))
    schade_box = Paragraph(
        schade_omschrijving.replace("\n", "<br/>") if schade_omschrijving != "—" else
        "<i>Geen gespecificeerde schade beschreven.</i>",
        p_just,
    )
    sb = Table([[schade_box]], colWidths=[170*mm])
    sb.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fefce8")),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#fbbf24")),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    elements.append(sb)

    # ===== SECTION: WAARDEBEPALING (eisen 7, 8, 9) =====
    elements.append(Paragraph("6. Waardebepaling", p_h2))
    w = report.get("waarde", {}) or {}
    nieuwprijs = float(w.get("historische_nieuwprijs") or 0)
    inkoopwaarde = float(w.get("inkoopwaarde_nl") or 0)
    herstelkosten = float(w.get("herstelkosten") or 0)
    waardeverm_pct = float(w.get("waardevermindering_pct") or 31)
    waardeverm_bedrag = herstelkosten * (waardeverm_pct / 100.0)
    afschrijving = max(nieuwprijs - inkoopwaarde, 0)
    afschr_pct = (afschrijving / nieuwprijs * 100) if nieuwprijs > 0 else 0

    waarde_rows = [
        [Paragraph("<b>Waardemethode</b>", p_n), Paragraph(_safe(w.get("methode") or "Taxatie op basis van fysieke opname + koerslijst"), p_n)],
        [Paragraph("Koerslijst gebruikt", p_n), Paragraph(_safe(w.get("koerslijst") or "n.v.t."), p_n)],
        [Paragraph("Historische nieuwprijs NL (consumentenprijs op DET)", p_n), Paragraph(_fmt_eur(nieuwprijs), p_right)],
        [Paragraph("Handelsinkoopwaarde NL volgens taxatie", p_n), Paragraph(_fmt_eur(inkoopwaarde), p_right)],
        [Paragraph("Afschrijving (nieuwprijs − inkoopwaarde)", p_n), Paragraph(_fmt_eur(afschrijving), p_right)],
        [Paragraph("<b>Afschrijvingspercentage</b>", p_n),
         Paragraph(f"<b>{afschr_pct:.2f}%</b>", p_right)],
    ]
    t = Table(waarde_rows, colWidths=[110*mm, 60*mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fafafa")),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#e4e4e7")),
        ("INNERGRID", (0,0), (-1,-1), 0.3, colors.HexColor("#e4e4e7")),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#fef3c7")),
    ]))
    elements.append(t)

    if herstelkosten > 0:
        elements.append(Spacer(1, 4*mm))
        elements.append(Paragraph("<b>Schade-correctie</b>", p_n))
        herstel_rows = [
            [Paragraph("Begroting herstelkosten", p_n), Paragraph(_fmt_eur(herstelkosten), p_right)],
            [Paragraph("Waardeverminderingspercentage (standaard 31%)", p_n),
             Paragraph(f"{waardeverm_pct:.0f}%", p_right)],
            [Paragraph("<b>Waardevermindering door schade</b>", p_n),
             Paragraph(f"<b>{_fmt_eur(waardeverm_bedrag)}</b>", p_right)],
        ]
        t = Table(herstel_rows, colWidths=[110*mm, 60*mm])
        t.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#e4e4e7")),
            ("INNERGRID", (0,0), (-1,-1), 0.3, colors.HexColor("#e4e4e7")),
            ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#fef3c7")),
        ]))
        elements.append(t)

        if waardeverm_pct > 31:
            elements.append(Spacer(1, 2*mm))
            elements.append(Paragraph(
                f"<i>Onderbouwing hoger percentage ({waardeverm_pct:.0f}%): "
                f"{_safe(w.get('onderbouwing_hoger_pct'))}</i>",
                p_sm,
            ))

    # ===== SECTION: BIJLAGEN OVERZICHT (eis 10) =====
    elements.append(Paragraph("7. Bijlagen", p_h2))
    foto_files = [f for f in (aanvraag.get("files") or []) if isinstance(f, dict)]
    bijlagen_text = []
    if foto_files:
        bijlagen_text.append(f"<b>{len(foto_files)} foto's</b> van het voertuig (zie onderstaande pagina's)")
    bijlagen_text.append(_safe(report.get("bijlage_inkoop") or "Kopie inkoopfactuur / inkoopverklaring (apart aangeleverd)"))
    if report.get("extra_bijlagen"):
        bijlagen_text.append(_safe(report.get("extra_bijlagen")))
    elements.append(Paragraph("<br/>".join(["• " + b for b in bijlagen_text]), p_n))

    # ===== VERKLARING + HANDTEKENING (eis 4) =====
    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph("8. Verklaring en ondertekening", p_h2))
    elements.append(Paragraph(
        f"Ondergetekende, <b>{branding['taxateur_name']}</b>, "
        f"verklaart dat hij de waarde van het bovengenoemde motorrijtuig "
        f"<b>naar waarheid heeft vastgesteld</b> na een grondige fysieke opname "
        f"van het voertuig, conform de eisen gesteld in Bijlage 1 van de "
        f"Uitvoeringsregeling belasting van personenauto's en motorrijwielen 1992.",
        p_just,
    ))
    elements.append(Spacer(1, 14*mm))
    sig_data = [
        [Paragraph(f"<b>{branding['taxateur_name']}</b><br/>"
                   f"<font size=8 color='#666'>{branding.get('taxateur_title','Erkend BPM-taxateur')}</font><br/>"
                   f"<font size=8 color='#666'>{branding['company_name']}</font>", p_n),
         Paragraph(f"<font size=8 color='#666'>Plaats</font><br/><b>{branding['city']}</b>", p_right),
         Paragraph(f"<font size=8 color='#666'>Datum</font><br/><b>{_safe(report.get('rapport_datum') or datetime.now().strftime('%d-%m-%Y'))}</b>", p_right)],
    ]
    sig = Table(sig_data, colWidths=[100*mm, 35*mm, 35*mm])
    sig.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "BOTTOM"),
        ("LINEABOVE", (0,0), (-1,0), 0.8, colors.HexColor("#0f172a")),
        ("TOPPADDING", (0,0), (-1,-1), 6),
    ]))
    elements.append(sig)

    # ===== PHOTO BIJLAGE PAGES =====
    if foto_files:
        elements.append(PageBreak())
        elements.append(Paragraph("Bijlage A — Fotodocumentatie", p_h1))
        elements.append(Paragraph(
            "De volgende foto's zijn gemaakt tijdens de fysieke opname en vormen "
            "een integraal onderdeel van dit taxatierapport.",
            p_sm,
        ))
        elements.append(Spacer(1, 6*mm))

        # 2 photos per row
        row = []
        for f in foto_files:
            path = _photo_resolve(f)
            caption = _photo_caption(f)
            if path:
                try:
                    img = RLImage(path, width=80*mm, height=60*mm, kind="proportional")
                    cell = [img, Paragraph(f"<font size=8 color='#666'>{caption}</font>", p_center)]
                except Exception:
                    cell = [Paragraph(f"<i>(foto niet beschikbaar: {caption})</i>", p_sm)]
            else:
                cell = [Paragraph(f"<i>(foto niet beschikbaar: {caption})</i>", p_sm)]
            row.append(cell)
            if len(row) == 2:
                tbl = Table([row], colWidths=[85*mm, 85*mm])
                tbl.setStyle(TableStyle([
                    ("VALIGN", (0,0), (-1,-1), "TOP"),
                    ("LEFTPADDING", (0,0), (-1,-1), 3),
                    ("RIGHTPADDING", (0,0), (-1,-1), 3),
                    ("TOPPADDING", (0,0), (-1,-1), 5),
                    ("BOTTOMPADDING", (0,0), (-1,-1), 8),
                ]))
                elements.append(tbl)
                row = []
        if row:
            row.append([Paragraph("", p_n)])
            tbl = Table([row], colWidths=[85*mm, 85*mm])
            tbl.setStyle(TableStyle([
                ("VALIGN", (0,0), (-1,-1), "TOP"),
                ("LEFTPADDING", (0,0), (-1,-1), 3),
                ("RIGHTPADDING", (0,0), (-1,-1), 3),
            ]))
            elements.append(tbl)

    # ===== FOOTER op elke pagina =====
    def _footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#888"))
        footer_text = (
            f"{branding['company_name']} · {branding['address']}, {branding['postal_code']} {branding['city']} · "
            f"KvK {branding['kvk']} · BTW {branding['btw']} · {branding['email']}"
        )
        canvas.drawCentredString(A4[0]/2, 10*mm, footer_text)
        canvas.drawRightString(A4[0]-20*mm, 10*mm, f"Pagina {doc_.page}")
        canvas.restoreState()

    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
