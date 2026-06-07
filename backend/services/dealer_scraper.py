"""Automatische scraper voor moto.it concessionari-listing.

Stap 1: paginas van https://www.moto.it/concessionari ophalen (1.132 dealers totaal)
Stap 2: per dealer naar dealer.moto.it/{slug} → website-domein extraheren
Stap 3: voor elk domein → GET /contatti, /contact, /contacts → email regex matchen
Stap 4: leads invoegen in DB (idempotent op email_lower)

Bewust async + parallel pool met max concurrency om geblokkeerd worden te voorkomen.
"""
import asyncio
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

from database import db

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')

# Skip generic / non-dealer domains
SPAM_EMAIL_DOMAINS = {
    "google.com", "facebook.com", "instagram.com", "youtube.com", "twitter.com",
    "linkedin.com", "wixstatic.com", "sentry.io", "googletagmanager.com",
    "doubleclick.net", "wordpress.com", "wp.com", "example.com", "moto.it",
    "yamaha-motor.it", "yamaha-motor.eu", "honda.it", "ducati.com", "ktm.com",
    "bmw.it", "piaggio.com", "vespa.com", "aprilia.com", "stcrm.it",
    "noreply", "no-reply", "donotreply", "do-not-reply",
}

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

# Dealer-listing pagina-template + contact-paden om af te speuren
CONTACT_PATHS = ["/contatti", "/contatti/", "/contact", "/contact/", "/contattaci", "/info",
                 "/contacts", "/about/contact", "/chi-siamo/contatti"]


def _is_valid_email(em: str) -> bool:
    em = em.lower().strip()
    if not EMAIL_RE.fullmatch(em):
        return False
    if any(em.startswith(p + "@") for p in ("noreply", "no-reply", "donotreply", "do-not-reply", "info@example")):
        return False
    domain = em.split("@", 1)[1]
    if any(domain.endswith(sd) for sd in SPAM_EMAIL_DOMAINS):
        return False
    if domain in SPAM_EMAIL_DOMAINS:
        return False
    return True


# Regex om dealer-info uit de moto.it listing HTML te halen.
# Patroon (Markdown vorm zoals crawl_tool teruggeeft): "- [Naam](url)" gevolgd door "via Adres" + "Plaats - 12345 - PR, Regio" + "Telefono:xxx"
DEALER_RE = re.compile(
    r'\[(?P<name>[^\]]+?)\]\((?P<url>https?://dealer\.moto\.it/[^\)]+)\)'
    r'.*?'  # tussenwit
    r'(?P<address>[^\n]+?)\n+'
    r'(?P<city>[A-ZÀ-Ÿa-zà-ÿ\'\s\.]+?)\s*-\s*(?P<postcode>\d{5})\s*-\s*(?P<province>[A-Z]{2})',
    re.DOTALL,
)


async def _fetch(client: httpx.AsyncClient, url: str, timeout: float = 15.0) -> Optional[str]:
    """Veilig een URL ophalen — return None bij fout."""
    try:
        r = await client.get(url, timeout=timeout, follow_redirects=True,
                             headers={"User-Agent": USER_AGENT})
        if r.status_code == 200 and r.text:
            return r.text
    except Exception as e:
        logger.debug(f"Fetch failed {url}: {e}")
    return None


def _parse_dealer_listing(html: str) -> list:
    """Parse 1 pagina van moto.it/concessionari → lijst van dealer dicts.

    De HTML heeft per dealer een <a href="https://dealer.moto.it/{slug}">Naam</a>
    gevolgd ergens daarna door een postcode-pattern "Plaats - 12345 - PR".
    We dedupen op moto_it_url omdat namen meerdere keren voorkomen (link in titel + foto + scheda).
    """
    dealers = []
    seen_urls = set()
    # Match: <a href="https://dealer.moto.it/SLUG" ...>NAAM</a>
    link_re = re.compile(
        r'<a\s+href=["\'](https?://dealer\.moto\.it/[a-zA-Z0-9\-_]+)["\'][^>]*>([^<]{2,80})</a>',
        re.IGNORECASE,
    )
    # Pak ook plaats + postcode + provincie patroon dichtbij
    location_re = re.compile(
        r'([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\'\s\.\-]{1,50}?)\s*-\s*(\d{5})\s*-\s*([A-Z]{2})',
    )

    for m in link_re.finditer(html):
        url = m.group(1).strip().rstrip("/")
        name = (m.group(2) or "").strip()
        if url in seen_urls:
            continue
        if not name or name.lower() in ("scheda completa", "offerte nuovo e usato", ""):
            continue
        # Filter out de menu-link "Concessionari" zelf
        if "/concessionari" in url.lower():
            continue
        seen_urls.add(url)

        # Zoek dichtstbijzijnde locatie-info (na de link, binnen 2000 chars)
        start = m.end()
        chunk = html[start:start + 2000]
        loc = location_re.search(chunk)
        city, postcode, province = "", "", ""
        if loc:
            city = (loc.group(1) or "").strip()
            postcode = (loc.group(2) or "").strip()
            province = (loc.group(3) or "").strip()

        dealers.append({
            "name": name,
            "moto_it_url": url,
            "address": "",
            "city": city,
            "postcode": postcode,
            "province": province,
        })
    return dealers


