"""Maandelijkse taxateur-statistieken: hoeveel rapporten heeft elke taxateur gedaan?

Voor elke gebruiker met rol="taxateur" telt deze service in een gegeven kalendermaand:
- Aantal afgeronde aanvragen (`taxatie_aanvragen` met status="afgerond")
- Aantal aangemaakte taxatie-facturen (`taxatie_invoices`)

Verstuurt één samenvattende e-mail naar motoimportbv@gmail.com.
"""
from datetime import datetime, timezone, timedelta
from calendar import monthrange
import logging

from database import db
from services.email_service import send_email
from config import ALLOWED_ADMIN_EMAIL_TAXATIE

logger = logging.getLogger(__name__)

DUTCH_MONTHS = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
]


def _previous_month_range(now: datetime) -> tuple:
    """Retourneer (start_iso, end_iso_exclusive, label) voor de vorige kalendermaand in UTC."""
    year = now.year
    month = now.month - 1
    if month == 0:
        month = 12
        year -= 1
    start = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    last_day = monthrange(year, month)[1]
    # Einde = 1e van huidige maand (exclusive) — eenvoudigste correcte logica
    if month == 12:
        end = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    label = f"{DUTCH_MONTHS[month - 1]} {year}"
    return start.isoformat(), end.isoformat(), label, last_day


async def compute_taxateur_stats(start_iso: str, end_iso: str) -> list:
    """Bereken stats voor alle taxateurs in [start_iso, end_iso)."""
    taxateurs = await db.users.find(
        {"role": "taxateur"},
        {"_id": 0, "id": 1, "email": 1, "name": 1, "company_name": 1},
    ).to_list(200)

    results = []
    for t in taxateurs:
        uid = t.get("id") or ""
        email = t.get("email") or ""
        if not uid and not email:
            continue
        # Aanvragen afgerond door deze taxateur in periode
        aanvragen_count = await db.taxatie_aanvragen.count_documents({
            "status": "afgerond",
            "$or": [
                {"completed_by_id": uid} if uid else {"_skip": True},
                {"completed_by_email": email} if email else {"_skip": True},
            ],
            "completed_at": {"$gte": start_iso, "$lt": end_iso},
        })
        # Facturen aangemaakt in periode
        invoice_filter = {
            "created_at": {"$gte": start_iso, "$lt": end_iso},
        }
        if uid:
            invoice_filter["created_by"] = uid
        invoices = await db.taxatie_invoices.find(
            invoice_filter, {"_id": 0, "fee": 1}
        ).to_list(1000)
        invoices_count = len(invoices)
        # Omzet = som van basis-fee (ex BTW) over alle facturen in de periode
        revenue_ex_btw = sum(float(inv.get("fee") or 0) for inv in invoices)

        results.append({
            "name": t.get("name") or t.get("company_name") or email,
            "email": email,
            "aanvragen_afgerond": aanvragen_count,
            "facturen_aangemaakt": invoices_count,
            "omzet_ex_btw": round(revenue_ex_btw, 2),
            "totaal": aanvragen_count + invoices_count,
        })
    # Sorteer: meeste rapporten eerst
    results.sort(key=lambda r: r["totaal"], reverse=True)
    return results


