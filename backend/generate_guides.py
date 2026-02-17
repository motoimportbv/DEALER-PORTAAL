from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, ListFlowable, ListItem
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Output directory
OUTPUT_DIR = "/app/frontend/public/guides"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def create_styles():
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        name='MainTitle',
        fontSize=24,
        spaceAfter=6,
        alignment=1,
        textColor=colors.HexColor('#18181b'),
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='Tagline',
        fontSize=14,
        spaceAfter=20,
        alignment=1,
        textColor=colors.HexColor('#dc2626'),
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='SectionTitle',
        fontSize=14,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#18181b'),
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='GuideBodyText',
        fontSize=10,
        spaceAfter=8,
        textColor=colors.HexColor('#3f3f46'),
        leading=14
    ))
    
    styles.add(ParagraphStyle(
        name='BulletText',
        fontSize=10,
        leftIndent=20,
        spaceAfter=4,
        textColor=colors.HexColor('#3f3f46'),
        leading=14
    ))
    
    styles.add(ParagraphStyle(
        name='URLStyle',
        fontSize=11,
        spaceAfter=15,
        textColor=colors.HexColor('#dc2626'),
        fontName='Helvetica-Bold',
        alignment=1
    ))
    
    return styles

def create_dealer_guide_nl():
    filename = os.path.join(OUTPUT_DIR, "dealer-handleiding-nl.pdf")
    doc = SimpleDocTemplate(filename, pagesize=A4, 
                           rightMargin=2*cm, leftMargin=2*cm,
                           topMargin=2*cm, bottomMargin=2*cm)
    
    styles = create_styles()
    story = []
    
    # Header
    story.append(Paragraph("MOTO IMPORT B.V.", styles['MainTitle']))
    story.append(Paragraph("Kom bij het grootste motor netwerk van Nederland", styles['Tagline']))
    story.append(Spacer(1, 10))
    story.append(Paragraph("DEALER INSTALLATIEHANDLEIDING", styles['SectionTitle']))
    story.append(Paragraph("Stap-voor-stap gids voor registratie en app installatie", styles['GuideBodyText']))
    story.append(Spacer(1, 15))
    
    # Intro
    story.append(Paragraph(
        "Welkom bij Moto Import! Als dealer krijgt u toegang tot ons uitgebreide aanbod van motoren "
        "tegen aantrekkelijke prijzen. Volg deze handleiding om te starten.",
        styles['GuideBodyText']
    ))
    story.append(Spacer(1, 10))
    
    # Step 1
    story.append(Paragraph("STAP 1: REGISTREREN ALS DEALER", styles['SectionTitle']))
    steps1 = [
        "Ga naar de registratiepagina (zie URL onderaan)",
        "Vul uw bedrijfsgegevens in:",
        "   • Bedrijfsnaam",
        "   • KVK-nummer",
        "   • Adres, postcode en plaats",
        "   • Contactpersoon en telefoonnummer",
        "Maak een account aan met uw e-mailadres en wachtwoord",
        "Accepteer de Algemene Voorwaarden",
        "Klik op 'Account Aanmaken'",
        "Wacht op goedkeuring door Moto Import (u ontvangt een e-mail)"
    ]
    for step in steps1:
        story.append(Paragraph(f"✓ {step}" if not step.startswith("   ") else step, styles['BulletText']))
    
    story.append(Spacer(1, 10))
    story.append(Paragraph("Registratie URL:", styles['GuideBodyText']))
    story.append(Paragraph("https://motocycle-hub-1.preview.emergentagent.com/register", styles['URLStyle']))
    
    # Step 2
    story.append(Paragraph("STAP 2: APP INSTALLEREN", styles['SectionTitle']))
    story.append(Paragraph("Na goedkeuring kunt u de app installeren voor snelle toegang tot nieuwe motoren:", styles['GuideBodyText']))
    story.append(Spacer(1, 5))
    
    story.append(Paragraph("<b>Voor iPhone/iPad:</b>", styles['GuideBodyText']))
    story.append(Paragraph("1. Open Safari en ga naar onze website", styles['BulletText']))
    story.append(Paragraph("2. Tik op het 'Delen' icoon (vierkant met pijl omhoog)", styles['BulletText']))
    story.append(Paragraph("3. Scroll naar beneden en tik op 'Zet op beginscherm'", styles['BulletText']))
    story.append(Paragraph("4. Tik op 'Voeg toe'", styles['BulletText']))
    story.append(Spacer(1, 5))
    
    story.append(Paragraph("<b>Voor Android:</b>", styles['GuideBodyText']))
    story.append(Paragraph("1. Open Chrome en ga naar onze website", styles['BulletText']))
    story.append(Paragraph("2. Tik op de drie puntjes (menu) rechtsboven", styles['BulletText']))
    story.append(Paragraph("3. Tik op 'App installeren' of 'Toevoegen aan startscherm'", styles['BulletText']))
    story.append(Paragraph("4. Bevestig de installatie", styles['BulletText']))
    
    # Step 3
    story.append(Paragraph("STAP 3: MELDINGEN INSCHAKELEN", styles['SectionTitle']))
    story.append(Paragraph("Ontvang direct een melding als er nieuwe motoren beschikbaar zijn:", styles['GuideBodyText']))
    story.append(Paragraph("✓ Log in op uw account", styles['BulletText']))
    story.append(Paragraph("✓ Klik op 'Push Notificaties' → 'Inschakelen'", styles['BulletText']))
    story.append(Paragraph("✓ Geef toestemming in uw browser", styles['BulletText']))
    story.append(Paragraph("✓ U ontvangt nu meldingen bij nieuwe motoren!", styles['BulletText']))
    
    # Step 4
    story.append(Paragraph("STAP 4: MOTOREN BESTELLEN", styles['SectionTitle']))
    story.append(Paragraph("✓ Bekijk het motoraanbod via 'Motoren'", styles['BulletText']))
    story.append(Paragraph("✓ Klik op een motor voor details", styles['BulletText']))
    story.append(Paragraph("✓ Klik op 'Direct Kopen'", styles['BulletText']))
    story.append(Paragraph("✓ Kies eventueel: Bezorging (€50), Keuring (€125), Taxatie (€160 excl. BTW)", styles['BulletText']))
    story.append(Paragraph("✓ Bevestig uw bestelling", styles['BulletText']))
    story.append(Paragraph("✓ U ontvangt een pakbon per e-mail", styles['BulletText']))
    
    # Contact
    story.append(Spacer(1, 20))
    story.append(Paragraph("CONTACT", styles['SectionTitle']))
    story.append(Paragraph("Moto Import B.V.", styles['GuideBodyText']))
    story.append(Paragraph("Horstenhoekweg 11", styles['GuideBodyText']))
    story.append(Paragraph("7433 SV Schalkhaar", styles['GuideBodyText']))
    story.append(Paragraph("Tel: +31 6 38525541", styles['GuideBodyText']))
    story.append(Paragraph("Email: motoimportbv@gmail.com", styles['GuideBodyText']))
    
    doc.build(story)
    print(f"Created: {filename}")
    return filename

