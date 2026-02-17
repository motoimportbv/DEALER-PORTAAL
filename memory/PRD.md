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
- `/app/frontend/src/components/ui/searchable-select.jsx` (NEW)
- `/app/frontend/src/pages/SupplierRegisterPage.js`
- `/app/frontend/src/pages/admin/MotorcycleForm.js`
- `/app/frontend/src/pages/dealer/DealerSellMotorcycle.js`
- `/app/frontend/src/pages/foreign-dealer/ForeignDealerAddMotorcycle.js`
- `/app/frontend/src/pages/admin/PendingForeignListings.js`
- `/app/frontend/src/pages/dealer/DealerOrders.js`
- `/app/backend/server.py` (Order model + snapshot logic)

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

---

## Test Credentials
- **Admin**: `motoimportbv@gmail.com` / `Enolim12`
- **Test Dealer**: `zoektest@dealer.nl` / `ZoekTest123!`
- **Foreign Dealer**: `testdealer@germany.de` / `Test1234!`

---

## URLs
- **Foreign Dealer Registration**: `/register/supplier` (or `?lang=de|it|fr|nl`)
- **Preview**: https://motordealer-2.preview.emergentagent.com
