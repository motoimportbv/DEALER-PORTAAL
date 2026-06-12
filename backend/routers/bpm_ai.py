"""BPM Verlaging onderbouwing - AI text generation per rapport.

Productie-architectuur: async background task + polling.
Reden: Kubernetes/Nginx ingress sluit synchrone HTTP requests af na ~30s,
maar de Claude generatie duurt 20-40s. Daarom retourneert het POST endpoint
direct een task_id en draait de LLM-call op de achtergrond. De frontend
pollt vervolgens een status endpoint tot de tekst klaar is.
"""
import os
import logging
import uuid
import asyncio
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Body, HTTPException, Depends
from emergentintegrations.llm.chat import LlmChat, UserMessage
from services.auth_service import require_taxatie_access
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


# =====================================================================
# VARIATIE-POOLS — forceren dat elke onderbouwing compleet anders klinkt.
# Combinatoriek: 20 × 10 × 8 × 6 × 12 = 115.200 unieke style-combinaties,
# ruim boven de door de gebruiker gewenste 600.
# =====================================================================

_OPENERS = [
    "Begin met een objectieve beschrijving van de algehele technische conditie zoals aangetroffen tijdens de keuring.",
    "Open met een korte typering van het voertuig (bouwjaar, kilometerstand, gebruik) voordat je ingaat op de gebreken.",
    "Start direct met de meest waardedrukkende factor — vermeld deze in de eerste zin.",
    "Begin met een zin over het doel van deze taxatie (rest-BPM vaststellen conform artikel 10 Wet BPM).",
    "Open met een beschouwing over de marktpositie van dit merk/model voor het betreffende bouwjaar.",
    "Start met een zin die de complete technische inspectie samenvat in één overkoepelende indruk.",
    "Begin met een verwijzing naar het verschil tussen catalogusprijs en de werkelijke economische waarde.",
    "Open vanuit het perspectief van een potentiële koper die het voertuig op Marktplaats aantreft.",
    "Start met een observatie over de onderhoudshistorie en hoe deze zich verhoudt tot het kilometrage.",
    "Begin met een zin die de staat van het voertuig vergelijkt met een marktconform exemplaar in gemiddelde staat.",
    "Open met een korte chronologische schets: aankoop in buitenland, transport, aankomst, inspectie.",
    "Start met een zakelijke inleiding waarin je aankondigt dat onderstaande onderbouwing de vastgestelde rest-BPM rechtvaardigt.",
    "Begin met een observatie over cosmetische of structurele afwijkingen die direct opvielen.",
    "Open met de belangrijkste negatieve bevinding uit de technische inspectie.",
    "Start met de bedrijfseconomische realiteit: de kosten om dit voertuig verkoopklaar te maken.",
    "Begin door het voertuig te positioneren binnen de huidige importmarkt en daarna in te zoomen.",
    "Open met een zin over de combinatie van leeftijd, gebruikssporen en technische staat.",
    "Start met een samenvatting van de onderzoeksmethodiek (visuele inspectie, proefrit, historie-check).",
    "Begin met een typering van de geconstateerde gebreken in volgorde van ernst.",
    "Open door de waardevermindering uit te drukken als percentage ten opzichte van een schadevrij exemplaar.",
]

_TONES = [
    "zakelijk-formeel en beknopt, met korte directe zinnen",
    "uitvoerig-beschrijvend en analytisch, met lange zinnen en nuance",
    "technisch-objectief in de stijl van een onafhankelijk expertiserapport",
    "feitelijk-afstandelijk, alsof het een juridisch document betreft",
    "neutraal maar met lichte empathie voor de eigenaar",
    "vakinhoudelijk gedreven met veel technisch jargon",
    "helder-toegankelijk, zoals een taxateur aan een leek uitlegt",
    "gedocumenteerd-bureaucratisch met verwijzingen naar normen en regelingen",
    "compact-professioneel met focus op cijfers en economische impact",
    "kritisch-evaluerend waarbij elke bevinding wordt afgewogen",
]

