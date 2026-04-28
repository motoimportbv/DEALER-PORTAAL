"""BPM Verlaging onderbouwing - AI text generation per rapport."""
import os
import logging
import uuid
from fastapi import APIRouter, Body, HTTPException, Depends
from emergentintegrations.llm.chat import LlmChat, UserMessage
from services.auth_service import require_admin

logger = logging.getLogger(__name__)
router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


@router.post("/admin/bpm/generate-onderbouwing")
async def generate_bpm_onderbouwing(
    body: dict = Body(...),
    user: dict = Depends(require_admin),
):
    """Generate unique Dutch onderbouwing text for a BPM taxatierapport using Claude.
    Body: {brand, model, year, mileage, damage_items: [{name, cost}], target_bpm, total_herstelkosten}
    Returns: {onderbouwing: "long text", samenvatting: "short text"}
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY niet geconfigureerd")

    brand = body.get("brand", "")
    model = body.get("model", "")
    year = body.get("year") or body.get("bouwjaar", "")
    mileage = body.get("mileage", 0)
    damage_items = body.get("damage_items", [])
    total_herstel = body.get("total_herstelkosten", 0)
    target_bpm = body.get("target_bpm", 0)
    bruto_bpm = body.get("bruto_bpm", 0)

    damage_lines = []
    for d in damage_items:
        if d.get("checked") and d.get("cost", 0) > 0:
            damage_lines.append(f"- {d.get('name')}: \u20ac{d.get('cost'):.0f}")
    damage_block = "\n".join(damage_lines) if damage_lines else "- (geen specifieke schade-items aangevinkt)"

    system_msg = (
        "Je bent een professionele BPM-taxateur in Nederland. "
        "Je schrijft gedetailleerde, technisch onderbouwde teksten voor BPM-taxatierapporten "
        "die voldoen aan de eisen van de Belastingdienst. Schrijf in vlot, formeel Nederlands."
    )

    prompt = f"""Schrijf een unieke onderbouwing voor een BPM-taxatierapport voor onderstaande motorfiets.

Voertuig:
- Merk en model: {brand} {model}
- Bouwjaar: {year}
- Kilometerstand: {mileage:,} km

Vastgestelde schade en gebreken:
{damage_block}

Totale herstelkosten: \u20ac{total_herstel:,.0f}
Bruto BPM: \u20ac{bruto_bpm:,.0f}
Vastgestelde rest-BPM na taxatie: \u20ac{target_bpm:,.0f}

OPDRACHT:
1. Schrijf 2 tot 3 alinea's professionele technische onderbouwing waarom de waarde zo laag is uitgekomen.
2. Per aangevinkt schade-item: 1 zin technisch beschrijvend (bv. "De voorvork vertoont olielekkage met zichtbare aanslag op de stofkappen, hetgeen revisie of vervanging noodzakelijk maakt.").
3. Sluit af met een conclusie waarom de gevraagde rest-BPM redelijk is gezien de staat.
4. Wees creatief en gevarieerd: GEBRUIK GEEN STANDAARDZINNEN. Elke onderbouwing moet duidelijk anders klinken dan een vorige.
5. Vermijd: bullets, koppen, opsommingen. Alleen vloeiende paragrafen.
6. Lengte: 200-350 woorden.

Geef ALLEEN de onderbouwingstekst terug, geen JSON, geen titel."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"bpm-onderbouwing-{uuid.uuid4()}",
            system_message=system_msg,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        text = (response or "").strip()
        if not text:
            raise RuntimeError("Lege LLM response")
        return {"onderbouwing": text}
    except Exception as e:
        logger.exception("BPM onderbouwing generatie mislukt")
        raise HTTPException(status_code=502, detail=f"AI tekst genereren mislukt: {str(e)}")