async def _extract_email_from_dealer_profile(client: httpx.AsyncClient, profile_url: str) -> tuple:
    """Probeer email + website-domein te halen uit een dealer.moto.it/{slug} pagina.
    Returns (email or None, website or None)."""
    html = await _fetch(client, profile_url)
    if not html:
        return None, None

    # 1) Soms staat email direct in de profielpagina (zelden)
    for em in EMAIL_RE.findall(html):
        if _is_valid_email(em):
            return em.lower(), None

    # 2) Zoek externe website (niet moto.it, niet social, niet google etc.)
    skip_hosts = ("moto.it", "facebook.com", "instagram.com", "youtube.com", "twitter.com",
                  "x.com", "linkedin.com", "tiktok.com", "wa.me", "maps.google", "goo.gl",
                  "googleapis.com", "google.com", "gstatic.com", "stcrm.it",
                  "schema.org", "w3.org", "cookielaw.org", "iubenda.com", "rcsmediagroup",
                  "amazon-adsystem", "doubleclick", "googletagmanager")
    urls = re.findall(r'href=["\'](https?://[^"\'<>\s]+)', html)
    seen_host = set()
    for u in urls:
        try:
            host = u.split("/")[2].lower()
        except IndexError:
            continue
        if any(b in host for b in skip_hosts):
            continue
        # We willen een dealer-website, niet een merk-website van fabrikant
        if any(brand in host for brand in ("yamaha-motor", "honda.it", "ducati.com",
                                            "ktm.com", "bmw-motorrad", "piaggio.com",
                                            "vespa.com", "aprilia.com", "kawasaki.it",
                                            "suzuki.it", "harley-davidson", "triumph",
                                            "royalenfield", "betamotor")):
            continue
        # Eerste hostname per dealer
        if host in seen_host:
            continue
        seen_host.add(host)
        # Bouw clean base URL (scheme + host)
        return None, f"https://{host}"
    return None, None


async def _try_dealer_contact_pages(client: httpx.AsyncClient, website: str) -> Optional[str]:
    """Probeer /contatti, /contact, etc. — return eerste valide email."""
    base = website.rstrip("/")
    candidates = [base + p for p in CONTACT_PATHS] + [base]
    for url in candidates:
        html = await _fetch(client, url, timeout=10.0)
        if not html:
            continue
        for em in EMAIL_RE.findall(html):
            if _is_valid_email(em):
                return em.lower()
    return None


async def extract_emails_from_url_list(urls: list, current_user_id: Optional[str] = None) -> dict:
    """Voor elke website-URL in de lijst: probeer /contact, /contatti, etc. paden om
    email-adressen te vinden via regex. Insert in DB met country auto-detect via TLD.

    Returns: {processed, inserted, duplicates, no_email, errors, details: [...]}
    """
    inserted = 0
    duplicates = 0
    no_email = 0
    processed = 0
    errors = 0
    details = []  # Per-URL feedback voor UI

    # Dedup input
    clean_urls = []
    seen = set()
    for u in urls:
        u = (u or "").strip()
        if not u:
            continue
        if not u.startswith("http"):
            u = "https://" + u.lstrip("/")
        u = u.rstrip("/")
        if u in seen:
            continue
        seen.add(u)
        clean_urls.append(u)

    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)) as client:
        semaphore = asyncio.Semaphore(5)

        async def process_url(website: str):
            nonlocal inserted, duplicates, no_email, processed, errors
            async with semaphore:
                processed += 1
                try:
                    # Probeer alle contact-pagina paden
                    email = await _try_dealer_contact_pages(client, website)
                    if not email:
                        no_email += 1
                        details.append({"url": website, "status": "no_email"})
                        return
                    if not _is_valid_email(email):
                        no_email += 1
                        details.append({"url": website, "status": "no_email"})
                        return
                    # Dedup
                    existing = await db.taxatie_leads.find_one({"email_lower": email}, {"_id": 0, "id": 1})
                    if existing:
                        duplicates += 1
                        details.append({"url": website, "status": "duplicate", "email": email})
                        return
                    # Bepaal country via TLD
                    try:
                        host = website.split("/")[2].lower()
                        tld = host.rsplit(".", 1)[-1]
                        country = {"fr": "FR", "be": "BE", "lu": "LU", "nl": "NL", "de": "DE",
                                   "it": "IT", "es": "ES", "ch": "CH", "uk": "GB", "co.uk": "GB"}.get(tld, "")
                    except Exception:
                        host = ""
                        country = ""
                    # Best-effort: dealer-naam uit host (motoshop-paris.fr → "Motoshop Paris")
                    name_part = host.replace("www.", "").split(".")[0]
                    name = " ".join(w.capitalize() for w in re.split(r"[-_]", name_part) if w)
                    doc = {
                        "id": str(uuid.uuid4()),
                        "name": name,
                        "email": email,
                        "email_lower": email,
                        "address": "",
                        "postcode": "",
                        "city": "",
                        "website": website,
                        "country": country,
                        "source_site": "url-bulk",
                        "source_url": website,
                        "dealer_id": "",
                        "status": "new",
                        "notes": "Email auto-geëxtraheerd via URL-bulk tool",
                        "sent_at": None,
                        "batch_id": None,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "created_by": current_user_id,
                    }
                    await db.taxatie_leads.insert_one(doc)
                    inserted += 1
                    details.append({"url": website, "status": "ok", "email": email, "name": name})
                except Exception as e:
                    errors += 1
                    details.append({"url": website, "status": "error", "error": str(e)[:100]})

        await asyncio.gather(*(process_url(u) for u in clean_urls))

    return {
        "total_urls": len(clean_urls),
        "processed": processed,
        "inserted": inserted,
        "duplicates": duplicates,
        "no_email": no_email,
        "errors": errors,
        "details": details,
    }