def create_supplier_guide_nl():
    filename = os.path.join(OUTPUT_DIR, "leverancier-handleiding-nl.pdf")
    doc = SimpleDocTemplate(filename, pagesize=A4,
                           rightMargin=2*cm, leftMargin=2*cm,
                           topMargin=2*cm, bottomMargin=2*cm)
    
    styles = create_styles()
    # Change color for supplier guide
    styles['Tagline'].textColor = colors.HexColor('#7c3aed')
    styles['URLStyle'].textColor = colors.HexColor('#7c3aed')
    
    story = []
    
    # Header
    story.append(Paragraph("MOTO IMPORT B.V.", styles['MainTitle']))
    story.append(Paragraph("Kom bij het grootste motor netwerk van Nederland", styles['Tagline']))
    story.append(Spacer(1, 10))
    story.append(Paragraph("LEVERANCIER HANDLEIDING", styles['SectionTitle']))
    story.append(Paragraph("Stap-voor-stap gids voor registratie en app installatie", styles['GuideBodyText']))
    story.append(Spacer(1, 15))
    
    # Intro
    story.append(Paragraph(
        "Welkom bij Moto Import! Als buitenlandse leverancier kunt u eenvoudig uw motoren aanbieden "
        "aan ons uitgebreide dealernetwerk in Nederland. Volg deze handleiding om te starten.",
        styles['GuideBodyText']
    ))
    story.append(Spacer(1, 10))
    
    # Step 1
    story.append(Paragraph("STAP 1: REGISTREREN ALS LEVERANCIER", styles['SectionTitle']))
    story.append(Paragraph("✓ Ga naar de registratiepagina voor leveranciers (zie URL onderaan)", styles['BulletText']))
    story.append(Paragraph("✓ Vul uw bedrijfsgegevens in:", styles['BulletText']))
    story.append(Paragraph("   • Bedrijfsnaam", styles['BulletText']))
    story.append(Paragraph("   • Land (selecteer uit de lijst)", styles['BulletText']))
    story.append(Paragraph("   • Contactpersoon", styles['BulletText']))
    story.append(Paragraph("   • Telefoonnummer", styles['BulletText']))
    story.append(Paragraph("✓ Maak een account aan met uw e-mailadres en wachtwoord", styles['BulletText']))
    story.append(Paragraph("✓ Klik op 'Registreren als Leverancier'", styles['BulletText']))
    story.append(Paragraph("✓ Wacht op goedkeuring door Moto Import (u ontvangt een e-mail)", styles['BulletText']))
    
    story.append(Spacer(1, 10))
    story.append(Paragraph("Registratie URL:", styles['GuideBodyText']))
    story.append(Paragraph("https://motocycle-hub-1.preview.emergentagent.com/register/supplier", styles['URLStyle']))
    
    # Step 2
    story.append(Paragraph("STAP 2: APP DOWNLOADEN", styles['SectionTitle']))
    story.append(Paragraph("Na goedkeuring kunt u de app installeren voor eenvoudig beheer:", styles['GuideBodyText']))
    story.append(Spacer(1, 5))
    
    story.append(Paragraph("<b>Voor iPhone/iPad:</b>", styles['GuideBodyText']))
    story.append(Paragraph("1. Open Safari en ga naar onze website", styles['BulletText']))
    story.append(Paragraph("2. Tik op het 'Delen' icoon (vierkant met pijl omhoog)", styles['BulletText']))
    story.append(Paragraph("3. Scroll naar beneden en tik op 'Zet op beginscherm'", styles['BulletText']))
    story.append(Paragraph("4. Tik op 'Voeg toe'", styles['BulletText']))
    story.append(Spacer(1, 5))
    
    story.append(Paragraph("<b>Voor Android:</b>", styles['GuideBodyText']))
    story.append(Paragraph("1. Open Chrome en ga naar onze website", styles['BulletText']))
    story.append(Paragraph("2. Tik op de drie puntjes (menu) rechtsboven", styles['BulletText']))
    story.append(Paragraph("3. Tik op 'App installeren' of 'Toevoegen aan startscherm'", styles['BulletText']))
    story.append(Paragraph("4. Bevestig de installatie", styles['BulletText']))
    
    # Step 3
    story.append(Paragraph("STAP 3: MOTOREN TOEVOEGEN", styles['SectionTitle']))
    story.append(Paragraph("✓ Log in met uw account", styles['BulletText']))
    story.append(Paragraph("✓ Klik op 'Motor Toevoegen' in het menu", styles['BulletText']))
    story.append(Paragraph("✓ Vul de motorgegevens in (merk, model, jaar, prijs, etc.)", styles['BulletText']))
    story.append(Paragraph("✓ Upload foto's van de motor", styles['BulletText']))
    story.append(Paragraph("✓ Verzend ter goedkeuring", styles['BulletText']))
    story.append(Paragraph("✓ Moto Import controleert en activeert uw motor", styles['BulletText']))
    
    # Contact
    story.append(Spacer(1, 20))
    story.append(Paragraph("CONTACT", styles['SectionTitle']))
    story.append(Paragraph("Moto Import B.V.", styles['GuideBodyText']))
    story.append(Paragraph("Horstenhoekweg 11", styles['GuideBodyText']))
    story.append(Paragraph("7433 SV Schalkhaar", styles['GuideBodyText']))
    story.append(Paragraph("Tel: +31 6 38525541", styles['GuideBodyText']))
    story.append(Paragraph("Email: motoimportbv@gmail.com", styles['GuideBodyText']))
    
    doc.build(story)
    print(f"Created: {filename}")
    return filename

