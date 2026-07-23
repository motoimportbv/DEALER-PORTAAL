"""
MotoDirect.nl B2C platform backend tests.
Covers: catalog, register, login, /me, my-orders, admin endpoints.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://promo-asset-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Admin2024!"


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json().get("token")


@pytest.fixture(scope="module")
def buyer_creds():
    unique = uuid.uuid4().hex[:8]
    return {
        "name": "TEST_Buyer",
        "email": f"TEST_buyer_{unique}@example.com",
        "password": "secret123",
        "phone": "0612345678",
        "address": "Teststraat 1",
        "postal_code": "1234AB",
        "city": "Amsterdam",
        "bsn": "123456789",
    }


@pytest.fixture(scope="module")
def registered_buyer(session, buyer_creds):
    r = session.post(f"{API}/motodirect/register", json=buyer_creds)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"], "creds": buyer_creds}


# ---------- Catalog (public) ----------

class TestCatalog:
    def test_catalog_list(self, session):
        r = session.get(f"{API}/motodirect/catalog")
        assert r.status_code == 200
        data = r.json()
        assert "motorcycles" in data
        assert "brands" in data
        assert "total" in data
        assert isinstance(data["motorcycles"], list)
        assert isinstance(data["brands"], list)

    def test_catalog_brand_filter(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"brand": "Yamaha"})
        assert r.status_code == 200
        data = r.json()
        for m in data["motorcycles"]:
            assert m["brand"] == "Yamaha"

    def test_catalog_price_filter(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"min_price": 1000, "max_price": 999999})
        assert r.status_code == 200
        for m in r.json()["motorcycles"]:
            assert 1000 <= (m.get("price") or 0) <= 999999

    def test_catalog_sort(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"sort": "price_low"})
        assert r.status_code == 200
        prices = [m.get("price") for m in r.json()["motorcycles"] if m.get("price") is not None]
        assert prices == sorted(prices)

    def test_catalog_detail_and_deposit(self, session):
        r = session.get(f"{API}/motodirect/catalog")
        motos = r.json()["motorcycles"]
        if not motos:
            pytest.skip("No motorcycles in catalog to test detail")
        motor_id = motos[0]["id"]
        r2 = session.get(f"{API}/motodirect/catalog/{motor_id}")
        assert r2.status_code == 200
        data = r2.json()
        assert data["id"] == motor_id
        assert "deposit_amount" in data
        assert "deposit_percentage" in data
        assert data["deposit_percentage"] == 0.35
        expected_deposit = round(float(data["price"]) * 0.35, 2)
        assert abs(data["deposit_amount"] - expected_deposit) < 0.01

    def test_catalog_detail_not_found(self, session):
        r = session.get(f"{API}/motodirect/catalog/nonexistent-id-xyz")
        assert r.status_code == 404


# ---------- Register ----------

class TestRegister:
    def test_register_success(self, registered_buyer):
        assert registered_buyer["token"]
        assert registered_buyer["user"]["role"] == "motodirect_buyer"
        assert registered_buyer["user"]["email"] == registered_buyer["creds"]["email"].lower()

    def test_register_duplicate_email(self, session, registered_buyer):
        # Try to register same email again
        r = session.post(f"{API}/motodirect/register", json=registered_buyer["creds"])
        assert r.status_code == 400
        assert "geregistreerd" in r.text.lower() or "al" in r.text.lower()

    def test_register_invalid_bsn(self, session):
        payload = {
            "name": "TEST_BadBsn",
            "email": f"TEST_bsn_{uuid.uuid4().hex[:8]}@example.com",
            "password": "secret123",
            "phone": "0612345678",
            "address": "Teststraat 1",
            "postal_code": "1234AB",
            "city": "Amsterdam",
            "bsn": "1234567",  # only 7 digits, invalid
        }
        r = session.post(f"{API}/motodirect/register", json=payload)
        assert r.status_code == 400
        assert "bsn" in r.text.lower()

    def test_register_missing_fields(self, session):
        r = session.post(f"{API}/motodirect/register", json={"email": "x@y.com"})
        assert r.status_code == 400

    def test_register_short_password(self, session):
        payload = {
            "name": "TEST_Short",
            "email": f"TEST_shortpw_{uuid.uuid4().hex[:8]}@example.com",
            "password": "123",
            "phone": "0612345678",
            "address": "Teststraat 1",
            "postal_code": "1234AB",
            "city": "Amsterdam",
            "bsn": "123456789",
        }
        r = session.post(f"{API}/motodirect/register", json=payload)
        assert r.status_code == 400


# ---------- Login ----------

class TestLogin:
    def test_login_success(self, session, registered_buyer):
        creds = registered_buyer["creds"]
        r = session.post(f"{API}/motodirect/login", json={"email": creds["email"], "password": creds["password"]})
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "motodirect_buyer"
        assert data["token"]

    def test_login_wrong_password(self, session, registered_buyer):
        r = session.post(f"{API}/motodirect/login", json={"email": registered_buyer["creds"]["email"], "password": "wrongpw"})
        assert r.status_code == 401

    def test_login_unknown_email(self, session):
        r = session.post(f"{API}/motodirect/login", json={"email": "unknown_xyz@example.com", "password": "anything123"})
        assert r.status_code == 401


# ---------- /me and /my-orders ----------

class TestBuyerProfile:
    def test_me_authenticated(self, session, registered_buyer):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.get(f"{API}/motodirect/me", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == registered_buyer["creds"]["email"].lower()
        assert data["city"] == registered_buyer["creds"]["city"]
        assert data["postal_code"] == registered_buyer["creds"]["postal_code"]

    def test_me_unauthenticated(self, session):
        r = session.get(f"{API}/motodirect/me")
        assert r.status_code in (401, 403)

    def test_my_orders_authenticated_empty(self, session, registered_buyer):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.get(f"{API}/motodirect/my-orders", headers=headers)
        assert r.status_code == 200
        assert "orders" in r.json()
        assert isinstance(r.json()["orders"], list)

    def test_my_orders_unauthenticated(self, session):
        r = session.get(f"{API}/motodirect/my-orders")
        assert r.status_code in (401, 403)


# ---------- Admin endpoints ----------

class TestAdminEndpoints:
    def test_admin_orders(self, session, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = session.get(f"{API}/motodirect/admin/orders", headers=headers)
        assert r.status_code == 200
        assert "orders" in r.json()

    def test_admin_customers(self, session, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = session.get(f"{API}/motodirect/admin/customers", headers=headers)
        assert r.status_code == 200
        assert "customers" in r.json()

    def test_admin_orders_requires_admin(self, session, registered_buyer):
        # buyer cannot access admin
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.get(f"{API}/motodirect/admin/orders", headers=headers)
        assert r.status_code == 403

    def test_admin_customers_requires_admin(self, session, registered_buyer):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.get(f"{API}/motodirect/admin/customers", headers=headers)
        assert r.status_code == 403

    def test_admin_orders_unauthenticated(self, session):
        r = session.get(f"{API}/motodirect/admin/orders")
        assert r.status_code in (401, 403)


# ---------- Role isolation on buyer endpoints ----------

class TestRoleIsolation:
    def test_admin_cannot_use_motodirect_me(self, session, admin_token):
        # /motodirect/me requires role motodirect_buyer, admin should be rejected
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = session.get(f"{API}/motodirect/me", headers=headers)
        assert r.status_code == 403
