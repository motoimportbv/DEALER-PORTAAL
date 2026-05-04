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

elements.append(Paragraph("<b>Oggetto:</b> Proposta di collaborazione — importazione e taxazione motociclette nei Paesi Bassi", b))
elements.append(Spacer(1, 6 * mm))

# ==== Aanhef ====
elements.append(Paragraph("Gentili Signori,", n))
elements.append(Spacer(1, 3 * mm))

# ==== Wie we zijn ====
elements.append(Paragraph(
    "con la presente desideriamo presentarci e proporre una collaborazione duratura "
    "tra Mundimoto e <b>Moto Import B.V.</b>, società olandese specializzata "
    "nell'<b>importazione, valutazione e regolarizzazione fiscale (BPM)</b> di motociclette "
    "destinate al mercato dei Paesi Bassi.",
    nj,
))
elements.append(Spacer(1, 3 * mm))

elements.append(Paragraph(
    "Operiamo da anni nel settore con un approccio rigoroso e trasparente. "
    "Il nostro team segue ogni motocicletta dall'acquisto in Europa fino alla "
    "consegna al cliente finale olandese, garantendo conformità normativa e "
    "tempi rapidi. Ci avvaliamo di una piattaforma digitale proprietaria che "
    "automatizza i calcoli BPM, genera la documentazione ufficiale per la "
    "Belastingdienst (Agenzia delle Entrate olandese) e produce perizie tecniche "
    "complete con fotografie, schede tecniche e giustificazioni economiche.",
    nj,
))

elements.append(Spacer(1, 4 * mm))

# ==== Wat we doen ====
elements.append(Paragraph("I nostri servizi", h2))
elements.append(Paragraph(
    "<b>1. Acquisto e logistica internazionale.</b> Ritiriamo motociclette presso "
    "il vostro deposito o presso terzi in tutta Europa. Gestiamo il trasporto, "
    "la documentazione doganale e l'esportazione con targhe transit europee.",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "<b>2. Perizia BPM e riduzione fiscale.</b> Ogni motocicletta viene ispezionata "
    "fisicamente e valutata da un perito ufficiale. Redigiamo il rapporto di perizia "
    "(Taxatieverslag) conforme all'articolo 10, comma 7 della legge BPM, riducendo "
    "in modo legittimo l'imposta dovuta sulla base dello stato reale del veicolo.",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "<b>3. Registrazione RDW e immatricolazione olandese.</b> Curiamo la pratica "
    "di omologazione, l'ispezione tecnica RDW e la consegna del documento di "
    "immatricolazione olandese al cliente finale, completa di garanzia di "
    "tracciabilità.",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "<b>4. Pagamento sicuro e veloce.</b> Operiamo con bonifici SEPA in EUR, "
    "fatturazione in regime intracomunitario (P.IVA NL867456982B01) e tempi di "
    "saldo garantiti entro pochi giorni dalla consegna documentale.",
    nj,
))

elements.append(Spacer(1, 4 * mm))

# ==== Voorstel ====
elements.append(Paragraph("La nostra proposta a Mundimoto", h2))
elements.append(Paragraph(
    "Riteniamo che la combinazione tra il vostro inventario di motociclette "
    "selezionate e la nostra esperienza nell'importazione olandese possa generare "
    "un canale di vendita aggiuntivo, stabile e a basso rischio. Concretamente "
    "proponiamo:",
    nj,
))
elements.append(Spacer(1, 2 * mm))
elements.append(Paragraph(
    "&nbsp;&nbsp;•&nbsp; <b>Acquisti regolari</b> (mensili o trimestrali) di motociclette "
    "selezionate dal vostro stock, in lotti concordati;",
    nj,
))
elements.append(Paragraph(
    "&nbsp;&nbsp;•&nbsp; <b>Prezzi netti franco vostro deposito</b>, con calcolo BPM e "
    "logistica a nostro carico;",
    nj,
))
elements.append(Paragraph(
    "&nbsp;&nbsp;•&nbsp; <b>Visite periodiche</b> presso le vostre sedi italiane per "
    "selezionare i veicoli, accompagnate da pagamento immediato al ritiro;",
    nj,
))
elements.append(Paragraph(
    "&nbsp;&nbsp;•&nbsp; <b>Trasparenza totale</b> sulla destinazione finale dei veicoli "
    "e sui prezzi di rivendita, ove di vostro interesse statistico.",
    nj,
))

elements.append(Spacer(1, 4 * mm))

# ==== Afsluiting ====
elements.append(Paragraph(
    "Saremmo lieti di organizzare un primo incontro — di persona presso le vostre "
    "sedi o in videoconferenza — per illustrare nel dettaglio il nostro processo, "
    "presentare casi concreti e definire insieme un eventuale primo lotto di prova. "
    "Restiamo a disposizione per qualsiasi chiarimento e vi ringraziamo per "
    "l'attenzione che vorrete dedicare a questa proposta.",
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
