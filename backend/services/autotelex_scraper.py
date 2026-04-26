"""
AutoTelex PRO scraper service.

Logs in to www.autotelexpro.nl via Mijn Autotelex SSO and performs
brand + first-registration date searches in the Motoren category.

Flow:
1. login() -> browser context with valid session cookies
2. search_motors(brand, day, month, year) -> list of results [
    {execution, cc, kw_pk, gel_van, gel_tot, bpm, prijs, detail_url}
   ]
3. get_details(detail_url) -> {
     prijslijstprijs_zonder_opties, consumentenprijs, handelswaarde,
     inruilwaarde, verkoopwaarde, bpm
   }
"""
import asyncio
import logging
import os
import re
import time
from typing import List, Optional, Dict

# Use the system-wide Playwright browsers path if our CLI install put it there
_pw_path = "/pw-browsers"
if os.path.isdir(_pw_path):
    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", _pw_path)

from playwright.async_api import async_playwright, Browser, BrowserContext

logger = logging.getLogger(__name__)

AUTOTELEX_EMAIL = os.environ.get("AUTOTELEX_EMAIL", "")
AUTOTELEX_PASSWORD = os.environ.get("AUTOTELEX_PASSWORD", "")

LOGIN_URL = "https://www.autotelexpro.nl/LoginPage.aspx"
HOME_URL = "https://www.autotelexpro.nl/Default.aspx"

# Cached browser + context (reused across requests for ~30 min)
_browser: Optional[Browser] = None
_context: Optional[BrowserContext] = None
_session_at: float = 0
_session_lock = asyncio.Lock()
SESSION_TTL = 25 * 60  # 25 minutes


