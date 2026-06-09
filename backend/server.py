"""
Moto Import - Main Server
Lean orchestrator that imports all modular routers and sets up the FastAPI application.
"""
from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import asyncio
from datetime import datetime, timezone

from config import UPLOAD_DIR, ADMIN_EMAILS_FULL, ALLOWED_ADMIN_EMAIL_TAXATIE, logger
from database import db, client
from services import init_storage, send_email
from models import PartCategory
from routers import all_routers

# Create the main app
app = FastAPI(title="Moto Import API")
api_router = APIRouter(prefix="/api")


# ============ ROOT & HEALTH ============

@api_router.get("/")
async def root():
    return {"message": "Moto Import API is running"}

@api_router.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    try:
        await db.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "degraded", "database": "error", "detail": str(e)}


# ============ INCLUDE ALL ROUTERS ============

for router in all_routers:
    api_router.include_router(router)


# ============ MOUNT ============

app.include_router(api_router)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


# ============ STARTUP ============

@app.on_event("startup")
async def startup_db_client():
    """Initialize database with default data"""
    try:
        if init_storage():
            logger.info("Cloud storage initialized successfully")
        else:
            logger.warning("Cloud storage not available - using MongoDB fallback")
    except Exception as e:
        logger.error(f"Failed to initialize cloud storage: {e}")

    default_categories = [
        {"name": "Uitlaten", "description": "Uitlaatsystemen en onderdelen"},
        {"name": "Tanktassen", "description": "Tanktassen en bevestigingen"},
        {"name": "Koffers", "description": "Zijkoffers en topkoffers"},
        {"name": "Luxe Zadels", "description": "Comfort en luxe zadels"}
    ]
    for cat in default_categories:
        existing = await db.part_categories.find_one({"name": cat["name"]})
        if not existing:
            category = PartCategory(name=cat["name"], description=cat["description"])
            await db.part_categories.insert_one(category.model_dump())
            logger.info(f"Created default category: {cat['name']}")

    # Import background tasks from routers that define them
    from routers.motorcycles import auto_delete_expired_motorcycles
    from routers.wanted import expire_wanted_requests

    asyncio.create_task(auto_delete_expired_motorcycles())
    asyncio.create_task(expire_wanted_requests())
    asyncio.create_task(monthly_taxatie_reminder())
    asyncio.create_task(monthly_taxateur_report_task())

    # Pre-warm AutoTelex login so first /api/admin/autotelex/search is fast
    # Note: disabled — warmup races with first request via cached context
    # try:
    #     from services.autotelex_scraper import warmup as autotelex_warmup
    #     asyncio.create_task(autotelex_warmup())
    # except Exception as e:
    #     logger.warning(f"Could not start AutoTelex warmup: {e}")

    # Migrate pakbon role for Ellen
    await db.users.update_many(
        {"email": {"$regex": "^ellenmilone@gmail\\.com$", "$options": "i"}},
        {"$set": {"role": "pakbon"}}
    )

    # Migrate old taxatie_invoices to new motoimport bv / NL09 BUNQ IBAN (Feb 2026)
    iban_mig = await db.taxatie_invoices.update_many(
        {"$or": [
            {"bank_iban": "NL84BUNQ2159356875"},
            {"bank_iban": "NL03SNSB8846497880"},
            {"bank_name": "S. Milone"},
        ]},
        {"$set": {"bank_name": "motoimport bv", "bank_iban": "NL09BUNQ2159361135"}}
    )
    if iban_mig.modified_count:
        logger.info(f"Migrated {iban_mig.modified_count} taxatie invoices to motoimport bv / NL09 BUNQ")


async def monthly_taxatie_reminder():
    """Background task: sends monthly email on the 1st with pending taxatie invoices"""
    while True:
        try:
            now = datetime.now(timezone.utc)
            if now.day == 1 and now.hour == 8 and now.minute < 5:
                month_key = now.strftime("%Y-%m")
                already_sent = await db.system_tasks.find_one({"task": "taxatie_reminder", "month": month_key})
                if not already_sent:
                    pending = await db.taxatie_invoices.find(
                        {"status": {"$in": ["concept", "open"]}}, {"_id": 0}
                    ).to_list(500)
                    if pending:
                        concept_count = sum(1 for p in pending if p.get("status") == "concept")
                        open_count = sum(1 for p in pending if p.get("status") == "open")
                        invoice_rows = ""
                        for inv in pending[:20]:
                            status_color = "#d97706" if inv["status"] == "open" else "#6b7280"
                            status_label = "Open" if inv["status"] == "open" else "Concept"
                            invoice_rows += f"""
                            <tr>
                                <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">#{inv.get('invoice_number', '-')}</td>
                                <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">{inv.get('customer_name', '-')}</td>
                                <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">{inv.get('motorcycle_brand', '')} {inv.get('motorcycle_model', '')}</td>
                                <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: {status_color}; font-weight: bold;">{status_label}</td>
                            </tr>"""
                        html_content = f"""
                        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                            <div style="background: #dc2626; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                                <h1 style="color: white; margin: 0;">Taxatie Facturen Herinnering</h1>
                            </div>
                            <div style="padding: 30px; background: white; border: 1px solid #eee;">
                                <p>Beste,</p>
                                <p>Er staan <strong>{len(pending)}</strong> taxatie facturen open die nog verstuurd moeten worden:</p>
                                <ul>
                                    <li><strong>{concept_count}</strong> concept facturen</li>
                                    <li><strong>{open_count}</strong> open facturen</li>
                                </ul>
                                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                    <thead>
                                        <tr style="background: #f3f4f6;">
                                            <th style="padding: 8px 12px; text-align: left;">Nr.</th>
                                            <th style="padding: 8px 12px; text-align: left;">Klant</th>
                                            <th style="padding: 8px 12px; text-align: left;">Motor</th>
                                            <th style="padding: 8px 12px; text-align: left;">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>{invoice_rows}</tbody>
                                </table>
                                <p>Ga naar het admin panel om de facturen te bekijken en te versturen.</p>
                            </div>
                        </div>
                        """
                        await send_email(ALLOWED_ADMIN_EMAIL_TAXATIE, f"Taxatie Facturen: {len(pending)} openstaand", html_content)
                        logger.info(f"Sent monthly taxatie reminder with {len(pending)} pending invoices")
                    await db.system_tasks.insert_one({"task": "taxatie_reminder", "month": month_key, "sent_at": now.isoformat()})
        except Exception as e:
            logger.error(f"Error in monthly_taxatie_reminder: {e}")
        await asyncio.sleep(300)


async def monthly_taxateur_report_task():
    """Background task: stuurt op de 1e van elke maand om ~08:00 UTC (09:00 NL-tijd)
    een maandrapport met aantal taxatie-rapporten per taxateur."""
    from services.taxateur_stats import send_monthly_taxateur_report
    while True:
        try:
            now = datetime.now(timezone.utc)
            if now.day == 1 and now.hour == 8 and now.minute < 5:
                month_key = now.strftime("%Y-%m")
                already_sent = await db.system_tasks.find_one(
                    {"task": "monthly_taxateur_report", "month": month_key}
                )
                if not already_sent:
                    await send_monthly_taxateur_report(now)
                    await db.system_tasks.insert_one({
                        "task": "monthly_taxateur_report",
                        "month": month_key,
                        "sent_at": now.isoformat(),
                    })
        except Exception as e:
            logger.error(f"Error in monthly_taxateur_report_task: {e}")
        await asyncio.sleep(300)


# ============ SHUTDOWN ============


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()