#!/usr/bin/env python3
"""
Genereer een strakke, zakelijke A4 flyer voor Nederlandse motordealers
om hen te trekken naar motoimportbv.nl/taxatie voor BPM-taxatieverslagen.

Stijl: wit/zwart minimalistisch, zakelijk.
Hoofdboodschap: officieel BPM-taxatieverslag binnen 48 uur + €60 introductietarief.
"""
import io
import os
from pathlib import Path

import qrcode
from fpdf import FPDF
from fpdf.enums import XPos, YPos

OUTPUT_DIR = Path(__file__).parent / "static" / "flyers"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TAXATIE_URL = "https://www.motoimportbv.nl/taxatie"


class TaxatieFlyer(FPDF):
    def __init__(self):
        super().__init__(format="A4")
        self.set_auto_page_break(auto=False)
        self.set_margins(15, 15, 15)

    def header(self):
        # Geen header — clean layout
        pass

    def footer(self):
        # Dunne zwarte balk onderaan met contactgegevens
        self.set_y(-22)
        self.set_fill_color(15, 15, 15)
        self.rect(0, 275, 210, 22, "F")
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 9)
        self.set_xy(15, 280)
        self.cell(0, 4, "Moto Import B.V.", align="L")
        self.set_font("Helvetica", "", 9)
        self.set_xy(15, 285)
        self.cell(
            0,
            4,
            "Horsterhoekweg 11, 7433 SV Schalkhaar  |  KVK 94622086",
            align="L",
        )
        self.set_xy(15, 290)
        self.cell(
            0,
            4,
            "06-24264861  |  motoimportbv@gmail.com  |  www.motoimportbv.nl",
            align="L",
        )

    def thin_rule(self, x1, y, x2, width=0.3, color=(15, 15, 15)):
        self.set_draw_color(*color)
        self.set_line_width(width)
        self.line(x1, y, x2, y)


