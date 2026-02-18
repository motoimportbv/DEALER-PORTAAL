# Moto Import - Motorcycle Dealer Platform

## Original Problem Statement
A comprehensive application for a motorcycle dealership network "Moto Import". The platform supports an Admin who manages inventory and users, and two types of dealers: local Dealers who can buy, and Foreign Dealers who act as suppliers.

## User Roles
- **Admin**: Manage motorcycles, dealers, orders, parts, approve foreign dealer submissions
- **Dealer**: Register, view catalog, order motorcycles, list own motorcycles for sale
- **Foreign Dealer**: Register and submit motorcycles for admin approval (specific rules apply)

## Core Features
- Motorcycle catalog with search/filter
- Order management system
- Parts shop (admin managed)
- Push notifications
- Multi-language support (NL, DE, FR, IT)
- JWT Authentication

---

## Completed Features (February 2025)

### Session - December 2025 (Lead Generation)

#### ✅ Motordealers Lijst Milaan en Omgeving (P0 Taak)
- **Taak**: Uitgebreide lijst van motordealers met e-mailadressen voor marketing
- **Focus gebied**: Milaan, Monza-Brianza, Bergamo en omliggende provincies
- **Resultaat**: CSV bestand met **57 dealers** (was 22)
- **Nieuwe dealers toegevoegd**:
  - **Milano stad**: Moto Crea, Giovanelli Moto (4 contacten), CMTmotor, Francone Moto, MaMaMoto, Moto 39, Ducati Milano (4 contacten)
  - **Milano provincie**: Ducati Sesto S.G. (3 contacten), Pogliani, MG Moto (Cormano), MV Moto (Rho), CMTmotor Rozzano
  - **Monza-Brianza**: Giava Motors, Valtermoto Group, CMTmotor Monza, Motosalone Cavallotti
  - **Bergamo**: Triumph, RS Moto Honda, Dall'Ara Moto, Dall'Ara Ezio, Farioli SRL (KTM)
- **Bestand**: `/app/backend/uploads/Motorzaken_Noord_Italie.csv`
- **Status**: Voltooid ✓

### Session - 18 February 2025 (Part 6)

#### ✅ Bestelling Verwijderen voor Dealers (P0 Feature)
- **Feature**: Dealers kunnen nu hun eigen bestellingen verwijderen van de "Mijn Bestellingen" pagina
- **Backend Endpoint**: `DELETE /api/orders/{order_id}`
  - Dealers kunnen alleen hun eigen bestellingen verwijderen
  - Admins kunnen elke bestelling verwijderen
  - Motor wordt weer beschikbaar na verwijdering
- **Frontend Updates**:
  - Rode "Verwijderen" knop bij elke bestelling
  - Bevestigingsdialoog met motor naam (indien beschikbaar)
  - Success toast "Succesvol verwijderd" na verwijdering
  - Bestelling verdwijnt direct uit de lijst
- **Test Status**: 100% geslaagd (backend en frontend)

#### ✅ Bestelling Archiveren Functie (Verbetering)
- **Feature**: Dealers kunnen bestellingen archiveren in plaats van permanent verwijderen
- **Backend Endpoints**:
  - `PUT /api/orders/{order_id}/archive` - Archiveert een bestelling
  - `PUT /api/orders/{order_id}/restore` - Herstelt een gearchiveerde bestelling
  - `GET /api/orders/archived` - Haalt gearchiveerde bestellingen op
  - `GET /api/orders` - Filtert nu gearchiveerde bestellingen uit
- **Frontend Updates**:
  - Amber "Archiveren" knop naast de verwijderknop
  - "Bekijk Archief" knop rechtsboven op de bestellingen pagina
  - Nieuwe pagina `/dealer/orders/archived` met gearchiveerde bestellingen
  - Grayscale effect en "Gearchiveerd" badge op gearchiveerde bestellingen
  - Groene "Herstellen" knop om bestellingen te herstellen
  - Bevestigingsdialogen voor archiveren en herstellen
