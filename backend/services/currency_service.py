# Currency Service
# Exchange rate management and conversions

import logging
import httpx
from datetime import datetime, timezone
from database import db
from config import EXCHANGE_RATE_CACHE_DURATION

logger = logging.getLogger(__name__)

# Default margin for CHF to EUR conversion (15%)
DEFAULT_CHF_EUR_MARGIN = 0.15

# Cache for exchange rates
exchange_rate_cache = {
    "CHF_EUR": None,
    "last_updated": None
}


async def get_chf_eur_margin() -> float:
    """Get the current CHF to EUR margin from database, or use default"""
    settings = await db.settings.find_one({"key": "chf_eur_margin"}, {"_id": 0})
    if settings and "value" in settings:
        return settings["value"]
    return DEFAULT_CHF_EUR_MARGIN


async def set_chf_eur_margin(margin: float):
    """Set the CHF to EUR margin in database"""
    await db.settings.update_one(
        {"key": "chf_eur_margin"},
        {"$set": {"key": "chf_eur_margin", "value": margin, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )


async def get_chf_to_eur_rate() -> float:
    """Get real-time CHF to EUR exchange rate with caching"""
    global exchange_rate_cache
    
    now = datetime.now(timezone.utc)
    
    # Check cache validity
    if (exchange_rate_cache["CHF_EUR"] is not None and 
        exchange_rate_cache["last_updated"] is not None and
        (now - exchange_rate_cache["last_updated"]).total_seconds() < EXCHANGE_RATE_CACHE_DURATION):
        return exchange_rate_cache["CHF_EUR"]
    
    try:
        # Use exchangerate-api.com (free tier: 1500 requests/month)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.exchangerate-api.com/v4/latest/CHF",
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                rate = data.get("rates", {}).get("EUR", 0.95)
                exchange_rate_cache["CHF_EUR"] = rate
                exchange_rate_cache["last_updated"] = now
                logger.info(f"Exchange rate updated: 1 CHF = {rate} EUR")
                return rate
    except Exception as e:
        logger.error(f"Failed to fetch exchange rate: {e}")
    
    # Fallback rate if API fails
    if exchange_rate_cache["CHF_EUR"] is not None:
        return exchange_rate_cache["CHF_EUR"]
    return 0.95  # Default fallback


async def convert_chf_to_eur_with_margin(chf_amount: float, rate: float) -> float:
    """Convert CHF to EUR with margin from database"""
    margin = await get_chf_eur_margin()
    base_conversion = chf_amount * rate
    return round(base_conversion * (1 + margin), 2)


def convert_chf_to_eur(chf_amount: float, rate: float, margin: float = 0) -> float:
    """Convert CHF to EUR with optional margin"""
    base_conversion = chf_amount * rate
    if margin > 0:
        return round(base_conversion * (1 + margin), 2)
    return round(base_conversion, 2)