def _render_email_html(label: str, stats: list) -> str:
    total_revenue = sum(s.get("omzet_ex_btw", 0) for s in stats)
    total_invoices = sum(s.get("facturen_aangemaakt", 0) for s in stats)
    total_aanvragen = sum(s.get("aanvragen_afgerond", 0) for s in stats)
    if not stats:
        body_rows = '<tr><td colspan="5" style="padding: 16px; text-align: center; color: #71717a;">Geen taxateurs gevonden in het systeem.</td></tr>'
    else:
        body_rows = ""
        for s in stats:
            revenue_str = f"€{s.get('omzet_ex_btw', 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            body_rows += f"""
                <tr>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7;">
                        <div style="font-weight: bold; color: #18181b;">{s['name']}</div>
                        <div style="font-size: 11px; color: #71717a;">{s['email']}</div>
                    </td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; text-align: center; font-size: 15px; font-weight: bold; color: #2563eb;">{s['aanvragen_afgerond']}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; text-align: center; font-size: 15px; font-weight: bold; color: #16a34a;">{s['facturen_aangemaakt']}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; text-align: right; font-size: 14px; font-weight: bold; color: #7c2d12;">{revenue_str}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; text-align: center; font-size: 16px; font-weight: bold; color: #18181b;">{s['totaal']}</td>
                </tr>"""
    revenue_str_total = f"€{total_revenue:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; background: #fafafa;">
      <div style="background: linear-gradient(135deg, #18181b, #7f1d1d); color: white; padding: 24px;">
        <h1 style="margin: 0 0 4px; font-size: 22px;">Maandrapport taxateurs</h1>
        <p style="margin: 0; color: #fecaca; font-size: 14px;">Productie over {label}</p>
      </div>
      <div style="background: white; padding: 24px;">
        <p style="font-size: 14px; color: #3f3f46; line-height: 1.6;">
          Hieronder zie je per taxateur hoeveel rapporten zij in <strong>{label}</strong> hebben gedaan en wat de bijbehorende omzet was (basis-fee ex BTW).
        </p>
        <div style="display: flex; gap: 8px; margin: 16px 0; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 100px; padding: 12px; background: #eff6ff; border-radius: 6px;"><div style="font-size: 11px; color: #1e40af; text-transform: uppercase;">Aanvragen</div><div style="font-size: 22px; font-weight: bold; color: #1e3a8a;">{total_aanvragen}</div></div>
          <div style="flex: 1; min-width: 100px; padding: 12px; background: #f0fdf4; border-radius: 6px;"><div style="font-size: 11px; color: #166534; text-transform: uppercase;">Facturen</div><div style="font-size: 22px; font-weight: bold; color: #14532d;">{total_invoices}</div></div>
          <div style="flex: 1; min-width: 120px; padding: 12px; background: #fef2f2; border-radius: 6px;"><div style="font-size: 11px; color: #991b1b; text-transform: uppercase;">Omzet ex BTW</div><div style="font-size: 22px; font-weight: bold; color: #7f1d1d;">{revenue_str_total}</div></div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
          <thead>
            <tr style="background: #f4f4f5;">
              <th style="padding: 10px 12px; text-align: left; color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Taxateur</th>
              <th style="padding: 10px 12px; text-align: center; color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Aanvragen<br/>afgerond</th>
              <th style="padding: 10px 12px; text-align: center; color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Facturen<br/>aangemaakt</th>
              <th style="padding: 10px 12px; text-align: right; color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Omzet<br/>ex BTW</th>
              <th style="padding: 10px 12px; text-align: center; color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Totaal</th>
            </tr>
          </thead>
          <tbody>{body_rows}</tbody>
        </table>
        <p style="font-size: 11px; color: #a1a1aa; margin: 20px 0 0;">
          Omzet = basis-factuurbedrag ex BTW (extra regels/uitprinten/verzending niet meegerekend).
          Dit rapport wordt automatisch op de 1e van elke maand om ±09:00 NL-tijd verstuurd.
        </p>
      </div>
      <div style="background: #18181b; padding: 14px; text-align: center; color: #a1a1aa; font-size: 11px;">
        <p style="margin: 0;"><strong style="color: white;">Moto Import B.V.</strong> — automatisch maandrapport</p>
      </div>
    </div>
    """


async def send_monthly_taxateur_report(now: datetime = None) -> dict:
    """Bereken stats voor de afgelopen maand en stuur 1 e-mail.

    Retourneert dict met info over het verzonden rapport. Roept geen exceptions
    naar buiten — fouten worden gelogd.
    """
    now = now or datetime.now(timezone.utc)
    start_iso, end_iso, label, _ = _previous_month_range(now)
    stats = await compute_taxateur_stats(start_iso, end_iso)
    total_reports = sum(s["totaal"] for s in stats)
    total_revenue = sum(s.get("omzet_ex_btw", 0) for s in stats)
    revenue_str = f"€{total_revenue:,.0f}".replace(",", ".")
    subject = f"📊 Maandrapport taxateurs — {label} ({total_reports} rapporten, {revenue_str} omzet)"
    html = _render_email_html(label, stats)
    try:
        await send_email(
            to_email=ALLOWED_ADMIN_EMAIL_TAXATIE,
            subject=subject,
            html_content=html,
        )
        logger.info(f"Sent monthly taxateur report for {label}: {len(stats)} taxateurs, {total_reports} reports total")
        return {"ok": True, "label": label, "taxateurs": len(stats), "total_reports": total_reports, "stats": stats}
    except Exception as e:
        logger.error(f"Failed to send monthly taxateur report: {e}")
        return {"ok": False, "error": str(e), "label": label, "stats": stats}
