# Moto Import - Changelog

## Feb 2026 - MotoDirect.nl B2C Platform Launch ✅
- Nieuw B2C platform voor particulieren gebouwd onder route `/motodirect`
- Backend router `/api/motodirect/*`: register (NAW+BSN), login, catalog (public), motor detail, Stripe checkout (35% deposit), order status polling, my orders, admin views
- Frontend pagina's: Landing (hero+value props+how-it-works), Catalog (filters), MotorDetail (gallery+reserve widget), Register, Login, Account, CheckoutSuccess
- Design: Dark theme (obsidian #050505 + cobalt blue #0047FF) - IBM Plex Sans + Space Grotesk
- User rol: `motodirect_buyer` (auto-approved)
- Stripe: `emergentintegrations` StripeCheckout - 35% deposit calculated from motor price
- Testing: 24/24 backend pytest ✅ + volledige frontend flows ✅ + regressie dealer/admin ✅
- Fix na testing: async admin notification (registratie van 15s → 0.5s) + sanitized error messages



## Feb 2026 - Benelli TRK 902 modellen toegevoegd
- `motorcycleDatabase.js`: 'TRK 902 Stradale' en 'TRK 902 Explorer' toegevoegd aan Benelli array

## 12 april 2026 - Backend Refactoring (P0)
- **server.py** van 9.875 regels opgesplitst naar 170 regels (lean orchestrator)
- 18 modulaire router bestanden aangemaakt in `/app/backend/routers/`
- Gedeelde modules bijgewerkt: `config.py`, `services/`, `models/`
- Alle Pydantic modellen geconsolideerd in `models/schemas.py`
- 100% test slagingspercentage: 31 backend tests + frontend tests geslaagd
- Geen functionaliteit gewijzigd, alleen code organisatie

## Eerdere sessies
- BPM Vermindering Tool met 26-punts schadechecklist (DONE)
- Klant-deellinks zonder prijzen voor beschikbare en verkochte motoren (DONE)
- Admin "Bestel namens dealer" functie (DONE)
- Bouwjaar, Chassisnummer en kW weergave bijgewerkt (DONE)
- Email flyer op productie (VERIFIED werkend)