_STRUCTURES = [
    "Structuur A: eerst algemene staat → daarna per schadepost met kostenonderbouwing → conclusie.",
    "Structuur B: eerst de meest impactvolle gebreken → daarna de kleinere posten → marktcontext → conclusie.",
    "Structuur C: chronologisch vanaf aankomst in Nederland → per onderdeel wat vervangen/hersteld moet worden → conclusie.",
    "Structuur D: begin met marktcontext → vervolg met technische gebreken → eindig met economische rechtvaardiging.",
    "Structuur E: groepeer gebreken thematisch (motor/veiligheid/optiek) → behandel per groep → conclusie.",
    "Structuur F: begin met een brede contextuele alinea → behandel alle schadeposten in één vloeiende alinea → korte conclusie.",
    "Structuur G: open met het eindoordeel → onderbouw vervolgens waarom dit oordeel terecht is.",
    "Structuur H: vergelijk met referentievoertuig → licht de afwijkingen toe → kwantificeer de impact.",
]

_VOCAB_PALETTES = [
    "Gebruik een woordenschat rond: 'geconstateerd', 'vastgesteld', 'bevinding', 'afwijking', 'tolerantie'.",
    "Gebruik een woordenschat rond: 'revisie', 'vervanging', 'hersteltraject', 'kostenpost', 'arbeidsuur'.",
    "Gebruik een woordenschat rond: 'marktconforme waarde', 'transactieprijs', 'koopgedrag', 'vraagzijde'.",
    "Gebruik een woordenschat rond: 'slijtageprofiel', 'onderhoudsachterstand', 'functioneel gebrek', 'levensduur'.",
    "Gebruik een woordenschat rond: 'economische waardevermindering', 'afschrijving', 'restwaarde', 'depreciation'.",
    "Gebruik een woordenschat rond: 'defect', 'malfunctie', 'technische onvolkomenheid', 'reparatienoodzaak'.",
]

_CLOSERS = [
    "Sluit af met een zin waarin je de vastgestelde rest-BPM expliciet als 'redelijk en marktconform' typeert.",
    "Sluit af met een verwijzing naar artikel 10 Wet BPM en de noodzaak van werkelijke marktwaarde.",
    "Eindig met een beschouwing over de verkoopbaarheid en de tijd die nodig is om een koper te vinden.",
    "Eindig met een conclusie waarin de herstelkosten worden afgezet tegen de restwaarde.",
    "Sluit af door te stellen dat een hogere rest-BPM economisch niet verdedigbaar zou zijn.",
    "Eindig met een samenvattend oordeel over de algehele staat in één krachtige slotzin.",
    "Sluit af met een doorkijk naar wat een eventuele doorverkoop voor de eigenaar zou betekenen.",
    "Eindig met een bevestiging dat het taxatiebedrag aansluit bij de daadwerkelijk te realiseren verkoopprijs.",
    "Sluit af met een neutrale constatering dat de vastgestelde waarde correspondeert met vergelijkbare transacties.",
    "Eindig met een verwijzing naar de Hoge Raad-uitspraak en de objectieve benadering daarvan.",
    "Sluit af met een conclusie die de economische realiteit van importvoertuigen onderstreept.",
    "Eindig door te stellen dat de rest-BPM het enige passende resultaat is na alle in acht genomen factoren.",
]


def _pick_style_card() -> dict:
    """Kies 5 onafhankelijke stijl-dimensies — combinatoriek > 100k."""
    return {
        "opener": random.choice(_OPENERS),
        "tone": random.choice(_TONES),
        "structure": random.choice(_STRUCTURES),
        "vocab": random.choice(_VOCAB_PALETTES),
        "closer": random.choice(_CLOSERS),
        "variatie_nr": random.randint(1, 999),
    }


