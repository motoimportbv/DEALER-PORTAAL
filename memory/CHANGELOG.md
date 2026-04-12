# Moto Import - Changelog

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
