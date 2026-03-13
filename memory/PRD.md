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

## Architecture
```
/app/backend/server.py     - Monolithic FastAPI backend
/app/frontend/src/pages/   - React pages (admin/, dealer/)
MongoDB: test_database
```

## Completed (This Session - March 2026)
- [x] BMW R 1300 GS models verified in admin form (R 1300 GS, Adventure, Triple Black)
- [x] Dealer license plate document download/view feature (Bekijken + Downloaden buttons)
- [x] Fixed dealer password_hash field inconsistency

## P0/P1 Issues
- [ ] AI Welcome Message non-functional (Emergent LLM Key budget exhausted)
- [ ] Email flyer delivery on production (user verification pending)

## P1 Upcoming
- [ ] WhatsApp notifications integration
- [ ] Emergent LLM Key budget - user needs to add funds

## P2 Backlog
- [ ] Add specific costs to proposal options (inspection/appraisal/delivery pricing)
- [ ] Pre-fill proposal options when admin accepts
- [ ] Confirmation dialog for relisting motorcycles
- [ ] Flyers download page for dealers
- [ ] Backend refactoring (break server.py into routers)

## Key Credentials (Test)
- Admin: Daniel2002jay@hotmail.com
- Dealer: testdealer@motoimport.nl
- API: https://moto-manager-test.preview.emergentagent.com
