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
- **BPM Vermindering**: Professioneel BPM taxatieprogramma met schade-checklist (exclusief motoimportbv@gmail.com)
- **Google Motoren**: SEO-geoptimaliseerde publieke motoren pagina's

## BPM Vermindering Tool (Actueel)
- **Bruto BPM**: Berekend op basis van netto catalogusprijs (9,6% t/m €2.133, daarboven 19,4% - €210)
- **3 afschrijvingsmethoden**: Forfaitaire tabel, Koerslijst, Taxatierapport (voordeligste automatisch gekozen)
- **Schade-checklist**: 26 motorfiets-specifieke onderdelen aanvinken met individuele herstelkosten
- **BPM-aftrek**: 31% van totale herstelkosten (Belastingdienst norm)
- **Geen kentekenveld**: Voertuigen hebben nog geen kenteken (moeten gekeurd worden)
- **Printbaar rapport**: PDF voor Belastingdienst met schade-tabel, BPM-vergelijking, handtekeningen
- **Live berekening**: Realtime updates bij invoer

## Architectuur
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI (Python)
- Database: MongoDB
- Betalingen: Stripe (emergentintegrations)
- Opslag: Emergent Object Storage
- AI: OpenAI GPT-4.1-mini, TTS, Sora 2

## Prioritized Backlog

### P0
- Backend Refactoring: server.py opsplitsen (9700+ regels)

### P1
- WhatsApp notificaties
- Franse promotievideo

### P2
- MoneyMonk API integratie
- Kosten bij voorstel opties
- Flyers Download pagina
- Email flyer bezorging productie

## Test Credentials
- Admin: motoimportbv@gmail.com / Admin2024!
- Dealer: zoektest@dealer.nl / Test2024!
