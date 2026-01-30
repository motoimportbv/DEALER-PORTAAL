# Moto Import - Motorfiets Dealer Platform

## Originele Probleemstelling
Een applicatie voor Moto Import B.V. waar motorfietsen worden aangeboden aan een dealer netwerk met:
- Admin en Dealer rollen
- Dealer registratie met KVK-nummer verificatie
- Bied- en Koop Nu systeem met veilingen (max 3 uur)
- 10% aanbetaling via Stripe/iDEAL
- €50 bezorgoptie of gratis ophalen
- Email notificaties voor registraties en goedkeuringen

## Gebruikersrollen
1. **Admin** - Motorfietsen beheren, orders bekijken, dealers goedkeuren
2. **Dealer** - Catalogus bekijken, bieden, kopen, orders volgen

## Kernvereisten
- JWT authenticatie met bcrypt password hashing
- Dealer goedkeuring workflow met email notificaties
- Motorfiets CRUD met foto uploads
- Biedsysteem met minimum verhogingen (€100)
- Koop Nu met Stripe betalingsintegratie
- In-app notificaties (bell icon) voor nieuwe motoren

## Wat is Geïmplementeerd (30 Jan 2025)

### Backend (FastAPI + MongoDB)
- ✅ JWT authenticatie met bcrypt
- ✅ Gebruikersregistratie met KVK validatie
- ✅ Dealer goedkeuring workflow
- ✅ Gmail SMTP email notificaties
- ✅ Motorfiets CRUD endpoints
- ✅ Bidsysteem met veiling timer
- ✅ Stripe checkout integratie (10% aanbetaling)
- ✅ Bezorgkosten berekening (€50)
- ✅ Foto upload endpoint
- ✅ Notificaties systeem
- ✅ Order management

### Frontend (React + Shadcn UI)
- ✅ Login en registratie pagina's (met KVK veld)
- ✅ Admin Dashboard met KPI's
- ✅ Motorfiets lijst en detail pagina's
- ✅ Bied en Koop Nu dialogs
- ✅ Dealer management voor admin
- ✅ Order overzicht
- ✅ Notificaties bell icon
- ✅ Payment success pagina
- ✅ Nederlandse interface
- ✅ Moto Import branding

### Betalingssysteem (Stripe)
- ✅ 10% aanbetaling berekening
- ✅ €50 bezorgkosten optie
- ✅ Checkout session creatie
- ✅ Redirect naar Stripe checkout
- ✅ Payment status tracking

## Test Accounts
- **Admin**: admin@test.nl / admin123
- **Dealer**: dealer@test.nl / dealer123

## Tech Stack
- Backend: FastAPI, MongoDB (motor), Pydantic, bcrypt, JWT
- Frontend: React, React Router, Shadcn UI, Tailwind CSS, Axios
- Email: Gmail SMTP
- Payments: Stripe (via emergentintegrations)

## Geprioriteerde Backlog

### P0 (Kritiek) - ✅ Voltooid
- [x] Basis authenticatie
- [x] Motorfiets catalogus
- [x] Bied- en Koop Nu systeem
- [x] **Stripe betaling fix** (30 Jan 2025)

### P1 (Hoog) - Volgende Sprint
- [ ] N+1 Query fix in /api/orders endpoint
- [ ] Stripe webhook voor betrouwbare payment confirmatie
- [ ] iDEAL als specifieke betaalmethode toevoegen

### P2 (Medium)
- [ ] Backend refactoren naar routers/models structuur
- [ ] Wachtwoord reset functionaliteit
- [ ] Zoek/filter uitbreiden (prijs range, jaar, conditie)

### P3 (Laag)
- [ ] Dashboard grafieken
- [ ] Export orders naar CSV/Excel
- [ ] Favorieten voor dealers

## API Endpoints
| Endpoint | Method | Beschrijving |
|----------|--------|--------------|
| /api/auth/register | POST | Dealer registratie |
| /api/auth/login | POST | Inloggen |
| /api/motorcycles | GET/POST | Motorcycles CRUD |
| /api/bids | POST | Bod plaatsen |
| /api/payments/create-checkout | POST | Stripe sessie maken |
| /api/payments/calculate | GET | Bedragen berekenen |
| /api/dealers/{id}/approve | PUT | Dealer goedkeuren |

## Database Schema
- **users**: email, password_hash, role, is_approved, company_name, kvk_number, ...
- **motorcycles**: brand, model, year, price, starting_price, images[], auction_end_time, ...
- **orders**: motorcycle_id, dealer_id, status, deposit_amount, stripe_session_id, ...
- **bids**: motorcycle_id, dealer_id, amount, ...
- **notifications**: user_id, type, message, is_read, ...

## Configuratie Vereist
- `STRIPE_API_KEY`: Vervang met eigen Live key voor echte betalingen
- `GMAIL_APP_PASSWORD`: Google App Password voor emails
- `JWT_SECRET`: Geheim voor token signing