def create_dealer_guide_de():
    filename = os.path.join(OUTPUT_DIR, "haendler-anleitung-de.pdf")
    doc = SimpleDocTemplate(filename, pagesize=A4,
                           rightMargin=2*cm, leftMargin=2*cm,
                           topMargin=2*cm, bottomMargin=2*cm)
    
    styles = create_styles()
    story = []
    
    story.append(Paragraph("MOTO IMPORT B.V.", styles['MainTitle']))
    story.append(Paragraph("Werden Sie Teil des größten Motorradnetzwerks der Niederlande", styles['Tagline']))
    story.append(Spacer(1, 10))
    story.append(Paragraph("HÄNDLER INSTALLATIONSANLEITUNG", styles['SectionTitle']))
    story.append(Spacer(1, 15))
    
    story.append(Paragraph(
        "Willkommen bei Moto Import! Als Händler erhalten Sie Zugang zu unserem umfangreichen "
        "Motorradangebot zu attraktiven Preisen.",
        styles['GuideBodyText']
    ))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("SCHRITT 1: ALS HÄNDLER REGISTRIEREN", styles['SectionTitle']))
    story.append(Paragraph("✓ Gehen Sie zur Registrierungsseite", styles['BulletText']))
    story.append(Paragraph("✓ Geben Sie Ihre Unternehmensdaten ein (Firmenname, Handelsregisternummer, Adresse)", styles['BulletText']))
    story.append(Paragraph("✓ Erstellen Sie ein Konto mit E-Mail und Passwort", styles['BulletText']))
    story.append(Paragraph("✓ Akzeptieren Sie die AGB und klicken Sie auf 'Konto erstellen'", styles['BulletText']))
    story.append(Paragraph("✓ Warten Sie auf die Genehmigung (Sie erhalten eine E-Mail)", styles['BulletText']))
    
    story.append(Spacer(1, 10))
    story.append(Paragraph("Registrierungs-URL:", styles['GuideBodyText']))
    story.append(Paragraph("https://motocycle-hub-1.preview.emergentagent.com/register", styles['URLStyle']))
    
    story.append(Paragraph("SCHRITT 2: APP INSTALLIEREN", styles['SectionTitle']))
    story.append(Paragraph("<b>Für iPhone:</b> Safari → Teilen → 'Zum Home-Bildschirm'", styles['BulletText']))
    story.append(Paragraph("<b>Für Android:</b> Chrome → Menü → 'App installieren'", styles['BulletText']))
    
    story.append(Paragraph("SCHRITT 3: BENACHRICHTIGUNGEN AKTIVIEREN", styles['SectionTitle']))
    story.append(Paragraph("✓ Anmelden → 'Push-Benachrichtigungen' → 'Aktivieren'", styles['BulletText']))
    
    story.append(Paragraph("SCHRITT 4: MOTORRÄDER BESTELLEN", styles['SectionTitle']))
    story.append(Paragraph("✓ Motorrad auswählen → 'Direkt kaufen'", styles['BulletText']))
    story.append(Paragraph("✓ Optional: Lieferung (€50), Inspektion (€125), Bewertung (€160 zzgl. MwSt.)", styles['BulletText']))
    
    story.append(Spacer(1, 20))
    story.append(Paragraph("KONTAKT: Moto Import B.V. | Tel: +31 6 38525541 | motoimportbv@gmail.com", styles['GuideBodyText']))
    
    doc.build(story)
    print(f"Created: {filename}")
    return filename

