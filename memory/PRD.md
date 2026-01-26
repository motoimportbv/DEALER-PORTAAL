# MotoDealer - Motorfiets Dealer Platform

## Originele Probleemstelling
Bouw een app waar motorfietsen kunnen worden aangeboden aan een dealer netwerk met login functionaliteit.

## Gebruikersrollen
1. **Admin** - Beheerder die motorfietsen kan toevoegen, bewerken, verwijderen en orders kan beheren
2. **Dealer** - Bedrijf dat motorfietsen kan bekijken en bestellen

## Kernvereisten (Statisch)
- Gebruikersauthenticatie (registratie/login) met JWT
- Rollenbeheer (admin/dealer)
- Motorfiets CRUD (Create, Read, Update, Delete)
- Motorfiets details: merk, model, bouwjaar, prijs, kilometerstand, kleur, beschrijving, conditie, afbeeldingen
- Bestelproces voor dealers
- Order management voor admin

## Wat is Geïmplementeerd (26 Jan 2025)

### Backend (FastAPI)
- ✅ JWT authenticatie met bcrypt password hashing
- ✅ Gebruikersregistratie en login endpoints
- ✅ Motorfiets CRUD endpoints
- ✅ Order management endpoints
- ✅ Admin statistieken endpoint
- ✅ MongoDB integratie

### Frontend (React + Shadcn UI)
- ✅ Login en registratie pagina's
- ✅ Admin Dashboard met KPI's en recente orders
- ✅ Motorfiets lijst met cards
- ✅ Motorfiets formulier (toevoegen/bewerken)
- ✅ Order beheer voor admin
- ✅ Dealer dashboard met zoekfunctie
- ✅ Motorfiets detail pagina met bestelknop
- ✅ Dealer order overzicht
- ✅ Performance Pro design (donkere sidebar, witte content)
- ✅ Nederlandse interface
- ✅ Responsive design

## Geprioriteerde Backlog

### P0 (Kritiek) - Voltooid
- [x] Basis authenticatie
- [x] Motorfiets toevoegen/bekijken
- [x] Bestellen door dealers

### P1 (Hoog) - Volgende Fase
- [ ] Wachtwoord reset functionaliteit
- [ ] Email notificaties bij nieuwe orders
- [ ] Afbeelding upload (nu URL-based)

### P2 (Medium)
- [ ] Zoek/filter functie uitbreiden (prijs range, jaar, conditie)
- [ ] Export orders naar CSV/Excel
- [ ] Dealer bedrijfsprofiel pagina

### P3 (Laag)
- [ ] Dashboard charts/grafieken
- [ ] Notificatie systeem
- [ ] Favorieten voor dealers

## Test Accounts
- Admin: admin@test.nl / admin123
- Dealer: dealer@test.nl / dealer123

## Tech Stack
- Backend: FastAPI, MongoDB, JWT
- Frontend: React, Shadcn UI, Tailwind CSS
- Fonts: Barlow Condensed (headings), Manrope (body)
