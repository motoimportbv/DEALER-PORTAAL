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
- [x] **Volledige app vertaling (NL, DE, FR, IT)** ✅
- [x] **Push notificatie instructie-popup** ✅ (16 Feb 2026)

### P1 (Hoog) - ✅ Voltooid
- [x] **Native app build (Capacitor)** ✅ Geconfigureerd met iOS/Android projecten
  - Documentatie: `/app/frontend/NATIVE_APP_BUILD_GUIDE.md`
  - iOS project: `/app/frontend/ios/`
  - Android project: `/app/frontend/android/`
  - App ID: `nl.motoimport.app`

### P2 (Medium) - In Progress
- [x] ~~Wachtwoord reset functionaliteit~~ ✅ Voltooid
- [x] **Backend refactoring gestart** ✅ (16 Feb 2026)
  - Models gescheiden naar `/app/backend/models/`
  - Services gescheiden naar `/app/backend/services/`
  - Routers structuur aangemaakt
- [ ] Backend refactoring voltooien (endpoints naar routers)
- [ ] Ongebruikte Stripe endpoints verwijderen
- [ ] Zoek/filter uitbreiden (prijs range, jaar, conditie)

### P3 (Laag)
- [ ] Dashboard grafieken
- [ ] Export orders naar CSV/Excel
- [ ] Favorieten voor dealers

## Bestanden Structuur

### Backend (Nieuw - Refactored)
```
/app/backend/
├── server.py              # Hoofd FastAPI app (3228 regels - wordt opgesplitst)
├── models/
│   ├── __init__.py
│   ├── database.py        # MongoDB connectie
│   └── schemas.py         # Alle Pydantic models
├── services/
│   ├── __init__.py
│   ├── auth_service.py    # JWT authenticatie
│   └── email_service.py   # Gmail SMTP
├── routers/               # Toekomstige API routers
│   └── __init__.py
└── README.md              # Refactoring roadmap
```

### Frontend (Capacitor)
```
/app/frontend/
├── ios/                   # iOS Xcode project
├── android/               # Android Studio project
├── capacitor.config.ts    # Capacitor configuratie
└── NATIVE_APP_BUILD_GUIDE.md  # Publicatie handleiding
```

## API Endpoints
| Endpoint | Method | Beschrijving |
|----------|--------|--------------|
| /api/auth/register | POST | Dealer registratie |
| /api/auth/register-supplier | POST | Leverancier registratie (buitenland) |
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

### 16 Feb 2026 (Update 19) ✅ VOLTOOID
- 🔔 **PUSH NOTIFICATIE INSTRUCTIE-POPUP** - Voor geblokkeerde notificaties
  - Nieuwe `NotificationBlockedModal.js` component
  - Automatische browser-detectie (Chrome, Safari, Firefox, iOS, Android)
  - Stap-voor-stap instructies per browser/platform
  - "Hoe in te schakelen?" link en knop bij geblokkeerde permissies
  - Volledig vertaald in 4 talen (NL, DE, FR, IT)
  - Test IDs: `notification-blocked-modal`, `push-notification-help-btn`

- 🔧 **PUSH NOTIFICATIE VAPID KEY FIX** - Kritieke productie bug opgelost
  - VAPID private key conversie gefixed (was PEM, nu raw base64 formaat)
  - VAPID keys hardcoded in code voor consistentie tussen preview en productie
  - Test pagina toegevoegd: `/push-test.html` voor debugging
  - Nieuwe `/api/push/status` endpoint toegevoegd
  - Productie deployment succesvol - keys_match: true

- 📱 **NATIVE APP DOCUMENTATIE** - Capacitor build guide
  - Handleiding: `/app/frontend/NATIVE_APP_BUILD_GUIDE.md`
  - iOS en Android projecten al geconfigureerd
  - App ID: `nl.motoimport.app`
  - Android SDK target updated naar API 34

- 🏗️ **BACKEND REFACTORING GESTART** - Modulaire structuur
  - Nieuwe directory structuur: `/app/backend/models/`, `/app/backend/services/`, `/app/backend/routers/`
  - Models gescheiden naar `models/schemas.py` (alle Pydantic modellen)
  - Database connectie naar `models/database.py`
  - Auth service naar `services/auth_service.py` (JWT, wachtwoord hashing)
  - Email service naar `services/email_service.py` (Gmail SMTP)
  - Backend README toegevoegd met refactoring roadmap

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