async def _build_prompt(body: dict, user: dict) -> tuple[str, str]:
    """Bouwt (system_msg, prompt) op basis van body + user context."""
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
            name = d.get("name", "Onbekend")
            cost = d.get("cost", 0)
            hours = d.get("hours", 0) or 0
            material = d.get("material_cost", 0) or 0
            parts = []
            if hours > 0:
                parts.append(f"{hours:.1f} uur arbeid \u00e0 \u20ac65 = \u20ac{hours*65:.0f}")
            if material > 0:
                parts.append(f"\u20ac{material:.0f} materiaal")
            breakdown = " + ".join(parts) if parts else f"\u20ac{cost:.0f} totaal"
            damage_lines.append(f"- {name}: {breakdown} (totaal \u20ac{cost:.0f})")
    damage_block = "\n".join(damage_lines) if damage_lines else "- (geen specifieke schade-items aangevinkt)"

    from services.branding import get_branding
    cb = get_branding(user)
    vehicle_label = cb['vehicle_label']

    # Whitelabel override: als de taxatie aan een ander bedrijf is toegewezen
    # (bv. Bloemert Motoren), gebruik die branding voor taxateur-naam + bedrijfsnaam
    taxatie_id = (body.get("taxatie_id") or "").strip()
    branding_company = cb.get("name") or "Moto Import B.V."
    branding_taxateur = cb.get("taxateur_full_name") or cb.get("taxateur_name") or ""
    if taxatie_id:
        try:
            tx = await db.taxatie_programma.find_one({"id": taxatie_id}, {"_id": 0, "branding_override": 1})
            override = (tx or {}).get("branding_override") or {}
            if override.get("company_name"):
                branding_company = override["company_name"]
            if override.get("taxateur_name"):
                branding_taxateur = override["taxateur_name"]
        except Exception:
            logger.exception("Whitelabel branding ophalen mislukt — fallback naar default")

    is_motorfiets = vehicle_label == 'motorfiets'

    # Random stijl-kaart: 5 orthogonale dimensies ⇒ >100k unieke combinaties
    style = _pick_style_card()

    system_msg = (
        f"Je bent {branding_taxateur or 'een erkende BPM-taxateur'} van het bedrijf "
        f"{branding_company}, gevestigd in Nederland. "
        "Je schrijft gedetailleerde, technisch onderbouwde teksten voor BPM-taxatierapporten "
        "die voldoen aan de eisen van de Belastingdienst. Schrijf in vlot, formeel Nederlands. "
        "Refereer NIET aan andere bedrijven of taxatiebureaus dan het bovengenoemde. "
        "BELANGRIJK: elke onderbouwing die je schrijft moet fundamenteel anders klinken dan eerdere — "
        "varieer openingszin, zinsbouw, woordkeuze, volgorde van argumentatie en afsluitende formulering. "
        f"Werk deze taxatie uit volgens stijl-variant #{style['variatie_nr']}."
    )

    motorfiets_import_context = """

CONTEXT VOOR IMPORTMOTOREN (verplicht meenemen in onderbouwing):
Belangrijk: deze motorfiets is een import. In de markt is ruim gedocumenteerd dat geïmporteerde motorfietsen aanzienlijk minder waard zijn dan vergelijkbare exemplaren met een Nederlandse historie. De onderbouwing moet daarom — naast de schadeposten — expliciet één alinea bevatten die deze waardedrukkende factoren benoemt:
- **Logistieke en transactiekosten**: het ophalen in het buitenland (BE/DE/AT/IT/CH), grenstransport, douaneformaliteiten en exportkenteken brengen extra kosten met zich mee die op de transactiewaarde drukken.
- **Aanvullende keurings- en onderhoudskosten**: bij import is een volledige onderhoudsbeurt, RDW-keuring, vervanging van koplampen/snelheidsmeter naar Nederlandse spec en eventuele aanpassing van de uitlaat noodzakelijk voordat de motor verkoopklaar is.
- **Geen Nederlandse onderhoudshistorie / garantieverlies**: kopers waarderen het ontbreken van een Nederlandse dealerhistorie en de niet-overdraagbare fabrieksgarantie negatief, hetgeen de marktwaarde structureel drukt.
- **Verminderde verkoopbaarheid**: vraagprijzen op AutoScout24/Marktplaats voor importmotoren liggen aantoonbaar 10-20% onder die van Nederlandse exemplaren.
- **Wettelijke basis**: artikel 10 lid 7 Wet BPM en de bijhorende uitspraken (HR 17 januari 2014, ECLI:NL:HR:2014:80) bevestigen dat de werkelijke marktwaarde — inclusief bovengenoemde correcties — leidend is voor de BPM-vermindering.
Verwerk deze elementen op een natuurlijke wijze in een aparte alinea binnen de onderbouwing (geen bullets in de output)."""

    prompt = f"""Schrijf een unieke onderbouwing voor een BPM-taxatierapport voor onderstaande {vehicle_label}.

=== VERPLICHTE STIJL-KAART (variatie #{style['variatie_nr']}) ===
Volg ONDERSTAANDE instructies letterlijk zodat elke onderbouwing fundamenteel anders leest:
• OPENING: {style['opener']}
• TOON: Schrijf {style['tone']}.
• STRUCTUUR: {style['structure']}
• WOORDENSCHAT: {style['vocab']}
• AFSLUITING: {style['closer']}

Vermijd de vaste openingszin "De onderhavige [merk] ..." — wissel af met natuurlijke alternatieven.

Voertuig:
- Merk en model: {brand} {model}
- Bouwjaar: {year}
- Kilometerstand: {mileage:,} km

Vastgestelde schade en gebreken:
{damage_block}

Totale herstelkosten: \u20ac{total_herstel:,.0f}
Bruto BPM: \u20ac{bruto_bpm:,.0f}
Vastgestelde rest-BPM na taxatie: \u20ac{target_bpm:,.0f}
{motorfiets_import_context if is_motorfiets else ''}

OPDRACHT:
1. Schrijf {'3 tot 4' if is_motorfiets else '2 tot 3'} alinea's professionele technische onderbouwing waarom de waarde zo laag is uitgekomen.
2. Per aangevinkt schade-item: een technisch beschrijvende zin (bv. "De voorvork vertoont olielekkage met zichtbare aanslag op de stofkappen, hetgeen revisie of vervanging noodzakelijk maakt.") waarbij je de **exacte uren en materiaalkosten** uit de bovenstaande lijst expliciet noemt — bijvoorbeeld: "Het herstel vergt 2,5 uur arbeid (\u20ac 162) plus \u20ac 240 aan onderdelen."
{('3. Wijd één aparte alinea aan de waardedrukkende invloed van de import-status (zoals beschreven in de CONTEXT hierboven) — noem expliciet de logistieke kosten, de noodzakelijke voorbereiding voor de Nederlandse markt, het garantieverlies en de marktverhouding tot Nederlandse exemplaren.' if is_motorfiets else '')}
{4 if is_motorfiets else 3}. Sluit af met een conclusie waarom de gevraagde rest-BPM redelijk is gezien de staat{' en de import-status' if is_motorfiets else ''}.
{5 if is_motorfiets else 4}. Wees creatief en gevarieerd: GEBRUIK GEEN STANDAARDZINNEN. Elke onderbouwing moet duidelijk anders klinken dan een vorige — de stijl-kaart hierboven is leidend.
{6 if is_motorfiets else 5}. Vermijd: bullets, koppen, opsommingen. Alleen vloeiende paragrafen.
{7 if is_motorfiets else 6}. Lengte: {'350-500' if is_motorfiets else '250-400'} woorden.

Geef ALLEEN de onderbouwingstekst terug, geen JSON, geen titel."""

    return system_msg, prompt


