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
- Backend Refactoring, CHF Prijsaanpassing, BPM Snel Aanpassen
- AutoTelex Gegevens Overnemen, BPM Rapport PDF
- Belastingdienst Formulier Auto-Fill (21 pagina's, 92 velden)
- Taxatieverslag PDF (uren × €65 + materiaal onderbouwing)
- PDF download bug fixes (XHR, auto-download template, PyMuPDF)
- Pakbon zichtbaarheid voor Ellen (pakbon rol) - OrderWithMotorcycle model miste velden kentekenbewijs_url, payment_instructions, supplier_info, motorcycle_license_plate (Feb 2026)
- COC/CVO bestellen bij buy-now: Yamaha/Kawasaki/KTM €75, Triumph €120, Honda €150. Optionele checkbox in buy-now dialog (alleen zichtbaar voor de 5 merken), toegevoegd aan totaalprijs, zichtbaar in admin /admin/orders met paarse badge (Feb 2026)

### P1
- AutoTelex API (wacht op API-sleutel)
- WhatsApp notificaties
- Franse promotievideo

### P2
- MoneyMonk API, Voorstel kosten, Flyers Download

## Test Credentials
- Admin: motoimportbv@gmail.com / Admin2024!
- Dealer: zoektest@dealer.nl / Test2024!
