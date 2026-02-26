#!/usr/bin/env python3
"""
Generate professional PDF flyers in French and Italian for recruiting motorcycle dealers
"""

from fpdf import FPDF
from fpdf.enums import XPos, YPos
from pathlib import Path

class DealerFlyer(FPDF):
    def __init__(self, language='fr'):
        super().__init__()
        self.language = language
        self.set_auto_page_break(auto=True, margin=15)
        
    def header(self):
        # Red header bar
        self.set_fill_color(220, 38, 38)
        self.rect(0, 0, 210, 35, 'F')
        
        # Logo
        self.set_font('Helvetica', 'B', 28)
        self.set_text_color(255, 255, 255)
        self.set_xy(15, 10)
        self.cell(0, 15, 'MOTO IMPORT', align='L')
        
        # Tagline
        self.set_font('Helvetica', '', 10)
        self.set_xy(15, 22)
        if self.language == 'fr':
            self.cell(0, 8, "Portail des concessionnaires de motos aux Pays-Bas", align='L')
        else:
            self.cell(0, 8, "Portale concessionari moto nei Paesi Bassi", align='L')
        
        self.ln(40)
        
    def footer(self):
        self.set_y(-25)
        self.set_fill_color(40, 40, 40)
        self.rect(0, 272, 210, 25, 'F')
        
        self.set_font('Helvetica', '', 9)
        self.set_text_color(255, 255, 255)
        self.set_xy(15, 277)
        self.cell(0, 5, 'Moto Import B.V.  |  Horsterhoekweg 11, 7433 SV Schalkhaar  |  +31 6 24264861', align='C')
        self.set_xy(15, 283)
        self.cell(0, 5, 'www.motoimportbv.nl  |  motoimportbv@gmail.com', align='C')
    
    def draw_bullet(self, x, y):
        self.set_fill_color(220, 38, 38)
        self.ellipse(x, y + 2, 4, 4, 'F')


