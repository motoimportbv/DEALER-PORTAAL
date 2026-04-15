# Moto Import Platform - PRD

## Oorspronkelijke Probleemstelling
Platform voor motorhandelnetwerk "Moto Import" met dealer management, bestellingen, en BPM tools.

## Kernfuncties
- **BPM Vermindering Tool**: Volledige BPM taxatie met AutoTelex integratie, snel schadebedrag, PDF export + **automatisch invullen officieel Belastingdienst formulier**
- **Dealer Platform**: Dashboard, bestellingen, voorstellen, motor verkoop, zoekertjes
- **Admin Platform**: Motorcycles beheer, orders, dealers, marketing, taxatie
- **Foreign Dealer**: Motoren aanmelden, CHF prijsaanpassing
- **Klant Deellinks**: Motoren delen zonder prijzen

## BPM Formulier Auto-Fill
Het officiële Belastingdienst PDF-formulier (21 pagina's, 92 velden) wordt automatisch ingevuld met:
- Voertuiggegevens (VIN, merk, model, 1e toelating)
- Bedrijfsgegevens (Motoimport B.V., RSIN 866851525, adres)
- Netto catalogusprijs & Bruto BPM
- Forfaitaire afschrijvingspercentage
- Berekende BPM & Te betalen BPM
- Ondertekening (Sandro Milone)
- Bijlage A (bruto BPM) & Bijlage D (vermindering)

## Prioritized Backlog

### P0 - Afgerond
- Backend Refactoring
- CHF Prijsaanpassing
- BPM Snel Aanpassen tools
- AutoTelex Gegevens Overnemen
- BPM Rapport PDF Export
- Belastingdienst Formulier Auto-Fill

### P1
- AutoTelex API (wacht op API-sleutel)
- WhatsApp notificaties
- Franse promotievideo

### P2
- MoneyMonk API, Voorstel kosten, Flyers Download

## Test Credentials
- Admin: motoimportbv@gmail.com / Admin2024!
- Dealer: zoektest@dealer.nl / Test2024!
