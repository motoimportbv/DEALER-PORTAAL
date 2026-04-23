"""Tests for COC/CVO v2 expanded feature:
- Honda removed from COC_PRICES (returns 400)
- Triumph uses Mage Motos supplier (admin_cost_chf=80, coc_cost=120)
- Yamaha/Kawasaki/KTM use Hostettler supplier (admin_cost_chf=0, coc_cost=75)
- Admin dashboard endpoint GET /api/admin/coc-orders (admin only)
- PUT /api/orders/{id}/coc-status (admin only, validates needs_coc + status)
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

HOSTETTLER = {
    "name": "Hostettler AG Eschenbach",
    "email": "walter.breny@hostettler-moto.ch",
    "admin_cost_chf": 0.0,
}
MAGE = {
    "name": "Mage Motos",
    "email": "mgredig@maegemotos.ch",
    "admin_cost_chf": 80.0,
}
SUPPLIER_EXPECTATIONS = {
    "Yamaha": (75.0, HOSTETTLER),
    "Kawasaki": (75.0, HOSTETTLER),
    "KTM": (75.0, HOSTETTLER),
    "Triumph": (120.0, MAGE),
}
VALID_COC_STATUSES = ["requested", "ordered_from_supplier", "coc_received", "sent_to_dealer"]


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def dealer_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": DEALER_EMAIL, "password": DEALER_PASS}, timeout=30)
    assert r.status_code == 200, f"Dealer login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


def _create_moto(admin_headers, brand, price=5000.0):
    payload = {
        "brand": brand, "model": "TEST_COC_V2", "year": 2023, "price": price,
        "mileage": 100, "color": "Black", "description": "TEST_COC_V2 ephemeral",
        "condition": "good", "images": [],
    }
    r = requests.post(f"{BASE_URL}/api/motorcycles", json=payload,
                      headers=admin_headers, timeout=30)
    assert r.status_code in (200, 201), f"Create moto failed: {r.text}"
    return r.json()


def _delete_moto(admin_headers, mid):
    try:
        requests.delete(f"{BASE_URL}/api/motorcycles/{mid}", headers=admin_headers, timeout=15)
    except Exception:
        pass


def _delete_order(admin_headers, oid):
    try:
        requests.delete(f"{BASE_URL}/api/orders/{oid}", headers=admin_headers, timeout=15)
    except Exception:
        pass


# ===== Honda is NOT orderable =====
def test_honda_coc_returns_400(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers, "Honda")
    try:
        r = requests.post(f"{BASE_URL}/api/orders/buy-now",
                          json={"motorcycle_id": moto["id"], "needs_coc": True},
                          headers=dealer_headers, timeout=30)
        assert r.status_code == 400, f"Expected 400 for Honda COC, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "Honda" in detail or "niet beschikbaar" in detail.lower(), f"Unexpected: {detail}"
    finally:
        _delete_moto(admin_headers, moto["id"])


# ===== Supplier metadata per brand =====
@pytest.mark.parametrize("brand,expected", list(SUPPLIER_EXPECTATIONS.items()))
def test_supplier_metadata_on_order(admin_headers, dealer_headers, brand, expected):
    expected_coc, supplier = expected
    moto = _create_moto(admin_headers, brand, price=4000.0)
    order_id = None
    try:
        r = requests.post(f"{BASE_URL}/api/orders/buy-now",
                          json={"motorcycle_id": moto["id"], "needs_coc": True},
                          headers=dealer_headers, timeout=60)
        assert r.status_code == 200, f"{brand} buy-now failed: {r.text}"
        order_id = r.json()["order_id"]

        # Fetch via admin coc-orders to see supplier fields
        r2 = requests.get(f"{BASE_URL}/api/admin/coc-orders", headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        orders = r2.json()
        target = next((o for o in orders if o.get("id") == order_id), None)
        assert target is not None, f"order {order_id} not in coc-orders list"
        assert target.get("coc_cost") == expected_coc, f"coc_cost mismatch for {brand}"
        assert target.get("coc_status") == "requested"
        assert target.get("coc_supplier_name") == supplier["name"]
        assert target.get("coc_supplier_email") == supplier["email"]
        assert target.get("coc_admin_cost_chf") == supplier["admin_cost_chf"]
        assert target.get("needs_coc") is True
        assert target.get("motorcycle") is not None
    finally:
        if order_id:
            _delete_order(admin_headers, order_id)
        _delete_moto(admin_headers, moto["id"])


# ===== GET /api/admin/coc-orders authz =====
def test_coc_orders_admin_access(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/coc-orders", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_coc_orders_dealer_forbidden(dealer_headers):
    r = requests.get(f"{BASE_URL}/api/admin/coc-orders", headers=dealer_headers, timeout=30)
    assert r.status_code == 403


# ===== PUT /api/orders/{id}/coc-status =====
def test_coc_status_update_success(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers, "Yamaha", price=3000.0)
    order_id = None
    try:
        r = requests.post(f"{BASE_URL}/api/orders/buy-now",
                          json={"motorcycle_id": moto["id"], "needs_coc": True},
                          headers=dealer_headers, timeout=30)
        assert r.status_code == 200
        order_id = r.json()["order_id"]

        r2 = requests.put(f"{BASE_URL}/api/orders/{order_id}/coc-status",
                          json={"status": "ordered_from_supplier"},
                          headers=admin_headers, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("status") == "ordered_from_supplier"

        # Verify persisted
        r3 = requests.get(f"{BASE_URL}/api/admin/coc-orders", headers=admin_headers, timeout=30)
        t = next((o for o in r3.json() if o.get("id") == order_id), None)
        assert t is not None
        assert t.get("coc_status") == "ordered_from_supplier"
        assert t.get("coc_updated_at"), "coc_updated_at should be set"
    finally:
        if order_id:
            _delete_order(admin_headers, order_id)
        _delete_moto(admin_headers, moto["id"])


def test_coc_status_invalid_status_400(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers, "Yamaha", price=3000.0)
    order_id = None
    try:
        r = requests.post(f"{BASE_URL}/api/orders/buy-now",
                          json={"motorcycle_id": moto["id"], "needs_coc": True},
                          headers=dealer_headers, timeout=30)
        order_id = r.json()["order_id"]
        r2 = requests.put(f"{BASE_URL}/api/orders/{order_id}/coc-status",
                          json={"status": "bogus_status"},
                          headers=admin_headers, timeout=30)
        assert r2.status_code == 400
    finally:
        if order_id:
            _delete_order(admin_headers, order_id)
        _delete_moto(admin_headers, moto["id"])


def test_coc_status_on_non_coc_order_400(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers, "Yamaha", price=3000.0)
    order_id = None
    try:
        r = requests.post(f"{BASE_URL}/api/orders/buy-now",
                          json={"motorcycle_id": moto["id"], "needs_coc": False},
                          headers=dealer_headers, timeout=30)
        assert r.status_code == 200
        order_id = r.json()["order_id"]
        r2 = requests.put(f"{BASE_URL}/api/orders/{order_id}/coc-status",
                          json={"status": "ordered_from_supplier"},
                          headers=admin_headers, timeout=30)
        assert r2.status_code == 400
        assert "geen COC" in r2.json().get("detail", "") or "COC" in r2.json().get("detail", "")
    finally:
        if order_id:
            _delete_order(admin_headers, order_id)
        _delete_moto(admin_headers, moto["id"])


def test_coc_status_dealer_forbidden(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers, "Yamaha", price=3000.0)
    order_id = None
    try:
        r = requests.post(f"{BASE_URL}/api/orders/buy-now",
                          json={"motorcycle_id": moto["id"], "needs_coc": True},
                          headers=dealer_headers, timeout=30)
        order_id = r.json()["order_id"]
        r2 = requests.put(f"{BASE_URL}/api/orders/{order_id}/coc-status",
                          json={"status": "ordered_from_supplier"},
                          headers=dealer_headers, timeout=30)
        assert r2.status_code == 403
    finally:
        if order_id:
            _delete_order(admin_headers, order_id)
        _delete_moto(admin_headers, moto["id"])