- **Test Status**: 100% geslaagd (backend en frontend)

#### ✅ CHF Wisselkoers Integratie (Verbetering)
- **Feature**: Real-time CHF naar EUR conversie voor buitenlandse (Zwitserse) dealers
- **Backend Endpoints**:
  - `GET /api/exchange-rate/chf-eur` - Haalt huidige wisselkoers op
  - `GET /api/exchange-rate/margin` - Haalt huidige marge op
  - `PUT /api/exchange-rate/margin` - Admin past marge aan (0-50%)
  - `POST /api/exchange-rate/convert` - Converteert bedragen
  - `GET /api/motorcycles/available` - Live EUR prijzen voor CHF motors
- **Exchange Rate API**: exchangerate-api.com (gratis, 5 min cache)
- **Marge Systeem**:
  - Standaard: **0% marge** (pure wisselkoers)
  - Admin kan marge aanpassen via `/admin/exchange-rate` indien gewenst
  - Admin vult verkoopprijzen handmatig in bij activeren
- **Live Prijzen voor Dealers**:
  - Nederlandse dealers zien real-time EUR prijzen
  - Prijzen bewegen mee met CHF/EUR koers
  - "🟢 Live wisselkoers" indicator bij CHF motors
  - Zowel EUR als originele CHF prijs worden getoond
- **Frontend Updates**:
  - CHF/EUR dropdown in buitenlandse dealer formulier
  - Real-time EUR conversie preview
  - Admin pagina `/admin/exchange-rate` met koers overzicht
  - Catalogus en detail pagina's tonen beide prijzen + live indicator
- **Test Status**: Volledig getest, live prijzen werken correct

### Session - 17 February 2025 (Part 5)

#### ✅ RDW Document Upload voor Kentekens
- **Feature**: Admin kan RDW documenten uploaden bij kentekens
- **Ondersteunde formaten**: PDF, JPG, PNG, WEBP
- **Max bestandsgrootte**: 10MB
- **Backend Endpoints**:
  - `POST /api/license-plates/{plate_id}/document` - Upload document
  - `DELETE /api/license-plates/{plate_id}/document` - Verwijder document
- **Opslag**: `/app/backend/uploads/rdw/` met unieke bestandsnamen
- **Frontend Updates**:
  - "RDW Document Uploaden" knop bij kentekens zonder document
  - Groene badge met bestandsnaam bij kentekens met document
  - Download knop (opent in nieuw tabblad)
  - Verwijder knop (met bevestigingsdialoog)
- **Bestanden gewijzigd**:
  - `/app/backend/server.py` (upload/delete endpoints)
  - `/app/frontend/src/pages/admin/AdminLicensePlates.js`
- **Test Status**: 100% geslaagd (16 backend tests, alle frontend tests)

#### ✅ Dealer Online Notificatie
- **Feature**: Dealers ontvangen automatisch een notificatie wanneer ze weer online worden gezet
- **Notificatie tekst**: "Goed nieuws! Wij waren bezig met een update en alles is nu afgerond. Uw account is weer online en u kunt weer volop gebruik maken van het platform."
- **Push notificatie**: "Account weer online! ✅" met auto-login link
- **In-app notificatie**: Zichtbaar in het notificatiepaneel
- **Bestanden gewijzigd**:
  - `/app/backend/server.py` (toggle_dealer_offline endpoint uitgebreid)

### Session - 17 February 2025 (Part 4)

#### ✅ Dealer Filters met Voorraad Telling
- Zoekbalk vervangen door merk/type dropdown filters
- Filters tonen aantal op voorraad: "BMW (1)", "Honda (2)", etc.
- "X motoren gevonden" resultaat telling

#### ✅ Mobiele Uitlog Knop
- Rode uitlog knop toegevoegd aan mobiele header
- Werkt voor admin en dealers

