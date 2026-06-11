"""
OCR / Vision extractie van data uit taxatie-foto's via Gemini 3 Flash.

Per foto-veld een gerichte prompt zodat we structured JSON terug krijgen:
  - foto_chassisnummer → VIN
  - foto_km_stand      → kilometerstand
  - foto_kenteken_voor / _achter → kenteken + merk + model + bouwjaar + brandstof + CO2 + DET
  - foto_inkoop_verklaring → inkoopdatum + verkoper + bedrag
"""
import os
import json
import logging
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads", "taxatie_aanvragen")

# Welke field_keys we proberen te lezen + welke velden ze opleveren
PROMPTS = {
    "foto_chassisnummer": (
        "Dit is een foto van het chassisnummer (VIN) van een motorfiets. "
        "Lees het VIN-nummer exact (17 karakters, alleen hoofdletters en cijfers, "
        "geen letters I, O of Q). "
        "Antwoord ALLEEN als geldige JSON: {\"vin\": \"WB10K0303PZB12345\"} "
        "of {\"vin\": null} als het niet leesbaar is."
    ),
    "foto_km_stand": (
        "Dit is een foto van de kilometerteller van een motorfiets. "
        "Lees de kilometerstand af. "
        "Antwoord ALLEEN als geldige JSON: {\"kilometerstand\": \"14250\"} "
        "(alleen het getal, zonder 'km'). {\"kilometerstand\": null} als onleesbaar."
    ),
    "foto_kenteken_voor": (
        "Dit is een foto van de voorzijde van een Nederlands of buitenlands kentekenbewijs van een motorfiets. "
        "Extracteer de volgende velden indien zichtbaar: "
        "merk, model, bouwjaar (4 cijfers), kenteken, brandstof, "
        "cilinderinhoud (cc), vermogen (kW), CO2-uitstoot (g/km), kleur, "
        "datum eerste toelating (DET) in formaat YYYY-MM-DD. "
        "Antwoord ALLEEN als geldige JSON met deze keys: "
        "{\"merk\":..., \"model\":..., \"bouwjaar\":..., \"kenteken\":..., "
        "\"brandstof\":..., \"cilinderinhoud\":..., \"vermogen\":..., "
        "\"co2\":..., \"kleur\":..., \"det\":...}. "
        "Gebruik null voor velden die niet zichtbaar zijn."
    ),
    "foto_kenteken_achter": (
        "Dit is een foto van de achterzijde van een kentekenbewijs. "
        "Extracteer indien zichtbaar: VIN/chassisnummer (17 karakters), "
        "datum eerste toelating buitenland (formaat YYYY-MM-DD). "
        "Antwoord ALLEEN als geldige JSON: {\"vin\":..., \"det\":...}. "
        "Gebruik null voor velden die niet zichtbaar zijn."
    ),
    "foto_inkoop_verklaring": (
        "Dit is een foto van een inkoopfactuur of inkoopverklaring voor een geïmporteerde motorfiets. "
        "Extracteer indien zichtbaar: inkoopdatum (YYYY-MM-DD), verkoper-naam, "
        "inkoopbedrag (alleen getal in euro's), factuurnummer. "
        "Antwoord ALLEEN als geldige JSON: "
        "{\"inkoopdatum\":..., \"verkoper\":..., \"inkoopbedrag\":..., \"factuurnummer\":...}. "
        "Gebruik null voor velden die niet zichtbaar zijn."
    ),
}


def _resolve(filename: str) -> Optional[str]:
    p = os.path.join(UPLOAD_DIR, filename)
    return p if os.path.exists(p) else None


async def _ocr_one(field_key: str, file_path: str) -> dict:
    """Run Gemini Vision on a single file. Returns parsed JSON dict or empty."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY niet geconfigureerd")

    prompt = PROMPTS.get(field_key)
    if not prompt:
        return {}

    ext = os.path.splitext(file_path)[1].lower().lstrip(".")
    if ext == "jpg":
        ext = "jpeg"
    mime = {"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"ocr-{field_key}-{os.path.basename(file_path)}",
        system_message="Je bent een OCR-extractie engine. Antwoord ALLEEN met geldige JSON. Geen extra tekst.",
    ).with_model("gemini", "gemini-3-flash-preview")

    file_attach = FileContentWithMimeType(file_path=file_path, mime_type=mime)

    try:
        response = await chat.send_message(UserMessage(text=prompt, file_contents=[file_attach]))
    except AttributeError:
        # Fallback: streaming API
        from emergentintegrations.llm.chat import TextDelta, StreamDone
        buf = []
        async for ev in chat.stream_message(UserMessage(text=prompt, file_contents=[file_attach])):
            if isinstance(ev, TextDelta):
                buf.append(ev.content)
            elif isinstance(ev, StreamDone):
                break
        response = "".join(buf)

    # Strip code-fences if any
    txt = (response or "").strip()
    if txt.startswith("```"):
        # Remove ```json ... ``` fence
        txt = txt.strip("`")
        if txt.lower().startswith("json"):
            txt = txt[4:].strip()
    try:
        return json.loads(txt)
    except Exception as e:
        logger.warning(f"OCR JSON parse failed for {field_key}: {e}; raw={txt[:200]}")
        return {}


async def ocr_aanvraag(aanvraag: dict) -> dict:
    """
    Run OCR on all relevant photos in an aanvraag in parallel.
    Returns: {
      "voertuig": {merk, model, bouwjaar, vin, kilometerstand, brandstof, cilinderinhoud,
                   vermogen, co2, kleur, det, buitenlands_kenteken},
      "inkoop": {inkoopdatum, verkoper, inkoopbedrag, factuurnummer},
      "files_processed": [{field_key, success, raw}]
    }
    """
    files = [f for f in (aanvraag.get("files") or [])
             if isinstance(f, dict) and f.get("field_key") in PROMPTS]
    if not files:
        return {"voertuig": {}, "inkoop": {}, "files_processed": []}

    tasks = []
    targets = []
    for f in files:
        path = _resolve(f.get("filename") or "")
        if not path:
            continue
        tasks.append(_ocr_one(f["field_key"], path))
        targets.append(f["field_key"])

    results = await asyncio.gather(*tasks, return_exceptions=True)

    merged_voertuig = {}
    merged_inkoop = {}
    processed = []
    for field_key, res in zip(targets, results):
        if isinstance(res, Exception):
            logger.error(f"OCR error for {field_key}: {res}")
            processed.append({"field_key": field_key, "success": False, "raw": str(res)})
            continue
        if not isinstance(res, dict) or not res:
            processed.append({"field_key": field_key, "success": False, "raw": "empty"})
            continue
        processed.append({"field_key": field_key, "success": True, "raw": res})

        # Map to voertuig fields (later wins; kentekenbewijs > krasfoto)
        if field_key == "foto_inkoop_verklaring":
            for k in ("inkoopdatum", "verkoper", "inkoopbedrag", "factuurnummer"):
                v = res.get(k)
                if v is not None and str(v).strip().lower() not in ("none", "null", ""):
                    merged_inkoop[k] = v
        else:
            for k, v in res.items():
                if v is None or str(v).strip().lower() in ("none", "null", ""):
                    continue
                merged_voertuig[k] = v

    return {
        "voertuig": merged_voertuig,
        "inkoop": merged_inkoop,
        "files_processed": processed,
    }
