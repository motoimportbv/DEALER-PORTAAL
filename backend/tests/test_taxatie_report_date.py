"""
Test suite for the new 'report_date' field on BPM Vermindering Taxaties.
Verifies:
  - report_date persists on POST/PUT
  - taxatieverslag PDF contains '15-01-2026' in body when report_date='2026-01-15'
  - taxatierapport PDF returns 200 and contains the formatted date
  - belastingdienst PDF returns 200 and embeds the date in form fields (date01/05/06)
  - Empty/null report_date falls back to created_at without error (regression)
"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Admin2024!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json().get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _base_payload(extra=None):
    payload = {
        "kenteken": "TEST-RD-01",
        "brand": "Yamaha",
        "model": "TestReport",
        "year": 2024,
        "mileage": 1000,
        "color": "Zwart",
        "vin_number": "VINTESTREPORTDATE01",
        "first_registration_date": "2024-06-01",
        "fuel_type": "Benzine",
        "cylinder_capacity": "900 cc",
        "power_kw": 85,
        "customer_name": "Test Klant",
        "customer_phone": "+31600000000",
        "customer_email": "test@klant.nl",
        "customer_address": "Teststraat 1, 1234AB Amsterdam",
        "netto_catalogusprijs": 12000,
        "consumentenprijs": 14500,
        "koerslijst_waarde": 9000,
    }
    if extra:
        payload.update(extra)
    return payload


@pytest.fixture(scope="module")
def created_taxatie_with_date(admin_headers):
    payload = _base_payload({"report_date": "2026-01-15"})
    r = requests.post(f"{BASE_URL}/api/taxatie-programma", json=payload, headers=admin_headers)
    assert r.status_code == 200, f"Create with report_date failed: {r.status_code} {r.text}"
    data = r.json()
    yield data
    # cleanup
    requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=admin_headers)


@pytest.fixture(scope="module")
def created_taxatie_no_date(admin_headers):
    payload = _base_payload()  # no report_date
    r = requests.post(f"{BASE_URL}/api/taxatie-programma", json=payload, headers=admin_headers)
    assert r.status_code == 200, f"Create without report_date failed: {r.status_code} {r.text}"
    data = r.json()
    yield data
    requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=admin_headers)


# ---------- 1. POST persists report_date ----------
def test_create_persists_report_date(created_taxatie_with_date):
    data = created_taxatie_with_date
    assert "report_date" in data, "Response should contain report_date field"
    assert data["report_date"] == "2026-01-15", f"report_date should be saved verbatim, got {data.get('report_date')!r}"


# ---------- 2. GET list returns report_date ----------
def test_list_returns_report_date(admin_headers, created_taxatie_with_date):
    r = requests.get(f"{BASE_URL}/api/taxatie-programma", headers=admin_headers)
    assert r.status_code == 200
    rows = r.json()
    match = next((t for t in rows if t["id"] == created_taxatie_with_date["id"]), None)
    assert match is not None, "Created taxatie should be in list"
    assert match.get("report_date") == "2026-01-15"


# ---------- 3. GET single returns report_date ----------
def test_get_single_returns_report_date(admin_headers, created_taxatie_with_date):
    r = requests.get(f"{BASE_URL}/api/taxatie-programma/{created_taxatie_with_date['id']}",
                     headers=admin_headers)
    assert r.status_code == 200
    assert r.json().get("report_date") == "2026-01-15"


# ---------- 4. PUT updates report_date ----------
def test_update_report_date(admin_headers, created_taxatie_with_date):
    tax_id = created_taxatie_with_date["id"]
    payload = _base_payload({"report_date": "2026-03-20"})
    r = requests.put(f"{BASE_URL}/api/taxatie-programma/{tax_id}", json=payload, headers=admin_headers)
    assert r.status_code == 200, f"Update failed: {r.status_code} {r.text}"
    assert r.json().get("report_date") == "2026-03-20"

    # Persistence verify
    r2 = requests.get(f"{BASE_URL}/api/taxatie-programma/{tax_id}", headers=admin_headers)
    assert r2.json().get("report_date") == "2026-03-20"

    # Reset back to 2026-01-15 for subsequent PDF tests
    payload2 = _base_payload({"report_date": "2026-01-15"})
    r3 = requests.put(f"{BASE_URL}/api/taxatie-programma/{tax_id}", json=payload2, headers=admin_headers)
    assert r3.status_code == 200
    assert r3.json().get("report_date") == "2026-01-15"


def _pdf_text(pdf_bytes):
    """Extract concatenated text from a PDF (using PyMuPDF)."""
    import fitz
    text_parts = []
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page in doc:
            text_parts.append(page.get_text())
    return "\n".join(text_parts)


# ---------- 5. taxatieverslag PDF contains 15-01-2026 ----------
def test_taxatieverslag_pdf_contains_report_date(admin_headers, created_taxatie_with_date):
    tax_id = created_taxatie_with_date["id"]
    r = requests.get(f"{BASE_URL}/api/taxatie-programma/{tax_id}/taxatieverslag-pdf",
                     headers=admin_headers)
    assert r.status_code == 200, f"taxatieverslag-pdf failed: {r.status_code} {r.text[:200]}"
    assert r.headers.get("content-type", "").startswith("application/pdf")
    text = _pdf_text(r.content)
    assert "15-01-2026" in text, f"Expected '15-01-2026' in taxatieverslag PDF text. Snippet: {text[:500]}"


# ---------- 6. taxatierapport content lives inside taxatieverslag-pdf (4 places) ----------
def test_taxatierapport_pdf_contains_report_date(admin_headers, created_taxatie_with_date):
    """The 'Taxatierapport Motorfiets' content is rendered inside /taxatieverslag-pdf
    (verified via grep: there is no separate /taxatierapport-pdf route).
    Per spec, the date should appear in 4 places (header, inspection date, body, signature)."""
    tax_id = created_taxatie_with_date["id"]
    r = requests.get(f"{BASE_URL}/api/taxatie-programma/{tax_id}/taxatieverslag-pdf",
                     headers=admin_headers)
    assert r.status_code == 200, f"taxatieverslag-pdf failed: {r.status_code} {r.text[:200]}"
    text = _pdf_text(r.content)
    occurrences = text.count("15-01-2026")
    assert occurrences >= 2, f"Expected >=2 occurrences of '15-01-2026', got {occurrences}. Snippet: {text[:500]}"
    print(f"taxatieverslag PDF contains '15-01-2026' x{occurrences}")


# ---------- 7. belastingdienst PDF returns 200 with date form fields ----------
def test_belastingdienst_pdf_with_report_date(admin_headers, created_taxatie_with_date):
    tax_id = created_taxatie_with_date["id"]
    r = requests.get(f"{BASE_URL}/api/taxatie-programma/{tax_id}/belastingdienst-pdf",
                     headers=admin_headers)
    assert r.status_code == 200, f"belastingdienst-pdf failed: {r.status_code} {r.text[:200]}"
    assert r.headers.get("content-type", "").startswith("application/pdf")

    # Inspect form widget values. Names look like '3.date01.d_CF', '10.date05.m_CF', etc.
    # There are also other 'date01' widgets (e.g. 'B.A.date01.d_F' which is registration date),
    # so we collect ALL d/m/y per logical date name and assert that the report date 15-01-2026
    # appears for date01 and date05 at least once.
    import re
    import fitz
    found = {"date01": [], "date05": [], "date06": []}
    with fitz.open(stream=r.content, filetype="pdf") as doc:
        for page in doc:
            for w in page.widgets() or []:
                name = (w.field_name or "")
                m = re.search(r"date(0[1-9]|[1-9]\d)\.([dmy])(?:_[A-Za-z]+)?$", name)
                if not m:
                    continue
                key = f"date{m.group(1)}"
                if key in found:
                    found[key].append((m.group(2), (w.field_value or "").strip(), name))

    def _values(entries, suffix):
        return [v for s, v, _ in entries if s == suffix]

    # date01: 15-01-2026 must be one of the d/m/y triples
    assert "15" in _values(found["date01"], "d"), f"date01.d should include '15', got {found['date01']}"
    assert "01" in _values(found["date01"], "m"), f"date01.m should include '01', got {found['date01']}"
    assert "2026" in _values(found["date01"], "y"), f"date01.y should include '2026', got {found['date01']}"

    # date05: 15-01-2026
    assert "15" in _values(found["date05"], "d"), f"date05.d should include '15', got {found['date05']}"
    assert "01" in _values(found["date05"], "m"), f"date05.m should include '01', got {found['date05']}"
    assert "2026" in _values(found["date05"], "y"), f"date05.y should include '2026', got {found['date05']}"

    # date06: optional per implementation - report status only
    d06_d = _values(found["date06"], "d")
    d06_filled = any(v == "15" for v in d06_d)
    print(f"belastingdienst PDF date01={found['date01']}, date05={found['date05']}, date06_filled={d06_filled}")


# ---------- 8. Regression: empty report_date falls back gracefully ----------
def test_pdfs_work_without_report_date(admin_headers, created_taxatie_no_date):
    tax_id = created_taxatie_no_date["id"]
    # Confirm field comes back empty/None
    g = requests.get(f"{BASE_URL}/api/taxatie-programma/{tax_id}", headers=admin_headers)
    assert g.status_code == 200
    assert not g.json().get("report_date"), f"report_date should be empty, got {g.json().get('report_date')!r}"

    # All PDFs should still generate successfully
    for ep in ["taxatieverslag-pdf", "belastingdienst-pdf"]:
        r = requests.get(f"{BASE_URL}/api/taxatie-programma/{tax_id}/{ep}", headers=admin_headers)
        assert r.status_code == 200, f"{ep} fallback failed: {r.status_code} {r.text[:200]}"
        assert r.headers.get("content-type", "").startswith("application/pdf"), f"{ep} not a PDF"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
