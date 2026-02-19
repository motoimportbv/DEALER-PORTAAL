#!/usr/bin/env python3
"""
Moto Import - Dealer Werving Flyer Generator
Creates professional PDF flyers for recruiting new dealers
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Colors
PRIMARY_COLOR = HexColor('#1a1a1a')
ACCENT_COLOR = HexColor('#dc2626')  # Red
LIGHT_BG = HexColor('#f5f5f5')
DARK_BG = HexColor('#0a0a0a')

def create_dealer_flyer(output_path, language='nl'):
    """Create a dealer recruitment flyer"""
    
    # Translations
    texts = {
        'nl': {
            'headline': 'Word Partner van Moto Import',
            'subheadline': 'Uw toegang tot exclusieve motoren uit heel Europa',
            'benefit1_title': 'Directe Toegang',
            'benefit1_desc': 'Krijg als eerste toegang tot nieuwe motoren van leveranciers uit Zwitserland, Duitsland en Italië',
            'benefit2_title': 'Scherpe Prijzen',
            'benefit2_desc': 'Profiteer van groothandelprijzen en live wisselkoersen voor de beste deals',
            'benefit3_title': 'Eenvoudig Bestellen',
            'benefit3_desc': 'Bestel direct via ons platform met complete voertuighistorie en documentatie',
            'benefit4_title': 'Persoonlijke Service',
            'benefit4_desc': 'Dedicated ondersteuning en directe communicatie met onze specialisten',
            'cta': 'Meld u vandaag nog aan!',
            'register_url': 'www.motoimportbv.nl/register',
            'contact': 'Contact',
            'phone': 'Telefoon',
            'email': 'E-mail',
            'website': 'Website',
            'footer': 'Moto Import BV - Uw betrouwbare partner in motorhandel',
            'free': 'Gratis registratie',
            'no_obligation': 'Vrijblijvend',
        },
        'de': {
            'headline': 'Werden Sie Partner von Moto Import',
            'subheadline': 'Ihr Zugang zu exklusiven Motorrädern aus ganz Europa',
            'benefit1_title': 'Direkter Zugang',
            'benefit1_desc': 'Erhalten Sie als Erster Zugang zu neuen Motorrädern von Lieferanten aus der Schweiz, Deutschland und Italien',
            'benefit2_title': 'Günstige Preise',
            'benefit2_desc': 'Profitieren Sie von Großhandelspreisen und Live-Wechselkursen für die besten Angebote',
            'benefit3_title': 'Einfach Bestellen',
            'benefit3_desc': 'Bestellen Sie direkt über unsere Plattform mit kompletter Fahrzeughistorie und Dokumentation',
            'benefit4_title': 'Persönlicher Service',
            'benefit4_desc': 'Dedizierte Unterstützung und direkte Kommunikation mit unseren Spezialisten',
            'cta': 'Melden Sie sich noch heute an!',
            'register_url': 'www.motoimportbv.nl/register',
            'contact': 'Kontakt',
            'phone': 'Telefon',
            'email': 'E-Mail',
            'website': 'Webseite',
            'footer': 'Moto Import BV - Ihr zuverlässiger Partner im Motorradhandel',
            'free': 'Kostenlose Registrierung',
            'no_obligation': 'Unverbindlich',
        },
        'it': {
            'headline': 'Diventa Partner di Moto Import',
            'subheadline': 'Il tuo accesso a moto esclusive da tutta Europa',
            'benefit1_title': 'Accesso Diretto',
            'benefit1_desc': 'Ottieni per primo l\'accesso a nuove moto da fornitori in Svizzera, Germania e Italia',
            'benefit2_title': 'Prezzi Competitivi',
            'benefit2_desc': 'Approfitta dei prezzi all\'ingrosso e dei tassi di cambio in tempo reale per le migliori offerte',
            'benefit3_title': 'Ordini Semplici',
            'benefit3_desc': 'Ordina direttamente tramite la nostra piattaforma con storia completa del veicolo e documentazione',
            'benefit4_title': 'Servizio Personale',
            'benefit4_desc': 'Supporto dedicato e comunicazione diretta con i nostri specialisti',
            'cta': 'Registrati oggi stesso!',
            'register_url': 'www.motoimportbv.nl/register',
            'contact': 'Contatto',
            'phone': 'Telefono',
            'email': 'E-mail',
            'website': 'Sito web',
            'footer': 'Moto Import BV - Il tuo partner affidabile nel commercio di moto',
            'free': 'Registrazione gratuita',
            'no_obligation': 'Senza impegno',
        },
        'fr': {
            'headline': 'Devenez Partenaire de Moto Import',
            'subheadline': 'Votre accès aux motos exclusives de toute l\'Europe',
            'benefit1_title': 'Accès Direct',
            'benefit1_desc': 'Obtenez en premier l\'accès aux nouvelles motos de fournisseurs en Suisse, Allemagne et Italie',
            'benefit2_title': 'Prix Compétitifs',
            'benefit2_desc': 'Profitez des prix de gros et des taux de change en direct pour les meilleures offres',
            'benefit3_title': 'Commandes Simples',
            'benefit3_desc': 'Commandez directement via notre plateforme avec historique complet du véhicule et documentation',
            'benefit4_title': 'Service Personnel',
            'benefit4_desc': 'Support dédié et communication directe avec nos spécialistes',
            'cta': 'Inscrivez-vous dès aujourd\'hui!',
            'register_url': 'www.motoimportbv.nl/register',
            'contact': 'Contact',
            'phone': 'Téléphone',
            'email': 'E-mail',
            'website': 'Site web',
            'footer': 'Moto Import BV - Votre partenaire fiable dans le commerce de motos',
            'free': 'Inscription gratuite',
            'no_obligation': 'Sans engagement',
        }
    }
    
    t = texts.get(language, texts['nl'])
    
    # Create PDF
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # Header background
    c.setFillColor(DARK_BG)
    c.rect(0, height - 120*mm, width, 120*mm, fill=True, stroke=False)
    
    # Logo / Company name
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 42)
    c.drawString(25*mm, height - 35*mm, "MOTO IMPORT")
    
    # Tagline
    c.setFont("Helvetica", 14)
    c.setFillColor(HexColor('#888888'))
    c.drawString(25*mm, height - 45*mm, "Professional Motorcycle Trading")
    
    # Main headline
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(25*mm, height - 75*mm, t['headline'])
    
    # Subheadline
    c.setFont("Helvetica", 14)
    c.setFillColor(HexColor('#cccccc'))
    c.drawString(25*mm, height - 88*mm, t['subheadline'])
    
    # Free registration badge
    c.setFillColor(ACCENT_COLOR)
    c.roundRect(width - 70*mm, height - 50*mm, 55*mm, 22*mm, 5*mm, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width - 42.5*mm, height - 36*mm, t['free'])
    c.setFont("Helvetica", 9)
    c.drawCentredString(width - 42.5*mm, height - 44*mm, t['no_obligation'])
    
    # Benefits section
    y_pos = height - 140*mm
    
    benefits = [
        (t['benefit1_title'], t['benefit1_desc'], '1'),
        (t['benefit2_title'], t['benefit2_desc'], '2'),
        (t['benefit3_title'], t['benefit3_desc'], '3'),
        (t['benefit4_title'], t['benefit4_desc'], '4'),
    ]
    
    for title, desc, num in benefits:
        # Number circle
        c.setFillColor(ACCENT_COLOR)
        c.circle(35*mm, y_pos + 5*mm, 8*mm, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(35*mm, y_pos + 2*mm, num)
        
        # Title
        c.setFillColor(PRIMARY_COLOR)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50*mm, y_pos + 5*mm, title)
        
        # Description
        c.setFillColor(HexColor('#555555'))
        c.setFont("Helvetica", 11)
        
        # Word wrap for description
        words = desc.split()
        lines = []
        current_line = []
        for word in words:
            current_line.append(word)
            if c.stringWidth(' '.join(current_line), "Helvetica", 11) > 130*mm:
                current_line.pop()
                lines.append(' '.join(current_line))
                current_line = [word]
        if current_line:
            lines.append(' '.join(current_line))
        
        for i, line in enumerate(lines):
            c.drawString(50*mm, y_pos - 5*mm - (i * 5*mm), line)
        
        y_pos -= 35*mm
    
    # CTA Section
    cta_y = 75*mm
    
    # CTA background
    c.setFillColor(LIGHT_BG)
    c.rect(0, cta_y - 25*mm, width, 55*mm, fill=True, stroke=False)
    
    # CTA text
    c.setFillColor(PRIMARY_COLOR)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width/2, cta_y + 15*mm, t['cta'])
    
    # Registration URL box
    c.setFillColor(ACCENT_COLOR)
    c.roundRect(width/2 - 55*mm, cta_y - 15*mm, 110*mm, 18*mm, 4*mm, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width/2, cta_y - 8*mm, t['register_url'])
    
    # Footer / Contact info
    footer_y = 35*mm
    
    c.setFillColor(DARK_BG)
    c.rect(0, 0, width, footer_y + 5*mm, fill=True, stroke=False)
    
    # Contact details
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(25*mm, footer_y - 5*mm, t['contact'])
    
    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor('#aaaaaa'))
    
    contact_info = [
        (t['website'] + ":", "www.motoimportbv.nl"),
        (t['email'] + ":", "info@motoimportbv.nl"),
    ]
    
    x_pos = 25*mm
    for label, value in contact_info:
        c.setFillColor(HexColor('#888888'))
        c.drawString(x_pos, footer_y - 18*mm, label)
        c.setFillColor(white)
        c.drawString(x_pos + 25*mm, footer_y - 18*mm, value)
        x_pos += 80*mm
    
    # Footer tagline
    c.setFillColor(HexColor('#666666'))
    c.setFont("Helvetica", 9)
    c.drawCentredString(width/2, 8*mm, t['footer'])
    
    c.save()
    print(f"Flyer created: {output_path}")
    return output_path


if __name__ == "__main__":
    output_dir = "/app/backend/uploads"
    
    # Create flyers in different languages
    languages = ['nl', 'de', 'it', 'fr']
    
    for lang in languages:
        output_path = os.path.join(output_dir, f"Moto_Import_Dealer_Flyer_{lang.upper()}.pdf")
        create_dealer_flyer(output_path, lang)
    
    print("\nAll flyers created successfully!")
