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

### Session - 17 February 2025

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
- **Preview**: https://motorcycles-portal.preview.emergentagent.com
