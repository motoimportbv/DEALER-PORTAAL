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
- **Bestel namens Dealer**: Admin kan bestellen namens een dealer
- **CHF Prijsaanpassing**: Admin kan leveranciersprijs in CHF aanpassen met automatische EUR herberekening

## Architectuur (NA REFACTORING - 12 april 2026)
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI (Python) - **Modulaire structuur**
- Database: MongoDB
- Betalingen: Stripe (emergentintegrations)
- Opslag: Emergent Object Storage
- AI: OpenAI GPT-4.1-mini, TTS, Sora 2

### Backend Structuur
```
/app/backend/
├── server.py              # Lean orchestrator (170 regels)
├── config.py              # Alle configuratie & constanten
├── database.py            # MongoDB connectie
├── models/
│   ├── schemas.py         # Alle Pydantic modellen
│   └── __init__.py        # Model exports
├── services/
│   ├── auth_service.py    # JWT, wachtwoord hashing, dependencies
│   ├── email_service.py   # Gmail SMTP
│   ├── sms_service.py     # Twilio SMS
│   ├── storage_service.py # Emergent Object Storage
│   ├── currency_service.py# Wisselkoersen CHF/EUR
│   └── __init__.py        # Service exports
└── routers/               # 18 modulaire router bestanden
    ├── auth.py            # Authenticatie
    ├── dealers.py         # Dealer beheer
    ├── motorcycles.py     # Motorfiets CRUD + CHF prijsaanpassing
    ├── orders.py          # Bestellingen
    ├── payments.py        # Stripe betalingen
    ├── uploads.py         # Afbeelding uploads
    ├── bids.py            # Bieden
    ├── wanted.py          # Zoekertjes
    ├── proposals.py       # Prijsvoorstellen
    ├── notifications.py   # Meldingen
    ├── admin.py           # Admin analytics/marketing/SMS
    ├── parts.py           # Onderdelen winkel
    ├── license_plates.py  # Kentekens
    ├── private_listings.py# Particuliere advertenties
    ├── reviews.py         # Beoordelingen
    ├── taxatie.py         # BPM & taxatie facturen
    ├── google_motors.py   # Google Motors & publieke SEO
    ├── exchange.py        # Wisselkoersen
    └── __init__.py        # Router registry
```

## Prioritized Backlog

### P0
- (DONE) Backend Refactoring: server.py opgesplitst van 9.875 naar 170 regels
- (DONE) CHF Prijsaanpassing: Admin kan CHF leveranciersprijs aanpassen met EUR herberekening

### P1
- WhatsApp notificaties
- Franse promotievideo
- Emergent LLM Key budget limiet herinnering

### P2
- MoneyMonk API integratie (vereist API key van gebruiker)
- Kosten bij voorstel opties
- Voorstelopties voorinvullen op basis van dealer verzoek
- Flyers Download pagina voor dealers

## Test Credentials
- Admin: motoimportbv@gmail.com / Admin2024!
- Dealer: zoektest@dealer.nl / Test2024!
