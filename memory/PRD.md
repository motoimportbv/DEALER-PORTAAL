# Moto Import Platform - PRD

## Oorspronkelijke Probleemstelling
Een uitgebreid platform voor het motorhandelnetwerk "Moto Import" met dealer management, bestellingen, voorstellen, en diverse integraties.

## Kernfuncties
- **BPM Vermindering Tool**: Volledige BPM taxatie met AutoTelex integratie, snel schadebedrag, slider, gewenste rest-BPM terugrekenen, PDF export conform Belastingdienst format
- **Dealer Platform**: Dashboard, bestellingen, voorstellen, motor verkoop, zoekertjes
- **Admin Platform**: Motorcycles beheer, orders, dealers, marketing, taxatie
- **Foreign Dealer**: Motoren aanmelden, CHF prijsaanpassing
- **Klant Deellinks**: Motoren delen zonder prijzen
- **Bestel namens Dealer**: Admin kan bestellen namens een dealer

## Architectuur
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI (Python) - Modulaire structuur (18 router bestanden)
- Database: MongoDB
- PDF: ReportLab (BPM Import Rapport generatie)

## BPM Berekening Formule (conform Belastingdienst)
1. Netto catalogusprijs → Bruto BPM: als ≤€2.133: ×9,6%, anders: ×19,4% - €210
2. Afschrijving: forfaitaire tabel / koerslijst / taxatierapport (voordeligste)
3. Optioneel: -31% van herstelkosten (schade-aftrek)
4. Te betalen BPM = BPM na afschrijving - schade-aftrek

## Prioritized Backlog

### P0 - Afgerond
- Backend Refactoring (9.875 → 170 regels)
- CHF Prijsaanpassing
- BPM Snel Aanpassen (slider, presets, terugrekenen)
- AutoTelex Gegevens Overnemen sectie
- BPM Import Rapport PDF Export

### P1
- AutoTelex API integratie (wacht op API-sleutel)
- WhatsApp notificaties
- Franse promotievideo

### P2
- MoneyMonk API integratie
- Kosten bij voorstel opties
- Flyers Download pagina voor dealers

## Test Credentials
- Admin: motoimportbv@gmail.com / Admin2024!
- Dealer: zoektest@dealer.nl / Test2024!
- AutoTelex PRO: motoimportbv@gmail.com / Motoimport2025!