def _generate_qr_png(url: str) -> bytes:
    """Genereer een zwart/wit QR-code als PNG-bytes."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)
    return buf.getvalue()


def _temp_image(data: bytes, suffix: str = ".png") -> str:
    """Schrijf bytes naar tijdelijk bestand en return pad."""
    import tempfile
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    return path


def create_flyer() -> Path:
    pdf = TaxatieFlyer()
    pdf.add_page()

    # ========== LOGO MARK (klein boven, links) ==========
    pdf.set_xy(15, 18)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(15, 15, 15)
    pdf.cell(0, 5, "MOTO IMPORT B.V.", align="L")
    pdf.set_xy(15, 24)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 4, "Officiele BPM-taxaties voor motorfietsen", align="L")

    # Datum rechts
    from datetime import datetime
    pdf.set_xy(150, 18)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(45, 4, datetime.now().strftime("%B %Y"), align="R")

    # Horizontale lijn
    pdf.thin_rule(15, 36, 195)

    # ========== EYEBROW / KICKER ==========
    pdf.set_xy(15, 48)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 4, "VOOR NEDERLANDSE MOTORZAKEN", align="L")

    # ========== MEGA HEADLINE ==========
    pdf.set_xy(15, 55)
    pdf.set_font("Helvetica", "B", 36)
    pdf.set_text_color(15, 15, 15)
    pdf.multi_cell(
        180,
        13,
        "Officieel BPM-\ntaxatieverslag.\nBinnen 48 uur.",
        align="L",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )

    # ========== SUBKOPJE ==========
    pdf.ln(2)
    pdf.set_x(15)
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(
        180,
        5.5,
        "Wij zijn 100% gespecialiseerd in motorfiets-taxaties voor BPM-aangifte.\n"
        "Belastingdienst-proof, scherp geprijsd, snel geleverd.",
        align="L",
    )

    # ========== INTRO PRIJS BOX (grijs vlak met groot bedrag) ==========
    box_y = 130
    pdf.set_fill_color(245, 245, 245)
    pdf.rect(15, box_y, 110, 36, "F")
    # Rode verticale streep links als accent
    pdf.set_fill_color(220, 38, 38)
    pdf.rect(15, box_y, 2, 36, "F")

    pdf.set_xy(22, box_y + 5)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 4, "INTRODUCTIETARIEF NIEUWE KLANTEN", align="L")

    pdf.set_xy(22, box_y + 11)
    pdf.set_font("Helvetica", "B", 32)
    pdf.set_text_color(15, 15, 15)
    pdf.cell(0, 12, "EUR 60", align="L")

    pdf.set_xy(22, box_y + 26)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 4, "ex BTW - eenmalig, voor uw eerste taxatieverslag", align="L")

    # ========== QR CODE RECHTS ==========
    qr_data = _generate_qr_png(TAXATIE_URL)
    qr_path = _temp_image(qr_data)
    try:
        # QR code in een wit kader met dunne lijn
        pdf.set_draw_color(220, 220, 220)
        pdf.set_line_width(0.3)
        pdf.rect(135, box_y, 60, 60)
        pdf.image(qr_path, x=140, y=box_y + 5, w=50, h=50)
    finally:
        try:
            os.remove(qr_path)
        except OSError:
            pass

    # QR caption
    pdf.set_xy(135, box_y + 62)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(15, 15, 15)
    pdf.cell(60, 4, "SCAN OM AAN TE MELDEN", align="C")
    pdf.set_xy(135, box_y + 67)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(60, 4, "motoimportbv.nl/taxatie", align="C")

    # ========== HOE HET WERKT — 3 stappen ==========
    steps_y = 180
    pdf.set_xy(15, steps_y)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(15, 15, 15)
    pdf.cell(0, 5, "ZO WERKT HET", align="L")
    pdf.thin_rule(15, steps_y + 7, 50)

    steps = [
        ("01", "Aanmelden", "Upload bedrijfsgegevens + 9 foto's via /taxatie"),
        ("02", "Wij taxeren", "Onze taxateur stelt het rapport op volgens RDW-richtlijnen"),
        ("03", "PDF in mailbox", "Binnen 48 uur ontvangt u het ondertekende verslag + BPM-berekening"),
    ]
    step_y = steps_y + 14
    col_w = 60
    for idx, (num, title, desc) in enumerate(steps):
        x = 15 + idx * col_w
        pdf.set_xy(x, step_y)
        pdf.set_font("Helvetica", "B", 22)
        pdf.set_text_color(220, 38, 38)
        pdf.cell(20, 8, num, align="L")

        pdf.set_xy(x, step_y + 11)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(15, 15, 15)
        pdf.cell(col_w - 5, 4, title, align="L")

        pdf.set_xy(x, step_y + 16)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(100, 100, 100)
        pdf.multi_cell(col_w - 5, 3.8, desc, align="L")

    # ========== USP BAR ==========
    usp_y = 232
    pdf.set_fill_color(15, 15, 15)
    pdf.rect(0, usp_y, 210, 18, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 9)

    usps = [
        "100% MOTOREN",
        "BELASTINGDIENST-PROOF",
        "BINNEN 48 UUR",
        "HONDERDEN TAXATIES/JAAR",
    ]
    usp_col_w = 210 / len(usps)
    for idx, usp in enumerate(usps):
        pdf.set_xy(idx * usp_col_w, usp_y + 6.5)
        pdf.cell(usp_col_w, 5, usp, align="C")

    # ========== CTA ==========
    cta_y = 256
    pdf.set_xy(15, cta_y)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(15, 15, 15)
    pdf.cell(0, 5, "Vragen? Bel of mail ons.", align="L")
    pdf.set_xy(15, cta_y + 7)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 6, "06-24264861   |   motoimportbv@gmail.com", align="L")

    # ========== EXPORT ==========
    output_path = OUTPUT_DIR / "taxatie_flyer_a4.pdf"
    pdf.output(str(output_path))
    return output_path


if __name__ == "__main__":
    path = create_flyer()
    print(f"Flyer aangemaakt: {path}")
