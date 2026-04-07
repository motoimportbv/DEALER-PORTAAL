# Moto Import Platform - PRD

## Oorspronkelijke Probleemstelling
Een uitgebreid platform voor het motorhandelnetwerk "Moto Import" met dealer management, bestellingen, voorstellen, en diverse integraties.

## Kernfuncties
- **Dealer Platform**: Dashboard, bestellingen, voorstellen, motor verkoop, zoekertjes
- **Admin Platform**: Motorcycles beheer, orders, dealers, marketing, taxatie
- **Foreign Dealer**: Motoren aanmelden, prijs beheer
- **Particulier Platform**: Private verkoop met Stripe abonnement
- **Pakbon Rol**: Beperkte rol voor pakbon beheer
- **Taxatie Facturen**: Exclusief voor motoimportbv@gmail.com
- **BPM Vermindering**: Professioneel BPM taxatieprogramma voor motorfietsen (exclusief motoimportbv@gmail.com)
- **Google Motoren**: SEO-geoptimaliseerde publieke motoren pagina's met social media generatie

## Gebruikersrollen
- **Admin** (motoimportbv@gmail.com, Daniel2002jay@hotmail.com, Motomaniabv@gmail.com)
- **Dealer** (goedgekeurde dealers)
- **Foreign Dealer** (buitenlandse leveranciers)
- **Particulier** (private verkopers)
- **Pakbon** (alleen pakbon toegang)

## Architectuur
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Betalingen**: Stripe (emergentintegrations)
- **Opslag**: Emergent Object Storage
- **AI**: OpenAI GPT-4.1-mini, OpenAI TTS, Sora 2 (via Emergent LLM Key)
- **Image Processing**: Pillow

## Wat is gebouwd

### Sessie 7 april 2026
- **BPM Vermindering Taxatie**: Volledig BPM-taxatieprogramma voor motorfietsen:
  - Bruto BPM berekening op basis van netto catalogusprijs (9,6% <=€2133, 19,4%-€210 >€2133)
  - Forfaitaire afschrijvingstabel (officieel Belastingdienst, 14 perioden)
  - Koerslijst methode (afschrijving op basis van consumentenprijs vs koerslijstwaarde)
  - Taxatierapport methode (afschrijving op basis van getaxeerde inruilwaarde)
  - Schade-aftrek (31% van herstelkosten, Belastingdienst norm)
  - Automatische selectie voordeligste methode
  - Live BPM-berekening in formulier (realtime updates bij invoer)
  - Printbaar PDF-rapport voor Belastingdienst met handtekeningen
  - Technische inspectie (10 categorien, score 1-5)
  - Links naar AutoTelex.nl en RDW
  - 100% getest (backend + frontend) via testing agent

### Eerdere sessies
- Google Motoren (SEO, Stripe iDEAL, AI social media)
- Dealer promo popup, wervingsflyers
- Pakbon updates (leverancier telefoon/adres)
- Admin wachtwoord reset, WhatsApp URL fix
- Particulier platform, dealer prive listings
- Taxatie factuur module
- Foreign dealer prijs management
- Voucher systeem, GitHub security fix

## Prioritized Backlog

### P0 - Kritisch
- Backend Refactoring: server.py opsplitsen (9600+ regels)

### P1 - Aankomend
- WhatsApp notificaties implementeren
- Franse promotievideo genereren
- Emergent LLM Key budget monitoren

### P2 - Toekomstig
- MoneyMonk API integratie (wacht op API key)
- Kosten toevoegen aan voorstel opties
- Bevestigingsdialoog voor opnieuw aanbieden verkochte motor
- "Flyers Download" pagina voor dealers
- Email flyer bezorging op productie (verificatie nodig)

## BPM Vermindering API Endpoints
- `POST /api/taxatie-programma` - BPM taxatie aanmaken
- `GET /api/taxatie-programma` - Alle taxaties ophalen
- `GET /api/taxatie-programma/{id}` - Detail
- `PUT /api/taxatie-programma/{id}` - Bijwerken (herberekent BPM)
- `POST /api/taxatie-programma/{id}/finalize` - Definitief maken
- `DELETE /api/taxatie-programma/{id}` - Verwijderen

## BPM Database Schema
- `taxatie_programma`: `{ id, taxatie_nummer, brand, model, year, mileage, kenteken, netto_catalogusprijs, consumentenprijs, koerslijst_waarde, taxatie_inruil_waarde, first_registration_date, has_damage, herstelkosten, bruto_bpm, forfaitair_percentage, forfaitair_bpm, koerslijst_percentage, koerslijst_bpm, taxatie_percentage, taxatie_bpm, schade_aftrek, beste_methode, netto_bpm, bpm_vermindering, scores (10x), status, photos }`

## Test Credentials (Preview)
- Admin: motoimportbv@gmail.com / Admin2024!
- Dealer: zoektest@dealer.nl / Test2024!
