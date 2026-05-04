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

elements.append(Paragraph("<b>Oggetto:</b> Richiesta di incontro — Moto Import B.V. cerca fornitori italiani per il mercato olandese", b))
elements.append(Spacer(1, 6 * mm))

# ==== Aanhef ====
elements.append(Paragraph("Gentili Signori,", n))
elements.append(Spacer(1, 3 * mm))

# ==== Wie we zijn ====
elements.append(Paragraph(
    "con la presente desideriamo presentarci. <b>Moto Import B.V.</b> è una società "
    "olandese specializzata nell'<b>importazione di motociclette usate</b> dal "
    "resto d'Europa verso i Paesi Bassi. Acquistiamo motociclette presso fornitori "
    "selezionati, ci occupiamo dell'intero processo di importazione, valutazione "
    "fiscale (BPM), registrazione RDW e rivendita sul mercato olandese.",
    nj,
))
elements.append(Spacer(1, 3 * mm))

elements.append(Paragraph(
    "Disponiamo di una <b>piattaforma digitale propria</b> sulla quale i nostri "
    "numerosi rivenditori, concessionari e clienti privati olandesi consultano "
    "quotidianamente lo stock disponibile. Questa rete consolidata ci permette di "
    "rivendere i veicoli importati in tempi brevi, garantendo ai nostri fornitori "
    "europei <b>volumi costanti</b> e <b>pagamenti rapidi</b>.",
    nj,
))

elements.append(Spacer(1, 4 * mm))

# ==== Wat we doen — als koper ====
elements.append(Paragraph("Perché collaborare con Moto Import B.V.", h2))
elements.append(Paragraph(
    "<b>1. Acquirenti seri e ricorrenti.</b> Acquistiamo regolarmente in lotti "
    "(mensili o trimestrali) motociclette di marche europee, giapponesi e "
    "americane. Cerchiamo continuità, non operazioni singole.",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "<b>2. Pagamento immediato al ritiro.</b> Al momento del prelievo presso il "
    "vostro deposito eseguiamo bonifico SEPA in EUR. Fatturazione "
    "intracomunitaria (P.IVA NL867456982B01).",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "<b>3. Logistica a nostro carico.</b> Ci occupiamo del trasporto, "
    "della documentazione doganale e dell'esportazione con targhe transit europee. "
    "Voi consegnate semplicemente i veicoli; il resto lo facciamo noi.",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "<b>4. Ampia rete di rivendita olandese.</b> Le motociclette acquistate vengono "
    "presentate sulla nostra piattaforma digitale, dove un'ampia base di rivenditori "
    "e clienti olandesi consulta lo stock. Questo riduce i nostri tempi di rotazione "
    "e si traduce in maggiore frequenza e volume di acquisto da parte nostra.",
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
    "&nbsp;&nbsp;•&nbsp; presentarci in modo approfondito e mostrarvi la nostra "
    "piattaforma e i volumi che gestiamo;",
    nj,
))
elements.append(Paragraph(
    "&nbsp;&nbsp;•&nbsp; visionare il vostro stock e selezionare un primo lotto di prova;",
    nj,
))
elements.append(Paragraph(
    "&nbsp;&nbsp;•&nbsp; definire condizioni commerciali stabili (prezzi netti, "
    "frequenza, modalità di pagamento) per una collaborazione duratura.",
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
