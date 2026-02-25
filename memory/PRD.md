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
- Email notifications (automatic for Dutch dealers)
- Multi-language support (NL, DE, FR, IT)
- JWT Authentication

---

## Completed Features (February 2025)

### Session - 25 February 2025 (Backend Refactoring)

#### ✅ Backend Modulaire Structuur Geïmplementeerd
- **Taak**: `server.py` was 6912+ regels - te groot voor onderhoud
- **Nieuwe structuur**:
  ```
  /app/backend/
  ├── server.py          # 6316 regels (was 6912)
  ├── config.py          # 84 regels - alle environment variables
  ├── database.py        # 37 regels - MongoDB connectie
  ├── services/
  │   ├── auth_service.py      # 136 regels - JWT, passwords, dependencies
  │   ├── email_service.py     # 99 regels - Gmail SMTP
  │   ├── sms_service.py       # 55 regels - Twilio SMS
  │   ├── storage_service.py   # 65 regels - Emergent Object Storage
  │   └── currency_service.py  # 86 regels - CHF/EUR conversie
  └── models/
      └── schemas.py           # 554 regels - alle Pydantic models
  ```
- **Voordelen**:
  - Betere code organisatie en onderhoudbaarheid
  - Herbruikbare services (import uit één plek)
  - Makkelijker unit testen per module
  - ~600 regels verplaatst naar aparte bestanden
- **Status**: ✅ Voltooid en getest - alle API endpoints werken

#### ✅ Gebundelde Email Notificaties Geverifieerd
- **Functie**: Max 3 emails per dealer per dag
- **Logica**:
  - Nieuwe motors worden toegevoegd aan `pending_motorcycle_emails` queue
  - Emails worden gebundeld verzonden (meerdere motors in één email)
  - Dagelijkse limiet van 3 emails per dealer
  - Reset automatisch bij nieuwe dag
- **Status**: ✅ Getest en werkend

#### ✅ Emergent LLM Key Budget Gecommuniceerd
- **Probleem**: AI welkomstboodschap werkt niet (budget op)
- **Oplossing**: User geïnformeerd over Profile → Universal Key → Add Balance

---

### Session - 24-25 February 2025 (Performance & Features)

#### ✅ Cloud Image Migration
- Alle 550+ productie images gemigreerd van MongoDB naar Emergent Object Storage
- Image loading 12-18x sneller
- Thumbnails gegenereerd voor snellere previews

#### ✅ Dealer Activity Tracking
- Nieuwe endpoints: `/api/admin/activity-stats`, `/api/admin/activity-notifications`
- Admin krijgt real-time notificaties wanneer dealers motors bekijken
- Nieuwe component: `AdminActivityBell.js`

#### ✅ Foto's Herordenen
- Admin kan volgorde van foto's wijzigen in MotorcycleForm.js
- Up/down knoppen en "set as primary" functie

#### ✅ Orders 7 Dagen Zichtbaar
- Was 24 uur, nu 7 dagen

#### ✅ Motormodellen Uitgebreid
- BMW Adventure series toegevoegd
- Honda, Kawasaki en andere merken uitgebreid

---

## Technical Stack
- **Backend**: FastAPI, MongoDB (motor), Pydantic, JWT Auth
- **Frontend**: React, React Router, TailwindCSS, Axios, Shadcn/UI
- **Email**: Gmail SMTP
- **SMS**: Twilio
- **Images**: Emergent Object Storage

---

## Backend Architecture

### Config (`config.py`)
- PRODUCTION_BASE_URL
- JWT_SECRET, JWT_ALGORITHM
- Email config (ADMIN_EMAILS, GMAIL credentials)
- Stripe, Twilio config
- Exchange rate settings

### Database (`database.py`)
- MongoDB connection via motor
- Collection references

### Services
- **auth_service.py**: hash_password, verify_password, create_token, get_current_user, require_admin, require_approved_dealer
- **email_service.py**: send_email, send_email_with_attachment, send_admin_notification
- **sms_service.py**: send_sms, twilio_client
- **storage_service.py**: init_storage, put_object, get_object
- **currency_service.py**: get_chf_to_eur_rate, convert_chf_to_eur_with_margin

### Models (`models/schemas.py`)
- User models (UserCreate, User, SupplierCreate)
- Motorcycle models (Motorcycle, MotorcycleCreate, MotorcycleUpdate)
- Order models (Order, OrderCreate, OrderWithMotorcycle)
- Notification, Chat, Voucher, PriceProposal models
- WantedRequest, Part, PartOrder models
- Request models (SMSRequest, BulkEmailRequest, etc.)

---

## Test Credentials
- **Admin**: `motoimportbv@gmail.com` / `Enolim12`
- **Test Dealer**: `testdealer@motoimport.nl` / `MotoTest123!`

---

## URLs
- **Preview**: https://dealer-inventory-pro.preview.emergentagent.com
- **Production**: https://www.motoimportbv.nl

---

## Upcoming Tasks

### P1 - High Priority
1. **WhatsApp Notificaties** - Automatische berichten naar dealers
2. **Verdere Backend Refactoring** - Routes splitsen in aparte bestanden

### P2 - Medium Priority
1. Marketing bestanden migreren naar permanente opslag
2. Flyers download pagina maken
3. Dealer analytics (conversie tracking)

### P3 - Low Priority
1. Native app build (iOS/Android)
2. Push notification systeem herimplementeren (indien gewenst)

---

## Known Issues
- AI Welcome Message niet actief (budget overschreden)
- webpush code uitgeschakeld (package niet geïnstalleerd)