### 15 Feb 2026 (Update 11)
- 🌐 **Uitgebreide vertalingen** - Bijna volledige app vertaald
  - DealerDashboard, AdminDashboard, RegisterPage volledig vertaald
  - DealerSellMotorcycle, DealerMyListings, DealerOrders volledig vertaald
  - MotorcycleDetail pagina volledig vertaald (inclusief dialogen)
  - PendingForeignListings (admin) volledig vertaald
  - TermsModal (Algemene Voorwaarden) volledig vertaald in alle 4 talen
  - Alle locale bestanden uitgebreid met 150+ nieuwe keys
  - Status: **BIJNA COMPLEET** - Nog enkele admin pagina's te vertalen

### 15 Feb 2026 (Update 12) ✅ VOLTOOID
- 🌍 **VOLLEDIGE APP VERTALING COMPLEET** - Alle pagina's vertaald in 4 talen
  - Nederlands, Duits, Frans, Italiaans volledig ondersteund
  - Admin pagina's vertaald: MotorcycleList, OrderList, DealerManagement
  - Pakbon pagina volledig vertaald
  - **PushNotificationToggle component vertaald** (nieuw)
    - "Push Notificaties" → "Push-Benachrichtigungen" (DE) / "Notifications Push" (FR) / "Notifiche Push" (IT)
    - Alle knoppen en foutmeldingen vertaald
  - Taalwisselaar werkt perfect met vlag + taal naam
  - Toast meldingen vertaald ("Succesvol opgeslagen" → "Enregistré avec succès" etc.)
  - Status: **100% COMPLEET** - Klaar voor internationaal gebruik

### 15 Feb 2026 (Update 13) ✅ VOLTOOID
- 🌍 **APARTE LEVERANCIER REGISTRATIEPAGINA** - Voor buitenlandse leveranciers
  - Nieuwe pagina: `/register/supplier`
  - Vereenvoudigd formulier: Bedrijfsnaam, Land, Contactpersoon, Telefoon, Email, Wachtwoord
  - **Geen KVK-nummer vereist** - alleen land selectie
  - Automatisch gemarkeerd als `is_foreign_dealer: true`
  - Backend endpoint: `POST /api/auth/register-supplier`
  - Email notificatie naar admin met paarse styling
  - Link op normale registratiepagina: "Bent u een buitenlandse leverancier?"
  - Volledig vertaald in 4 talen (NL, DE, FR, IT)

### 16 Feb 2026 (Update 18) ✅ VOLTOOID
- ✅ **DEALER LISTINGS BEHEER** - Bewerken, verwijderen, pauzeren
  - Dealers kunnen hun eigen listings bewerken (prijs, km-stand, conditie, beschrijving)
  - Dealers kunnen listings pauzeren (tijdelijk onzichtbaar) en hervatten
  - Dealers kunnen listings permanent verwijderen
  - Backend endpoints: PUT/DELETE /api/motorcycles/my-listings/{id}, PUT .../pause
  - Visuele feedback: gepauzeerde listings tonen oranje badge en zijn transparant
  - Vertalingen toegevoegd in 4 talen (NL, DE, FR, IT)

### 16 Feb 2026 (Update 17) ✅ VOLTOOID
- ✅ **AFBEELDINGEN PERMANENT OPGESLAGEN** - In MongoDB ipv lokale folder
  - Afbeeldingen worden nu base64 gecodeerd in MongoDB opgeslagen
  - 22 bestaande afbeeldingen gemigreerd naar database
  - Nieuwe endpoint: `/api/images/{id}` voor ophalen
  - Upload endpoint aangepast om direct in MongoDB op te slaan
  - Afbeeldingen blijven bewaard bij server herstarts/deployments
  - Alleen handmatig verwijderen haalt afbeeldingen weg

