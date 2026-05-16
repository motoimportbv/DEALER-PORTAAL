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
- **🔒 Beveiligingsfix: dealers zien GEEN inkoopprijs / leverancier-IBAN meer op Pakbon** (Feb 2026): Twee lekken gedicht:
  1. Frontend `Pakbon.js` toonde de "Betalingsinstructie"-kaart (CHF-bedrag, leverancier, IBAN, referentie) zodra `order.payment_instructions` aanwezig was — ongeacht rol. Nu alleen voor `admin` en `pakbon` rollen.
  2. Backend `GET /api/orders` stuurde `payment_instructions` en `supplier_info` mee in de respons voor álle rollen. Defense-in-depth: deze velden worden nu actief gestript bij niet-admin/pakbon. Getest met curl: dealer ziet 0 leaks, admin behoudt normale toegang.
- **Volmacht-PDF — alle velden bewerkbaar via modal** (Feb 2026): VolmachtEditor modal toont alle 19 velden gegroepeerd per sectie (Volmachtgever / Gemachtigde / Voertuig / Ondertekening / Extra). Defaults komen automatisch uit klant + branding + taxatie; overrides worden opgeslagen op de taxatie als `volmacht_overrides`. Extra clausule-veld (multiline) wordt onder de standaard strekkingsclausule getoond. Auto-vinkt nog steeds vakje 10.5 op de Aangifte BPM PDF. Nieuwe endpoints `GET/POST /api/taxatie-programma/{id}/volmacht-overrides` + `/volmacht-pdf` (POST met body). Knop "Volmacht PDF" in de Aangifte editor opent nu eerst de modal i.p.v. directe download. End-to-end getest met curl + PyMuPDF read-back: alle overrides verschijnen correct in de output-PDF.
- **Volmacht-PDF generator** (Feb 2026): Knop "Volmacht PDF" in de Aangifte BPM editor genereert een officieel Volmacht-document waarin de klant Motoimport / DK Automotive machtigt om de BPM-aangifte namens hen in te dienen. Inclusief: volmachtgever (klant) + gemachtigde (gebruiker via branding) + voertuig (merk/model/VIN/datum/km) + officiële strekkingsclausule + handtekeningvelden. Bij download wordt vakje 10.5 ("Volmacht") op de Aangifte BPM PDF automatisch aangevinkt. Endpoint `GET /api/taxatie-programma/{id}/volmacht-pdf`. Klant-RSIN wordt automatisch ingevuld vanuit het klantenbestand. Getest met curl + PyMuPDF read-back.
- **Klant-detail modal (BPM-historie + Facturen + Snel nieuwe taxatie)** (Feb 2026): Klikken op klantnaam in Mijn Klanten opent een detailmodal met statistieken (totaal taxaties, facturen, ontvangen BPM, gefactureerd) + complete historie van alle BPM-taxaties en facturen voor die klant. Knop "Nieuwe BPM Taxatie" navigeert naar `/admin/taxatie-programma?prefill_customer={id}` waar het form direct opent met klant-gegevens pre-gevuld. Nieuw endpoint `GET /api/customers/{id}/history` aggregeert taxatie + factuur data via case-insensitive matching op `customer_name`. End-to-end getest met curl.
- **Aangifte BPM — Pagina 1 & 6 bewerkbaar + RSIN auto-fill** (Feb 2026): Aparte knop in BPM Rapport view ÉN in de lijst-actierij (paars `FileCheck` icon) opent modal met alle bewerkbare velden van pagina 1 (VIN, document kenmerk 1c, BSN/RSIN) en pagina 6 (document kenmerk, vraag 9 radio + toelichting, vraag 9.2 radio, ondertekenaar, datum, 4 bijlage-checkboxes). Klanten hebben nu een `rsin` veld in het Klantenbestand (zichtbaar als blauwe inline-editor in tabel + input in "Nieuwe klant" modal). Bij openen Aangifte editor wordt 1.2_BSR auto-gevuld vanuit `customer.rsin`. Bij download van PDF wordt het ingevulde RSIN automatisch teruggekoppeld naar de klant (upsert), zodat hij volgende keer direct beschikbaar is. Nieuwe endpoints `GET/POST /api/taxatie-programma/{id}/aangifte-overrides` + `/aangifte-bpm-pdf`. Overrides worden opgeslagen op de taxatie voor hergebruik. Getest met curl + PyMuPDF read-back.
- **Klant-specifiek taxatietarief (default_taxatie_fee)** (Feb 2026): Naast `default_fee` (extra fee voor Gielen/Wijma/Wilderman) kan per klant nu ook het taxatietarief afwijkend van €160 worden opgeslagen. Backend `/api/customers` upsert + GET projection bevatten `default_taxatie_fee`. Frontend `CustomerDirectory.js` heeft input + inline editor; `TaxatieInvoices.pickCustomer` overschrijft alle `taxatie_items.fee` met de klantwaarde + toont gecombineerde toast. Getest end-to-end (11/11 backend, alle frontend flows). Pytest: `/app/backend/tests/test_customer_default_fees.py`.
- **Verzending-tracking + 5-dagen Reminder + Maandfactuur Overzicht** (Feb 2026): Nieuwe workflow op `taxatie_programma`: na "Definitief" kun je markeren *Op de post gedaan* (datumkiezer), waarna na 5 dagen automatisch een oranje reminder-banner verschijnt op `/admin/taxatie-programma`. Met één klik open je het *BPM ontvangen* modal (verplicht meldcode Belastingdienst + ontvangen bedrag + datum). Nieuwe pagina `/admin/taxatie-maandfactuur` groepeert alle ontvangen taxaties per maand met meldcode, klant, BPM-bedrag, en knop *"Gefactureerd"* om af te vinken. 4 nieuwe endpoints: `mark-posted`, `mark-bpm-received`, `taxatie-programma-reminders`, `taxatie-programma-maandfactuur`, `mark-invoiced`. Toegankelijk voor admin én taxateur (DK Automotive) met data-isolatie.
- **AI Onderbouwing async + polling** (Feb 2026): `/api/admin/bpm/generate-onderbouwing` retourneert nu direct (<1s) een `task_id` en draait Claude generatie als `asyncio.create_task` background. Resultaat in collectie `bpm_ai_tasks`. Frontend pollt `GET /api/admin/bpm/onderbouwing-status/{task_id}` elke 2.5s tot status `done` (max 90s). Lost productie "Network Error" definitief op (Kubernetes ingress sloot synchrone 30s+ requests af; nu zijn alle requests <2s).
- **Wettelijke onderbouwing-pagina in Taxatieverslag PDF** (Feb 2026): Voor motorfietsen wordt automatisch een sectie 7 toegevoegd met letterlijke citaten van Artikel 10 lid 7 Wet BPM (bron: wetten.overheid.nl) + Hoge Raad uitspraak ECLI:NL:HR:2014:80 (bron: uitspraken.rechtspraak.nl) + de 5 toegepaste waardedrukkende factoren (logistiek, RDW-keuring, garantieverlies, marktverhouding, technische gebreken). Alleen voor `vehicle_type=motorfiets` — auto-rapporten van Deniz krijgen deze pagina niet (lokale taxatie).
- **Import-context in AI onderbouwing voor motorfietsen** (Feb 2026): AI verwerkt expliciet alle 5 import-elementen.
- **Auto-specifieke Technische Inspectie** (Feb 2026): 13 categorieën (Carrosserie, Ruiten, Aandrijflijn, Airco, Interieur, etc.) automatisch geladen voor taxateurs met `vehicle_type=auto`.
- **Volledige data isolatie per taxateur** (Feb 2026): Nieuwe Mongo helpers `_owner_filter_for_user` + `_stamp_owner` in `taxatie.py`. Bij creatie van factuur of taxatie wordt `owner_user_id` gestempeld. Bij ophalen ziet taxateur ALLEEN eigen records, admin ziet eigen + legacy records. Toegepast op alle GET/PUT/DELETE/PDF endpoints van taxatie-programma + taxatie-invoices. Getest: Admin ziet 4+3, Deniz ziet 0+0 ✅ Backend `services/branding.py` + frontend `utils/branding.js` retourneren bedrijfsgegevens per gebruiker (admin → Moto Import, taxateur → DK Automotive). Toegepast op: BPM Rapport PDF (header/footer), Taxatieverslag PDF (alle 6 secties + ondertekening + footer), Taxatie Factuur (afzender + footer), Sidebar header (desktop + mobile), BpmReport HTML view, paginatitels. Voertuig-labels dynamisch: "motorfiets" voor admin → "auto" voor Deniz (vehicle_type=auto). AI prompt schrijft over auto's i.p.v. motorfiets. Adres "Schalkhaar" → "Lettele", KVK 94622086 → 88479935, S. Milone → Denizkabakolak23.
- **Nieuwe rol "taxateur" voor Deniz Kabakolak** (Feb 2026): Account aangemaakt met rol `taxateur`.
- **Merk-specifieke schadeprofielen** (Feb 2026): 16 merken vooraf geconfigureerd.
- **Auto-vink schadepunten gerandomiseerd** (Feb 2026): 4-laags probability tier systeem.
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
