# Routers module
# Importeert alle routers voor gebruik in server.py

from routers.auth import router as auth_router
from routers.dealers import router as dealers_router

# Lijst van alle routers die in server.py worden geïncludeerd
all_routers = [
    auth_router,
    dealers_router,
]