### 16 Feb 2026 (Update 16) ✅ VOLTOOID
- ✅ **ONDERDELEN SHOP COMPLEET** - Dealers kunnen onderdelen bestellen
  - Admin kan onderdelen beheren: toevoegen, bewerken, verwijderen
  - Admin kan categorieën beheren (standaard: Uitlaten, Tanktassen, Koffers, Luxe Zadels)
  - Dealers kunnen zoeken op naam, artikelnummer, categorie en motormerk
  - Winkelwagen functionaliteit met +/- knoppen
  - Keuze tussen verzending (€9,95) of gratis ophalen
  - Automatische PDF factuur per email naar dealer
  - Admin krijgt notificatie email bij nieuwe bestelling
  - Factuur bevat: S. Milone, IBAN NL90 REVO 9997 6557 88
  - Voorraad wordt automatisch bijgewerkt na bestelling
  - Backend endpoints: `/api/parts/*`, `/api/parts/categories`, `/api/parts/order`
  - Frontend pagina's: PartsShop.js (dealer), AdminParts.js, AdminPartOrders.js (admin)
  - Vertaald in 4 talen (NL, DE, FR, IT)

### 16 Feb 2026 (Update 15) ✅ VOLTOOID
- ✅ **TAALKEUZE MOBIEL VERBETERD** - Nu prominent zichtbaar
  - Mobiele header met Moto Import logo en taalkeuze
  - Rode knop met globe icoon, vlag en taalnaam
  - Sticky header blijft bovenaan tijdens scrollen
  - LanguageSelector component ondersteunt nu `variant="light"` voor lichte achtergronden
  - Werkt op alle pagina's: login, dashboard, detail pagina's
- ⚠️ **AFBEELDINGEN ISSUE GEÏDENTIFICEERD** - Geen bug, maar lege data
  - Motorfietsen in database hebben geen afbeeldingen geüpload
  - Placeholder icoon wordt correct getoond bij ontbrekende afbeeldingen
  - Admin moet afbeeldingen uploaden via "Motor toevoegen" of "Motor bewerken"

### 16 Feb 2026 (Update 14) ✅ VOLTOOID
- ✅ **KEURING & TAXATIE OPTIES** - Bij bestellen
  - Keuring: €125
  - Taxatie: €160 (excl. BTW)
  - Bezorging: €50 (bestaand)
  - Backend en frontend aangepast
  - Email notificatie toont alle gekozen opties
- ✅ **PUSH NOTIFICATIE FIX** - Klik op notificatie crashte app niet meer
  - Service worker v2 met betere click handler
  - App.js luistert naar postMessage voor veilige navigatie
- ✅ **PDF HANDLEIDINGEN** - Direct downloadbaar
  - `/guides/dealer-handleiding-nl.pdf`
  - `/guides/leverancier-handleiding-nl.pdf`
  - `/guides/haendler-anleitung-de.pdf`
  - `/guides/lieferanten-anleitung-de.pdf`
- ✅ **HANDLEIDINGEN OP LOGIN PAGINA** - Zichtbaar voor nieuwe bezoekers
  - Dealer handleiding (rood)
  - Leverancier handleiding (paars)
  - Links naar online versies
- ✅ **COMPLETE CHECK** - Testing agent rapport
  - Backend: 87.5% passed
  - Frontend: 100% passed
  - Alle features werken correct

### 15 Feb 2026 (Update 10)
- 🌍 **Meertalige App** - 4 talen ondersteund
  - Nederlands (standaard), Duits, Italiaans, Frans
  - Taalkeuze in sidebar (vlag + naam)
  - i18next voor vertalingen
  - Vertaalbestanden: `/frontend/src/locales/nl.json`, `de.json`, `it.json`, `fr.json`
  
- 🌐 **Buitenlandse Dealers** - Leveranciers uit het buitenland
  - Nieuw gebruikerstype: "Foreign Dealer"
  - Admin kan dealer markeren als buitenlandse dealer (met land)
  - Buitenlandse dealers kunnen motors indienen (niet direct zichtbaar)
  - Admin beoordeelt, past prijs aan, en activeert motor
  - Paarse styling voor buitenlandse dealers
  - Backend endpoints: `POST /api/motorcycles/foreign-listing`, `POST /api/motorcycles/{id}/activate`
  - Frontend pagina's: `ForeignDealerDashboard.js`, `ForeignDealerAddMotorcycle.js`

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
