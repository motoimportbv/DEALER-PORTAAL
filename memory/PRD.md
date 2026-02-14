# Moto Import - Motorfiets Dealer Platform

## Originele Probleemstelling
Een applicatie voor Moto Import B.V. waar motorfietsen worden aangeboden aan een dealer netwerk met:
- Admin en Dealer rollen
- Dealer registratie met KVK-nummer verificatie
- Direct bestelsysteem (betalingen verwijderd per gebruikersverzoek)
- €50 bezorgoptie of gratis ophalen
- Email notificaties voor registraties, goedkeuringen en bestellingen
- Real-time chat tussen dealers en admin
- Progressive Web App (PWA) voor offline toegang en installatie

## Gebruikersrollen
1. **Admin** - Motorfietsen beheren, orders bekijken, dealers goedkeuren, chat met dealers
2. **Dealer** - Catalogus bekijken, bestellen, orders volgen, chat met admin

## Wat is Geïmplementeerd

### Backend (FastAPI + MongoDB)
- ✅ JWT authenticatie met bcrypt
- ✅ Gebruikersregistratie met KVK validatie
- ✅ Dealer goedkeuring workflow (nieuwe dealers kunnen niet inloggen tot goedgekeurd)
- ✅ Gmail SMTP email notificaties
- ✅ Motorfiets CRUD endpoints
- ✅ Direct bestelsysteem (Buy Now zonder betaling)
- ✅ Email bevestiging naar dealer én admin bij bestelling
- ✅ Bezorgkosten berekening (€50)
- ✅ Foto upload endpoint
- ✅ Notificaties systeem (in-app + email bij nieuwe motoren)
- ✅ Order management
- ✅ Real-time chat systeem

### Frontend (React + Shadcn UI)
- ✅ Login en registratie pagina's (met KVK veld)
- ✅ Admin Dashboard met KPI's
- ✅ Motorfiets lijst en detail pagina's
- ✅ Direct bestellen dialogs
- ✅ Dealer management voor admin
- ✅ Order overzicht met details
- ✅ Notificaties bell icon
- ✅ Chat widget voor communicatie
- ✅ Nederlandse interface
- ✅ Moto Import branding

### PWA Functionaliteit (14 Feb 2026)
- ✅ Service Worker voor offline caching
- ✅ Web App Manifest
- ✅ App icons (72x72 tot 512x512)
- ✅ Installatie prompt component
- ✅ Offline fallback pagina
- ✅ Push notification ondersteuning

### Verwijderde Functionaliteit
- ❌ Stripe betalingen (verwijderd per gebruikersverzoek)
- ❌ Twilio SMS notificaties (verwijderd per gebruikersverzoek - 14 Feb 2026)

## Test Accounts
- **Admin**: motoimportbv@gmail.com / Enolim12

## Tech Stack
- Backend: FastAPI, MongoDB (motor), Pydantic, bcrypt, JWT
- Frontend: React, React Router, Shadcn UI, Tailwind CSS, Axios
- Email: Gmail SMTP
- PWA: Service Workers, Web App Manifest

## Geprioriteerde Backlog

### P0 (Kritiek) - ✅ Voltooid
- [x] Basis authenticatie
- [x] Motorfiets catalogus
- [x] Direct bestelsysteem
- [x] Email notificaties
- [x] Dealer goedkeuring workflow
- [x] PWA implementatie
- [x] Twilio SMS verwijderen

### P1 (Hoog) - Aanbevolen
- [ ] Mobiele responsiviteit verbeteren
- [ ] Backend refactoren naar routers/models structuur
- [ ] Ongebruikte Stripe endpoints verwijderen

### P2 (Medium)
- [ ] Native app build (Capacitor) voor App Store/Play Store
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
| /api/orders/buy-now | POST | Direct bestellen |
| /api/dealers/{id}/approve | PUT | Dealer goedkeuren |
| /api/chat/messages | POST | Chat bericht sturen |
| /api/notifications | GET | Notificaties ophalen |

## Database Schema
- **users**: email, password_hash, role, is_approved, company_name, kvk_number, phone, ...
- **motorcycles**: brand, model, year, price, images[], is_available, ...
- **orders**: motorcycle_id, dealer_id, status, total_price, delivery_option, ...
- **chat_messages**: conversation_id, sender_id, message, is_read, ...
- **notifications**: user_id, type, message, is_read, ...

## Configuratie Vereist
- `GMAIL_APP_PASSWORD`: Google App Password voor emails
- `JWT_SECRET`: Geheim voor token signing
- `BASE_URL`: Publieke URL voor links in emails

## Changelog

### 14 Feb 2026
- Twilio SMS functionaliteit volledig verwijderd
- PWA functionaliteit geverifieerd en werkend
- Service Worker geregistreerd en actief
- Test accounts bijgewerkt
