"""Tests for COC/CVO ordering feature on buy-now endpoint.

Verifies:
- coc_cost is correctly applied per supported brand
- 400 error for unsupported brands
- needs_coc/coc_cost fields persisted and returned by GET /api/orders
"""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASS = "Admin2024!"
DEALER_EMAIL = "zoektest@dealer.nl"
DEALER_PASS = "Test2024!"

SUPPORTED_BRANDS = {
    "Yamaha": 75.0,
    "Kawasaki": 75.0,
    "Triumph": 120.0,
    "KTM": 75.0,
    "Honda": 150.0,
}
UNSUPPORTED_BRANDS = ["Suzuki", "BMW", "Ducati"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def dealer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": DEALER_EMAIL, "password": DEALER_PASS}, timeout=30)
    assert r.status_code == 200, f"Dealer login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def dealer_headers(dealer_token):
    return {"Authorization": f"Bearer {dealer_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def all_motorcycles(dealer_headers):
    r = requests.get(f"{BASE_URL}/api/motorcycles", headers=dealer_headers, timeout=30)
    assert r.status_code == 200, f"GET /api/motorcycles failed: {r.text}"
    return r.json()


def _find_available_motorcycle_for_brand(motorcycles, brand):
    """Find an available motorcycle of given brand (case-insensitive)."""
    brand_lc = brand.lower()
    for m in motorcycles:
        if (m.get("brand", "").lower() == brand_lc
                and m.get("is_available", False)
                and not m.get("is_paused", False)
                and not m.get("is_pending_approval", False)):
            return m
    return None


def _create_test_motorcycle(admin_headers, brand, price=5000.0):
    """Create a test motorcycle of a specific brand for COC testing."""
    payload = {
        "brand": brand,
        "model": "TEST_COC_MODEL",
        "year": 2023,
        "price": price,
        "mileage": 1000,
        "color": "Black",
        "description": "TEST_COC test motorcycle - safe to delete",
        "condition": "good",
        "images": [],
    }
    r = requests.post(f"{BASE_URL}/api/motorcycles", json=payload,
                      headers=admin_headers, timeout=30)
    assert r.status_code in (200, 201), f"Failed creating test motorcycle for {brand}: {r.text}"
    return r.json()


def _delete_motorcycle(admin_headers, motorcycle_id):
    try:
        requests.delete(f"{BASE_URL}/api/motorcycles/{motorcycle_id}",
                        headers=admin_headers, timeout=30)
    except Exception:
        pass


def _delete_order(admin_headers, order_id):
    try:
        requests.delete(f"{BASE_URL}/api/orders/{order_id}",
                        headers=admin_headers, timeout=30)
    except Exception:
        pass


# ============ COC supported brands ============

@pytest.mark.parametrize("brand,expected_coc", list(SUPPORTED_BRANDS.items()))
def test_buy_now_with_coc_supported_brand(admin_headers, dealer_headers, brand, expected_coc):
    moto = _create_test_motorcycle(admin_headers, brand, price=5000.0)
    moto_id = moto["id"]
    order_id = None
    try:
        payload = {
            "motorcycle_id": moto_id,
            "needs_delivery": False,
            "needs_inspection": False,
            "needs_valuation": False,
            "needs_coc": True,
        }
        r = requests.post(f"{BASE_URL}/api/orders/buy-now", json=payload,
                          headers=dealer_headers, timeout=60)
        assert r.status_code == 200, f"buy-now failed for {brand}: {r.text}"
        body = r.json()
        order_id = body.get("order_id")
        assert order_id

        # Verify via GET /api/orders that needs_coc and coc_cost are persisted
        r2 = requests.get(f"{BASE_URL}/api/orders", headers=dealer_headers, timeout=30)
        assert r2.status_code == 200
        orders = r2.json()
        target = next((o for o in orders if o.get("id") == order_id), None)
        assert target is not None, f"Order {order_id} not found in GET /api/orders"
        assert target.get("needs_coc") is True, f"needs_coc not True: {target.get('needs_coc')}"
        assert target.get("coc_cost") == expected_coc, (
            f"coc_cost mismatch for {brand}: got {target.get('coc_cost')}, expected {expected_coc}"
        )
        # total_price = motorprijs + coc_cost
        assert target.get("total_price") == 5000.0 + expected_coc, (
            f"total_price mismatch for {brand}: got {target.get('total_price')}"
        )
    finally:
        if order_id:
            _delete_order(admin_headers, order_id)
        _delete_motorcycle(admin_headers, moto_id)


# ============ COC unsupported brand returns 400 ============

@pytest.mark.parametrize("brand", UNSUPPORTED_BRANDS)
def test_buy_now_with_coc_unsupported_brand_400(admin_headers, dealer_headers, brand):
    moto = _create_test_motorcycle(admin_headers, brand, price=5000.0)
    moto_id = moto["id"]
    try:
        payload = {
            "motorcycle_id": moto_id,
            "needs_delivery": False,
            "needs_coc": True,
        }
        r = requests.post(f"{BASE_URL}/api/orders/buy-now", json=payload,
                          headers=dealer_headers, timeout=30)
        assert r.status_code == 400, (
            f"Expected 400 for unsupported brand {brand}, got {r.status_code}: {r.text}"
        )
        detail = r.json().get("detail", "")
        assert "COC" in detail or "CVO" in detail or "niet beschikbaar" in detail.lower(), (
            f"Unexpected error message: {detail}"
        )
        # Motor must remain available (not consumed by failed order)
        r2 = requests.get(f"{BASE_URL}/api/motorcycles/{moto_id}",
                          headers=dealer_headers, timeout=30)
        if r2.status_code == 200:
            assert r2.json().get("is_available") is True, (
                "Motorcycle should remain available after 400 error"
            )
    finally:
        _delete_motorcycle(admin_headers, moto_id)


# ============ buy-now without COC -> coc_cost = 0 ============

def test_buy_now_without_coc_supported_brand(admin_headers, dealer_headers):
    moto = _create_test_motorcycle(admin_headers, "Yamaha", price=5000.0)
    moto_id = moto["id"]
    order_id = None
    try:
        payload = {
            "motorcycle_id": moto_id,
            "needs_delivery": False,
            "needs_coc": False,
        }
        r = requests.post(f"{BASE_URL}/api/orders/buy-now", json=payload,
                          headers=dealer_headers, timeout=60)
        assert r.status_code == 200, r.text
        order_id = r.json().get("order_id")

        r2 = requests.get(f"{BASE_URL}/api/orders", headers=dealer_headers, timeout=30)
        target = next((o for o in r2.json() if o.get("id") == order_id), None)
        assert target is not None
        assert target.get("needs_coc") is False
        assert target.get("coc_cost") == 0.0
        assert target.get("total_price") == 5000.0
    finally:
        if order_id:
            _delete_order(admin_headers, order_id)
        _delete_motorcycle(admin_headers, moto_id)