async def scrape_moto_it(max_pages: int = 5, current_user_id: Optional[str] = None,
                         progress_cb=None) -> dict:
    """Scrape moto.it concessionari + zoek emails per dealer-website.

    max_pages = aantal listing-pagina's te scrapen (10 dealers per pagina, dus 5 = 50 dealers).
    progress_cb = optionele async functie die per dealer wordt aangeroepen voor progress logging.
    """
    inserted = 0
    duplicates = 0
    no_email = 0
    processed = 0
    errors = 0

    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=10, max_keepalive_connections=4)) as client:
        # Stap 1: alle dealer-namen + plaatsen uit listing-pagina's halen
        all_dealers = []
        for page in range(1, max_pages + 1):
            listing_url = f"https://www.moto.it/concessionari?page={page}" if page > 1 else "https://www.moto.it/concessionari"
            html = await _fetch(client, listing_url)
            if not html:
                logger.warning(f"moto.it listing pagina {page} faalde")
                continue
            dealers = _parse_dealer_listing(html)
            if not dealers:
                logger.info(f"moto.it pagina {page}: geen dealers gevonden, stop")
                break
            all_dealers.extend(dealers)
            logger.info(f"moto.it pagina {page}: {len(dealers)} dealers gevonden")

        total = len(all_dealers)
        logger.info(f"moto.it scraper: {total} dealers in {max_pages} pagina's")

        # Stap 2: parallel pool voor email-extractie (max 5 gelijktijdig)
        semaphore = asyncio.Semaphore(5)

        async def process_dealer(d):
            nonlocal inserted, duplicates, no_email, processed, errors
            async with semaphore:
                processed += 1
                try:
                    # 1) Probeer profile-pagina (krijg website-domein)
                    email, website = await _extract_email_from_dealer_profile(client, d["moto_it_url"])
                    # 2) Als geen email maar wel website: probeer /contatti
                    if not email and website:
                        email = await _try_dealer_contact_pages(client, website)
                    if not email:
                        no_email += 1
                        if progress_cb:
                            await progress_cb(processed, total, f"❌ {d['name']} — geen email")
                        return
                    if not _is_valid_email(email):
                        no_email += 1
                        return
                    # 3) Dedup + insert
                    existing = await db.taxatie_leads.find_one({"email_lower": email}, {"_id": 0, "id": 1})
                    if existing:
                        duplicates += 1
                        if progress_cb:
                            await progress_cb(processed, total, f"⏭️ {d['name']} — duplicaat ({email})")
                        return
                    doc = {
                        "id": str(uuid.uuid4()),
                        "name": d["name"],
                        "email": email,
                        "email_lower": email,
                        "address": d.get("address", ""),
                        "postcode": d.get("postcode", ""),
                        "city": d.get("city", ""),
                        "website": website or "",
                        "country": "IT",
                        "source_site": "moto.it",
                        "source_url": d["moto_it_url"],
                        "dealer_id": "",
                        "status": "new",
                        "notes": f"Provincia: {d.get('province','')} — auto-scraped via moto.it",
                        "sent_at": None,
                        "batch_id": None,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "created_by": current_user_id,
                    }
                    await db.taxatie_leads.insert_one(doc)
                    inserted += 1
                    if progress_cb:
                        await progress_cb(processed, total, f"✅ {d['name']} → {email}")
                except Exception as e:
                    errors += 1
                    logger.error(f"Error processing {d['name']}: {e}")

        await asyncio.gather(*(process_dealer(d) for d in all_dealers))

    return {
        "total_dealers_found": total,
        "processed": processed,
        "inserted": inserted,
        "duplicates": duplicates,
        "no_email": no_email,
        "errors": errors,
    }
