#!/usr/bin/env python3
"""Generate spectacular dealer recruitment flyers in 4 languages - COMPACT VERSION"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white, black
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
        ],
        "cta": "START VANDAAG",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address": "Horsterhoekweg 11, 7433 SV Schalkhaar, Nederland",
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
        ],
        "cta": "HEUTE STARTEN",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address": "Horsterhoekweg 11, 7433 SV Schalkhaar, Niederlande",
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
        ],
        "cta": "COMMENCEZ AUJOURD'HUI",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address": "Horsterhoekweg 11, 7433 SV Schalkhaar, Pays-Bas",
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
        ],
        "cta": "INIZIA OGGI",
        "website": "www.motoimportbv.nl",
        "email": "motoimportbv@gmail.com",
        "phone": "+31 6 81792660",
        "address": "Horsterhoekweg 11, 7433 SV Schalkhaar, Paesi Bassi",
    }
}

# Colors
RED = HexColor("#DC2626")
DARK_GRAY = HexColor("#18181B")

def create_flyer(lang_code, content, output_path):
    """Create a compact spectacular PDF flyer"""
    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4
    
    # Background
    c.setFillColor(DARK_GRAY)
    c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # Top red bar
    c.setFillColor(RED)
    c.rect(0, height - 12*mm, width, 12*mm, fill=True, stroke=False)
    
    # Hero image (smaller)
    try:
        img_width = width - 30*mm
        img_height = 60*mm
        c.drawImage(str(HERO_IMAGE_PATH), 15*mm, height - 75*mm, 
                    width=img_width, height=img_height, preserveAspectRatio=True)
    except:
        pass
    
    # Title section
    y_pos = height - 90*mm
    
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width/2, y_pos, content["title"])
    
    y_pos -= 10*mm
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width/2, y_pos, content["subtitle"])
    
    y_pos -= 8*mm
    c.setFillColor(HexColor("#A1A1AA"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(width/2, y_pos, content["tagline"])
    
    # Divider
    y_pos -= 6*mm
    c.setStrokeColor(RED)
    c.setLineWidth(2)
    c.line(width/2 - 35*mm, y_pos, width/2 + 35*mm, y_pos)
    
    # Benefits
    y_pos -= 10*mm
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width/2, y_pos, content["benefits_title"])
    
    c.setFillColor(white)
    c.setFont("Helvetica", 11)
    for benefit in content["benefits"]:
        y_pos -= 6*mm
        c.drawCentredString(width/2, y_pos, benefit)
    
    # CTA Button
    y_pos -= 12*mm
    btn_width = 55*mm
    btn_height = 10*mm
    btn_x = (width - btn_width) / 2
    c.setFillColor(RED)
    c.roundRect(btn_x, y_pos - 2*mm, btn_width, btn_height, 2*mm, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width/2, y_pos + 1*mm, content["cta"])
    
    # Contact section
    y_pos -= 18*mm
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width/2, y_pos, "CONTACT")
    
    y_pos -= 7*mm
    c.setFont("Helvetica", 10)
    c.drawCentredString(width/2, y_pos, content["website"])
    
    y_pos -= 5*mm
    c.drawCentredString(width/2, y_pos, content["email"])
    
    y_pos -= 5*mm
    c.drawCentredString(width/2, y_pos, content["phone"])
    
    y_pos -= 6*mm
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#A1A1AA"))
    c.drawCentredString(width/2, y_pos, content["address"])
    
    # Bottom bar
    c.setFillColor(RED)
    c.rect(0, 0, width, 10*mm, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width/2, 3*mm, "MOTO IMPORT B.V.")
    
    c.save()
    print(f"✅ Created: {output_path}")

def main():
    print("\n🏍️ Generating Compact Moto Import Flyers...")
    print("=" * 50)
    
    for lang_code, content in FLYER_CONTENT.items():
        output_path = UPLOADS_DIR / f"Moto_Import_Dealer_Flyer_2025_{lang_code}.pdf"
        create_flyer(lang_code, content, output_path)
    
    print("\n✅ All 4 flyers generated!")
    print(f"📁 Location: {UPLOADS_DIR}")

if __name__ == "__main__":
    main()