def create_supplier_guide_de():
    filename = os.path.join(OUTPUT_DIR, "lieferanten-anleitung-de.pdf")
    doc = SimpleDocTemplate(filename, pagesize=A4,
                           rightMargin=2*cm, leftMargin=2*cm,
                           topMargin=2*cm, bottomMargin=2*cm)
    
    styles = create_styles()
    styles['Tagline'].textColor = colors.HexColor('#7c3aed')
    styles['URLStyle'].textColor = colors.HexColor('#7c3aed')
    story = []
    
    story.append(Paragraph("MOTO IMPORT B.V.", styles['MainTitle']))
    story.append(Paragraph("Werden Sie Teil des größten Motorradnetzwerks der Niederlande", styles['Tagline']))
    story.append(Spacer(1, 10))
    story.append(Paragraph("LIEFERANTEN HANDBUCH", styles['SectionTitle']))
    story.append(Spacer(1, 15))
    
    story.append(Paragraph(
        "Willkommen bei Moto Import! Als ausländischer Lieferant können Sie Ihre Motorräder "
        "einfach unserem Händlernetzwerk in den Niederlanden anbieten.",
        styles['GuideBodyText']
    ))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("SCHRITT 1: ALS LIEFERANT REGISTRIEREN", styles['SectionTitle']))
    story.append(Paragraph("✓ Gehen Sie zur Lieferanten-Registrierungsseite", styles['BulletText']))
    story.append(Paragraph("✓ Geben Sie ein: Firmenname, Land, Kontaktperson, Telefon", styles['BulletText']))
    story.append(Paragraph("✓ Erstellen Sie ein Konto mit E-Mail und Passwort", styles['BulletText']))
    story.append(Paragraph("✓ Klicken Sie auf 'Als Lieferant registrieren'", styles['BulletText']))
    
    story.append(Spacer(1, 10))
    story.append(Paragraph("Registrierungs-URL:", styles['GuideBodyText']))
    story.append(Paragraph("https://motocycle-hub-1.preview.emergentagent.com/register/supplier", styles['URLStyle']))
    
    story.append(Paragraph("SCHRITT 2: APP INSTALLIEREN", styles['SectionTitle']))
    story.append(Paragraph("<b>Für iPhone:</b> Safari → Teilen → 'Zum Home-Bildschirm'", styles['BulletText']))
    story.append(Paragraph("<b>Für Android:</b> Chrome → Menü → 'App installieren'", styles['BulletText']))
    
    story.append(Paragraph("SCHRITT 3: MOTORRÄDER HINZUFÜGEN", styles['SectionTitle']))
    story.append(Paragraph("✓ Anmelden → 'Motorrad hinzufügen'", styles['BulletText']))
    story.append(Paragraph("✓ Details eingeben und Fotos hochladen", styles['BulletText']))
    story.append(Paragraph("✓ Zur Genehmigung einreichen", styles['BulletText']))
    
    story.append(Spacer(1, 20))
    story.append(Paragraph("KONTAKT: Moto Import B.V. | Tel: +31 6 38525541 | motoimportbv@gmail.com", styles['GuideBodyText']))
    
    doc.build(story)
    print(f"Created: {filename}")
    return filename

if __name__ == "__main__":
    create_dealer_guide_nl()
    create_supplier_guide_nl()
    create_dealer_guide_de()
    create_supplier_guide_de()
    print(f"\nAll PDFs created in: {OUTPUT_DIR}")
    print("Files:")
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith('.pdf'):
            print(f"  - {f}")
