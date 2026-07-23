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


# ---------- Admin markup settings (NEW iteration 37) ----------

class TestAdminSettings:
    """Tests voor /motodirect/admin/settings (markup config)."""

    def test_get_settings_admin(self, session, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = session.get(f"{API}/motodirect/admin/settings", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "markup" in data
        assert "default_markup" in data
        assert data["default_markup"] == 500.0
        # markup should be a number
        assert isinstance(data["markup"], (int, float))

    def test_get_settings_forbidden_for_buyer(self, session, registered_buyer):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.get(f"{API}/motodirect/admin/settings", headers=headers)
        assert r.status_code == 403

    def test_get_settings_forbidden_unauth(self, session):
        r = session.get(f"{API}/motodirect/admin/settings")
        assert r.status_code in (401, 403)

    def test_put_settings_negative_rejected(self, session, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = session.put(f"{API}/motodirect/admin/settings", json={"markup": -10}, headers=headers)
        assert r.status_code == 400

    def test_put_settings_non_numeric_rejected(self, session, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = session.put(f"{API}/motodirect/admin/settings", json={"markup": "abc"}, headers=headers)
        assert r.status_code == 400

    def test_put_settings_forbidden_for_buyer(self, session, registered_buyer):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.put(f"{API}/motodirect/admin/settings", json={"markup": 750}, headers=headers)
        assert r.status_code == 403


# ---------- Markup applied to catalog + reset ----------

class TestMarkupAppliedToCatalog:
    """
    E2E: change markup, verify GET /catalog reflects new price (dealer + markup),
    verify detail endpoint deposit is 35% of (dealer+markup), then reset to 500.
    Uses a module-scoped 'raw_dealer_price' anchor motor.
    """

    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}

    @pytest.fixture(scope="class")
    def anchor_motor_id(self, session):
        """Pick a motorcycle id we can use to test price movement."""
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 5})
        assert r.status_code == 200
        motos = r.json().get("motorcycles", [])
        if not motos:
            pytest.skip("No motorcycles available for markup test")
        return motos[0]["id"]

    def _set_markup(self, session, admin_headers, value):
        r = session.put(f"{API}/motodirect/admin/settings", json={"markup": value}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["markup"] == value
        return r.json()["markup"]

    def _get_detail_price(self, session, motor_id):
        r = session.get(f"{API}/motodirect/catalog/{motor_id}")
        assert r.status_code == 200
        return r.json()

    def test_default_markup_500_applied(self, session, admin_headers, anchor_motor_id):
        # Ensure markup is at default 500
        self._set_markup(session, admin_headers, 500.0)
        d = self._get_detail_price(session, anchor_motor_id)
        price_at_500 = d["price"]
        # deposit is 35% of consumer price
        expected_deposit = round(price_at_500 * 0.35, 2)
        assert abs(d["deposit_amount"] - expected_deposit) < 0.01
        assert d["deposit_percentage"] == 0.35
        # Save for later comparison
        TestMarkupAppliedToCatalog._price_at_500 = price_at_500

    def test_update_markup_750_reflected_immediately(self, session, admin_headers, anchor_motor_id):
        # Set markup to 750, catalog price should jump by exactly 250 vs. 500 baseline
        self._set_markup(session, admin_headers, 750.0)
        d = self._get_detail_price(session, anchor_motor_id)
        delta = round(d["price"] - TestMarkupAppliedToCatalog._price_at_500, 2)
        assert abs(delta - 250.0) < 0.01, f"Expected +250 in price, got {delta}"
        # deposit reflects new price
        assert abs(d["deposit_amount"] - round(d["price"] * 0.35, 2)) < 0.01
        # And in the catalog list also
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 100})
        motos = {m["id"]: m for m in r.json()["motorcycles"]}
        assert anchor_motor_id in motos
        assert abs(motos[anchor_motor_id]["price"] - d["price"]) < 0.01

    def test_update_markup_zero_edge_case(self, session, admin_headers, anchor_motor_id):
        # Setting markup to 0 should work (admin wants no margin)
        self._set_markup(session, admin_headers, 0.0)
        d = self._get_detail_price(session, anchor_motor_id)
        # price at 0 markup should be price_at_500 - 500
        expected = round(TestMarkupAppliedToCatalog._price_at_500 - 500.0, 2)
        assert abs(d["price"] - expected) < 0.01

    def test_reset_markup_to_500(self, session, admin_headers, anchor_motor_id):
        # Reset to 500 (cleanup so other tests are not affected)
        self._set_markup(session, admin_headers, 500.0)
        d = self._get_detail_price(session, anchor_motor_id)
        assert abs(d["price"] - TestMarkupAppliedToCatalog._price_at_500) < 0.01


