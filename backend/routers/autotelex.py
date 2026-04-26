"""AutoTelex PRO scraper endpoints (admin only)."""
import logging
from fastapi import APIRouter, Body, HTTPException, Depends
from services.auth_service import require_admin
from services import autotelex_scraper

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/admin/autotelex/search")
async def search(
    body: dict = Body(...),
    user: dict = Depends(require_admin),
):
    """Search AutoTelex PRO for motorcycles matching brand + first registration date.
    Body: {brand, day, month, year, model_substring?}
    Returns: {results: [{execution, cc, kw_pk, gel_van, gel_tot, bpm, prijs}]}
    """
    brand = (body.get("brand") or "").strip()
    try:
        day = int(body.get("day"))
        month = int(body.get("month"))
        year = int(body.get("year"))
    except Exception:
        raise HTTPException(status_code=400, detail="Vul geldige datum (dag, maand, jaar) in")
    if not brand:
        raise HTTPException(status_code=400, detail="Merk is verplicht")
    model_sub = (body.get("model_substring") or "").strip()
    try:
        results = await autotelex_scraper.search_motors(brand, day, month, year, model_sub)
        return {"results": results, "count": len(results)}
    except Exception as e:
        logger.exception("AutoTelex search error")
        raise HTTPException(status_code=502, detail=f"AutoTelex zoek-fout: {str(e)}")


@router.post("/admin/autotelex/details")
async def details(
    body: dict = Body(...),
    user: dict = Depends(require_admin),
):
    """Click through to the detail page and fetch handelswaarde / verkoopwaarde / etc.
    Body: {brand, day, month, year, execution_name}
    Returns the detail values (best-effort).
    """
    brand = (body.get("brand") or "").strip()
    execution = (body.get("execution_name") or "").strip()
    try:
        day = int(body.get("day"))
        month = int(body.get("month"))
        year = int(body.get("year"))
    except Exception:
        raise HTTPException(status_code=400, detail="Vul geldige datum in")
    if not brand or not execution:
        raise HTTPException(status_code=400, detail="Merk en uitvoering zijn verplicht")
    try:
        d = await autotelex_scraper.lookup_with_details(brand, day, month, year, execution)
        return d
    except Exception as e:
        logger.exception("AutoTelex details error")
        raise HTTPException(status_code=502, detail=f"AutoTelex details-fout: {str(e)}")
