#!/usr/bin/env python3
"""
Generate a professional PDF flyer for recruiting motorcycle dealers to Moto Import
"""

from fpdf import FPDF
from pathlib import Path
import os

class DealerFlyer(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=15)
        
    def header(self):
        # Red header bar
        self.set_fill_color(220, 38, 38)  # Red-600
        self.rect(0, 0, 210, 35, 'F')
        
        # Logo area (white text)
        self.set_font('Helvetica', 'B', 28)
        self.set_text_color(255, 255, 255)
        self.set_xy(15, 10)
        self.cell(0, 15, 'MOTO IMPORT', align='L')
        
        # Tagline
        self.set_font('Helvetica', '', 10)
        self.set_xy(15, 22)
        self.cell(0, 8, "Het grootste motorennetwerk van Europa", align='L')
        
        self.ln(40)
        
    def footer(self):
        self.set_y(-25)
        self.set_fill_color(40, 40, 40)
        self.rect(0, 272, 210, 25, 'F')
        
        self.set_font('Helvetica', '', 9)
        self.set_text_color(255, 255, 255)
        self.set_xy(15, 277)
        self.cell(0, 5, 'Moto Import B.V.  |  Horsterhoekweg 11, 7433 SV Schalkhaar  |  +31 6 81792660', align='C')
        self.set_xy(15, 283)
        self.cell(0, 5, 'www.motoimportbv.nl  |  motoimportbv@gmail.com', align='C')


def create_flyer():
    pdf = DealerFlyer()
    pdf.add_page()
    
    # Main headline
    pdf.set_text_color(30, 30, 30)
    pdf.set_font('Helvetica', 'B', 26)
    pdf.cell(0, 12, 'Word Partner van Moto Import!', align='C', ln=True)
    
    pdf.ln(5)
    
    # Subheadline
    pdf.set_font('Helvetica', '', 13)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(0, 7, 
        'Sluit u aan bij het snelst groeiende motorennetwerk van Europa.\n'
        'Toegang tot honderden motoren tegen dealerprijzen.',
        align='C')
    
    pdf.ln(10)
    
    # Benefits section
    benefits = [
        ("Exclusieve Dealerprijzen", "Koop motoren tegen scherpe inkoopprijzen, rechtstreeks van importeurs uit heel Europa."),
        ("Groot Aanbod", "Dagelijks nieuwe motoren van alle topmerken: BMW, Honda, Kawasaki, Yamaha, Ducati en meer."),
        ("Eenvoudig Bestellen", "Bestel met één klik via onze app. Levering binnen enkele dagen mogelijk."),
        ("Push Notificaties", "Ontvang direct een melding wanneer een interessante motor beschikbaar komt."),
        ("Geen Verplichtingen", "Geen maandelijkse kosten, geen minimale afname. Betaal alleen wat u bestelt."),
        ("Persoonlijke Service", "Direct contact met ons team voor vragen, transport en after-sales.")
    ]
    
    # Draw benefits with icons
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 10, 'Waarom kiezen voor Moto Import?', ln=True)
    
    pdf.ln(3)
    
    for title, description in benefits:
        # Checkmark bullet
        pdf.set_fill_color(220, 38, 38)
        pdf.set_draw_color(220, 38, 38)
        
        # Red bullet point
        y_pos = pdf.get_y()
        pdf.set_xy(15, y_pos + 2)
        pdf.set_font('Helvetica', 'B', 14)
        pdf.set_text_color(220, 38, 38)
        pdf.cell(8, 6, chr(0x2713), ln=False)  # Checkmark
        
        # Title
        pdf.set_xy(25, y_pos)
        pdf.set_font('Helvetica', 'B', 11)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 7, title, ln=True)
        
        # Description
        pdf.set_x(25)
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(80, 80, 80)
        pdf.multi_cell(165, 5, description)
        
        pdf.ln(3)
    
    pdf.ln(5)
    
    # Call to action box
    pdf.set_fill_color(220, 38, 38)
    box_y = pdf.get_y()
    pdf.rect(15, box_y, 180, 45, 'F')
    
    pdf.set_xy(15, box_y + 8)
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 8, 'Registreer Nu - Gratis!', align='C', ln=True)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', '', 11)
    pdf.cell(180, 6, 'Scan de QR-code of ga naar:', align='C', ln=True)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(180, 8, 'www.motoimportbv.nl/register', align='C', ln=True)
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(180, 6, 'Binnen 24 uur krijgt u toegang tot ons complete aanbod!', align='C', ln=True)
    
    # Save PDF
    output_path = Path('/app/backend/uploads/Moto_Import_Dealer_Info.pdf')
    pdf.output(str(output_path))
    
    return output_path


if __name__ == '__main__':
    path = create_flyer()
    print(f'PDF gegenereerd: {path}')
