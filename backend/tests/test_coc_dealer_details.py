"""Tests for COC/CVO dealer-provided details (brand, type, chassis, document):

- Validation: missing coc_brand -> 400 "Vul het merk in voor COC/CVO"
- Validation: missing coc_type -> 400 "Vul het type in voor COC/CVO"
- Validation: missing chassis AND document -> 400
- Success with brand+type+chassis stored correctly
- Success with brand+type+document_url (no chassis)
- GET /api/admin/coc-orders exposes coc_brand/type/chassis/document_url
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


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}",
            "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def dealer_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": DEALER_EMAIL, "password": DEALER_PASS}, timeout=30)
    assert r.status_code == 200, f"Dealer login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}",
            "Content-Type": "application/json"}


def _create_moto(admin_headers, brand="Yamaha", model="TEST_COC_DETAILS", price=3500.0):
    payload = {
        "brand": brand, "model": model, "year": 2023, "price": price,
        "mileage": 200, "color": "Red",
        "description": "TEST_COC_DETAILS ephemeral test bike",
        "condition": "good", "images": [],
    }
    r = requests.post(f"{BASE_URL}/api/motorcycles", json=payload,
                      headers=admin_headers, timeout=30)
    assert r.status_code in (200, 201), f"Create moto failed: {r.text}"
    return r.json()


def _delete_moto(admin_headers, mid):
    try:
        requests.delete(f"{BASE_URL}/api/motorcycles/{mid}",
                        headers=admin_headers, timeout=15)
    except Exception:
        pass


def _delete_order(admin_headers, oid):
    try:
        requests.delete(f"{BASE_URL}/api/orders/{oid}",
                        headers=admin_headers, timeout=15)
    except Exception:
        pass


# ---------- Validation: brand missing ----------
def test_missing_brand_returns_400(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers)
    try:
        r = requests.post(f"{BASE_URL}/api/orders/buy-now",
                          json={"motorcycle_id": moto["id"], "needs_coc": True},
                          headers=dealer_headers, timeout=30)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "merk" in detail.lower() and "coc" in detail.lower(), \
            f"Unexpected detail: {detail}"
    finally:
        _delete_moto(admin_headers, moto["id"])


# ---------- Validation: type missing ----------
def test_missing_type_returns_400(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers)
    try:
        r = requests.post(f"{BASE_URL}/api/orders/buy-now",
                          json={"motorcycle_id": moto["id"], "needs_coc": True,
                                "coc_brand": "Yamaha"},
                          headers=dealer_headers, timeout=30)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "type" in detail.lower() and "coc" in detail.lower(), \
            f"Unexpected detail: {detail}"
    finally:
        _delete_moto(admin_headers, moto["id"])


# ---------- Validation: chassis AND document missing ----------
def test_missing_chassis_and_document_returns_400(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers)
    try:
        r = requests.post(f"{BASE_URL}/api/orders/buy-now",
                          json={"motorcycle_id": moto["id"], "needs_coc": True,
                                "coc_brand": "Yamaha", "coc_type": "MT-07"},
                          headers=dealer_headers, timeout=30)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert ("chassis" in detail.lower()) or ("kenteken" in detail.lower()), \
            f"Unexpected detail: {detail}"
    finally:
        _delete_moto(admin_headers, moto["id"])


# ---------- Success with chassis ----------
def test_success_with_chassis_persists_fields(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers, brand="Yamaha")
    order_id = None
    try:
        payload = {
            "motorcycle_id": moto["id"],
            "needs_coc": True,
            "coc_brand": "Yamaha",
            "coc_type": "MT-07",
            "coc_chassis_number": "JYACHASSIS1234567",
        }
        r = requests.post(f"{BASE_URL}/api/orders/buy-now", json=payload,
                          headers=dealer_headers, timeout=30)
        assert r.status_code == 200, f"buy-now failed: {r.text}"
        order_id = r.json()["order_id"]

        # Verify via admin coc-orders
        r2 = requests.get(f"{BASE_URL}/api/admin/coc-orders",
                          headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        target = next((o for o in r2.json() if o.get("id") == order_id), None)
        assert target is not None, f"Order {order_id} not found in coc-orders"
        assert target.get("coc_brand") == "Yamaha"
        assert target.get("coc_type") == "MT-07"
        assert target.get("coc_chassis_number") == "JYACHASSIS1234567"
        # document url should be empty/None
        assert not target.get("coc_document_url")
    finally:
        if order_id:
            _delete_order(admin_headers, order_id)
        _delete_moto(admin_headers, moto["id"])


# ---------- Success with document URL (no chassis) ----------
def test_success_with_document_only_persists_fields(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers, brand="Kawasaki")
    order_id = None
    try:
        payload = {
            "motorcycle_id": moto["id"],
            "needs_coc": True,
            "coc_brand": "Kawasaki",
            "coc_type": "Z900",
            "coc_document_url": "https://example.com/uploads/kenteken.jpg",
        }
        r = requests.post(f"{BASE_URL}/api/orders/buy-now", json=payload,
                          headers=dealer_headers, timeout=30)
        assert r.status_code == 200, f"buy-now failed: {r.text}"
        order_id = r.json()["order_id"]

        r2 = requests.get(f"{BASE_URL}/api/admin/coc-orders",
                          headers=admin_headers, timeout=30)
        target = next((o for o in r2.json() if o.get("id") == order_id), None)
        assert target is not None
        assert target.get("coc_brand") == "Kawasaki"
        assert target.get("coc_type") == "Z900"
        assert target.get("coc_document_url") == "https://example.com/uploads/kenteken.jpg"
        # chassis may be empty
        assert not target.get("coc_chassis_number")
    finally:
        if order_id:
            _delete_order(admin_headers, order_id)
        _delete_moto(admin_headers, moto["id"])


# ---------- Admin coc-orders list exposes all 4 fields keys ----------
def test_admin_coc_orders_exposes_dealer_fields(admin_headers, dealer_headers):
    moto = _create_moto(admin_headers, brand="KTM")
    order_id = None
    try:
        payload = {
            "motorcycle_id": moto["id"], "needs_coc": True,
            "coc_brand": "KTM", "coc_type": "Duke 790",
            "coc_chassis_number": "VBKDUKE99999",
            "coc_document_url": "https://example.com/kenteken2.jpg",
        }
        r = requests.post(f"{BASE_URL}/api/orders/buy-now", json=payload,
                          headers=dealer_headers, timeout=30)
        assert r.status_code == 200, r.text
        order_id = r.json()["order_id"]

        r2 = requests.get(f"{BASE_URL}/api/admin/coc-orders",
                          headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        target = next((o for o in r2.json() if o.get("id") == order_id), None)
        assert target is not None
        # all 4 dealer-provided fields are present
        for key in ("coc_brand", "coc_type", "coc_chassis_number", "coc_document_url"):
            assert key in target, f"Missing key {key} in admin coc-orders response"
        assert target["coc_brand"] == "KTM"
        assert target["coc_type"] == "Duke 790"
        assert target["coc_chassis_number"] == "VBKDUKE99999"
        assert target["coc_document_url"] == "https://example.com/kenteken2.jpg"
    finally:
        if order_id:
            _delete_order(admin_headers, order_id)
        _delete_moto(admin_headers, moto["id"])
