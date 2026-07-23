# Routers module
# Importeert alle routers voor gebruik in server.py

from routers.exchange import router as exchange_router
from routers.auth import router as auth_router
from routers.dealers import router as dealers_router
from routers.motorcycles import router as motorcycles_router
from routers.orders import router as orders_router
from routers.payments import router as payments_router
from routers.uploads import router as uploads_router
from routers.bids import router as bids_router
from routers.wanted import router as wanted_router
from routers.proposals import router as proposals_router
from routers.notifications import router as notifications_router
from routers.admin import router as admin_router
from routers.parts import router as parts_router
from routers.license_plates import router as license_plates_router
from routers.private_listings import router as private_listings_router
from routers.reviews import router as reviews_router
from routers.taxatie import router as taxatie_router
from routers.google_motors import router as google_motors_router
from routers.autotelex import router as autotelex_router
from routers.bpm_ai import router as bpm_ai_router
from routers.customers import router as customers_router
from routers.taxatie_aanvraag import router as taxatie_aanvraag_router
from routers.leads import router as leads_router
from routers.email_tracking import router as email_tracking_router
from routers.motodirect import router as motodirect_router

all_routers = [
    exchange_router,
    auth_router,
    dealers_router,
    motorcycles_router,
    orders_router,
    payments_router,
    uploads_router,
    bids_router,
    wanted_router,
    proposals_router,
    notifications_router,
    admin_router,
    parts_router,
    license_plates_router,
    private_listings_router,
    reviews_router,
    taxatie_router,
    google_motors_router,
    autotelex_router,
    bpm_ai_router,
    customers_router,
    taxatie_aanvraag_router,
    leads_router,
    email_tracking_router,
    motodirect_router,
]
