"""Tests for COC PDF upload/download endpoints (extended COC/CVO feature)."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Admin2024!"
DEALER_EMAIL = "zoektest@dealer.nl"
DEALER_PASSWORD = "Test2024!"

TEST_ORDER_ID = "4c8b3e8c-1aca-4dcf-9920-e97baf90f1f6"

MIN_PDF = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def dealer_token():
    return _login(DEALER_EMAIL, DEALER_PASSWORD)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def dealer_headers(dealer_token):
    return {"Authorization": f"Bearer {dealer_token}"}


# --- Upload PDF (admin) ---
def test_admin_upload_pdf_success(admin_headers):
    files = {"file": ("test_coc.pdf", io.BytesIO(MIN_PDF), "application/pdf")}
    r = requests.post(f"{API}/orders/{TEST_ORDER_ID}/coc-pdf", headers=admin_headers, files=files, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "filename" in data
    assert data["filename"] == "test_coc.pdf"


def test_admin_upload_non_pdf_returns_400(admin_headers):
    files = {"file": ("test.txt", io.BytesIO(b"not a pdf"), "text/plain")}
    r = requests.post(f"{API}/orders/{TEST_ORDER_ID}/coc-pdf", headers=admin_headers, files=files, timeout=30)
    assert r.status_code == 400
    assert "PDF" in r.json().get("detail", "")


def test_dealer_upload_forbidden(dealer_headers):
    files = {"file": ("x.pdf", io.BytesIO(MIN_PDF), "application/pdf")}
    r = requests.post(f"{API}/orders/{TEST_ORDER_ID}/coc-pdf", headers=dealer_headers, files=files, timeout=30)
    assert r.status_code == 403


def test_upload_on_non_coc_order_returns_400(admin_headers):
    # Find a non-COC order to test
    r = requests.get(f"{API}/orders", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    non_coc = next((o for o in r.json() if not o.get("needs_coc")), None)
    if not non_coc:
        pytest.skip("No non-COC order available")
    files = {"file": ("x.pdf", io.BytesIO(MIN_PDF), "application/pdf")}
    r = requests.post(f"{API}/orders/{non_coc['id']}/coc-pdf", headers=admin_headers, files=files, timeout=30)
    assert r.status_code == 400
    assert "COC" in r.json().get("detail", "")


# --- Download PDF ---
def test_admin_download_pdf(admin_headers):
    r = requests.get(f"{API}/orders/{TEST_ORDER_ID}/coc-pdf", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content.startswith(b"%PDF")


def test_owning_dealer_download_pdf(dealer_headers):
    r = requests.get(f"{API}/orders/{TEST_ORDER_ID}/coc-pdf", headers=dealer_headers, timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")


def test_download_nonexistent_pdf_returns_404(admin_headers):
    # Find a COC order without PDF (or use an order id that has no pdf saved)
    r = requests.get(f"{API}/admin/coc-orders", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    no_pdf = next((o for o in r.json() if not o.get("coc_pdf_filename") and o["id"] != TEST_ORDER_ID), None)
    if not no_pdf:
        pytest.skip("No COC order without PDF")
    r = requests.get(f"{API}/orders/{no_pdf['id']}/coc-pdf", headers=admin_headers, timeout=30)
    assert r.status_code == 404


# --- admin/coc-orders returns pdf fields ---
def test_admin_coc_orders_includes_pdf_fields(admin_headers):
    r = requests.get(f"{API}/admin/coc-orders", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    orders = r.json()
    target = next((o for o in orders if o["id"] == TEST_ORDER_ID), None)
    assert target is not None, "Test order not in coc-orders"
    assert target.get("coc_pdf_filename"), "coc_pdf_filename missing"
    assert target.get("coc_pdf_uploaded_at"), "coc_pdf_uploaded_at missing"


# --- Status update triggers email (no exception, 200) ---
def test_status_sent_to_dealer_with_pdf(admin_headers):
    r = requests.put(
        f"{API}/orders/{TEST_ORDER_ID}/coc-status",
        headers=admin_headers,
        json={"status": "sent_to_dealer"},
        timeout=60,
    )
    assert r.status_code == 200
    assert r.json().get("status") == "sent_to_dealer"


# --- Non-owner dealer forbidden on download ---
def test_non_owner_dealer_forbidden(admin_headers):
    # Look for a second approved dealer (not the owner)
    r = requests.get(f"{API}/admin/users", headers=admin_headers, timeout=30)
    if r.status_code != 200:
        pytest.skip("admin/users not available")
    dealers = [u for u in r.json() if u.get("role") == "dealer" and u.get("is_approved") and u.get("email") != DEALER_EMAIL]
    if not dealers:
        pytest.skip("No second dealer available for non-owner test")
    # Try common passwords or skip
    other = dealers[0]
    # Try to reset password via admin (if endpoint exists), else skip
    reset = requests.post(
        f"{API}/admin/reset-password",
        headers=admin_headers,
        json={"email": other["email"], "new_password": "Test2024!"},
        timeout=30,
    )
    if reset.status_code != 200:
        pytest.skip(f"Cannot reset other dealer password: {reset.status_code}")
    tok = _login(other["email"], "Test2024!")
    r = requests.get(
        f"{API}/orders/{TEST_ORDER_ID}/coc-pdf",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=30,
    )
    assert r.status_code == 403