async def _run_generation_task(task_id: str, body: dict, user: dict) -> None:
    """Background task: roept Claude aan en slaat resultaat op in MongoDB."""
    try:
        system_msg, prompt = await _build_prompt(body, user)
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"bpm-onderbouwing-{task_id}",
            system_message=system_msg,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        text = (response or "").strip()
        if not text:
            raise RuntimeError("Lege LLM response")

        await db.bpm_ai_tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "status": "done",
                "onderbouwing": text,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        logger.info(f"BPM AI task {task_id} voltooid ({len(text)} chars)")
    except Exception as e:
        logger.exception(f"BPM AI task {task_id} mislukt")
        await db.bpm_ai_tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )


@router.post("/admin/bpm/generate-onderbouwing")
async def start_bpm_onderbouwing(
    body: dict = Body(...),
    user: dict = Depends(require_taxatie_access),
):
    """Start een AI-onderbouwing als background task. Retourneert direct een task_id.
    Body: {brand, model, year, mileage, damage_items, target_bpm, total_herstelkosten, bruto_bpm}
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY niet geconfigureerd")

    task_id = str(uuid.uuid4())
    await db.bpm_ai_tasks.insert_one({
        "task_id": task_id,
        "status": "pending",
        "user_id": user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Fire-and-forget: draait verder ook nadat de HTTP response al gestuurd is
    asyncio.create_task(_run_generation_task(task_id, body, user))

    return {"task_id": task_id, "status": "pending"}


@router.get("/admin/bpm/onderbouwing-status/{task_id}")
async def get_onderbouwing_status(
    task_id: str,
    user: dict = Depends(require_taxatie_access),
):
    """Polling endpoint: retourneert status (pending/done/failed) en bij done de onderbouwing."""
    task = await db.bpm_ai_tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task niet gevonden")
    # Eenvoudige eigenaarscheck: alleen de starter mag pollen
    if task.get("user_id") and task.get("user_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Geen toegang tot deze task")
    return task
