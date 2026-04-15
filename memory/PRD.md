# Moto Import Platform - PRD

## Oorspronkelijke Probleemstelling
Een uitgebreid platform voor het motorhandelnetwerk "Moto Import" met dealer management, bestellingen, voorstellen, en diverse integraties.

## Kernfuncties
- **Dealer Platform**: Dashboard, bestellingen, voorstellen, motor verkoop, zoekertjes
- **Admin Platform**: Motorcycles beheer, orders, dealers, marketing, taxatie
- **Foreign Dealer**: Motoren aanmelden, prijs beheer
- **Particulier Platform**: Private verkoop met Stripe abonnement
- **Pakbon Rol**: Beperkte rol voor pakbon beheer
- **BPM Vermindering**: BPM taxatieprogramma met schade-checklist, snel aanpassen tools, en AutoTelex integratie
- **Google Motoren**: SEO-geoptimaliseerde publieke motoren pagina's
- **Deel met Klant**: Motoren delen zonder prijzen via WhatsApp/Email
- **Bestel namens Dealer**: Admin kan bestellen namens een dealer
- **CHF Prijsaanpassing**: Admin kan leveranciersprijs in CHF aanpassen

## Architectuur
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI (Python) - Modulaire structuur (18 router bestanden)
- Database: MongoDB
- Betalingen: Stripe (emergentintegrations)
- Opslag: Emergent Object Storage
- AI: OpenAI GPT-4.1-mini, TTS, Sora 2
- AutoTelex PRO: Credentials opgeslagen (API-sleutel nog nodig voor automatische integratie)

## Prioritized Backlog

### P0 - Afgerond
- Backend Refactoring: server.py opgesplitst (9.875 → 170 regels)
- CHF Prijsaanpassing: Admin kan CHF leveranciersprijs aanpassen
- BPM Berekening Vereenvoudigd: Snel schadebedrag, slider, gewenste rest-BPM
- AutoTelex Gegevens Overnemen: Snelle invoersectie + "Open AutoTelex PRO" knop

### P1
- AutoTelex API integratie (wacht op API-sleutel van AutoTelex helpdesk)
- WhatsApp notificaties
- Franse promotievideo
- Emergent LLM Key budget limiet herinnering

### P2
- MoneyMonk API integratie (vereist API key van gebruiker)
- Kosten bij voorstel opties
- Voorstelopties voorinvullen
- Flyers Download pagina voor dealers

## Test Credentials
- Admin: motoimportbv@gmail.com / Admin2024!
- Dealer: zoektest@dealer.nl / Test2024!
- AutoTelex PRO: motoimportbv@gmail.com / Motoimport2025! (portal login, API-sleutel nog niet beschikbaar)