# ---------- Checkout inspection_choice ----------

class TestCheckoutInspectionChoice:
    """
    Verify that POST /motodirect/checkout accepts inspection_choice and stores it on the order.
    We don't complete the Stripe payment - we just verify the order row got persisted with the
    correct inspection_choice and total_price = dealer + markup.
    """

    @pytest.fixture(scope="class")
    def anchor_motor(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 5})
        motos = r.json().get("motorcycles", [])
        if not motos:
            pytest.skip("No motorcycles available")
        return motos[0]

    def _post_checkout(self, session, buyer, motor_id, inspection_choice=None):
        headers = {"Authorization": f"Bearer {buyer['token']}"}
        payload = {"motorcycle_id": motor_id, "origin_url": BASE_URL}
        if inspection_choice is not None:
            payload["inspection_choice"] = inspection_choice
        return session.post(f"{API}/motodirect/checkout", json=payload, headers=headers)

    def _get_my_last_order(self, session, buyer):
        headers = {"Authorization": f"Bearer {buyer['token']}"}
        r = session.get(f"{API}/motodirect/my-orders", headers=headers)
        assert r.status_code == 200
        orders = r.json().get("orders", [])
        assert orders, "Expected at least one order after checkout"
        return orders[0]  # newest first

    def test_checkout_with_motoimport(self, session, registered_buyer, anchor_motor, admin_token):
        # Ensure markup default 500
        session.put(
            f"{API}/motodirect/admin/settings",
            json={"markup": 500.0},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        r = self._post_checkout(session, registered_buyer, anchor_motor["id"], "motoimport")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "checkout_url" in data
        assert "order_id" in data
        # Total price returned should be catalog price (already contains markup)
        assert abs(data["total_price"] - anchor_motor["price"]) < 0.01
        # Deposit is 35%
        assert abs(data["deposit_amount"] - round(anchor_motor["price"] * 0.35, 2)) < 0.01
        # Verify persisted order carries inspection_choice
        last_order = self._get_my_last_order(session, registered_buyer)
        assert last_order["inspection_choice"] == "motoimport"
        assert last_order["markup"] == 500.0
        assert abs(last_order["total_price"] - anchor_motor["price"]) < 0.01

    def test_checkout_with_motodirect(self, session, registered_buyer, anchor_motor):
        r = self._post_checkout(session, registered_buyer, anchor_motor["id"], "motodirect")
        assert r.status_code == 200
        last_order = self._get_my_last_order(session, registered_buyer)
        assert last_order["inspection_choice"] == "motodirect"

    def test_checkout_default_inspection_choice(self, session, registered_buyer, anchor_motor):
        # No inspection_choice -> defaults to motoimport
        r = self._post_checkout(session, registered_buyer, anchor_motor["id"], None)
        assert r.status_code == 200
        last_order = self._get_my_last_order(session, registered_buyer)
        assert last_order["inspection_choice"] == "motoimport"

    def test_checkout_invalid_choice_falls_back(self, session, registered_buyer, anchor_motor):
        # Weird value -> should silently fallback to motoimport (per router logic)
        r = self._post_checkout(session, registered_buyer, anchor_motor["id"], "banana")
        assert r.status_code == 200
        last_order = self._get_my_last_order(session, registered_buyer)
        assert last_order["inspection_choice"] == "motoimport"
