"""Genereer een professionele Italiaanse handelsbrief voor Mundimoto.

Output: /app/Brief_Mundimoto_IT.pdf  +  /app/Brief_Mundimoto_IT.docx
"""
import io
from datetime import datetime
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_JUSTIFY

OUT_PDF = Path("/app/Brief_Mundimoto_IT.pdf")

today_it = datetime.now().strftime("%d/%m/%Y")

styles = getSampleStyleSheet()
n = ParagraphStyle('N', parent=styles['Normal'], fontSize=10.5, leading=15, fontName='Helvetica')
nj = ParagraphStyle('NJ', parent=n, alignment=TA_JUSTIFY)
b = ParagraphStyle('B', parent=n, fontName='Helvetica-Bold')
small = ParagraphStyle('S', parent=n, fontSize=8.5, textColor=colors.HexColor('#666'))
right = ParagraphStyle('R', parent=n, alignment=TA_RIGHT)
right_b = ParagraphStyle('RB', parent=b, alignment=TA_RIGHT)
title = ParagraphStyle('T', parent=n, fontSize=20, fontName='Helvetica-Bold',
                       textColor=colors.HexColor('#dc2626'), spaceAfter=2*mm)
sub = ParagraphStyle('SUB', parent=n, fontSize=11, textColor=colors.HexColor('#666'),
                     spaceAfter=8*mm)
h2 = ParagraphStyle('H2', parent=b, fontSize=12, textColor=colors.HexColor('#18181b'),
                    spaceBefore=4*mm, spaceAfter=2*mm)

elements = []

# ==== HEADER (afzender — rechts) ====
elements.append(Paragraph("MOTO IMPORT B.V.", right_b))
elements.append(Paragraph("Horsterhoekweg 11", right))
elements.append(Paragraph("7433 SV Schalkhaar — Paesi Bassi", right))
elements.append(Paragraph("KvK 94622086 &nbsp;•&nbsp; P.IVA NL867456982B01", right))
elements.append(Paragraph("Tel. +31 6 24264861 &nbsp;•&nbsp; motoimportbv@gmail.com", right))
elements.append(Spacer(1, 6 * mm))

# ==== Geadresseerde ====
elements.append(Paragraph("<b>Spett.le</b>", n))
elements.append(Paragraph("<b>Mundimoto S.r.l.</b>", b))
elements.append(Paragraph("Direzione Acquisti / Reparto Internazionale", n))
elements.append(Paragraph("Italia", n))
elements.append(Spacer(1, 5 * mm))

elements.append(Paragraph(f"Schalkhaar, {today_it}", right))
elements.append(Spacer(1, 5 * mm))

elements.append(Paragraph("<b>Oggetto:</b> Richiesta di incontro — accesso gratuito alla nostra rete di 120 concessionari olandesi", b))
elements.append(Spacer(1, 6 * mm))

# ==== Aanhef ====
elements.append(Paragraph("Gentili Signori,", n))
elements.append(Spacer(1, 3 * mm))

# ==== Wie we zijn ====
elements.append(Paragraph(
    "con la presente desideriamo presentarci. <b>Moto Import B.V.</b> è una società "
    "olandese che acquista <b>motociclette in Italia</b> per conto dei propri "
    "concessionari nei Paesi Bassi. Disponiamo di una <b>rete consolidata di "
    "120 dealer olandesi</b> che si rivolgono regolarmente a noi per ampliare "
    "il proprio stock con motociclette italiane di qualità.",
    nj,
))
elements.append(Spacer(1, 3 * mm))

elements.append(Paragraph(
    "Per facilitare e velocizzare questo flusso, abbiamo sviluppato un "
    "<b>portale digitale dedicato</b> sul quale i nostri 120 dealer consultano "
    "ogni giorno le motociclette disponibili presso i fornitori italiani con cui "
    "collaboriamo. Quando un dealer è interessato, l'acquisto avviene "
    "<b>immediatamente e direttamente</b>, senza intermediazioni inutili.",
    nj,
))

