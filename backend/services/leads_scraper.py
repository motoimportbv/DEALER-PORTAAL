"""Lead-scraper service: parseert HTML van motoroccasion.nl dealer-listings
om e-mailadressen + bedrijfsnamen + plaats te extraheren.

De HTML-structuur (zoals gezien op motoroccasion.nl/adressen/dealers.html):

    <div class="address-line-tile">
      ... <a href=".../adressen/dealers/{slug}-d{ID}.html">
            <span class="address-tile-brandname">3D Motoren</span>
            <div class="address-line-tile-yearmls">Verbindingsweg 12<br>5527AM Hapert</div>
          </a> ...
      <a ... data-dlr="16944" data-type="email">
        <img ... title="e-Mail: info@3dmotoren.nl" alt="e-Mail">
      </a>
      <a href="http://www.3dmotoren.nl/...">
        <img title="Website: www.3dmotoren.nl" alt="Website">
      </a>
    </div>

Per tile leveren we: bedrijfsnaam, adres, postcode, plaats, email, website, dealer_id.
"""

from __future__ import annotations

import re
import logging
from typing import List, Dict, Optional
from html import unescape

import requests

logger = logging.getLogger(__name__)

# Realistische browser headers — sommige sites laten dit door
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

# Regex om tile-block uit HTML te slicen
TILE_RE = re.compile(
    r'<div class="address-line-tile">(.*?)(?=<div class="address-line-tile">|<div style="clear: both; padding-top: 9px;">)',
    re.DOTALL,
)

# Velden binnen één tile
NAME_RE      = re.compile(r'<span class="address-tile-brandname">([^<]+)</span>', re.DOTALL)
ADDRESS_RE   = re.compile(r'<div class="address-line-tile-yearmls">(.*?)</div>', re.DOTALL)
EMAIL_RE     = re.compile(r'title="e-Mail:\s*([^"]+?)"', re.IGNORECASE)
WEBSITE_RE   = re.compile(r'title="Website:\s*([^"]+?)"', re.IGNORECASE)
DEALER_ID_RE = re.compile(r'data-dlr="(\d+)"\s+data-type="email"')
DETAIL_URL_RE = re.compile(r'href="(https?://www\.motoroccasion\.nl/adressen/dealers/[^"]+)"')
POSTCODE_CITY_RE = re.compile(r'\b(\d{4}\s?[A-Z]{2})\s+(.+?)\s*$')

EMAIL_VALID_RE = re.compile(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')


def _clean(text: str) -> str:
    return unescape(re.sub(r'\s+', ' ', text or '')).strip().rstrip('\xa0').strip()


def parse_motoroccasion_html(html: str) -> List[Dict[str, str]]:
    """Parse één pagina (HTML) van motoroccasion.nl dealer-listing.

    Returnt list van leads (dicts met name, email, address, postcode, city, website, source_url, dealer_id).
    """
    if not html:
        return []

    # Vervang &nbsp; en `<br>` met spaces voor adres-parsing
    html_norm = html.replace('&nbsp;', ' ')

    results: List[Dict[str, str]] = []
    # Slice op tile boundaries
    tiles = re.findall(
        r'<div class="table address-line-tile">(.*?)</div>\s*</div>\s*</div>\s*</div>',
        html_norm,
        re.DOTALL,
    )

    for tile in tiles:
        try:
            name_match    = NAME_RE.search(tile)
            address_match = ADDRESS_RE.search(tile)
            email_match   = EMAIL_RE.search(tile)
            website_match = WEBSITE_RE.search(tile)
            id_match      = DEALER_ID_RE.search(tile)
            detail_match  = DETAIL_URL_RE.search(tile)

            if not name_match:
                continue
            name = _clean(name_match.group(1))
            if not name:
                continue

            email = ""
            if email_match:
                e = _clean(email_match.group(1))
                if EMAIL_VALID_RE.match(e):
                    email = e.lower()

            website = _clean(website_match.group(1)) if website_match else ""
            # Normaliseer website: forceer met http:// als geen schema
            if website and not website.startswith(('http://', 'https://')):
                website = 'http://' + website

            address_raw = ""
            postcode = ""
            city = ""
            if address_match:
                # Adres heeft formaat "Straat 12<br>1234AB Plaats"
                addr_html = address_match.group(1)
                parts = re.split(r'<br\s*/?>', addr_html)
                parts = [_clean(p) for p in parts if _clean(p)]
                if len(parts) >= 2:
                    address_raw = parts[0]
                    pc_city = parts[1]
                    pc_match = POSTCODE_CITY_RE.search(pc_city)
                    if pc_match:
                        postcode = pc_match.group(1).replace(' ', '').upper()
                        city = pc_match.group(2).strip()
                    else:
                        city = pc_city
                elif len(parts) == 1:
                    address_raw = parts[0]

            results.append({
                "name": name,
                "email": email,
                "address": address_raw,
                "postcode": postcode,
                "city": city,
                "website": website,
                "source_url": _clean(detail_match.group(1)) if detail_match else "",
                "dealer_id": id_match.group(1) if id_match else "",
                "source_site": "motoroccasion.nl",
            })
        except Exception as e:
            logger.warning(f"parse_motoroccasion_html tile error: {e}")
            continue

    return results


def try_auto_fetch_motoroccasion(page: int = 1, timeout: float = 12.0) -> Dict[str, any]:
    """Probeer een dealer-listing pagina automatisch op te halen.

    De site is meestal beschermd tegen bots (403). We proberen het toch — werkt soms
    afhankelijk van het uitgaande IP. Bij falen krijgt de admin de paste-mode te zien.
    """
    url = "https://www.motoroccasion.nl/adressen/dealers.html"
    if page > 1:
        # Probeer beide patronen
        url = f"https://www.motoroccasion.nl/adressen/dealers.html?pagina={page}"

    try:
        r = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
        if r.status_code == 200 and 'address-line-tile' in r.text:
            leads = parse_motoroccasion_html(r.text)
            return {"ok": True, "status": r.status_code, "count": len(leads), "leads": leads}
        return {"ok": False, "status": r.status_code, "error": "Niet toegankelijk via server (anti-bot bescherming). Gebruik de plak-HTML modus."}
    except Exception as e:
        return {"ok": False, "status": 0, "error": f"Verbindingsfout: {str(e)[:120]}"}
