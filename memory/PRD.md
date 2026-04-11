# Moto Import Platform - PRD

## Oorspronkelijke Probleemstelling
Een uitgebreid platform voor het motorhandelnetwerk "Moto Import" met dealer management, bestellingen, voorstellen, en diverse integraties.

## Kernfuncties
- **Dealer Platform**: Dashboard, bestellingen, voorstellen, motor verkoop, zoekertjes
- **Admin Platform**: Motorcycles beheer, orders, dealers, marketing, taxatie
- **Foreign Dealer**: Motoren aanmelden, prijs beheer
- **Particulier Platform**: Private verkoop met Stripe abonnement
- **Pakbon Rol**: Beperkte rol voor pakbon beheer
- **BPM Vermindering**: BPM taxatieprogramma met schade-checklist (exclusief motoimportbv@gmail.com)
- **Google Motoren**: SEO-geoptimaliseerde publieke motoren pagina's
- **Deel met Klant**: Motoren delen zonder prijzen via WhatsApp/Email

## Deel met Klant Feature (Nieuw)
- **Backend**: `GET /api/motorcycles/{id}/customer-share` - publiek endpoint, verwijdert alle prijsvelden
- **Frontend**: `/klant/motor/{id}` - publieke pagina zonder prijzen, met foto galerij, specs, info banner
- **Dealer knoppen**: WhatsApp + Email deel-knoppen op motordetailpagina (zichtbaar voor dealers/admins)
- **Link format**: `https://www.motoimportbv.nl/klant/motor/{id}`

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

## Test Credentials
- Admin: motoimportbv@gmail.com / Admin2024!
