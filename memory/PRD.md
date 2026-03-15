# Moto Import - Product Requirements Document

## Original Problem Statement
Full-stack motorcycle dealership platform for "Moto Import" dealer network. React frontend + FastAPI backend + MongoDB.

## Core Features (Implemented)
- Admin motorcycle CRUD with purchase price, margin calculation
- Dealer dashboard with email preferences, price proposal workflow
- License plate (kenteken) management with RDW document upload/download
- Transport status tracking for orders
- Price reduction email notifications
- Extra cost options (inspection, appraisal, delivery) on proposals
- Relist sold motorcycles feature
- Marketing email/flyer system
- Expanded model variants (Honda CRF, BMW R 1300 GS series)
- Pakbon role for warehouse/logistics (ellenmilone@gmail.com)
- Pakbon voltooien + MoneyMonk factuur knoppen

## User Roles
- **admin** - Full access to all features
- **dealer** - Browse motorcycles, make proposals, manage orders
- **foreign_dealer** - Add motorcycles from abroad
- **pakbon** - View and print packing slips ONLY (ellenmilone@gmail.com / Pakbon2024!)

## Architecture
```
/app/backend/server.py     - Monolithic FastAPI backend
/app/frontend/src/pages/   - React pages (admin/, dealer/, pakbon/)
MongoDB: test_database
```

## Completed (This Session - March 2026)
- [x] BMW R 1300 GS models verified in admin form
- [x] Dealer license plate document download/view feature
- [x] Pakbon role for ellenmilone@gmail.com with restricted dashboard
- [x] Route protection: pakbon users cannot access /dealer or /admin
- [x] Case-insensitive login (email)
- [x] Pakbon "Voltooien" button to mark packing slips as completed
- [x] "Factuur in MoneyMonk" button on pakbon page
- [x] Completed pakbonnen shown with green badge on dashboard
- [x] Orders sorted newest first on pakbon dashboard
- [x] Auto-migration of Ellen's role on server startup

## P0/P1 Issues
- [ ] AI Welcome Message non-functional (Emergent LLM Key budget exhausted)
- [ ] Email flyer delivery on production (user verification pending)

## P1 Upcoming
- [ ] WhatsApp notifications integration
- [ ] Emergent LLM Key budget - user needs to add funds
- [ ] MoneyMonk direct API integration (requires API key from MoneyMonk)

## P2 Backlog
- [ ] Add specific costs to proposal options
- [ ] Pre-fill proposal options when admin accepts
- [ ] Confirmation dialog for relisting motorcycles
- [ ] Flyers download page for dealers
- [ ] Backend refactoring (break server.py into routers)
