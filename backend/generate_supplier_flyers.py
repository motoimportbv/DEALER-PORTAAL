#!/usr/bin/env python3
"""Generate professional flyers for foreign dealers - 4 languages"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
import urllib.request
from pathlib import Path

# Download hero image
HERO_IMAGE_URL = "https://static.prod-images.emergentagent.com/jobs/f2436d1f-d8e9-4eb8-9346-4ab2fc10bbda/images/5d71a4867410a41b3fb50f3674c927891434904bcdc175c2b5a7920743269c95.png"
UPLOADS_DIR = Path(__file__).parent / "uploads"
HERO_IMAGE_PATH = UPLOADS_DIR / "portal_hero.png"

if not HERO_IMAGE_PATH.exists():
    print("Downloading hero image...")
    urllib.request.urlretrieve(HERO_IMAGE_URL, HERO_IMAGE_PATH)

# Flyer content in 4 languages
FLYER_CONTENT = {
    "NL": {
        "header": "MOTO IMPORT B.V.",
        "title": "HET GROOTSTE",
        "title2": "MOTORFIETS PORTAAL",
        "title3": "VAN NEDERLAND",
        "subtitle": "Uw Partner voor Verkoop in de Benelux",
        "stats_title": "ONZE CIJFERS",
        "stats": [
            ("500+", "Actieve Dealers"),
            ("1000+", "Motoren Verkocht"),
            ("15+", "Jaren Ervaring"),
            ("24/7", "Online Platform"),
        ],
        "benefits_title": "WAAROM MET ONS SAMENWERKEN?",
        "benefits": [
            "✓ Direct toegang tot 500+ Nederlandse dealers",
            "✓ Snelle verkoop van uw motorfietsen",
            "✓ Professionele presentatie op ons platform",
            "✓ Betrouwbare betalingen",
            "✓ Meertalige ondersteuning",
        ],
        "cta": "WORD LEVERANCIER",
        "contact": "NEEM CONTACT OP",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address": "Horsterhoekweg 11, 7433 SV Schalkhaar, Nederland",
    },
    "DE": {
        "header": "MOTO IMPORT B.V.",
        "title": "DAS GRÖSSTE",
        "title2": "MOTORRAD-PORTAL",
        "title3": "DER NIEDERLANDE",
        "subtitle": "Ihr Partner für den Verkauf in den Benelux-Ländern",
        "stats_title": "UNSERE ZAHLEN",
        "stats": [
            ("500+", "Aktive Händler"),
            ("1000+", "Motorräder Verkauft"),
            ("15+", "Jahre Erfahrung"),
            ("24/7", "Online-Plattform"),
        ],
        "benefits_title": "WARUM MIT UNS ZUSAMMENARBEITEN?",
        "benefits": [
            "✓ Direkter Zugang zu 500+ niederländischen Händlern",
            "✓ Schneller Verkauf Ihrer Motorräder",
            "✓ Professionelle Präsentation auf unserer Plattform",
            "✓ Zuverlässige Zahlungen",
            "✓ Mehrsprachiger Support",
        ],
        "cta": "LIEFERANT WERDEN",
        "contact": "KONTAKTIEREN SIE UNS",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address": "Horsterhoekweg 11, 7433 SV Schalkhaar, Niederlande",
    },
    "FR": {
        "header": "MOTO IMPORT B.V.",
        "title": "LE PLUS GRAND",
        "title2": "PORTAIL MOTO",
        "title3": "DES PAYS-BAS",
        "subtitle": "Votre Partenaire pour la Vente au Benelux",
        "stats_title": "NOS CHIFFRES",
        "stats": [
            ("500+", "Revendeurs Actifs"),
            ("1000+", "Motos Vendues"),
            ("15+", "Ans d'Expérience"),
            ("24/7", "Plateforme en Ligne"),
        ],
        "benefits_title": "POURQUOI TRAVAILLER AVEC NOUS?",
        "benefits": [
            "✓ Accès direct à 500+ revendeurs néerlandais",
            "✓ Vente rapide de vos motos",
            "✓ Présentation professionnelle sur notre plateforme",
            "✓ Paiements fiables",
            "✓ Support multilingue",
        ],
        "cta": "DEVENIR FOURNISSEUR",
        "contact": "CONTACTEZ-NOUS",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address": "Horsterhoekweg 11, 7433 SV Schalkhaar, Pays-Bas",
    },
    "IT": {
        "header": "MOTO IMPORT B.V.",
        "title": "IL PIÙ GRANDE",
        "title2": "PORTALE MOTO",
        "title3": "DEI PAESI BASSI",
        "subtitle": "Il Vostro Partner per la Vendita nel Benelux",
        "stats_title": "I NOSTRI NUMERI",
        "stats": [
            ("500+", "Rivenditori Attivi"),
            ("1000+", "Moto Vendute"),
            ("15+", "Anni di Esperienza"),
            ("24/7", "Piattaforma Online"),
        ],
        "benefits_title": "PERCHÉ COLLABORARE CON NOI?",
        "benefits": [
            "✓ Accesso diretto a 500+ rivenditori olandesi",
            "✓ Vendita rapida delle vostre moto",
            "✓ Presentazione professionale sulla nostra piattaforma",
            "✓ Pagamenti affidabili",
            "✓ Supporto multilingue",
        ],
        "cta": "DIVENTA FORNITORE",
        "contact": "CONTATTACI",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address": "Horsterhoekweg 11, 7433 SV Schalkhaar, Paesi Bassi",
    }
}

# Colors
RED = HexColor("#DC2626")
DARK_GRAY = HexColor("#0F0F0F")
GOLD = HexColor("#F59E0B")

def create_flyer(lang_code, content, output_path):
    """Create professional supplier flyer"""
    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4
    
    # Dark background
    c.setFillColor(DARK_GRAY)
    c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # Top gold accent line
    c.setFillColor(GOLD)
    c.rect(0, height - 8*mm, width, 8*mm, fill=True, stroke=False)
    
    # Header
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width/2, height - 18*mm, content["header"])
    
    # Hero image
    try:
        c.drawImage(str(HERO_IMAGE_PATH), 15*mm, height - 85*mm, 
                    width=width-30*mm, height=55*mm, preserveAspectRatio=True)
    except:
        pass
    
    # Main title - "HET GROOTSTE"
    y_pos = height - 100*mm
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width/2, y_pos, content["title"])
    
    # "MOTORFIETS PORTAAL"
    y_pos -= 9*mm
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width/2, y_pos, content["title2"])
    
    # "VAN NEDERLAND"
    y_pos -= 9*mm
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width/2, y_pos, content["title3"])
    
    # Subtitle
    y_pos -= 8*mm
    c.setFillColor(HexColor("#9CA3AF"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(width/2, y_pos, content["subtitle"])
    
    # Stats section
    y_pos -= 15*mm
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width/2, y_pos, content["stats_title"])
    
    # Stats boxes
    y_pos -= 12*mm
    box_width = 42*mm
    start_x = (width - (4 * box_width + 3 * 3*mm)) / 2
    
    for i, (number, label) in enumerate(content["stats"]):
        box_x = start_x + i * (box_width + 3*mm)
        
        # Box background
        c.setFillColor(HexColor("#1F1F1F"))
        c.roundRect(box_x, y_pos - 18*mm, box_width, 20*mm, 2*mm, fill=True, stroke=False)
        
        # Number
        c.setFillColor(GOLD)
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(box_x + box_width/2, y_pos - 5*mm, number)
        
        # Label
        c.setFillColor(white)
        c.setFont("Helvetica", 7)
        c.drawCentredString(box_x + box_width/2, y_pos - 13*mm, label)
    
    # Benefits section
    y_pos -= 32*mm
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width/2, y_pos, content["benefits_title"])
    
    # Benefits list
    c.setFillColor(white)
    c.setFont("Helvetica", 9)
    for benefit in content["benefits"]:
        y_pos -= 6*mm
        c.drawCentredString(width/2, y_pos, benefit)
    
    # CTA Button
    y_pos -= 12*mm
    btn_width = 50*mm
    btn_x = (width - btn_width) / 2
    c.setFillColor(RED)
    c.roundRect(btn_x, y_pos - 2*mm, btn_width, 9*mm, 2*mm, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width/2, y_pos + 1*mm, content["cta"])
    
    # Contact section
    y_pos -= 16*mm
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(width/2, y_pos, content["contact"])
    
    y_pos -= 6*mm
    c.setFillColor(white)
    c.setFont("Helvetica", 9)
    c.drawCentredString(width/2, y_pos, f"{content['website']}  |  {content['email']}")
    
    y_pos -= 5*mm
    c.drawCentredString(width/2, y_pos, content["phone"])
    
    y_pos -= 5*mm
    c.setFillColor(HexColor("#6B7280"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(width/2, y_pos, content["address"])
    
    # Bottom bar
    c.setFillColor(GOLD)
    c.rect(0, 0, width, 6*mm, fill=True, stroke=False)
    c.setFillColor(DARK_GRAY)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(width/2, 1.5*mm, "🏍️ MOTO IMPORT B.V. - #1 MOTORCYCLE PORTAL")
    
    c.save()
    print(f"✅ Created: {output_path}")

def main():
    print("\n🏍️ Generating Professional Supplier Flyers...")
    print("=" * 50)
    
    for lang_code, content in FLYER_CONTENT.items():
        output_path = UPLOADS_DIR / f"Moto_Import_Supplier_Flyer_{lang_code}.pdf"
        create_flyer(lang_code, content, output_path)
    
    print("\n✅ All 4 supplier flyers generated!")

if __name__ == "__main__":
    main()
