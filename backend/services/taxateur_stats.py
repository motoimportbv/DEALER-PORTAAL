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
        invoices_count = await db.taxatie_invoices.count_documents(invoice_filter)

        results.append({
            "name": t.get("name") or t.get("company_name") or email,
            "email": email,
            "aanvragen_afgerond": aanvragen_count,
            "facturen_aangemaakt": invoices_count,
            "totaal": aanvragen_count + invoices_count,
        })
    # Sorteer: meeste rapporten eerst
    results.sort(key=lambda r: r["totaal"], reverse=True)
    return results


def _render_email_html(label: str, stats: list) -> str:
    if not stats:
        body_rows = '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #71717a;">Geen taxateurs gevonden in het systeem.</td></tr>'
    else:
        body_rows = ""
        for s in stats:
            body_rows += f"""
                <tr>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7;">
                        <div style="font-weight: bold; color: #18181b;">{s['name']}</div>
                        <div style="font-size: 11px; color: #71717a;">{s['email']}</div>
                    </td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; text-align: center; font-size: 15px; font-weight: bold; color: #2563eb;">{s['aanvragen_afgerond']}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; text-align: center; font-size: 15px; font-weight: bold; color: #16a34a;">{s['facturen_aangemaakt']}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; text-align: center; font-size: 16px; font-weight: bold; color: #18181b;">{s['totaal']}</td>
                </tr>"""
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #fafafa;">
      <div style="background: linear-gradient(135deg, #18181b, #7f1d1d); color: white; padding: 24px;">
        <h1 style="margin: 0 0 4px; font-size: 22px;">Maandrapport taxateurs</h1>
        <p style="margin: 0; color: #fecaca; font-size: 14px;">Productie over {label}</p>
      </div>
      <div style="background: white; padding: 24px;">
        <p style="font-size: 14px; color: #3f3f46; line-height: 1.6;">
          Hieronder zie je per taxateur hoeveel rapporten zij in {label} hebben gedaan.
          <strong>Aanvragen afgerond</strong> = aanvragen die op "afgerond" zijn gezet via /admin/taxatie-aanvragen.
          <strong>Facturen aangemaakt</strong> = taxatie-facturen aangemaakt via /admin/taxatie.
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 16px;">
          <thead>
            <tr style="background: #f4f4f5;">
              <th style="padding: 10px 12px; text-align: left; color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Taxateur</th>
              <th style="padding: 10px 12px; text-align: center; color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Aanvragen<br/>afgerond</th>
              <th style="padding: 10px 12px; text-align: center; color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Facturen<br/>aangemaakt</th>
              <th style="padding: 10px 12px; text-align: center; color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Totaal</th>
            </tr>
          </thead>
          <tbody>{body_rows}</tbody>
        </table>
        <p style="font-size: 11px; color: #a1a1aa; margin: 20px 0 0;">
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
    subject = f"📊 Maandrapport taxateurs — {label} ({total_reports} rapporten)"
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
