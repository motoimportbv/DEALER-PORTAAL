# Moto Import - Motorcycle Dealer Platform

## Original Problem Statement
A comprehensive application for a motorcycle dealership network "Moto Import". The platform supports an Admin who manages inventory and users, and two types of dealers: local Dealers who can buy, and Foreign Dealers who act as suppliers.

## User Roles
- **Admin**: Manage motorcycles, dealers, orders, parts, approve foreign dealer submissions
- **Dealer**: Register, view catalog, order motorcycles, list own motorcycles for sale
- **Foreign Dealer**: Register and submit motorcycles for admin approval

---

## Completed Features (February 2025)

### Session - 25 February 2025 (Backend Refactoring - Fase 2)

#### ✅ Auth Router Geëxtraheerd
- **Alle 15 auth endpoints verplaatst** van server.py naar `/routers/auth.py`
- **server.py**: 6317 → 5763 regels (-554 regels, -8.7%)
- **routers/auth.py**: 533 regels (nieuw)
- **Endpoints verplaatst**:
  - POST /auth/register
  - POST /auth/register-supplier
  - POST /auth/login
  - GET /auth/me
  - POST /auth/notification-login
  - POST /auth/accept-terms
  - POST /auth/generate-permanent-link
  - GET /auth/my-permanent-link
  - POST /auth/permanent-login
  - POST /auth/shortcode-login
  - GET /auth/shortcode/{code}
  - POST /auth/revoke-permanent-link
  - POST /auth/forgot-password
  - POST /auth/reset-password
  - POST /auth/change-password

### Session - 25 February 2025 (Backend Refactoring - Fase 1)

#### ✅ Backend Modulaire Structuur
- **Nieuwe bestanden**:
  - `config.py` (84 regels) - environment variables
  - `database.py` (37 regels) - MongoDB connectie
  - `services/auth_service.py` (136 regels)
  - `services/email_service.py` (99 regels)
  - `services/sms_service.py` (55 regels)
  - `services/storage_service.py` (65 regels)
  - `services/currency_service.py` (86 regels)
  - `models/schemas.py` (554 regels)

---

## Refactoring Voortgang

| Fase | Actie | Regels Verwijderd | Status |
|------|-------|-------------------|--------|
| 1 | Config, Database, Services, Models | 595 | ✅ Voltooid |
| 2 | Auth Router | 554 | ✅ Voltooid |
| 3 | Motorcycles Router | ~600 (geschat) | ⏳ TODO |
| 4 | Orders Router | ~200 (geschat) | ⏳ TODO |
| 5 | Dealers Router | ~250 (geschat) | ⏳ TODO |
| 6 | Admin Router | ~350 (geschat) | ⏳ TODO |
| 7 | Parts Router | ~400 (geschat) | ⏳ TODO |
| 8 | Overige Routers | ~1000 (geschat) | ⏳ TODO |

**Totaal gereduceerd tot nu toe: 1149 regels (16.6%)**
**server.py: 6912 → 5763 regels**

---

## Backend Architecture

```
/app/backend/
├── server.py              # 5763 regels (hoofdserver)
├── config.py              # Environment variables
├── database.py            # MongoDB connectie
│
├── routers/
│   ├── auth.py            # ✅ Auth endpoints (533 regels)
│   ├── motorcycles.py     # TODO
│   ├── orders.py          # TODO
│   ├── dealers.py         # TODO
│   ├── admin.py           # TODO
│   └── ...
│
├── services/
│   ├── auth_service.py
│   ├── email_service.py
│   ├── sms_service.py
│   ├── storage_service.py
│   └── currency_service.py
│
└── models/
    └── schemas.py         # Alle Pydantic models
```

---

## Test Credentials
- **Admin**: `motoimportbv@gmail.com` / `Enolim12`
- **Test Dealer**: `testdealer@motoimport.nl` / `MotoTest123!`

## URLs
- **Preview**: https://dealer-inventory-pro.preview.emergentagent.com
- **Production**: https://www.motoimportbv.nl

---

## Upcoming Tasks

### P1 - High Priority
1. **Verder Backend Refactoring** - Motorcycles, Orders, Dealers routers
2. **WhatsApp Notificaties** - Automatische berichten naar dealers

### P2 - Medium Priority
1. Marketing bestanden migreren naar permanente opslag
2. Flyers download pagina maken
3. Dealer analytics (conversie tracking)

---

## Known Issues
- AI Welcome Message niet actief (Emergent LLM Key budget overschreden)
- webpush code uitgeschakeld (package niet geïnstalleerd)
