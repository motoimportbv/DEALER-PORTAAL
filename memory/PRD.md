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
- ✅ Dealer verwijderen (inclusief gerelateerde data cleanup)
- ✅ Gmail SMTP email notificaties
- ✅ Motorfiets CRUD endpoints
- ✅ Direct bestelsysteem (Buy Now zonder betaling)
- ✅ Email bevestiging naar dealer én admin bij bestelling
- ✅ Bezorgkosten berekening (€50)
- ✅ Foto upload endpoint
- ✅ Notificaties systeem (in-app + email bij nieuwe motoren)
- ✅ Order management
- ✅ Real-time chat systeem
- ✅ Web Push notificaties (pywebpush + VAPID)
- ✅ €250 welkomstvoucher systeem
- ✅ Wachtwoord reset functionaliteit
- ✅ Pakbon generatie en email

### Frontend (React + Shadcn UI)
- ✅ Login en registratie pagina's (met KVK veld)
- ✅ Admin Dashboard met KPI's
- ✅ Motorfiets lijst en detail pagina's
- ✅ Direct bestellen dialogs
- ✅ Dealer management voor admin (inclusief verwijderen)
- ✅ Order overzicht met details (responsive kaarten voor mobiel)
- ✅ Notificaties bell icon
- ✅ Chat widget voor communicatie
- ✅ Nederlandse interface
- ✅ Moto Import branding
- ✅ Push notification toggle voor dealers
- ✅ Voucher code invoer bij bestellen
- ✅ Wachtwoord vergeten/reset pagina's
- ✅ Pakbon pagina (printbaar)

### PWA Functionaliteit (14 Feb 2026)
- ✅ Service Worker voor offline caching
- ✅ Web App Manifest
- ✅ App icons (72x72 tot 512x512)
- ✅ Installatie prompt component
- ✅ Offline fallback pagina
- ✅ Push notification ondersteuning
- ✅ **iOS ondersteuning compleet:**
  - 9 iOS splash screens (iPhone X t/m iPhone 15 Pro Max + iPads)
  - Apple touch icons
  - Apple mobile web app meta tags
  - Stap-voor-stap iOS installatie instructies in app
  - Dealer handleiding met iOS/Android installatie gids

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
- [x] Algemene Voorwaarden accepteren (dealers)

### P1 (Hoog) - Aanbevolen
- [ ] Backend refactoren naar routers/models structuur
- [ ] Ongebruikte Stripe endpoints verwijderen (`/api/create-checkout-session`)
- [ ] Native app build (Capacitor) voor App Store/Play Store

### P2 (Medium)
- [x] ~~Wachtwoord reset functionaliteit~~ ✅ Voltooid
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
| /api/dealers/{id} | DELETE | Dealer verwijderen |
| /api/chat/messages | POST | Chat bericht sturen |
| /api/notifications | GET | Notificaties ophalen |
| /api/auth/forgot-password | POST | Wachtwoord reset aanvragen |
| /api/auth/reset-password | POST | Nieuw wachtwoord instellen |
| /api/voucher/check/{code} | GET | Voucher code valideren |
| /api/voucher/my-voucher | GET | Eigen voucher ophalen |
| /api/push/subscribe | POST | Push notificaties inschakelen |
| /api/push/vapid_public_key | GET | VAPID publieke sleutel |
| /api/auth/accept-terms | POST | Voorwaarden accepteren |
| /api/stats/top-dealers | GET | Meest actieve dealers |
| /api/motorcycles/dealer-listing | POST | Dealer plaatst motor te koop |
| /api/motorcycles/my-listings | GET | Eigen motors ophalen |

## Database Schema
- **users**: email, password_hash, role, is_approved, company_name, kvk_number, phone, **terms_accepted**, **terms_accepted_at**, **login_count**, **last_login**, ...
- **motorcycles**: brand, model, year, price, images[], is_available, **is_dealer_listing**, **seller_company**, **seller_id**, **listing_fee_invoiced**, ...
- **orders**: motorcycle_id, dealer_id, status, total_price, delivery_option, **is_dealer_to_dealer**, **seller_company**, **seller_id**, ...
- **notifications**: user_id, type, message, is_read, ...

## Configuratie Vereist
- `GMAIL_APP_PASSWORD`: Google App Password voor emails
- `JWT_SECRET`: Geheim voor token signing
- `BASE_URL`: Publieke URL voor links in emails

## Changelog

### 15 Feb 2026 (Update 6)
- 📜 **Algemene Voorwaarden feature** - Dealers moeten eenmalig de voorwaarden accepteren
  - Modal verschijnt automatisch na eerste login
  - Checkbox verplicht voordat accepteren mogelijk is
  - `terms_accepted` en `terms_accepted_at` opgeslagen in database
  - Modal verschijnt niet meer na accepteren
  - Backend endpoint: `POST /api/auth/accept-terms`
  - Frontend component: `TermsModal.js`

