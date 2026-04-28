# Moto Import Platform - PRD

## Oorspronkelijke Probleemstelling
Platform voor motorhandelnetwerk "Moto Import" met dealer management, bestellingen, en BPM tools.

## Kernfuncties
- **BPM Vermindering Tool**: Volledige BPM taxatie met:
  - AutoTelex gegevens overnemen
  - Snel schadebedrag (slider, presets, terugrekenen)
  - 26-punts schadechecklist met uren + materiaalkosten (€65/uur excl. BTW)
  - **3 PDF exports**: Belastingdienst formulier (auto-fill), Taxatieverslag (schade+uren onderbouwing), Rapport PDF
- **Dealer Platform**: Dashboard, bestellingen, voorstellen, motor verkoop
- **Admin Platform**: Motorcycles beheer, orders, dealers, marketing
- **Foreign Dealer**: CHF prijsaanpassing met wisselkoers conversie

## Backend Structuur (18 modulaire routers)
server.py: 170 regels (orchestrator) + routers/, models/, services/, config.py

## Prioritized Backlog

### P0 - Afgerond
- **Auto-vink schadepunten gerandomiseerd** (Feb 2026): Item-selectie nu via 4-laags probability tier systeem (90%/60%/35%/15% kans per categorie). Items worden binnen elke tier geshuffeld + dobbelsteen-roll voor inclusie. Cost variance verbreed naar ±25% (was ±10%) en labor/material split is 35-50% (was vast 40%). Elke klik produceert een uniek schaderapport.
- **AutoTelex Invul Helper** (Feb 2026): Nieuwe sectie in BPM Terugreken-kaart waar admin de inkoopprijs (van factuur) + overig waardeverminderingsbedrag invult.
- **AI prompt verrijking met regelitems** (Feb 2026): `bpm_ai.py` verzendt nu `hours` + `material_cost` per damage-item naar Claude.
- **AI Onderbouwing modal flow** (Feb 2026): Na "Genereer onderbouwing (AI)" opent een bewerkbaar modal met de gegenereerde tekst. Automatisch toegevoegde handtekening: *"Vastgesteld door taxateur S. Milone op {report_date}."*. Gebruiker kan tekst aanpassen, opnieuw genereren, of annuleren voordat opslaan in `damage_notes`. Axios timeout verhoogd naar 60s voor AI calls (was globaal 15s).
- **AI Toelichting taxateur in PDFs** (Feb 2026): Wanneer `damage_notes` is gevuld (handmatig of via AI-knop "Genereer unieke onderbouwing"), wordt de tekst nu op een aparte pagina "Toelichting taxateur" geplaatst in zowel het BPM Rapport (sectie 6) als het Taxatieverslag (sectie 5, Verklaring naar 6). Tekst wordt netjes gerenderd met `TA_JUSTIFY`, paragraaf-splitsing op `\n\n`, en aparte PageBreak voor leesbaarheid.
- **Auto-vink schadepunten knop** in BPM Taxatie: scope-bug opgelost (`bpm` was block-scoped binnen `if (view==='form')` en niet zichtbaar in `autoTickDamage`). `bpm` wordt nu lokaal berekend via `calcBpmLocal(form, null)`. Bonus: vult ook `hours` (40% labor) + `material_cost` automatisch in en opent de checklist (Feb 2026)
- Backend Refactoring, CHF Prijsaanpassing, BPM Snel Aanpassen
- AutoTelex Gegevens Overnemen, BPM Rapport PDF
- Belastingdienst Formulier Auto-Fill (21 pagina's, 92 velden)
- Taxatieverslag PDF (uren × €65 + materiaal onderbouwing)
- PDF download bug fixes (XHR, auto-download template, PyMuPDF)
- Pakbon zichtbaarheid voor Ellen (pakbon rol) - OrderWithMotorcycle model miste velden kentekenbewijs_url, payment_instructions, supplier_info, motorcycle_license_plate (Feb 2026)
- COC/CVO bestellen bij buy-now: Yamaha/Kawasaki/KTM €75, Triumph €120, Honda €150. Optionele checkbox in buy-now dialog (alleen zichtbaar voor de 5 merken), toegevoegd aan totaalprijs, zichtbaar in admin /admin/orders met paarse badge (Feb 2026)
- COC/CVO leveranciersflow (Feb 2026):
  - Honda uit COC_PRICES verwijderd — dealer bestelt zelf via Honda portal (info-link in buy-now dialog)
  - Yamaha/Kawasaki/KTM → Hostettler Eschenbach (walter.breny@hostettler-moto.ch), admin kosten €0
  - Triumph → Mage Motos (mgredig@maegemotos.ch), admin kosten CHF 80
  - Automatische Duitstalige COC-aanvraagmail naar leverancier met admin in CC
  - Admin dashboard /admin/coc-orders met 4 statusstappen (Aangevraagd → Besteld → Ontvangen → Verzonden) incl. merk-specifieke inkoopkosten in CHF
  - Dealer ziet live COC-statusbalk in /dealer/orders; automatische bevestigingsmail zodra status 'sent_to_dealer'
  - **COC PDF upload** in admin dashboard: PDF wordt automatisch als bijlage naar dealer gemaild bij status 'Verstuurd naar dealer'. Dealer kan PDF zelf downloaden via paarse knop in /dealer/orders (Feb 2026)

### P1
- AutoTelex API (wacht op API-sleutel)
- WhatsApp notificaties
- Franse promotievideo

### P2
- MoneyMonk API, Voorstel kosten, Flyers Download

## Test Credentials
- Admin: motoimportbv@gmail.com / Admin2024!
- Dealer: zoektest@dealer.nl / Test2024!