def create_french_flyer():
    pdf = DealerFlyer(language='fr')
    pdf.add_page()
    
    # Main headline
    pdf.set_text_color(30, 30, 30)
    pdf.set_font('Helvetica', 'B', 24)
    pdf.cell(0, 12, 'Rejoignez le Portail Moto Import!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.ln(3)
    
    # Key message
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 8, 'Augmentez vos ventes de motos!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.ln(3)
    
    # Subheadline
    pdf.set_font('Helvetica', '', 12)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(0, 6, 
        'Nous livrons des motos a plus de 200 concessionnaires aux Pays-Bas.\n'
        'Devenez notre partenaire et accedez a un marche en pleine croissance!',
        align='C')
    
    pdf.ln(8)
    
    # Benefits
    benefits = [
        ("Prix Concessionnaire Exclusifs", "Vendez vos motos a des prix competitifs directement aux concessionnaires neerlandais."),
        ("Grand Reseau", "Plus de 200 concessionnaires actifs prets a acheter vos motos."),
        ("Ventes Rapides", "Notre plateforme permet des transactions rapides et efficaces."),
        ("Notifications Push", "Les concessionnaires recoivent une alerte des qu'une nouvelle moto est disponible."),
        ("Totalement Gratuit", "Aucun frais! L'inscription et l'utilisation de notre plateforme sont entierement gratuites."),
        ("Service Personnel", "Contact direct avec notre equipe pour toutes vos questions.")
    ]
    
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 10, 'Pourquoi choisir Moto Import?', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.ln(2)
    
    for title, description in benefits:
        y_pos = pdf.get_y()
        pdf.draw_bullet(15, y_pos)
        
        pdf.set_xy(25, y_pos)
        pdf.set_font('Helvetica', 'B', 11)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 7, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        pdf.set_x(25)
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(80, 80, 80)
        pdf.multi_cell(165, 5, description)
        
        pdf.ln(2)
    
    pdf.ln(3)
    
    # CTA box
    pdf.set_fill_color(220, 38, 38)
    box_y = pdf.get_y()
    pdf.rect(15, box_y, 180, 40, 'F')
    
    pdf.set_xy(15, box_y + 6)
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 8, 'Inscrivez-vous Maintenant - Gratuit!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', '', 11)
    pdf.cell(180, 6, 'Visitez:', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(180, 8, 'www.motoimportbv.nl/register/supplier', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(180, 5, 'Acces a notre reseau dans les 24 heures!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    output_path = Path('/app/backend/uploads/Moto_Import_Dealer_Info_FR.pdf')
    pdf.output(str(output_path))
    return output_path


def create_italian_flyer():
    pdf = DealerFlyer(language='it')
    pdf.add_page()
    
    # Main headline
    pdf.set_text_color(30, 30, 30)
    pdf.set_font('Helvetica', 'B', 24)
    pdf.cell(0, 12, 'Unisciti al Portale Moto Import!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.ln(3)
    
    # Key message
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 8, 'Aumenta le tue vendite di moto!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.ln(3)
    
    # Subheadline
    pdf.set_font('Helvetica', '', 12)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(0, 6, 
        'Consegniamo moto a piu di 200 concessionari nei Paesi Bassi.\n'
        'Diventa nostro partner e accedi a un mercato in crescita!',
        align='C')
    
    pdf.ln(8)
    
    # Benefits
    benefits = [
        ("Prezzi Esclusivi per Concessionari", "Vendi le tue moto a prezzi competitivi direttamente ai concessionari olandesi."),
        ("Grande Rete", "Piu di 200 concessionari attivi pronti ad acquistare le tue moto."),
        ("Vendite Rapide", "La nostra piattaforma permette transazioni rapide ed efficienti."),
        ("Notifiche Push", "I concessionari ricevono un avviso quando una nuova moto e disponibile."),
        ("Completamente Gratuito", "Nessun costo! La registrazione e l'utilizzo della nostra piattaforma sono completamente gratuiti."),
        ("Servizio Personale", "Contatto diretto con il nostro team per tutte le tue domande.")
    ]
    
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 10, 'Perche scegliere Moto Import?', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.ln(2)
    
    for title, description in benefits:
        y_pos = pdf.get_y()
        pdf.draw_bullet(15, y_pos)
        
        pdf.set_xy(25, y_pos)
        pdf.set_font('Helvetica', 'B', 11)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 7, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        pdf.set_x(25)
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(80, 80, 80)
        pdf.multi_cell(165, 5, description)
        
        pdf.ln(2)
    
    pdf.ln(3)
    
    # CTA box
    pdf.set_fill_color(220, 38, 38)
    box_y = pdf.get_y()
    pdf.rect(15, box_y, 180, 40, 'F')
    
    pdf.set_xy(15, box_y + 6)
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 8, 'Registrati Ora - Gratis!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', '', 11)
    pdf.cell(180, 6, 'Visita:', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(180, 8, 'www.motoimportbv.nl/register/supplier', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(180, 5, 'Accesso alla nostra rete entro 24 ore!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    output_path = Path('/app/backend/uploads/Moto_Import_Dealer_Info_IT.pdf')
    pdf.output(str(output_path))
    return output_path


def create_german_flyer():
    pdf = DealerFlyer(language='de')
    pdf.add_page()
    
    # Main headline
    pdf.set_text_color(30, 30, 30)
    pdf.set_font('Helvetica', 'B', 24)
    pdf.cell(0, 12, 'Treten Sie dem Moto Import Portal bei!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.ln(3)
    
    # Key message
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 8, 'Steigern Sie Ihren Motorradverkauf!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.ln(3)
    
    # Subheadline
    pdf.set_font('Helvetica', '', 12)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(0, 6, 
        'Wir liefern Motorrader an mehr als 200 Handler in den Niederlanden.\n'
        'Werden Sie unser Partner und erschliessen Sie einen wachsenden Markt!',
        align='C')
    
    pdf.ln(8)
    
    # Benefits
    benefits = [
        ("Exklusive Handlerpreise", "Verkaufen Sie Ihre Motorrader zu wettbewerbsfahigen Preisen direkt an niederlandische Handler."),
        ("Grosses Netzwerk", "Mehr als 200 aktive Handler, die bereit sind, Ihre Motorrader zu kaufen."),
        ("Schnelle Verkaufe", "Unsere Plattform ermoglicht schnelle und effiziente Transaktionen."),
        ("Push-Benachrichtigungen", "Handler erhalten sofort eine Meldung, wenn ein neues Motorrad verfugbar ist."),
        ("Komplett Kostenlos", "Keine Gebuhren! Die Registrierung und Nutzung unserer Plattform sind vollig kostenlos."),
        ("Personlicher Service", "Direkter Kontakt mit unserem Team fur alle Ihre Fragen.")
    ]
    
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 10, 'Warum Moto Import wahlen?', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.ln(2)
    
    for title, description in benefits:
        y_pos = pdf.get_y()
        pdf.draw_bullet(15, y_pos)
        
        pdf.set_xy(25, y_pos)
        pdf.set_font('Helvetica', 'B', 11)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 7, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        pdf.set_x(25)
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(80, 80, 80)
        pdf.multi_cell(165, 5, description)
        
        pdf.ln(2)
    
    pdf.ln(3)
    
    # CTA box
    pdf.set_fill_color(220, 38, 38)
    box_y = pdf.get_y()
    pdf.rect(15, box_y, 180, 40, 'F')
    
    pdf.set_xy(15, box_y + 6)
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 8, 'Jetzt Registrieren - Kostenlos!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', '', 11)
    pdf.cell(180, 6, 'Besuchen Sie:', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(180, 8, 'www.motoimportbv.nl/register/supplier', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(180, 5, 'Zugang zu unserem Netzwerk innerhalb von 24 Stunden!', align='C', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    output_path = Path('/app/backend/uploads/Moto_Import_Dealer_Info_DE.pdf')
    pdf.output(str(output_path))
    return output_path


if __name__ == '__main__':
    fr_path = create_french_flyer()
    print(f'Franse PDF gegenereerd: {fr_path}')
    
    it_path = create_italian_flyer()
    print(f'Italiaanse PDF gegenereerd: {it_path}')
    
    de_path = create_german_flyer()
    print(f'Duitse PDF gegenereerd: {de_path}')