### 15 Feb 2026 (Update 7)
- 📊 **Dealer Activiteit Tracking** - Admin kan nu zien welke dealer het vaakst actief is
  - Login count en laatste login worden bijgehouden per dealer
  - "Meest Actieve Dealers" sectie toegevoegd aan Admin Dashboard
  - Top 5 dealers getoond met ranking (goud, zilver, brons)
  - Backend endpoint: `GET /api/stats/top-dealers`
- 🗑️ **Chat Functie Verwijderd** - Volledig verwijderd per gebruikersverzoek
  - ChatWidget.js verwijderd
  - Chat endpoints verwijderd uit backend
- 💬 **WhatsApp Button Toegevoegd** - Directe communicatie via WhatsApp
  - Floating groene WhatsApp knop rechtsonder
  - Telefoonnummer: +31638525541
  - Opent WhatsApp met vooringevuld bericht

### 15 Feb 2026 (Update 8)
- 🖨️ **Auto-Print Pakbon** - Na bestelling opent automatisch print dialoog
  - Redirect naar pakbon pagina na succesvolle bestelling
  - Print dialoog opent automatisch met `?print=true` parameter

### 15 Feb 2026 (Update 9)
- 🏪 **Dealer Marketplace** - Dealers kunnen nu eigen motoren verkopen
  - Nieuwe menu items: "Mijn Motoren" en "Motor Verkopen"
  - Dealers kunnen motors plaatsen voor andere dealers
  - €250 plaatsingskosten bij verkoop (admin factureert handmatig)
  - Verkoper naam zichtbaar op listing (gele badge)
  - Admin krijgt email notificatie bij nieuwe dealer listing
  - Admin krijgt speciale notificatie bij verkoop met €250 factuur reminder
  - Backend endpoints: `POST /api/motorcycles/dealer-listing`, `GET /api/motorcycles/my-listings`
  - Frontend pagina's: `DealerSellMotorcycle.js`, `DealerMyListings.js`

### 15 Feb 2026 (Update 5)
- 🔔 **Push notificaties volledig werkend!**
  - VAPID keys hardcoded voor consistentie tussen deployments
  - Admin ontvangt meldingen bij nieuwe biedingen
  - Dealers ontvangen meldingen bij nieuwe motoren
  - Test knop toegevoegd om notificaties te verifiëren
  - Debug endpoint toegevoegd (/api/push/debug)

### 15 Feb 2026 (Update 4)
- 🐛 **Bug fixes voor 3 openstaande issues:**
  1. **"Spinning server" bug** - Opgelost met axios timeout (15s) en error state handling
  2. **Wachtwoord reset "wachten op goedkeuring"** - DealerDashboard haalt nu verse user data op
  3. **Pakbon knop op mobiel** - Bevestigd dat de printer knop zichtbaar is in mobiele kaartweergave

### 15 Feb 2026 (Update 3)
- 🔍 **Zoekbalk voor dealers verbeterd**
  - Prominente zoekbalk bovenaan catalogus pagina
  - Zoeken op merk, model, kleur én bouwjaar
  - Live filtering terwijl je typt
  - "X" knop om zoekopdracht te wissen
  - Duidelijke placeholder tekst

### 15 Feb 2026 (Update 2)
- 🗑️ **Dealer verwijderen functie** - Admin kan nu dealers permanent verwijderen via Dealer Beheer
  - Verwijdert ook alle gerelateerde data (vouchers, notificaties, push subscriptions, chat berichten)
  - Bevestigingsdialoog voorkomt per ongeluk verwijderen
  - Volledige backend en frontend tests toegevoegd

### 15 Feb 2026
- 🎁 **Voucher systeem toegevoegd** - Nieuwe dealers krijgen automatisch €250 welkomstkorting
- 📧 **Pakbon per email** - Admin ontvangt volledige pakbon bij elke bestelling
- 📱 **Mobiele bestellingen** - Kaart-layout voor bestellingen op telefoon
- 🔔 **Push notificaties** - Dealers kunnen meldingen ontvangen op hun telefoon

### 14 Feb 2026
- Twilio SMS functionaliteit volledig verwijderd
- PWA functionaliteit geverifieerd en werkend
- Service Worker geregistreerd en actief
- **iOS PWA ondersteuning toegevoegd:**
  - 9 iOS splash screens voor alle iPhone/iPad modellen
  - Verbeterde InstallPrompt met stap-voor-stap iOS instructies
  - Apple touch startup images
  - Dealer handleiding bijgewerkt met iOS/Android installatie instructies
- Test accounts bijgewerkt
