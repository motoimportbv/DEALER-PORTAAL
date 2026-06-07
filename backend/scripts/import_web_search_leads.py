"""Bulk-insert leads gevonden via web search (Feb 2026 batch).

Run vanuit /app/backend:
    python -m scripts.import_web_search_leads

Idempotent: bestaande emails (case-insensitive) worden overgeslagen.
"""
import asyncio
import re
import sys
import uuid
from datetime import datetime, timezone

# zorg dat we modules uit /app/backend kunnen importeren
sys.path.insert(0, "/app/backend")

from database import db  # noqa: E402

EMAIL_RE = re.compile(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')


# Verzameld via parallelle Google-searches op Feb 2026.
# Bron-bevestigd via .fr/.be/.de/.it dealer pagina's en BMW/Honda/Yamaha locators.
WEB_SEARCH_LEADS = [
    # ===== FRANKRIJK =====
    {"name": "Paris Est Moto", "email": "contact@paris-est-moto.fr", "city": "Champigny-sur-Marne",
     "website": "https://www.paris-est-moto.fr", "country": "FR", "notes": "Paris Est — moto dealer"},
    {"name": "RB Scooters Bastille", "email": "contact@rb-scooters.com", "city": "Paris",
     "website": "https://www.rb-scooters.com", "country": "FR", "notes": "Paris 11e — Zontes/scooter dealer"},
    {"name": "MekaBike Lyon", "email": "contact@mekabike.fr", "city": "Lyon",
     "website": "https://www.mekabike.fr", "country": "FR", "notes": "Lyon 3e — moto dealer"},
    {"name": "Moto Moretti", "email": "contact@motomoretti.fr", "city": "Marseille",
     "website": "https://motomoretti.fr", "country": "FR", "notes": "Marseille 7e"},
    {"name": "Urban Moto", "email": "contact@urbanmoto.fr", "city": "Marseille",
     "website": "https://urbanmoto.fr", "country": "FR", "notes": "Marseille 10e"},
    {"name": "JM Motors Marseille (Azur Scoot)", "email": "azurscoot13@gmail.com", "city": "Marseille",
     "website": "https://jmmotors.fr", "country": "FR", "notes": "Marseille 6e"},
    {"name": "Californie Moto", "email": "califmoto06@gmail.com", "city": "Nice", "postcode": "06300",
     "website": "https://californie-moto.com", "country": "FR", "notes": "CFMOTO dealer Nice"},
    {"name": "Nissa Motor", "email": "nissamotor@yahoo.fr", "city": "Nice", "postcode": "06000",
     "website": "https://www.nissamotor.fr", "country": "FR", "notes": "36 rue Lamartine, Nice"},
    {"name": "Ducati Nantes (BPM Motorbike)", "email": "contact-bpmmotorbike-nantes@bpmgroup.fr",
     "city": "Orvault", "postcode": "44700", "website": "https://bpmmotorbike.fr",
     "country": "FR", "notes": "350 Route de Vannes, Orvault — Ducati"},
    {"name": "BS2 Moto", "email": "bs2moto@gmail.com", "city": "Saint-Étienne-de-Montluc",
     "website": "https://bs2moto.fr", "country": "FR", "notes": "Tussen Nantes en Saint-Nazaire"},
    {"name": "Delahaye Motors", "email": "info@delahayemotors.fr", "city": "Labège",
     "website": "https://delahayemotors.fr", "country": "FR", "notes": "Toulouse / Labège"},
    {"name": "MT Motos", "email": "thierry@mt-moto.fr", "city": "Lille", "postcode": "59000",
     "website": "https://www.mt-moto.fr", "country": "FR", "notes": "15 Rue Gustave Delory, Lille"},
    {"name": "Rennes Motos", "email": "rennesmotos@hotmail.com", "city": "Vezin-le-Coquet",
     "postcode": "35132", "website": "https://rennesmotos.com", "country": "FR",
     "notes": "9 Rue du Lieutenant Colonel Dubois, Rennes-regio"},
    {"name": "Moto Labo", "email": "info@motolabo.fr", "city": "Échirolles", "postcode": "38130",
     "website": "https://www.motolabo.fr", "country": "FR", "notes": "2 Rue de Bretagne, Grenoble-regio"},
    {"name": "Altitude Moto (Honda Grenoble)", "email": "contact@altitude-moto.com",
     "city": "Grenoble", "website": "", "country": "FR", "notes": "Pôle Moto 38 / Honda Grenoble"},
    {"name": "Cyclo Services", "email": "cyclo.services@wanadoo.fr", "city": "Montpellier",
     "website": "https://cycloservicesmontpellier.fr", "country": "FR",
     "notes": "Peugeot scooters/moto Montpellier"},
    {"name": "VSP Motos", "email": "contact@vspmotos.fr", "city": "Reims",
     "website": "https://www.vspmotos.fr", "country": "FR",
     "notes": "Kawasaki/Suzuki/Benelli/Orcal/FB Mondial dealer Reims"},
    {"name": "Power NG", "email": "contact@powerng.fr", "city": "Cannes",
     "website": "https://www.powerng.fr", "country": "FR", "notes": "CFMOTO Cannes"},
    {"name": "Power 06", "email": "contact@power06.fr", "city": "Cannes",
     "website": "https://www.power06.fr", "country": "FR", "notes": "BSA dealer Cannes"},
    {"name": "Avignon Motors Group", "email": "j.tatry@suttelgroup.com", "city": "Avignon",
     "website": "", "country": "FR", "notes": "CFMOTO/Zontes Avignon (Suttel Group)"},
    {"name": "Technic Moto Annecy", "email": "magasin@technic-moto.fr", "city": "Meythet",
     "website": "https://www.technic-moto.fr", "country": "FR", "notes": "Kawasaki Annecy"},
    {"name": "BMW Motorrad Car Avenue Metz", "email": "contactsmoto@caravenue.net.bmw.fr",
     "city": "Metz", "website": "", "country": "FR", "notes": "BMW Motorrad Car Avenue Metz"},
    {"name": "Motomob", "email": "motomob@wanadoo.fr", "city": "Essey-lès-Nancy",
     "website": "https://www.motomob.fr", "country": "FR", "notes": "Nancy-regio"},
    {"name": "Motocity Besançon", "email": "charles@motocity.fr", "city": "Besançon",
     "website": "https://piaggiogroup.motocity.fr", "country": "FR", "notes": "Piaggio Group Besançon"},

    # ===== BELGIË =====
    {"name": "Moto's Goossens", "email": "info@motosgoossens.be", "city": "Oelegem",
     "website": "https://motosgoossens.be", "country": "BE", "notes": "Regio Antwerpen"},
    {"name": "Motorshop Gent", "email": "motogent@proximus.be", "city": "Merelbeke",
     "website": "https://motorshop-gent.be", "country": "BE", "notes": "Gent-regio"},
    {"name": "R4 Moto's Gent", "email": "info@r4motos.be", "city": "Gent",
     "website": "https://r4motos-gent.be", "country": "BE", "notes": "Gent"},
    {"name": "Bariseau Mottrie Brugge (Sales)", "email": "sales.brugge@bariseaumottrie.be",
     "city": "Brugge", "website": "https://www.bariseaumottrie.be", "country": "BE",
     "notes": "Sales — Garage Deboo Brugge"},
    {"name": "Bariseau Mottrie Brugge (Aftersales)", "email": "aftersales.brugge@bariseaumottrie.be",
     "city": "Brugge", "website": "https://www.bariseaumottrie.be", "country": "BE",
     "notes": "Aftersales — Garage Deboo Brugge"},
    {"name": "BMW Louyet Namur", "email": "namur@louyet.be", "city": "Wierde",
     "website": "https://louyet.bmw.be/fr/namur", "country": "BE", "notes": "BMW Motorrad Namur"},
    {"name": "JDC Moto", "email": "info@jdcmoto.be", "city": "Namur",
     "website": "https://www.jdcmoto.be", "country": "BE", "notes": "Namur moto dealer"},
    {"name": "MV Agusta Liège", "email": "info@mvagustaliege.be", "city": "Liège",
     "website": "https://mvagustaliege.be", "country": "BE", "notes": "MV Agusta Liège"},
    {"name": "Husqvarna Liège", "email": "info@husqvarnaliege.be", "city": "Liège",
     "website": "https://husqvarnaliege.be", "country": "BE", "notes": "Husqvarna dealer Liège"},
    {"name": "Harley-Davidson Mons", "email": "enzo-import@skynet.be", "city": "Mons-Cuesmes",
     "website": "https://harley-davidson-mons.be", "country": "BE", "notes": "Harley Mons"},
    {"name": "Louyet Motor Namur", "email": "namur@louyetmotor.be", "city": "Cognelée",
     "website": "https://louyetmotor.be/fr/namur", "country": "BE", "notes": "BMW Motorrad Louyet Namur"},
    {"name": "Louyet Motor Marcinelle", "email": "marcinelle@louyetmotor.be", "city": "Marcinelle",
     "website": "https://louyetmotor.be/fr/marcinelle", "country": "BE",
     "notes": "Charleroi/Marcinelle — BMW Motorrad"},
    {"name": "Sprimont 2 Roues", "email": "info@sprimont2roues.be", "city": "Sprimont",
     "website": "https://www.sprimont2roues.be", "country": "BE", "notes": "Liège-regio"},
    {"name": "Moto Zenith", "email": "info@motozenith.be", "city": "Ben Ahin",
     "website": "https://www.motozenith.be", "country": "BE", "notes": "Bij Huy / Liège"},
    {"name": "Aankoopmotoren.be", "email": "info@aankoopmotoren.be", "city": "Kortrijk",
     "website": "https://www.aankoopmotoren.be", "country": "BE", "notes": "Kortrijk motor-aankoop"},
    {"name": "Action Sports Verviers", "email": "info@actionsports.be", "city": "Verviers",
     "website": "https://b2b.actionsports.be", "country": "BE", "notes": "Verviers"},
    {"name": "Triumph Moto Visé", "email": "info@moto-vise.be", "city": "Visé",
     "website": "https://www.triumph-moto-vise.be", "country": "BE", "notes": "Triumph dealer Liège-regio"},

    # ===== DUITSLAND =====
    {"name": "Motorrad Merkel", "email": "info@motorradmerkel.de", "city": "München",
     "website": "https://www.motorradmerkel.de", "country": "DE", "notes": "München moto dealer"},
    {"name": "Wimmer und Merkel", "email": "info@wum-muc.de", "city": "München",
     "website": "https://www.motorrad-wimmer-merkel.de", "country": "DE", "notes": "München"},
    {"name": "Fuhrmann Motor Berlin", "email": "info@fuhrmann-motor.de", "city": "Berlin",
     "website": "https://www.fuhrmann-motor.de", "country": "DE", "notes": "Berlin moto dealer"},
    {"name": "Ducati Berlin", "email": "kontakt@ducati-berlin.de", "city": "Berlin",
     "website": "https://ducati-berlin.de", "country": "DE", "notes": "Ducati dealer Berlin"},
    {"name": "Yamaha Zentrum Berlin", "email": "kontakt@yamaha-zentrum.berlin", "city": "Berlin",
     "website": "", "country": "DE", "notes": "Yamaha Berlin"},
    {"name": "Heuser Motorräder", "email": "mail@heuser-motorraeder.de", "city": "Hamburg",
     "website": "https://heuser-motorraeder.de", "country": "DE", "notes": "Hamburg moto dealer"},
    {"name": "Triumph Hamburg", "email": "janine@triumph-hamburg.de", "city": "Hamburg",
     "website": "https://triumph-hamburg.de", "country": "DE", "notes": "Triumph Hamburg"},
    {"name": "MCA Frankfurt", "email": "info@mca-frankfurt.de", "city": "Frankfurt",
     "website": "https://www.mca-motorrad.de", "country": "DE", "notes": "Frankfurt moto dealer"},
    {"name": "H.M. Motorradhaus Frankfurt", "email": "info@hm-motorradhaus.de", "city": "Frankfurt",
     "website": "https://husqvarna-frankfurt.de", "country": "DE",
     "notes": "Husqvarna Frankfurt / Allround vermietung"},
    {"name": "StuteHengst Köln", "email": "info@stutehengst.de", "city": "Köln", "postcode": "51103",
     "website": "https://stutehengst.de", "country": "DE", "notes": "BMW Motorrad Köln"},
    {"name": "BMW Motorrad Stuttgart", "email": "motorrad-stuttgart@bmw.de", "city": "Stuttgart",
     "postcode": "70569", "website": "https://www.bmw-stuttgart.de", "country": "DE",
     "notes": "BMW Motorrad Zentrum Stuttgart"},
    {"name": "BMW Niederlassung Hannover", "email": "nl-hannover@bmw.de", "city": "Hannover",
     "postcode": "30539", "website": "https://www.bmw-hannover.de", "country": "DE",
     "notes": "BMW Motorrad Hannover"},
    {"name": "BMW Motorrad Hannover Service", "email": "motorradservice.hannover@bmw.de",
     "city": "Hannover", "postcode": "30539", "website": "https://www.bmw-hannover.de",
     "country": "DE", "notes": "Service-afdeling"},
    {"name": "Motorrad Huchting", "email": "info@motorrad-huchting.de", "city": "Bremen",
     "postcode": "28259", "website": "https://www.motorrad-huchting.de", "country": "DE",
     "notes": "Bremen moto dealer"},

    # ===== ITALIË (extra naast bestaande seed) =====
    {"name": "DG Moto", "email": "dgmotosrl@gmail.com", "city": "Roma", "postcode": "00152",
     "website": "https://www.dgmoto.it", "country": "IT",
     "notes": "Circonvallazione Gianicolense 204A, Roma"},
    {"name": "DVMoto Roma", "email": "info@dvmoto.it", "city": "Roma", "postcode": "00154",
     "website": "https://dvmoto.it", "country": "IT", "notes": "Via del Porto Fluviale 13-19, Roma"},
    {"name": "Giovanelli Moto Milano", "email": "info@giovanellimoto.it", "city": "Milano",
     "website": "https://www.giovanellimoto.it", "country": "IT", "notes": "Milano moto dealer"},
    {"name": "Tamburrino Moto", "email": "info@tamburrinomoto.it", "city": "Napoli", "postcode": "80143",
     "website": "https://tamburrinomoto.ligier.it", "country": "IT",
     "notes": "Via Nuova Poggioreale 159, Napoli"},
    {"name": "Moto Megaride", "email": "motomegaride@gmail.com", "city": "Napoli", "postcode": "80122",
     "website": "https://www.motomegaride.it", "country": "IT", "notes": "Via Francesco Giordani, Napoli"},
    {"name": "Lamberti Moto Napoli", "email": "info@lambertimoto.it", "city": "Napoli",
     "website": "https://lambertimoto.it", "country": "IT", "notes": "Via Nuova Del Campo 25/C"},
    {"name": "Quattrocchi Moto", "email": "info@quattrocchimoto.it", "city": "Torino",
     "website": "https://www.quattrocchimoto.it", "country": "IT", "notes": "Via Capelli 100, Torino"},
    {"name": "Harley-Davidson Torino", "email": "info@harley-davidson-torino.it", "city": "Torino",
     "website": "https://harley-davidson-torino.it", "country": "IT", "notes": "Harley Torino"},
    {"name": "Nova Moto Firenze", "email": "info@novamoto.it", "city": "Firenze",
     "website": "https://www.bmw-motorrad.it/novamoto-firenze", "country": "IT",
     "notes": "BMW Motorrad Firenze - Via Pratese 169"},
    {"name": "Motolandia Verona", "email": "info@motolandiasrl.com", "city": "Verona",
     "website": "https://www.motolandiasrl.com", "country": "IT", "notes": "Via Roveggia 79/B, Verona"},
    {"name": "CMTmotor Genova", "email": "genova.orsini@cmtmotor.com", "city": "Genova",
     "website": "https://www.cmtmotor.com", "country": "IT", "notes": "Via Orsini 58R, Genova"},
    {"name": "Ponente Moto", "email": "erika@ponentemoto.com", "city": "Genova",
     "website": "https://ponentemoto.it", "country": "IT", "notes": "Via Giacomo Puccini, Genova"},
    {"name": "Moto Service Bari", "email": "info@motoservice-bari.it", "city": "Bari",
     "website": "https://motoservice-foggia.it/sede-bari", "country": "IT", "notes": "Bari dealer"},
    {"name": "Gambino Moto Academy", "email": "yamaha.info@gambinomoto.it", "city": "Palermo",
     "website": "https://www.gambinomoto.it", "country": "IT", "notes": "Yamaha Palermo"},
    {"name": "Hobby Moto Catania", "email": "info@hobby-moto.it", "city": "Catania",
     "website": "http://www.hobbymoto.it", "country": "IT", "notes": "Catania moto dealer"},
    {"name": "Valeriano Moto Catania", "email": "valeriano1983@live.it", "city": "Catania",
     "website": "https://www.valerianomoto.it", "country": "IT", "notes": "Catania"},
    {"name": "Almia Motors Cagliari", "email": "info@almiamotors.it", "city": "Cagliari",
     "website": "https://www.almiamotors.it", "country": "IT", "notes": "Cagliari moto dealer"},

    # ===== Batch 2 (Feb 2026 — extra Google searches) =====
    # FR — extra steden
    {"name": "Motoman Quimper", "email": "compta@motoman-shop.fr", "city": "Quimper",
     "website": "https://www.motoman-shop.fr", "country": "FR", "notes": "Bretagne / Yamaha"},
    {"name": "Docteur Scooter", "email": "docteur-scooter@orange.fr", "city": "Perpignan",
     "website": "", "country": "FR", "notes": "Scooter/moto Perpignan"},
    {"name": "Le Garage Béziers (Zontes)", "email": "legarage2@bbox.fr", "city": "Béziers",
     "website": "", "country": "FR", "notes": "Zontes dealer Béziers"},
    {"name": "Motoland Amiens (Honda)", "email": "julien.r@motoland.eu", "city": "Rivery",
     "website": "https://amiens.honda-motos.com", "country": "FR", "notes": "Honda Amiens-regio"},
    {"name": "Moto & Co Beauvais", "email": "sebastien@motoandco.fr", "city": "Beauvais",
     "website": "https://piaggio-beauvais.com", "country": "FR", "notes": "Piaggio Beauvais"},
    {"name": "Eden Motors", "email": "contact@eden-motors.fr", "city": "Compiègne",
     "website": "https://www.eden-motors.fr", "country": "FR", "notes": "Compiègne moto dealer"},
    # BE — extra
    {"name": "LM Motors", "email": "info@lmmotors.be", "city": "Vlamertinge",
     "website": "https://www.lmmotors.be", "country": "BE", "notes": "West-Vlaanderen (bij Ieper)"},
    # IT — extra
    {"name": "Indian Moto Padova", "email": "info@indianmoto-padova.it", "city": "Padova",
     "website": "https://indianmoto-padova.it", "country": "IT", "notes": "Indian Motorcycle Padova"},
    {"name": "Ferali Moto", "email": "info@feralimoto.it", "city": "Padova",
     "website": "https://feralimoto.it", "country": "IT", "notes": "Padova moto"},
    {"name": "Top Motor Modena", "email": "info@topmotor.it", "city": "Modena",
     "website": "https://www.topmotor.it", "country": "IT", "notes": "Modena dealer"},
    {"name": "Franchini e Alpinoli Honda Modena", "email": "franchiniealpinoli@hondaitalia.com",
     "city": "Modena", "website": "https://www.franchiniealpinoli.it", "country": "IT",
     "notes": "Honda dealer Modena"},
    {"name": "Triumph Bologna", "email": "service@triumphbologna.it", "city": "Bologna",
     "website": "https://www.triumphbologna.it", "country": "IT", "notes": "Triumph Bologna"},

    # ===== Batch 3 (Feb 2026 — derde scrape ronde) =====
    # FR Le Havre — Pôle de la Moto cluster (1 dealergroep, 6 emails per merk)
    {"name": "Pôle de la Moto Le Havre", "email": "contact@poledelamoto.fr",
     "city": "Gonfreville-l'Orcher", "website": "https://poledelamoto.fr",
     "country": "FR", "notes": "Multi-merk dealer Le Havre"},
    {"name": "Yamaha Le Havre (M2)", "email": "contact@m2-lehavre.fr",
     "city": "Gonfreville-l'Orcher", "website": "https://poledelamoto.fr",
     "country": "FR", "notes": "Yamaha Le Havre"},
    {"name": "Suzuki Le Havre (Bazar de la Bécane)", "email": "bazardelabecane@poledelamoto.fr",
     "city": "Gonfreville-l'Orcher", "website": "https://poledelamoto.fr",
     "country": "FR", "notes": "Suzuki Le Havre"},
    {"name": "Kawasaki Le Havre (K-Bike)", "email": "contact-kbike@gmail.com",
     "city": "Gonfreville-l'Orcher", "website": "", "country": "FR", "notes": "Kawasaki Le Havre"},
    {"name": "Polaris Le Havre", "email": "remy.hauters@poledelamoto.fr",
     "city": "Gonfreville-l'Orcher", "website": "https://poledelamoto.fr",
     "country": "FR", "notes": "Polaris Le Havre"},
    {"name": "Maxxess Le Havre", "email": "maxxesslh@gmail.com",
     "city": "Gonfreville-l'Orcher", "website": "", "country": "FR", "notes": "Maxxess Le Havre"},
    {"name": "Moto Transfert Aix", "email": "contact@mototransfert.fr", "city": "Aix-en-Provence",
     "website": "https://www.mototransfert.fr", "country": "FR", "notes": "Aix-en-Provence"},
    {"name": "Speedway Toulon La Garde", "email": "garde@speedway.fr", "city": "La Garde",
     "website": "https://www.speedway.fr", "country": "FR", "notes": "Toulon-regio Speedway"},
    # IT extra
    {"name": "Vicenza Moto", "email": "info@vicenzamoto.com", "city": "Vicenza",
     "website": "https://www.vicenzamoto.com", "country": "IT", "notes": "Vicenza moto dealer"},
    {"name": "Biemme Moto Trento", "email": "info@biemmemoto.net", "city": "Trento",
     "website": "https://www.biemmemoto.net", "country": "IT", "notes": "Trento moto dealer"},
    {"name": "Centro Auto Trieste", "email": "info@centroautotrieste.it", "city": "Trieste",
     "website": "https://www.centroautotrieste.it", "country": "IT", "notes": "Trieste"},
    {"name": "Delta Motors Ancona", "email": "info@delta-motors.it", "city": "Ancona",
     "postcode": "60131", "website": "https://www.delta-motors.it", "country": "IT",
     "notes": "Via Luigi Albertini 26, Ancona"},
    {"name": "Tortora Moto Salerno", "email": "info@tortoramoto.it", "city": "Salerno",
     "postcode": "84131", "website": "", "country": "IT",
     "notes": "Via Roberto Wenner 31/33, Salerno"},
    {"name": "Rosciano Moto Salerno", "email": "info@roscianomoto.it", "city": "Salerno",
     "website": "http://roscianomoto.it", "country": "IT", "notes": "Via Cappello Vecchio 17, Salerno"},
    {"name": "Dea Moto Cremona", "email": "info@deamotocremona.it", "city": "Cremona",
     "website": "", "country": "IT", "notes": "Cremona moto dealer"},
    {"name": "Officina FG Moto Ravenna", "email": "info@fgmoto.it", "city": "Ravenna",
     "website": "", "country": "IT", "notes": "Ravenna moto-officina"},
    # BE extra
    {"name": "Moto6", "email": "info@motosix.be", "city": "België",
     "website": "https://motosix.be", "country": "BE", "notes": "Yamaha specialist"},
    {"name": "BMW Pautric Woluwe", "email": "info.woluwe@pautric.be", "city": "Woluwe",
     "website": "https://www.pautric.bmw.be", "country": "BE", "notes": "BMW Motorrad Brussel"},
    {"name": "BMW Pautric Drogenbos", "email": "info.drogenbos@pautric.be", "city": "Drogenbos",
     "website": "https://www.pautric.bmw.be", "country": "BE", "notes": "BMW Motorrad Drogenbos"},
]


async def main():
    inserted = 0
    duplicates = 0
    skipped = 0
    now = datetime.now(timezone.utc).isoformat()

    for lead in WEB_SEARCH_LEADS:
        email = (lead.get("email") or "").strip().lower()
        if not email or not EMAIL_RE.match(email):
            skipped += 1
            print(f"  SKIP invalid email: {lead.get('name')} / {email}")
            continue
        existing = await db.taxatie_leads.find_one({"email_lower": email}, {"_id": 0, "id": 1})
        if existing:
            duplicates += 1
            print(f"  DUP {email}")
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "name": lead.get("name") or "",
            "email": email,
            "email_lower": email,
            "address": lead.get("address") or "",
            "postcode": lead.get("postcode") or "",
            "city": lead.get("city") or "",
            "website": lead.get("website") or "",
            "country": lead.get("country") or "",
            "source_site": "web-search-feb2026",
            "source_url": "",
            "dealer_id": "",
            "status": "new",
            "notes": lead.get("notes") or "Gevonden via Google search (Feb 2026)",
            "sent_at": None,
            "batch_id": None,
            "created_at": now,
            "updated_at": now,
            "created_by": None,
        }
        await db.taxatie_leads.insert_one(doc)
        inserted += 1
        print(f"  ✅ {email} → {lead.get('name')}")

    print(f"\n=== TOTAAL: {inserted} nieuw · {duplicates} duplicaten · {skipped} skipped ===")
    by_country = {}
    for lead in WEB_SEARCH_LEADS:
        c = lead.get("country") or "?"
        by_country[c] = by_country.get(c, 0) + 1
    for c, n in sorted(by_country.items()):
        print(f"  {c}: {n}")


if __name__ == "__main__":
    asyncio.run(main())
