#!/usr/bin/env python3
"""Generate spectacular dealer recruitment flyers in 4 languages"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import urllib.request
import os
from pathlib import Path

# Download the hero image
HERO_IMAGE_URL = "https://static.prod-images.emergentagent.com/jobs/f2436d1f-d8e9-4eb8-9346-4ab2fc10bbda/images/5c97b8b395ba0e6c507c309b005944a1c6fc1fdb45faeadb69473c2baf52c240.png"
UPLOADS_DIR = Path(__file__).parent / "uploads"
HERO_IMAGE_PATH = UPLOADS_DIR / "flyer_hero.png"

# Download hero image if not exists
if not HERO_IMAGE_PATH.exists():
    print("Downloading hero image...")
    urllib.request.urlretrieve(HERO_IMAGE_URL, HERO_IMAGE_PATH)
    print("Hero image downloaded!")

# Flyer content in 4 languages
FLYER_CONTENT = {
    "NL": {
        "title": "WORD DEALER",
        "subtitle": "BIJ MOTO IMPORT",
        "tagline": "Uw Partner in Premium Motorfietsen",
        "benefits_title": "WAAROM MOTO IMPORT?",
        "benefits": [
            "✓ Ruim aanbod uit heel Europa",
            "✓ Scherpe dealerprijzen",
            "✓ Snelle levering binnen Europa", 
            "✓ Betrouwbare partner",
            "✓ Persoonlijke service",
            "✓ Exclusief dealernetwerk"
        ],
        "cta": "START VANDAAG",
        "contact_title": "NEEM CONTACT OP",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address1": "Horsterhoekweg 11",
        "address2": "7433 SV Schalkhaar, Nederland",
        "footer": "Nederland"
    },
    "DE": {
        "title": "WERDEN SIE HÄNDLER",
        "subtitle": "BEI MOTO IMPORT",
        "tagline": "Ihr Partner für Premium-Motorräder",
        "benefits_title": "WARUM MOTO IMPORT?",
        "benefits": [
            "✓ Große Auswahl aus ganz Europa",
            "✓ Attraktive Händlerpreise",
            "✓ Schnelle Lieferung in Europa",
            "✓ Zuverlässiger Partner",
            "✓ Persönlicher Service",
            "✓ Exklusives Händlernetzwerk"
        ],
        "cta": "HEUTE STARTEN",
        "contact_title": "KONTAKTIEREN SIE UNS",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address1": "Horsterhoekweg 11",
        "address2": "7433 SV Schalkhaar, Niederlande",
        "footer": "Niederlande"
    },
    "FR": {
        "title": "DEVENEZ REVENDEUR",
        "subtitle": "CHEZ MOTO IMPORT",
        "tagline": "Votre Partenaire en Motos Premium",
        "benefits_title": "POURQUOI MOTO IMPORT?",
        "benefits": [
            "✓ Large choix de toute l'Europe",
            "✓ Prix revendeurs compétitifs",
            "✓ Livraison rapide en Europe",
            "✓ Partenaire fiable",
            "✓ Service personnalisé",
            "✓ Réseau de revendeurs exclusif"
        ],
        "cta": "COMMENCEZ AUJOURD'HUI",
        "contact_title": "CONTACTEZ-NOUS",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address1": "Horsterhoekweg 11",
        "address2": "7433 SV Schalkhaar, Pays-Bas",
        "footer": "Pays-Bas"
    },
    "IT": {
        "title": "DIVENTA RIVENDITORE",
        "subtitle": "CON MOTO IMPORT",
        "tagline": "Il Vostro Partner per Moto Premium",
        "benefits_title": "PERCHÉ MOTO IMPORT?",
        "benefits": [
            "✓ Ampia scelta da tutta Europa",
            "✓ Prezzi competitivi per rivenditori",
            "✓ Consegna rapida in Europa",
            "✓ Partner affidabile",
            "✓ Servizio personalizzato",
            "✓ Rete di rivenditori esclusiva"
        ],
        "cta": "INIZIA OGGI",
        "contact_title": "CONTATTACI",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address1": "Horsterhoekweg 11",
        "address2": "7433 SV Schalkhaar, Paesi Bassi",
        "footer": "Paesi Bassi"
    }
}

# Colors
RED = HexColor("#DC2626")
DARK_RED = HexColor("#991B1B")
DARK_GRAY = HexColor("#18181B")
LIGHT_GRAY = HexColor("#F4F4F5")

def create_flyer(lang_code, content, output_path):
    """Create a spectacular PDF flyer"""
    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4
    
    # Background - dark gradient effect (solid dark)
    c.setFillColor(DARK_GRAY)
    c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # Top red accent bar
    c.setFillColor(RED)
    c.rect(0, height - 15*mm, width, 15*mm, fill=True, stroke=False)
    
    # Hero image area (top section)
    try:
        # Draw hero image
        img_width = width - 20*mm
        img_height = 80*mm
        c.drawImage(str(HERO_IMAGE_PATH), 10*mm, height - 100*mm, 
                    width=img_width, height=img_height, preserveAspectRatio=True)
    except:
        # Fallback if image fails
        c.setFillColor(HexColor("#27272A"))
        c.rect(10*mm, height - 100*mm, width - 20*mm, 80*mm, fill=True, stroke=False)
    
    # Main title section
    y_pos = height - 120*mm
    
    # Title
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(width/2, y_pos, content["title"])
    
    # Subtitle
    y_pos -= 12*mm
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width/2, y_pos, content["subtitle"])
    
    # Tagline
    y_pos -= 10*mm
    c.setFillColor(HexColor("#A1A1AA"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width/2, y_pos, content["tagline"])
    
    # Red divider line
    y_pos -= 8*mm
    c.setStrokeColor(RED)
    c.setLineWidth(2)
    c.line(width/2 - 40*mm, y_pos, width/2 + 40*mm, y_pos)
    
    # Benefits section
    y_pos -= 15*mm
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, y_pos, content["benefits_title"])
    
    # Benefits list
    y_pos -= 10*mm
    c.setFillColor(white)
    c.setFont("Helvetica", 13)
    for benefit in content["benefits"]:
        y_pos -= 7*mm
        c.drawCentredString(width/2, y_pos, benefit)
    
    # CTA Button
    y_pos -= 18*mm
    btn_width = 70*mm
    btn_height = 12*mm
    btn_x = (width - btn_width) / 2
    
    # Button background
    c.setFillColor(RED)
    c.roundRect(btn_x, y_pos - 3*mm, btn_width, btn_height, 3*mm, fill=True, stroke=False)
    
    # Button text
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width/2, y_pos + 1*mm, content["cta"])
    
    # Contact section (bottom)
    y_pos -= 25*mm
    
    # Contact title
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width/2, y_pos, content["contact_title"])
    
    # Contact details
    y_pos -= 8*mm
    c.setFillColor(white)
    c.setFont("Helvetica", 11)
    c.drawCentredString(width/2, y_pos, f"🌐 {content['website']}")
    
    y_pos -= 6*mm
    c.drawCentredString(width/2, y_pos, f"📧 {content['email']}")
    
    y_pos -= 6*mm
    c.drawCentredString(width/2, y_pos, f"📞 {content['phone']}")
    
    y_pos -= 6*mm
    c.setFillColor(HexColor("#71717A"))
    c.setFont("Helvetica", 10)
    c.drawCentredString(width/2, y_pos, content["address"])
    
    # Bottom bar with logo text
    c.setFillColor(RED)
    c.rect(0, 0, width, 12*mm, fill=True, stroke=False)
    
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, 4*mm, f"🏍️ MOTO IMPORT B.V. • {content['footer']}")
    
    c.save()
    print(f"✅ Created: {output_path}")

def main():
    """Generate all 4 language flyers"""
    print("\n🏍️ Generating Moto Import Dealer Flyers...")
    print("=" * 50)
    
    for lang_code, content in FLYER_CONTENT.items():
        output_path = UPLOADS_DIR / f"Moto_Import_Dealer_Flyer_2025_{lang_code}.pdf"
        create_flyer(lang_code, content, output_path)
    
    print("\n" + "=" * 50)
    print("✅ All 4 flyers generated successfully!")
    print(f"📁 Location: {UPLOADS_DIR}")

if __name__ == "__main__":
    main()