#### ✅ Admin Dashboard Verbeteringen
- KPI kaarten zijn nu klikbaar (linken naar relevante pagina's)
- Dealers telling gefixd (was 0, nu correct)
- Orders filter: alleen laatste 24 uur zichtbaar voor admin

#### ✅ Alle URLs naar Productie
- Push notificaties → www.motoimportbv.nl
- E-mail links → www.motoimportbv.nl
- WhatsApp links → www.motoimportbv.nl

#### ✅ Verwijderde Features
- SMS functie uit admin motoren pagina
- "Bekijk Pakbon Online" link uit e-mails
- Persoonlijke Login Link component

#### ✅ Bestel Dialog Scroll Fix
- Dealers kunnen nu scrollen in de bestelpopup op mobiel

### Session - 17 February 2025 (Part 3)

#### ✅ Short Code Permanent Login System (P0 Feature)
- **Problem**: Previous permanent login attempts (`?token=` and `/login/TOKEN`) failed on iOS when bookmarked
- **Solution**: Implemented short code system using `/go/{SHORT_CODE}` URL format
- **Features**:
  - 8-character alphanumeric codes (excluding confusing chars: 0, O, I, 1, L)
  - Codes stored in user profile (`login_short_code` field)
  - Case-insensitive code matching
  - Frontend page at `/go/:code` auto-logs in and redirects to `/dealer`
  - UI component shows link in dealer dashboard with copy/regenerate/revoke options
  - Security warning displayed to users about not sharing the link
- **Backend Endpoints**:
  - `POST /api/auth/generate-permanent-link` - Generate short code
  - `GET /api/auth/shortcode/{code}` - Verify code validity
  - `POST /api/auth/shortcode-login` - Exchange code for session token
  - `GET /api/auth/my-permanent-link` - Get user's current permanent link
  - `POST /api/auth/revoke-permanent-link` - Revoke the permanent link
- **Files Modified**:
  - `/app/backend/server.py` (short code functions and endpoints)
  - `/app/frontend/src/pages/ShortCodeLoginPage.js` (NEW)
  - `/app/frontend/src/App.js` (new route)
  - `/app/frontend/src/components/PermanentLoginLink.js`
- **Test Status**: 100% passed (12 backend tests, all frontend tests)

### Session - 17 February 2025 (Part 2)

#### ✅ Push Notification Click Fix (P0 Bug Fix)
- **Issue**: Dealers were forced to re-login when clicking a push notification
- **Root Cause**: Service worker's `notificationclick` handler was opening new windows incorrectly, causing auth state loss
- **Solution**: 
  - Updated service worker to prioritize focusing existing tabs
  - Added `NotificationHandler` React component for React Router navigation
  - Navigation now uses `navigate()` instead of `window.location.href`
  - Service worker version bumped to v4
- **Files Modified**:
  - `/app/frontend/public/service-worker.js`
  - `/app/frontend/src/App.js`

### Session - 17 February 2025 (Part 1)

#### ✅ License Plates (Kentekens) System
- Admin can add license plates to dealers
- Admin can edit/delete license plates
- Admin can search by plate, dealer, chassis number
- Dealers see their assigned plates in "Mijn Kentekens"
- Notification sent to dealer when plate is added
- Dutch-style yellow license plate display

#### ✅ Chassis Number (VIN) Field
- Added required chassis_number field to all motorcycle forms
- Admin, Dealer, and Foreign Dealer forms updated
- Auto-uppercase, max 17 characters
- Admin can also set license_plate on motorcycles

#### ✅ Photo Lightbox on Motorcycle Detail
- Dealers can click photos to enlarge
- Navigation arrows, thumbnails, counter
- Works on desktop and mobile

#### ✅ Security Fix: Offline Dealers Blocked
- Dealers set to "offline" are now blocked from all functionality
- Error message: "Uw account is tijdelijk offline gezet door de beheerder. Neem contact op met Moto Import."
- Blocked endpoints: catalog, orders, buy-now, payments, etc.

#### ✅ Foreign Dealer Registration Improvements
- Direct link: `/register/supplier` for foreign dealers
- Default language set to German
- Language order: Deutsch → Italiano → Français → Nederlands
- Custom language selector on registration page

#### ✅ Searchable Dropdowns (UX Improvement)
- Brand, Model, and Year fields now have searchable dropdowns
- Type to filter (e.g., "Y" jumps to Yamaha)
- Implemented across all motorcycle forms:
  - Admin: `/admin/motorcycles/new`
  - Dealer: `/dealer/sell`
  - Foreign Dealer: `/foreign-dealer/add`
- New component: `/frontend/src/components/ui/searchable-select.jsx`

#### ✅ Simplified Activation Modal
- Removed "Minimum biedprijs" field from foreign motorcycle approval
- Only one price field (Verkoopprijs) now required

#### ✅ Order Photo Lightbox
- Photos in "Mijn Bestellingen" are now clickable
- Full lightbox with:
  - Large photo view
  - Navigation arrows (left/right)
  - Thumbnail strip
  - Photo counter (1/3)
  - Close button
- Works on both desktop and mobile
- Motorcycle snapshot saved with order (photos preserved even if motorcycle deleted)

### Previous Sessions
- White screen bug fix on motorcycle detail page
- Removed all bidding terminology from UI
- "Always On" server fix for UptimeRobot (HEAD request support)
- Brand/Model/Year dropdowns with motoroccasion.nl data
- Multi-step wizard for parts management
- Foreign dealer business rules (no voucher, specific notifications, CHF label)

---

## Foreign Dealer Business Rules
1. ❌ No welcome voucher on approval
2. ❌ No notifications for new motorcycles in catalog
3. ✅ Receive notification when their motorcycle is sold
4. ✅ Form shows "Vraagprijs (CHF) *" instead of EUR

---

## Technical Stack
- **Backend**: FastAPI, MongoDB (motor), Pydantic, JWT Auth
- **Frontend**: React, React Router, TailwindCSS, Axios, Shadcn/UI
- **Notifications**: Web Push (pywebpush)
- **Email**: Gmail SMTP

---

## Key Files Modified (This Session)
- `/app/backend/server.py` (DELETE /api/orders/{order_id}, archive/restore endpoints)
- `/app/frontend/src/pages/dealer/DealerOrders.js` (delete/archive buttons, dialogs)
- `/app/frontend/src/pages/dealer/DealerArchivedOrders.js` (NEW - archived orders page)
- `/app/frontend/src/App.js` (route for /dealer/orders/archived)
- `/app/frontend/src/locales/nl.json` (orders vertalingen voor delete/archive/restore)
- `/app/backend/tests/test_delete_order.py` (NEW - tests)
- `/app/backend/tests/test_archive_orders.py` (NEW - tests)

---

## Technical Debt / Future Tasks

### P1 - High Priority
- Native app build (iOS/Android) - guide exists at `NATIVE_APP_BUILD_GUIDE.md`
- Frontend refactoring: extract MOTORCYCLE_DATABASE to shared hook/data file
- Extract parts wizard from AdminParts.js to separate component

### P2 - Medium Priority
- Backend refactoring: split server.py into routers/services
- Remove obsolete Bid model and auction code
- Replace hardcoded VAPID keys with environment variables
- Clean up abandoned permanent login implementations (token URL params, `/login/:token` route)
- Simplify AuthContext.js (multiple login/token strategies accumulated)

---

## Test Credentials
- **Admin**: `motoimportbv@gmail.com` / `Enolim12`
- **Test Dealer**: `zoektest@dealer.nl` / `ZoekTest123!`
- **Foreign Dealer**: `testdealer@germany.de` / `Test1234!`

---

## URLs
- **Foreign Dealer Registration**: `/register/supplier` (or `?lang=de|it|fr|nl`)
- **Preview**: https://moto-import-dealer.preview.emergentagent.com
