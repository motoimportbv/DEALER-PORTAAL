"""
Test suite verifying OrderWithMotorcycle now surfaces kentekenbewijs_url,
payment_instructions, supplier_info, and motorcycle_license_plate for both
admin and pakbon (Ellen) users.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Admin2024!"
PAKBON_EMAIL = "ellenmilone@gmail.com"
PAKBON_PASSWORD = "Test2024!"
TEST_ORDER_ID = "630312c9-2560-41ac-98a8-626d79cc3651"


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def pakbon_token():
    return _login(PAKBON_EMAIL, PAKBON_PASSWORD)


# ---------- Core fix: fields must be returned in /api/orders ----------

def test_pakbon_orders_include_fix_fields(pakbon_token):
    r = requests.get(
        f"{BASE_URL}/api/orders",
        headers={"Authorization": f"Bearer {pakbon_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    orders = r.json()
    assert isinstance(orders, list)
    target = next((o for o in orders if o.get("id") == TEST_ORDER_ID), None)
    assert target is not None, f"Order {TEST_ORDER_ID} missing for pakbon"

    # Fields must exist in model (None allowed only if not populated)
    for field in (
        "kentekenbewijs_url",
        "payment_instructions",
        "supplier_info",
        "motorcycle_license_plate",
    ):
        assert field in target, f"Field '{field}' missing from pakbon order payload"

    # According to context these should be populated for this test order
    assert target["kentekenbewijs_url"], "kentekenbewijs_url is empty for pakbon"
    pi = target["payment_instructions"]
    assert isinstance(pi, dict) and pi, "payment_instructions missing for pakbon"
    # Expected keys
    assert any(k in pi for k in ("amount", "iban", "recipient")), f"payment_instructions missing key fields: {pi}"


def test_admin_orders_include_fix_fields(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    orders = r.json()
    target = next((o for o in orders if o.get("id") == TEST_ORDER_ID), None)
    assert target is not None, f"Order {TEST_ORDER_ID} missing for admin"

    for field in (
        "kentekenbewijs_url",
        "payment_instructions",
        "supplier_info",
        "motorcycle_license_plate",
    ):
        assert field in target, f"Field '{field}' missing from admin order payload"

    assert target["kentekenbewijs_url"], "kentekenbewijs_url empty for admin"
    assert isinstance(target["payment_instructions"], dict) and target["payment_instructions"]


# ---------- Admin-only write endpoints still work (regression) ----------

def test_admin_update_payment_instructions_persists(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    # Endpoint expects {"instructions": {...}, "supplier_info": {...}}
    payload = {
        "instructions": {
            "amount": "CHF 7.500",
            "iban": "CH93 0000 0000 0000 0000 0",
            "recipient": "Hostettler AG",
        },
        "supplier_info": {"name": "Hostettler AG", "country": "CH"},
    }
    r = requests.put(
        f"{BASE_URL}/api/orders/{TEST_ORDER_ID}/payment-instructions",
        headers=headers,
        json=payload,
        timeout=30,
    )
    assert r.status_code == 200, f"payment-instructions update failed: {r.status_code} {r.text}"

    # Verify persistence by fetching order list
    r2 = requests.get(f"{BASE_URL}/api/orders", headers=headers, timeout=30)
    assert r2.status_code == 200
    order = next((o for o in r2.json() if o["id"] == TEST_ORDER_ID), None)
    assert order is not None
    assert order["payment_instructions"]["recipient"] == "Hostettler AG"
    assert order["payment_instructions"]["iban"].startswith("CH93")
    assert order["supplier_info"]["name"] == "Hostettler AG"


def test_pakbon_cannot_update_payment_instructions(pakbon_token):
    # Regression: pakbon should NOT be able to modify payment instructions
    r = requests.put(
        f"{BASE_URL}/api/orders/{TEST_ORDER_ID}/payment-instructions",
        headers={"Authorization": f"Bearer {pakbon_token}"},
        json={"payment_instructions": {"amount": "TEST", "iban": "TEST", "recipient": "TEST"}},
        timeout=30,
    )
    assert r.status_code in (401, 403), f"Pakbon unexpectedly allowed to update: {r.status_code} {r.text}"


def test_license_plate_endpoint_allows_pakbon(pakbon_token):
    # Save original
    headers = {"Authorization": f"Bearer {pakbon_token}"}
    r = requests.put(
        f"{BASE_URL}/api/orders/{TEST_ORDER_ID}/license-plate",
        headers=headers,
        json={"license_plate": "TEST-99-ZZ"},
        timeout=30,
    )
    assert r.status_code == 200, f"license-plate update failed for pakbon: {r.status_code} {r.text}"

    r2 = requests.get(f"{BASE_URL}/api/orders", headers=headers, timeout=30)
    order = next((o for o in r2.json() if o["id"] == TEST_ORDER_ID), None)
    assert order is not None
    assert order.get("motorcycle_license_plate") == "TEST-99-ZZ"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
