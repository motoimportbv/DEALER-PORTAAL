# Moto Import - Changelog

## Feb 2026 - MotoDirect besparings-visualisatie ✅
- **Vergelijkbare dealerprijs** (doorgestreept) + groene "BESPAAR €X" badge op elke motor card
- **Formule**: dealer_reference_price = ceil(moto-direct prijs × 1.20 / 100) × 100 (afgerond naar boven op €100)
- **Admin instelbaar**: dealer_multiplier via `/admin/motodirect` → Instellingen (bereik 1.0–3.0, default 1.20)
- Motor detail widget: groene "Jij bespaart €X" banner bovenaan
- Voorbeeld effect: Ducati Multistrada V4 bespaart €4.920, Yamaha Tracer 9 €2.300
- Testing: 53/53 backend pytest (12 nieuwe TestDealerMultiplierSavings) + volledige frontend flows ✅


## Feb 2026 - MotoDirect keuring & taxatie correctie ✅
- **RDW-keuring keuze** vernieuwd: "Moto-direct regelt (€125)" of "Ik keur zelf" (op eigen rekening). MotoImport is verwijderd uit de flow.
- **Taxatie voor BPM-vermindering** als optionele checkbox: +€160 add-on
- **APK wording** verwijderd — bestaat niet in NL motor-context
- **Live kostenoverzicht** op motor detail: Motor / RDW-keuring / Taxatie BPM / Totaal / Aanbetaling (35% + extras) / Restant
- **Backend**: MOTODIRECT_KEURING_FEE=125, MOTODIRECT_TAXATIE_FEE=160; checkout accepteert `keuring_choice` ('motodirect'/'self') + `include_taxatie` bool
- **Deposit formule**: 35% van motorprijs + volledige extras (customer betaalt extras direct)
- **Admin dashboard**: tabel toont Keuring keuze + Taxatie kolommen
- Testing: 41/41 backend pytest + volledige frontend flows ✅


## Feb 2026 - MotoDirect.nl uitbreidingen ✅
- **€500 marge** (admin-configureerbaar) automatisch bovenop dealerprijs; volledig verstopt in eindprijs
- **Keuring keuze** op motor-detail: MotoImport of Moto-direct (radio) opgeslagen bij order
- **Admin dashboard** `/admin/motodirect`: tabs Bestellingen / Klanten / Instellingen (marge live wijzigen)
- **Hostname routing**: bezoekers van `moto-direct.nl` zien alleen `/motodirect/*` routes; motoimport dealer platform blijft verborgen
- **Backend endpoints**: `GET/PUT /api/motodirect/admin/settings`, `_get_markup()`, `_apply_markup()`, `inspection_choice` in checkout
- Testing: 38/38 backend pytest + volledige frontend flows + regressie ✅


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
