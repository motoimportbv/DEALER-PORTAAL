# Moto Import Backend

FastAPI backend voor het Moto Import dealer platform.

## Structuur

```
backend/
├── server.py           # Hoofd FastAPI applicatie (legacy - wordt gerefactored)
├── models/
│   ├── __init__.py
│   ├── database.py     # MongoDB connectie
│   └── schemas.py      # Pydantic models
├── services/
│   ├── __init__.py
│   ├── auth_service.py # JWT authenticatie
│   └── email_service.py# Gmail SMTP
├── routers/            # (toekomstig) API routers
│   └── __init__.py
└── requirements.txt
```

## Refactoring Status

De `server.py` (3200+ regels) wordt stapsgewijs opgesplitst:

### Fase 1 (Voltooid)
- ✅ Models gescheiden naar `models/schemas.py`
- ✅ Database connectie naar `models/database.py`
- ✅ Auth helpers naar `services/auth_service.py`
- ✅ Email helpers naar `services/email_service.py`

### Fase 2 (Gepland)
- [ ] Auth endpoints naar `routers/auth.py`
- [ ] Motorcycle endpoints naar `routers/motorcycles.py`
- [ ] Parts endpoints naar `routers/parts.py`
- [ ] Order endpoints naar `routers/orders.py`
- [ ] Dealer endpoints naar `routers/dealers.py`
- [ ] Push notification endpoints naar `routers/push.py`

### Fase 3 (Gepland)
- [ ] Verwijder ongebruikte Stripe endpoints
- [ ] Update server.py om routers te importeren
- [ ] Volledige migratie testen

## API Endpoints

Zie `/app/memory/PRD.md` voor complete API documentatie.

## Development

```bash
# Start backend (via supervisor)
sudo supervisorctl restart backend

# Check logs
tail -f /var/log/supervisor/backend.*.log

# Handmatig testen
curl https://motorcycles-portal.preview.emergentagent.com/api/
```