async def _get_browser() -> Browser:
    global _browser
    if _browser is None or not _browser.is_connected():
        pw = await async_playwright().start()
        _browser = await pw.chromium.launch(
            headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
    return _browser


async def _ensure_logged_in() -> BrowserContext:
    """Return an authenticated browser context. Reuses cached session if fresh."""
    global _context, _session_at
    async with _session_lock:
        if _context and time.time() - _session_at < SESSION_TTL:
            return _context
        # Fresh login
        if _context:
            try:
                await _context.close()
            except Exception:
                pass
            _context = None
        if not AUTOTELEX_EMAIL or not AUTOTELEX_PASSWORD:
            raise RuntimeError("AUTOTELEX_EMAIL / AUTOTELEX_PASSWORD niet geconfigureerd")
        browser = await _get_browser()
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        )
        page = await ctx.new_page()
        try:
            await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
            await page.click("#ctl00_cp_btnLoginMijnAutotelex")
            await page.wait_for_load_state("networkidle", timeout=20000)
            await page.fill("#tboxUsername", AUTOTELEX_EMAIL)
            await page.click("button[type=submit], input[type=submit]")
            await page.wait_for_load_state("networkidle", timeout=20000)
            await page.fill("#tboxPassword", AUTOTELEX_PASSWORD)
            await page.click("#btnLogin")
            await page.wait_for_load_state("networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            # Verify we landed on the home (logged in)
            if "Login" in page.url or "tboxUsername" in await page.content():
                raise RuntimeError("AutoTelex login mislukt — controleer credentials")
        finally:
            await page.close()
        _context = ctx
        _session_at = time.time()
        logger.info("AutoTelex session refreshed")
        return _context


async def _get_brand_options() -> List[str]:
    """Return list of available motorcycle brands in the dropdown."""
    ctx = await _ensure_logged_in()
    page = await ctx.new_page()
    try:
        await page.goto(HOME_URL, wait_until="networkidle", timeout=30000)
        # Voertuigsoort dropdown -> Motoren (value=5) inside Manual tab
        sel = "#ctl00_cp_ucSearch_Manual_ddlVoertuigType"
        await page.select_option(sel, value="5")
        await page.wait_for_load_state("networkidle", timeout=20000)
        await page.wait_for_timeout(800)
        merk_sel = "#ctl00_cp_ucSearch_Manual_ddlMerk"
        opts = await page.query_selector_all(f"{merk_sel} option")
        return [
            (await o.inner_text()).strip()
            for o in opts
            if (await o.get_attribute("value")) not in (None, "", "-1")
        ]
    finally:
        await page.close()


def _parse_dutch_number(s: str) -> Optional[float]:
    if not s:
        return None
    s = s.strip().replace("\xa0", " ").replace("€", "").replace(" ", "")
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except Exception:
        return None


async def search_motors(brand: str, day: int, month: int, year: int, model_substring: str = "") -> List[Dict]:
    """Search AutoTelex for motorcycles matching brand + first registration date.
    Optimized: skips intermediate networkidle waits and uses targeted state polls."""
    ctx = await _ensure_logged_in()
    page = await ctx.new_page()
    try:
        await page.goto(HOME_URL, wait_until="networkidle", timeout=20000)
        # Activate "Op kenmerken / import" tab (Manual)
        try:
            await page.click("#ctl00_cp_ucSearch_Manual_lblHeaderTabTitle", timeout=3000)
            await page.wait_for_timeout(300)
        except Exception:
            pass
        # 1. Voertuigsoort = Motoren (5) — triggers ASP.NET __doPostBack
        await page.select_option("#ctl00_cp_ucSearch_Manual_ddlVoertuigType", value="5")
        await page.wait_for_load_state("networkidle", timeout=15000)
        # 2. Date components — each triggers a postback that progressively populates the brand list
        for sel_id, val in [
            ("ctl00_cp_ucSearch_Manual_ddlBouwdag", str(day)),
            ("ctl00_cp_ucSearch_Manual_ddlBouwmaand", str(month)),
            ("ctl00_cp_ucSearch_Manual_ddlBouwjaar", str(year)),
        ]:
            try:
                await page.select_option(f"#{sel_id}", value=val, timeout=8000)
                await page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass
        # 3. Pick brand
        merk_sel = "#ctl00_cp_ucSearch_Manual_ddlMerk"
        options = await page.query_selector_all(f"{merk_sel} option")
        target_value = None
        brand_norm = brand.strip().lower()
        for o in options:
            txt = ((await o.inner_text()) or "").strip().lower()
            val = await o.get_attribute("value")
            if val in (None, "-1", ""):
                continue
            if txt == brand_norm or (brand_norm and brand_norm in txt):
                target_value = val
                break
        if not target_value:
            avail = []
            for o in options:
                t = ((await o.inner_text()) or "").strip()
                if t and t != "- Kies merk -":
                    avail.append(t)
            raise RuntimeError(
                f"Merk '{brand}' niet gevonden ({len(options)} opties). "
                f"Beschikbaar: {', '.join(avail[:30])}"
            )
        await page.select_option(merk_sel, value=target_value)
        await page.wait_for_load_state("networkidle", timeout=10000)
        # 4. Click Zoeken and wait for result rows
        await page.click("#btnHandmatigZoeken")
        try:
            await page.wait_for_selector("tr.rgRow, tr.rgAltRow", timeout=15000)
        except Exception:
            pass
        # 5. Parse result rows from Telerik RadGrid (rgRow / rgAltRow)
        results: List[Dict] = []
        rows = await page.query_selector_all("tr.rgRow, tr.rgAltRow")
        for row in rows:
            row_id = await row.get_attribute("id") or ""
            cells_text = await row.evaluate(
                "tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())"
            )
            # Skip the expand-column at index 0
            data = [c for c in cells_text]
            # data: [<expand>, Uitvoering, CC, kW/pk, Versnelling, Gel van, Gel tot, BPM, Prijs]
            if len(data) < 9:
                continue
            execution = data[1]
            if not execution or execution.lower() in ("\xa0", " "):
                continue
            if model_substring and model_substring.lower() not in execution.lower():
                continue
            cc = data[2]
            kw_pk = data[3]
            versnelling = data[4]
            gel_van = data[5]
            gel_tot = data[6]
            bpm = _parse_dutch_number(data[7])
            prijs = _parse_dutch_number(data[8])
            results.append({
                "row_id": row_id,
                "execution": execution,
                "cc": cc,
                "kw_pk": kw_pk,
                "versnelling": versnelling,
                "gel_van": gel_van,
                "gel_tot": gel_tot,
                "bpm": bpm,
                "prijs": prijs,
            })
        return results
    finally:
        await page.close()


async def lookup_with_details(brand: str, day: int, month: int, year: int, execution_name: str = "") -> Dict:
    """Run search, then click the row matching execution_name (or first if only 1 result)
    and parse the Basisoverzicht detail page. Returns combined search + details data.
    """
    ctx = await _ensure_logged_in()
    page = await ctx.new_page()
    try:
        await page.goto(HOME_URL, wait_until="networkidle", timeout=30000)
        await page.select_option("#ctl00_cp_ucSearch_Manual_ddlVoertuigType", value="5")
        await page.wait_for_load_state("networkidle", timeout=20000)
        for sel_id, val in [
            ("ctl00_cp_ucSearch_Manual_ddlBouwdag", str(day)),
            ("ctl00_cp_ucSearch_Manual_ddlBouwmaand", str(month)),
            ("ctl00_cp_ucSearch_Manual_ddlBouwjaar", str(year)),
        ]:
            await page.select_option(f"#{sel_id}", value=val)
            await page.wait_for_load_state("networkidle", timeout=20000)
            await page.wait_for_timeout(300)
        # Brand
        merk_sel = "#ctl00_cp_ucSearch_Manual_ddlMerk"
        options = await page.query_selector_all(f"{merk_sel} option")
        target_value = None
        brand_norm = brand.strip().lower()
        for o in options:
            txt = ((await o.inner_text()) or "").strip().lower()
            val = await o.get_attribute("value")
            if val in (None, "-1", ""):
                continue
            if txt == brand_norm or brand_norm in txt:
                target_value = val
                break
        if not target_value:
            raise RuntimeError(f"Merk '{brand}' niet gevonden")
        await page.select_option(merk_sel, value=target_value)
        await page.wait_for_load_state("networkidle", timeout=20000)
        await page.wait_for_timeout(500)
        await page.click("#btnHandmatigZoeken")
        await page.wait_for_load_state("networkidle", timeout=30000)
        try:
            await page.wait_for_selector("tr.rgRow, tr.rgAltRow", timeout=15000)
        except Exception:
            pass
        await page.wait_for_timeout(1500)
        # Find row to click
        rows = await page.query_selector_all("tr.rgRow, tr.rgAltRow")
        if not rows:
            raise RuntimeError("Geen resultaten gevonden voor deze zoekopdracht")
        target_row = None
        if execution_name:
            ex_norm = execution_name.strip().lower()
            for r in rows:
                cells = await r.evaluate("tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())")
                if len(cells) >= 2 and cells[1].lower() == ex_norm:
                    target_row = r
                    break
            if not target_row:
                # fallback: contains
                for r in rows:
                    cells = await r.evaluate("tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())")
                    if len(cells) >= 2 and ex_norm in cells[1].lower():
                        target_row = r
                        break
        if not target_row:
            target_row = rows[0]
        # Click the target row's name cell (double-click to navigate to detail page)
        name_cell = await target_row.query_selector("td.UitvoeringNaamInGridview")
        clicker = name_cell or target_row
        try:
            async with page.expect_navigation(timeout=15000, wait_until="networkidle"):
                await clicker.dblclick()
        except Exception:
            # Fallback: regular click
            await clicker.click()
            await page.wait_for_load_state("networkidle", timeout=30000)
        try:
            await page.wait_for_selector("text=Basisgegevens", timeout=10000)
        except Exception:
            pass
        await page.wait_for_timeout(1500)

        # Extract values via DOM (label cell -> next cell)
        async def _grab_dom(label: str) -> Optional[float]:
            txt = await page.evaluate(
                """(label) => {
                    const all = Array.from(document.querySelectorAll('td, span, div, p, b, strong'));
                    for (const el of all) {
                        if (el.children.length === 0 && el.textContent && el.textContent.trim() === label) {
                            const tr = el.closest('tr');
                            if (tr) {
                                const cells = tr.querySelectorAll('td');
                                for (let i=0; i<cells.length-1; i++) {
                                    if (cells[i].textContent.trim() === label) {
                                        return cells[i+1].textContent.trim();
                                    }
                                }
                            }
                            let sib = el.nextElementSibling;
                            while (sib && !sib.textContent.trim()) sib = sib.nextElementSibling;
                            if (sib) return sib.textContent.trim();
                        }
                    }
                    return null;
                }""",
                label,
            )
            return _parse_dutch_number(txt) if txt else None

        details = {
            "prijslijstprijs_zonder_opties": await _grab_dom("Prijslijstprijs zonder opties"),
            "prijslijstprijs_met_opties": await _grab_dom("Prijslijstprijs met opties"),
            "consumentenprijs": await _grab_dom("Consumentenprijs Autotelex"),
            "handelswaarde": await _grab_dom("Handelswaarde"),
            "inruilwaarde": await _grab_dom("Inruilwaarde"),
            "verkoopwaarde": await _grab_dom("Verkoopwaarde"),
            "afleverkosten": await _grab_dom("Afleverkosten"),
            "detail_url": page.url,
        }
        return details
    finally:
        await page.close()


async def get_brands() -> List[str]:
    """Public function for frontend dropdown."""
    return await _get_brand_options()


async def warmup():
    """Pre-warm browser + login. Call at app startup so first request is fast."""
    try:
        await _ensure_logged_in()
        logger.info("AutoTelex warmup OK")
    except Exception as e:
        logger.warning(f"AutoTelex warmup skipped: {e}")