elements.append(Spacer(1, 4 * mm))

# ==== Wat we bieden Mundimoto ====
elements.append(Paragraph("Cosa offriamo a Mundimoto — gratuitamente", h2))
elements.append(Paragraph(
    "<b>1. Pubblicazione gratuita del vostro stock.</b> Voi caricate le motociclette "
    "che desiderate vendere sul nostro portale (foto, prezzo, dati tecnici). "
    "Nessun costo di iscrizione, nessuna commissione di pubblicazione.",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "<b>2. Visibilità immediata su 120 concessionari olandesi.</b> Le vostre "
    "motociclette diventano visibili istantaneamente alla nostra intera rete di "
    "dealer professionali. Si tratta di acquirenti seri, abituati a transazioni "
    "B2B rapide e trasparenti.",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "<b>3. Vendita diretta e veloce.</b> I dealer interessati possono acquistare "
    "subito tramite la piattaforma. Voi ricevete la conferma e il pagamento, "
    "senza dover gestire trattative individuali.",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "<b>4. Volumi costanti.</b> La domanda olandese è continua: i nostri dealer "
    "rinnovano lo stock ogni mese. Per voi significa un <b>nuovo canale di vendita "
    "stabile</b>, senza investimenti né rischi.",
    nj,
))

elements.append(Spacer(1, 4 * mm))

# ==== Voorstel: afspraak ====
elements.append(Paragraph("Richiesta di incontro presso le vostre sedi", h2))
elements.append(Paragraph(
    "Saremmo molto interessati a venire personalmente a trovarvi presso una delle "
    "vostre sedi italiane per:",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "&nbsp;&nbsp;•&nbsp; mostrarvi <b>dal vivo</b> il funzionamento del nostro portale "
    "e la rete dei 120 dealer olandesi;",
    nj,
))
elements.append(Paragraph(
    "&nbsp;&nbsp;•&nbsp; spiegarvi nel dettaglio come pubblicare il vostro stock — "
    "<b>è gratuito e richiede pochi minuti</b>;",
    nj,
))
elements.append(Paragraph(
    "&nbsp;&nbsp;•&nbsp; conoscerci di persona e gettare le basi per una "
    "collaborazione di lunga durata.",
    nj,
))
elements.append(Spacer(1, 3 * mm))
elements.append(Paragraph(
    "Siamo flessibili nelle date e disposti a viaggiare in Italia nelle prossime "
    "settimane. Vi preghiamo di indicarci una giornata e una sede a voi comode; "
    "saremo lieti di organizzare la visita di conseguenza.",
    nj,
))
elements.append(Spacer(1, 4 * mm))

elements.append(Paragraph(
    "Restiamo a disposizione per qualsiasi informazione preliminare e vi "
    "ringraziamo sin d'ora per l'attenzione.",
    nj,
))
elements.append(Spacer(1, 4 * mm))

elements.append(Paragraph("Cordiali saluti,", n))
elements.append(Spacer(1, 12 * mm))
elements.append(Paragraph("<b>Sandro Milone</b>", b))
elements.append(Paragraph("Direttore — Moto Import B.V.", small))
elements.append(Paragraph("motoimportbv@gmail.com &nbsp;•&nbsp; +31 6 24264861", small))

elements.append(Spacer(1, 8 * mm))
elements.append(Paragraph(
    "Allegati: presentazione aziendale, esempi di perizie BPM, condizioni commerciali "
    "indicative.", small,
))

# === Genereren ===
buf = io.BytesIO()
doc = SimpleDocTemplate(
    buf, pagesize=A4,
    leftMargin=22 * mm, rightMargin=22 * mm,
    topMargin=18 * mm, bottomMargin=18 * mm,
)
doc.build(elements)
OUT_PDF.write_bytes(buf.getvalue())
print(f"PDF gegenereerd: {OUT_PDF} ({OUT_PDF.stat().st_size:,} bytes)")
