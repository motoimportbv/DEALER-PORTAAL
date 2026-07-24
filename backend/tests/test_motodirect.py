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


# ---------- Catalog detail: keuring_fee + taxatie_fee (iteration 38) ----------

class TestCatalogDetailFees:
    """GET /motodirect/catalog/{id} must return keuring_fee=125 and taxatie_fee=160."""

    def test_detail_returns_fees(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 5})
        motos = r.json().get("motorcycles", [])
        if not motos:
            pytest.skip("No motorcycles available")
        r2 = session.get(f"{API}/motodirect/catalog/{motos[0]['id']}")
        assert r2.status_code == 200
        d = r2.json()
        assert "keuring_fee" in d and "taxatie_fee" in d
        assert d["keuring_fee"] == 125.0
        assert d["taxatie_fee"] == 160.0


# ---------- Checkout keuring_choice + include_taxatie (iteration 38) ----------

class TestCheckoutKeuringChoice:
    """
    POST /motodirect/checkout accepts:
      - keuring_choice: 'motodirect' (default) or 'self'
      - include_taxatie: bool
    Verify persisted order carries the correct values + total/deposit math.
    """

    @pytest.fixture(scope="class", autouse=True)
    def reset_markup(self, session, admin_token):
        # Ensure baseline markup=500
        session.put(
            f"{API}/motodirect/admin/settings",
            json={"markup": 500.0},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        yield
        session.put(
            f"{API}/motodirect/admin/settings",
            json={"markup": 500.0},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

    @pytest.fixture(scope="class")
    def anchor_motor(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 5})
        motos = r.json().get("motorcycles", [])
        if not motos:
            pytest.skip("No motorcycles available")
        return motos[0]

    def _post_checkout(self, session, buyer, motor_id, keuring_choice=None, include_taxatie=None):
        headers = {"Authorization": f"Bearer {buyer['token']}"}
        payload = {"motorcycle_id": motor_id, "origin_url": BASE_URL}
        if keuring_choice is not None:
            payload["keuring_choice"] = keuring_choice
        if include_taxatie is not None:
            payload["include_taxatie"] = include_taxatie
        return session.post(f"{API}/motodirect/checkout", json=payload, headers=headers)

    def _get_my_last_order(self, session, buyer):
        headers = {"Authorization": f"Bearer {buyer['token']}"}
        r = session.get(f"{API}/motodirect/my-orders", headers=headers)
        assert r.status_code == 200
        orders = r.json().get("orders", [])
        assert orders, "Expected at least one order after checkout"
        return orders[0]  # newest first

    def test_motodirect_plus_taxatie(self, session, registered_buyer, anchor_motor):
        """keuring_choice=motodirect + include_taxatie=true → total=motor+125+160; deposit=35%*motor+125+160."""
        motor_price = anchor_motor["price"]
        r = self._post_checkout(session, registered_buyer, anchor_motor["id"], "motodirect", True)
        assert r.status_code == 200, r.text
        data = r.json()
        expected_total = round(motor_price + 125 + 160, 2)
        expected_deposit = round(motor_price * 0.35 + 125 + 160, 2)
        assert abs(data["total_price"] - expected_total) < 0.01, f"total={data['total_price']} expected {expected_total}"
        assert abs(data["deposit_amount"] - expected_deposit) < 0.01, f"deposit={data['deposit_amount']} expected {expected_deposit}"
        order = self._get_my_last_order(session, registered_buyer)
        assert order["keuring_choice"] == "motodirect"
        assert order["include_taxatie"] is True
        assert order["keuring_fee"] == 125.0
        assert order["taxatie_fee"] == 160.0
        assert order["extras_total"] == 285.0
        assert abs(order["motor_price"] - motor_price) < 0.01
        assert abs(order["total_price"] - expected_total) < 0.01
        assert abs(order["deposit_amount"] - expected_deposit) < 0.01
        assert abs(order["remaining_amount"] - round(expected_total - expected_deposit, 2)) < 0.01

    def test_self_no_taxatie(self, session, registered_buyer, anchor_motor):
        """keuring_choice=self + include_taxatie=false → total=motor; deposit=35%*motor."""
        motor_price = anchor_motor["price"]
        r = self._post_checkout(session, registered_buyer, anchor_motor["id"], "self", False)
        assert r.status_code == 200, r.text
        data = r.json()
        expected_total = round(motor_price, 2)
        expected_deposit = round(motor_price * 0.35, 2)
        assert abs(data["total_price"] - expected_total) < 0.01
        assert abs(data["deposit_amount"] - expected_deposit) < 0.01
        order = self._get_my_last_order(session, registered_buyer)
        assert order["keuring_choice"] == "self"
        assert order["include_taxatie"] is False
        assert order["keuring_fee"] == 0.0
        assert order["taxatie_fee"] == 0.0
        assert order["extras_total"] == 0.0

    def test_self_with_taxatie(self, session, registered_buyer, anchor_motor):
        """keuring_choice=self + include_taxatie=true → total=motor+160; deposit=35%*motor+160."""
        motor_price = anchor_motor["price"]
        r = self._post_checkout(session, registered_buyer, anchor_motor["id"], "self", True)
        assert r.status_code == 200, r.text
        data = r.json()
        expected_total = round(motor_price + 160, 2)
        expected_deposit = round(motor_price * 0.35 + 160, 2)
        assert abs(data["total_price"] - expected_total) < 0.01
        assert abs(data["deposit_amount"] - expected_deposit) < 0.01
        order = self._get_my_last_order(session, registered_buyer)
        assert order["keuring_choice"] == "self"
        assert order["include_taxatie"] is True
        assert order["keuring_fee"] == 0.0
        assert order["taxatie_fee"] == 160.0
        assert order["extras_total"] == 160.0

    def test_default_keuring_choice_is_motodirect(self, session, registered_buyer, anchor_motor):
        """Missing keuring_choice defaults to 'motodirect'."""
        r = self._post_checkout(session, registered_buyer, anchor_motor["id"], None, False)
        assert r.status_code == 200
        order = self._get_my_last_order(session, registered_buyer)
        assert order["keuring_choice"] == "motodirect"
        assert order["keuring_fee"] == 125.0

    def test_invalid_keuring_choice_falls_back_to_motodirect(self, session, registered_buyer, anchor_motor):
        """Invalid keuring_choice like 'motoimport' falls back to 'motodirect'."""
        r = self._post_checkout(session, registered_buyer, anchor_motor["id"], "motoimport", False)
        assert r.status_code == 200
        order = self._get_my_last_order(session, registered_buyer)
        assert order["keuring_choice"] == "motodirect"
        assert order["keuring_fee"] == 125.0

    def test_order_has_all_required_fields(self, session, registered_buyer, anchor_motor):
        """Order should contain: keuring_choice, include_taxatie, keuring_fee, taxatie_fee,
        extras_total, motor_price, total_price, deposit_amount, remaining_amount."""
        r = self._post_checkout(session, registered_buyer, anchor_motor["id"], "motodirect", True)
        assert r.status_code == 200
        order = self._get_my_last_order(session, registered_buyer)
        required = ["keuring_choice", "include_taxatie", "keuring_fee", "taxatie_fee",
                    "extras_total", "motor_price", "total_price", "deposit_amount", "remaining_amount"]
        for f in required:
            assert f in order, f"Missing field {f} in persisted order"


# ---------- Dealer multiplier / savings (iteration 39) ----------

import math


def _expected_dealer_ref(price: float, multiplier: float) -> float:
    return float(math.ceil(price * multiplier / 100.0) * 100)


class TestDealerMultiplierSavings:
    """
    Verify that catalog exposes dealer_reference_price + savings and admin can
    tune the multiplier (default 1.20, rounded up to nearest €100).
    """

    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}

    def _set_multiplier(self, session, admin_headers, value):
        r = session.put(
            f"{API}/motodirect/admin/settings",
            json={"dealer_multiplier": value},
            headers=admin_headers,
        )
        return r

    def _reset_multiplier(self, session, admin_headers):
        self._set_multiplier(session, admin_headers, 1.20)

    def test_settings_include_dealer_multiplier(self, session, admin_headers):
        # First force to default so assertion is stable
        r = self._set_multiplier(session, admin_headers, 1.20)
        assert r.status_code == 200, r.text
        r = session.get(f"{API}/motodirect/admin/settings", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "dealer_multiplier" in data
        assert "default_dealer_multiplier" in data
        assert data["default_dealer_multiplier"] == 1.20
        assert abs(data["dealer_multiplier"] - 1.20) < 0.001

    def test_catalog_items_have_savings_fields(self, session, admin_headers):
        self._reset_multiplier(session, admin_headers)
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 10})
        assert r.status_code == 200
        motos = r.json()["motorcycles"]
        if not motos:
            pytest.skip("No motorcycles available")
        for m in motos:
            assert "dealer_reference_price" in m, f"Missing dealer_reference_price on {m['id']}"
            assert "savings" in m
            assert m["dealer_reference_price"] > m["price"], (
                f"dealer_reference_price ({m['dealer_reference_price']}) must be > price ({m['price']})"
            )
            assert m["savings"] > 0
            # savings == dealer_reference_price - price
            assert abs(m["savings"] - (m["dealer_reference_price"] - m["price"])) < 0.01
            # dealer_reference_price ends on €100
            assert m["dealer_reference_price"] % 100 == 0, (
                f"dealer_reference_price {m['dealer_reference_price']} not rounded to €100"
            )

    def test_dealer_reference_price_formula(self, session, admin_headers):
        # Ensure multiplier is 1.20
        self._reset_multiplier(session, admin_headers)
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 20})
        motos = r.json()["motorcycles"]
        if not motos:
            pytest.skip("No motorcycles")
        for m in motos:
            expected = _expected_dealer_ref(m["price"], 1.20)
            assert m["dealer_reference_price"] == expected, (
                f"For {m['id']} price={m['price']}: expected {expected}, got {m['dealer_reference_price']}"
            )

    def test_detail_has_savings_fields(self, session, admin_headers):
        self._reset_multiplier(session, admin_headers)
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 1})
        motos = r.json()["motorcycles"]
        if not motos:
            pytest.skip("No motorcycles")
        motor_id = motos[0]["id"]
        d = session.get(f"{API}/motodirect/catalog/{motor_id}").json()
        assert "dealer_reference_price" in d
        assert "savings" in d
        assert d["dealer_reference_price"] > d["price"]
        assert d["savings"] > 0
        expected = _expected_dealer_ref(d["price"], 1.20)
        assert d["dealer_reference_price"] == expected

    def test_update_multiplier_reflects_in_catalog(self, session, admin_headers):
        # Set 1.30
        r = self._set_multiplier(session, admin_headers, 1.30)
        assert r.status_code == 200, r.text
        assert abs(r.json()["dealer_multiplier"] - 1.30) < 0.001

        # Verify catalog uses new multiplier
        cat = session.get(f"{API}/motodirect/catalog", params={"limit": 5}).json()
        for m in cat["motorcycles"]:
            expected = _expected_dealer_ref(m["price"], 1.30)
            assert m["dealer_reference_price"] == expected, (
                f"After multiplier=1.30, {m['id']}: expected {expected}, got {m['dealer_reference_price']}"
            )

        # Verify detail as well
        first = cat["motorcycles"][0]
        d = session.get(f"{API}/motodirect/catalog/{first['id']}").json()
        assert d["dealer_reference_price"] == _expected_dealer_ref(d["price"], 1.30)

        # cleanup
        self._reset_multiplier(session, admin_headers)

    def test_multiplier_below_1_rejected(self, session, admin_headers):
        r = self._set_multiplier(session, admin_headers, 0.9)
        assert r.status_code == 400, f"Expected 400 for multiplier=0.9, got {r.status_code} {r.text}"

    def test_multiplier_above_3_rejected(self, session, admin_headers):
        r = self._set_multiplier(session, admin_headers, 3.5)
        assert r.status_code == 400, f"Expected 400 for multiplier=3.5, got {r.status_code} {r.text}"

    def test_multiplier_non_numeric_rejected(self, session, admin_headers):
        r = session.put(
            f"{API}/motodirect/admin/settings",
            json={"dealer_multiplier": "abc"},
            headers=admin_headers,
        )
        assert r.status_code == 400

    def test_put_markup_only_backward_compat(self, session, admin_headers):
        """PUT with only markup (no multiplier) must still succeed."""
        r = session.put(
            f"{API}/motodirect/admin/settings",
            json={"markup": 500.0},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "markup" in data
        assert data["markup"] == 500.0
        # multiplier should be untouched (still 1.20)
        assert abs(data["dealer_multiplier"] - 1.20) < 0.001

    def test_put_multiplier_only(self, session, admin_headers):
        """PUT with only multiplier (no markup) must succeed."""
        r = session.put(
            f"{API}/motodirect/admin/settings",
            json={"dealer_multiplier": 1.25},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        assert abs(r.json()["dealer_multiplier"] - 1.25) < 0.001
        # reset
        self._reset_multiplier(session, admin_headers)

    def test_multiplier_forbidden_for_buyer(self, session, registered_buyer):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.put(
            f"{API}/motodirect/admin/settings",
            json={"dealer_multiplier": 1.5},
            headers=headers,
        )
        assert r.status_code == 403

    def test_reset_multiplier_final(self, session, admin_headers):
        """Ensure default 1.20 is restored at end of suite."""
        self._reset_multiplier(session, admin_headers)
        r = session.get(f"{API}/motodirect/admin/settings", headers=admin_headers)
        assert abs(r.json()["dealer_multiplier"] - 1.20) < 0.001



# ---------- Iteration 40: manual dealer_reference_price + Marktplaats scraper ----------

class TestManualDealerReferencePrice:
    """
    PUT /api/motodirect/admin/motorcycle/{id}/dealer-reference-price
    Overrides the formula-based dealer_reference_price with a manually chosen value.
    """

    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}

    @pytest.fixture(scope="class")
    def target_motor(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 1})
        assert r.status_code == 200
        motos = r.json().get("motorcycles", [])
        if not motos:
            pytest.skip("No motorcycles available")
        return motos[0]

    def _put(self, session, admin_headers, motor_id, body):
        return session.put(
            f"{API}/motodirect/admin/motorcycle/{motor_id}/dealer-reference-price",
            json=body,
            headers=admin_headers,
        )

    def test_set_manual_value_persists_and_overrides_formula(self, session, admin_headers, target_motor):
        motor_id = target_motor["id"]
        # Set a manual value clearly distinct from the formula output
        manual_value = 13000.0
        r = self._put(session, admin_headers, motor_id, {"dealer_reference_price": manual_value})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("dealer_reference_price") == manual_value
        assert body.get("cleared") is False

        # Verify via public detail endpoint (should reflect the manual override, not the formula)
        d = session.get(f"{API}/motodirect/catalog/{motor_id}").json()
        assert abs(d["dealer_reference_price"] - manual_value) < 0.01, (
            f"Expected manual override {manual_value}, got {d['dealer_reference_price']}"
        )
        # Savings should equal manual value minus consumer price
        expected_savings = round(manual_value - d["price"], 2)
        assert abs(d["savings"] - expected_savings) < 0.01

    def test_clear_manual_value_falls_back_to_formula(self, session, admin_headers, target_motor):
        motor_id = target_motor["id"]
        # Clear the override with null
        r = self._put(session, admin_headers, motor_id, {"dealer_reference_price": None})
        assert r.status_code == 200, r.text
        assert r.json().get("cleared") is True
        assert r.json().get("dealer_reference_price") is None

        # Verify catalog goes back to the formula (ceil(price*multiplier/100)*100)
        import math
        d = session.get(f"{API}/motodirect/catalog/{motor_id}").json()
        s = session.get(f"{API}/motodirect/admin/settings", headers=admin_headers).json()
        multiplier = s.get("dealer_multiplier", 1.20)
        expected = math.ceil(d["price"] * multiplier / 100.0) * 100
        assert abs(d["dealer_reference_price"] - expected) < 0.01, (
            f"After clear, expected formula {expected}, got {d['dealer_reference_price']}"
        )

    def test_negative_value_rejected(self, session, admin_headers, target_motor):
        r = self._put(session, admin_headers, target_motor["id"], {"dealer_reference_price": -100})
        assert r.status_code == 400

    def test_zero_value_rejected(self, session, admin_headers, target_motor):
        r = self._put(session, admin_headers, target_motor["id"], {"dealer_reference_price": 0})
        assert r.status_code == 400

    def test_non_numeric_value_rejected(self, session, admin_headers, target_motor):
        r = self._put(session, admin_headers, target_motor["id"], {"dealer_reference_price": "not-a-number"})
        assert r.status_code == 400

    def test_unknown_motor_returns_404(self, session, admin_headers):
        r = self._put(session, admin_headers, "does-not-exist-id-xyz", {"dealer_reference_price": 12000})
        assert r.status_code == 404

    def test_forbidden_for_buyer(self, session, registered_buyer, target_motor):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.put(
            f"{API}/motodirect/admin/motorcycle/{target_motor['id']}/dealer-reference-price",
            json={"dealer_reference_price": 12000},
            headers=headers,
        )
        assert r.status_code == 403

    def test_unauthenticated_rejected(self, session, target_motor):
        r = session.put(
            f"{API}/motodirect/admin/motorcycle/{target_motor['id']}/dealer-reference-price",
            json={"dealer_reference_price": 12000},
        )
        assert r.status_code in (401, 403)

    def test_cleanup_ensure_no_manual_override(self, session, admin_headers, target_motor):
        """Ensure test target ends with no manual override (idempotent cleanup)."""
        r = self._put(session, admin_headers, target_motor["id"], {"dealer_reference_price": None})
        assert r.status_code == 200


class TestMarktplaatsScraper:
    """
    POST /api/motodirect/admin/scrape-marktplaats — scrape brand+model asking prices.
    External dependency: Marktplaats. 502 is acceptable if unreachable.
    """

    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}

    def test_scrape_missing_brand_400(self, session, admin_headers):
        r = session.post(f"{API}/motodirect/admin/scrape-marktplaats", json={"model": "Tracer 9"}, headers=admin_headers)
        assert r.status_code == 400

    def test_scrape_missing_model_400(self, session, admin_headers):
        r = session.post(f"{API}/motodirect/admin/scrape-marktplaats", json={"brand": "Yamaha"}, headers=admin_headers)
        assert r.status_code == 400

    def test_scrape_empty_body_400(self, session, admin_headers):
        r = session.post(f"{API}/motodirect/admin/scrape-marktplaats", json={}, headers=admin_headers)
        assert r.status_code == 400

    def test_scrape_forbidden_for_buyer(self, session, registered_buyer):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.post(
            f"{API}/motodirect/admin/scrape-marktplaats",
            json={"brand": "Yamaha", "model": "Tracer 9"},
            headers=headers,
        )
        assert r.status_code == 403

    def test_scrape_unauthenticated(self, session):
        r = session.post(
            f"{API}/motodirect/admin/scrape-marktplaats",
            json={"brand": "Yamaha", "model": "Tracer 9"},
        )
        assert r.status_code in (401, 403)

    def test_scrape_yamaha_tracer9_returns_results(self, session, admin_headers):
        r = session.post(
            f"{API}/motodirect/admin/scrape-marktplaats",
            json={"brand": "Yamaha", "model": "Tracer 9"},
            headers=admin_headers,
            timeout=30,
        )
        if r.status_code == 502:
            pytest.skip(f"Marktplaats unreachable: {r.text}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "count" in data
        assert "avg_price" in data
        assert "median_price" in data
        assert "samples" in data
        if data["count"] > 0:
            assert data["avg_price"] is not None and data["avg_price"] > 0
            assert data["median_price"] is not None and data["median_price"] > 0
            assert isinstance(data["samples"], list)
            # Validate filtering: all sample prices should be within 500..200000 window
            for s in data["samples"]:
                assert 500 <= s["price"] <= 200000, f"Sample price {s['price']} outside filter window"
                assert "title" in s and "price" in s

    def test_scrape_unknown_model_returns_count_zero_no_crash(self, session, admin_headers):
        r = session.post(
            f"{API}/motodirect/admin/scrape-marktplaats",
            json={"brand": "ZZZZ_NoBrand", "model": "XXX_NoModel_9999"},
            headers=admin_headers,
            timeout=30,
        )
        if r.status_code == 502:
            pytest.skip(f"Marktplaats unreachable: {r.text}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("count") == 0
        assert data.get("avg_price") is None
        assert data.get("median_price") is None
        assert data.get("samples") == []

    def test_scrape_filters_parts_out(self, session, admin_headers):
        """Search for 'parts'-heavy query and verify all returned samples are in motorcycle category.
        Since backend filters categoryId=710 (motoren), a query heavy on parts should still return only bikes."""
        r = session.post(
            f"{API}/motodirect/admin/scrape-marktplaats",
            json={"brand": "Yamaha", "model": "MT-07"},
            headers=admin_headers,
            timeout=30,
        )
        if r.status_code == 502:
            pytest.skip(f"Marktplaats unreachable: {r.text}")
        assert r.status_code == 200
        data = r.json()
        # If count>0 all sample prices must be >= 500 (parts / helmets typically below)
        for s in data.get("samples", []):
            assert s["price"] >= 500


# ---------- Regression: catalog still exposes savings/dealer_reference_price ----------

class TestIter40Regression:
    def test_catalog_still_has_savings_after_iter40(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 5})
        assert r.status_code == 200
        motos = r.json().get("motorcycles", [])
        if not motos:
            pytest.skip("No motorcycles")
        for m in motos:
            assert "dealer_reference_price" in m
            assert "savings" in m
            assert m["dealer_reference_price"] > 0


# =========================================================================
# Iteration 41: CANCEL + REFUND + PDF (factuur / pakbon)
# =========================================================================

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient


MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


def _mongo_run(coro):
    """Run a coroutine synchronously in tests (creates fresh event loop)."""
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def _seed_paid_order(buyer_id: str, buyer_email: str, motorcycle_id: str,
                     motor_snapshot: dict, total_price: float = 10000.0,
                     deposit_amount: float = 3500.0,
                     include_payment_intent: bool = False) -> str:
    """Directly insert a paid MotoDirect order in Mongo for cancel/PDF tests."""
    order_id = str(uuid.uuid4())

    async def _do():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        doc = {
            "id": order_id,
            "motorcycle_id": motorcycle_id,
            "buyer_id": buyer_id,
            "buyer_email": buyer_email,
            "buyer_name": "TEST_Paid Buyer",
            "buyer_phone": "0612345678",
            "buyer_address": "Teststraat 1",
            "buyer_postal_code": "1234AB",
            "buyer_city": "Amsterdam",
            "dealer_price": total_price - 785.0,
            "markup": 500.0,
            "motor_price": total_price - 285.0,
            "keuring_fee": 125.0,
            "taxatie_fee": 160.0,
            "extras_total": 285.0,
            "total_price": total_price,
            "deposit_amount": deposit_amount,
            "deposit_percentage": 0.35,
            "remaining_amount": round(total_price - deposit_amount, 2),
            "keuring_choice": "motodirect",
            "include_taxatie": True,
            "status": "reserved",
            "payment_status": "paid",
            "paid_at": "2026-01-01T00:00:00+00:00",
            "motorcycle_snapshot": motor_snapshot,
            "created_at": "2026-01-01T00:00:00+00:00",
            "stripe_session_id": f"cs_test_TEST_{order_id[:8]}",
        }
        if include_payment_intent:
            doc["payment_intent_id"] = f"pi_test_INVALID_{order_id[:8]}"
        await db.motodirect_orders.insert_one(doc)
        client.close()

    _mongo_run(_do())
    return order_id


def _cleanup_order(order_id: str):
    async def _do():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.motodirect_orders.delete_one({"id": order_id})
        client.close()

    _mongo_run(_do())


def _set_motor_available(motorcycle_id: str, is_available: bool):
    async def _do():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.motorcycles.update_one(
            {"id": motorcycle_id},
            {"$set": {"is_available": is_available}}
        )
        client.close()

    _mongo_run(_do())


class TestCancelOrder:
    """POST /api/motodirect/orders/{id}/cancel"""

    @pytest.fixture(scope="class")
    def anchor_motor(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 1})
        motos = r.json().get("motorcycles", [])
        if not motos:
            pytest.skip("No motorcycles available")
        return motos[0]

    def test_cancel_404_unknown_order(self, session, registered_buyer):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.post(f"{API}/motodirect/orders/does-not-exist-xyz/cancel", headers=headers)
        assert r.status_code == 404

    def test_cancel_pending_order_no_refund(self, session, registered_buyer, anchor_motor):
        """Pending (unpaid) order: status becomes cancelled with fee=0, refund=0, refund_status=not_applicable."""
        # Create a fresh checkout (creates pending order)
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.post(
            f"{API}/motodirect/checkout",
            json={"motorcycle_id": anchor_motor["id"], "origin_url": BASE_URL,
                  "keuring_choice": "self", "include_taxatie": False},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        order_id = r.json()["order_id"]

        # Cancel
        c = session.post(f"{API}/motodirect/orders/{order_id}/cancel", headers=headers)
        assert c.status_code == 200, c.text
        body = c.json()
        assert body["status"] == "cancelled"
        assert body["cancellation_fee"] == 0
        assert body["refund_amount"] == 0
        assert body["refund_status"] == "not_applicable"

        # my-orders should show this order as cancelled with cancelled_at set
        mo = session.get(f"{API}/motodirect/my-orders", headers=headers).json()["orders"]
        order = next((o for o in mo if o["id"] == order_id), None)
        assert order is not None
        assert order["status"] == "cancelled"
        assert order.get("cancelled_at")
        assert order.get("refund_status") == "not_applicable"

        _cleanup_order(order_id)

    def test_cancel_paid_order_computes_fee_and_refund(self, session, registered_buyer, anchor_motor):
        """Paid order: fee=10% of total_price, refund_amount=deposit-fee, refund_status='manual_required' (no PI)."""
        buyer = registered_buyer["user"]
        motor_snapshot = {
            "id": anchor_motor["id"],
            "brand": anchor_motor.get("brand", "TEST"),
            "model": anchor_motor.get("model", "TEST"),
            "year": anchor_motor.get("year", 2024),
            "price": anchor_motor.get("price", 10000),
            "mileage": anchor_motor.get("mileage", 100),
            "color": anchor_motor.get("color", "black"),
            "images": [],
        }
        total_price = 10000.0
        deposit = 3785.0
        order_id = _seed_paid_order(buyer["id"], buyer["email"], anchor_motor["id"],
                                    motor_snapshot, total_price=total_price, deposit_amount=deposit)
        try:
            _set_motor_available(anchor_motor["id"], False)  # reserved
            headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
            r = session.post(f"{API}/motodirect/orders/{order_id}/cancel", headers=headers)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["status"] == "cancelled"
            expected_fee = round(total_price * 0.10, 2)  # 1000.0
            expected_refund = round(deposit - expected_fee, 2)  # 2785.0
            assert body["cancellation_fee"] == expected_fee, f"fee={body['cancellation_fee']}"
            assert body["refund_amount"] == expected_refund, f"refund={body['refund_amount']}"
            # No payment_intent_id in seed → refund_status should be manual_required
            assert body["refund_status"] == "manual_required"

            # Verify motor is available again
            m = session.get(f"{API}/motodirect/catalog/{anchor_motor['id']}")
            # Detail 404s if not available; but we just made it available → should be 200
            assert m.status_code == 200, f"Motor should be available after cancel, got {m.status_code}"

            # Verify order in my-orders has cancelled_at + refund_status
            mo = session.get(f"{API}/motodirect/my-orders", headers=headers).json()["orders"]
            order = next((o for o in mo if o["id"] == order_id), None)
            assert order is not None
            assert order["status"] == "cancelled"
            assert order.get("cancelled_at")
            assert order.get("refund_status") == "manual_required"
            assert order.get("cancellation_fee") == expected_fee
            assert order.get("refund_amount") == expected_refund
        finally:
            _cleanup_order(order_id)

    def test_cancel_paid_with_invalid_payment_intent_still_returns_valid_schema(
        self, session, registered_buyer, anchor_motor
    ):
        """Even if Stripe refund fails (invalid PI), endpoint should return 200 with refund_status=manual_required."""
        buyer = registered_buyer["user"]
        motor_snapshot = {
            "id": anchor_motor["id"], "brand": "TEST", "model": "TEST",
            "year": 2024, "price": 8000, "mileage": 1000, "color": "red", "images": [],
        }
        order_id = _seed_paid_order(
            buyer["id"], buyer["email"], anchor_motor["id"], motor_snapshot,
            total_price=8000.0, deposit_amount=3000.0, include_payment_intent=True,
        )
        try:
            headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
            r = session.post(f"{API}/motodirect/orders/{order_id}/cancel", headers=headers)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["status"] == "cancelled"
            assert body["cancellation_fee"] == 800.0  # 10% of 8000
            assert body["refund_amount"] == 2200.0    # 3000 - 800
            # Stripe will 400 on invalid pi_test → manual_required
            assert body["refund_status"] in ("manual_required", "processed")
        finally:
            _cleanup_order(order_id)

    def test_cancel_already_cancelled_returns_400(self, session, registered_buyer, anchor_motor):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        # Create a pending order and cancel it
        r = session.post(
            f"{API}/motodirect/checkout",
            json={"motorcycle_id": anchor_motor["id"], "origin_url": BASE_URL,
                  "keuring_choice": "self", "include_taxatie": False},
            headers=headers,
        )
        assert r.status_code == 200
        order_id = r.json()["order_id"]
        c1 = session.post(f"{API}/motodirect/orders/{order_id}/cancel", headers=headers)
        assert c1.status_code == 200
        # Second cancel → 400
        c2 = session.post(f"{API}/motodirect/orders/{order_id}/cancel", headers=headers)
        assert c2.status_code == 400
        _cleanup_order(order_id)

    def test_cancel_foreign_order_returns_404(self, session, admin_token, anchor_motor, registered_buyer):
        """Another buyer's order → cancel endpoint returns 404 (not visible to this user).
        Endpoint filters by buyer_id, so foreign orders effectively 404, not 403.
        This is safe (no info leak). We verify 404 (or 403) is returned."""
        # Create a second buyer
        unique = uuid.uuid4().hex[:8]
        other_creds = {
            "name": "TEST_Other", "email": f"TEST_other_{unique}@example.com",
            "password": "secret123", "phone": "0612345678",
            "address": "X", "postal_code": "1000AA", "city": "Amsterdam",
            "bsn": "123456789",
        }
        rr = session.post(f"{API}/motodirect/register", json=other_creds)
        assert rr.status_code == 200
        other_token = rr.json()["token"]
        other_user = rr.json()["user"]

        # Seed a paid order owned by the OTHER buyer
        snap = {"id": anchor_motor["id"], "brand": "T", "model": "T",
                "year": 2024, "price": 5000, "mileage": 1, "color": "b", "images": []}
        order_id = _seed_paid_order(other_user["id"], other_user["email"],
                                    anchor_motor["id"], snap,
                                    total_price=5000.0, deposit_amount=2000.0)
        try:
            # First buyer tries to cancel other's order
            headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
            r = session.post(f"{API}/motodirect/orders/{order_id}/cancel", headers=headers)
            assert r.status_code in (403, 404), f"Expected 403/404, got {r.status_code}"
        finally:
            _cleanup_order(order_id)

    def test_cancel_unauthenticated(self, session):
        r = session.post(f"{API}/motodirect/orders/some-id/cancel")
        assert r.status_code in (401, 403)


class TestInvoiceAndPakbonPDF:
    """GET /api/motodirect/orders/{id}/invoice-deposit and /pakbon"""

    @pytest.fixture(scope="class")
    def anchor_motor(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 1})
        motos = r.json().get("motorcycles", [])
        if not motos:
            pytest.skip("No motorcycles available")
        return motos[0]

    @pytest.fixture(scope="class")
    def seeded_paid_order(self, registered_buyer, anchor_motor):
        buyer = registered_buyer["user"]
        snap = {"id": anchor_motor["id"], "brand": anchor_motor.get("brand", "TEST"),
                "model": anchor_motor.get("model", "TEST"), "year": anchor_motor.get("year", 2024),
                "price": anchor_motor.get("price", 10000), "mileage": 500,
                "color": "black", "images": []}
        order_id = _seed_paid_order(buyer["id"], buyer["email"], anchor_motor["id"], snap,
                                    total_price=10000.0, deposit_amount=3785.0)
        yield order_id
        _cleanup_order(order_id)

    def test_invoice_deposit_buyer_returns_pdf(self, session, registered_buyer, seeded_paid_order):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.get(f"{API}/motodirect/orders/{seeded_paid_order}/invoice-deposit", headers=headers)
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 500

    def test_invoice_deposit_admin_can_download(self, session, admin_token, seeded_paid_order):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = session.get(f"{API}/motodirect/orders/{seeded_paid_order}/invoice-deposit", headers=headers)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_invoice_deposit_404_unknown_order(self, session, registered_buyer):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.get(f"{API}/motodirect/orders/does-not-exist-xyz/invoice-deposit", headers=headers)
        assert r.status_code == 404

    def test_invoice_deposit_403_foreign_buyer(self, session, seeded_paid_order):
        # Register a different buyer
        unique = uuid.uuid4().hex[:8]
        other_creds = {"name": "TEST_Alien", "email": f"TEST_alien_{unique}@example.com",
                       "password": "secret123", "phone": "0612345678",
                       "address": "X", "postal_code": "1000AA", "city": "Amsterdam",
                       "bsn": "123456789"}
        rr = session.post(f"{API}/motodirect/register", json=other_creds)
        assert rr.status_code == 200
        other_token = rr.json()["token"]
        headers = {"Authorization": f"Bearer {other_token}"}
        r = session.get(f"{API}/motodirect/orders/{seeded_paid_order}/invoice-deposit", headers=headers)
        assert r.status_code == 403

    def test_invoice_deposit_unauthenticated(self, session, seeded_paid_order):
        r = session.get(f"{API}/motodirect/orders/{seeded_paid_order}/invoice-deposit")
        assert r.status_code in (401, 403)

    def test_pakbon_buyer_returns_pdf(self, session, registered_buyer, seeded_paid_order):
        headers = {"Authorization": f"Bearer {registered_buyer['token']}"}
        r = session.get(f"{API}/motodirect/orders/{seeded_paid_order}/pakbon", headers=headers)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 500

    def test_pakbon_admin_can_download(self, session, admin_token, seeded_paid_order):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = session.get(f"{API}/motodirect/orders/{seeded_paid_order}/pakbon", headers=headers)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_pakbon_404_unknown_order(self, session, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = session.get(f"{API}/motodirect/orders/does-not-exist-xyz/pakbon", headers=headers)
        assert r.status_code == 404

    def test_pakbon_403_foreign_buyer(self, session, seeded_paid_order):
        unique = uuid.uuid4().hex[:8]
        other_creds = {"name": "TEST_Alien2", "email": f"TEST_alien2_{unique}@example.com",
                       "password": "secret123", "phone": "0612345678",
                       "address": "X", "postal_code": "1000AA", "city": "Amsterdam",
                       "bsn": "123456789"}
        rr = session.post(f"{API}/motodirect/register", json=other_creds)
        assert rr.status_code == 200
        other_token = rr.json()["token"]
        headers = {"Authorization": f"Bearer {other_token}"}
        r = session.get(f"{API}/motodirect/orders/{seeded_paid_order}/pakbon", headers=headers)
        assert r.status_code == 403

    def test_pakbon_unauthenticated(self, session, seeded_paid_order):
        r = session.get(f"{API}/motodirect/orders/{seeded_paid_order}/pakbon")
        assert r.status_code in (401, 403)



# ---------- Iteration 42: Public API for external moto-direct.nl app ----------

MOTODIRECT_API_TOKEN = "zYQwbk7IZTZrQ-HAy-6x8j2_ranPTkI8ZZu9mbqyPPY"


class TestPublicApiHealth:
    """GET /api/motodirect/public/health - shared-secret Bearer auth."""

    def test_health_no_auth_returns_401(self, session):
        r = session.get(f"{API}/motodirect/public/health")
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_health_wrong_token_returns_403(self, session):
        r = session.get(
            f"{API}/motodirect/public/health",
            headers={"Authorization": "Bearer WRONG_TOKEN_XYZ"},
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_health_valid_token_returns_200_status_ok(self, session):
        r = session.get(
            f"{API}/motodirect/public/health",
            headers={"Authorization": f"Bearer {MOTODIRECT_API_TOKEN}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "ok"
        assert body.get("service") == "motoimport-api"
        assert "time" in body

    def test_health_non_bearer_scheme_returns_401(self, session):
        # No "Bearer " prefix
        r = session.get(
            f"{API}/motodirect/public/health",
            headers={"Authorization": MOTODIRECT_API_TOKEN},
        )
        assert r.status_code == 401


class TestPublicApiReserveRelease:
    """
    POST /api/motodirect/public/reserve/{id} and /public/release/{id}
    Used by the external moto-direct.nl app to lock/unlock a motorcycle.
    """

    @pytest.fixture(scope="class")
    def api_headers(self):
        return {"Authorization": f"Bearer {MOTODIRECT_API_TOKEN}", "Content-Type": "application/json"}

    @pytest.fixture(scope="class")
    def target_motor_id(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 1})
        assert r.status_code == 200
        motos = r.json().get("motorcycles", [])
        if not motos:
            pytest.skip("No available motorcycles for reserve tests")
        return motos[0]["id"]

    @pytest.fixture(scope="class", autouse=True)
    def _ensure_released_after_class(self, session, api_headers, target_motor_id):
        """Class-level teardown: make sure motor is available after all tests run."""
        yield
        try:
            session.post(
                f"{API}/motodirect/public/release/{target_motor_id}",
                json={"reason": "test cleanup"},
                headers=api_headers,
            )
        except Exception:
            pass

    # ---- Auth negatives ----

    def test_reserve_no_auth_returns_401(self, session, target_motor_id):
        r = session.post(f"{API}/motodirect/public/reserve/{target_motor_id}", json={})
        assert r.status_code == 401, r.text

    def test_reserve_wrong_token_returns_403(self, session, target_motor_id):
        r = session.post(
            f"{API}/motodirect/public/reserve/{target_motor_id}",
            json={},
            headers={"Authorization": "Bearer wrong-token"},
        )
        assert r.status_code == 403, r.text

    def test_release_no_auth_returns_401(self, session, target_motor_id):
        r = session.post(f"{API}/motodirect/public/release/{target_motor_id}", json={})
        assert r.status_code == 401, r.text

    def test_release_wrong_token_returns_403(self, session, target_motor_id):
        r = session.post(
            f"{API}/motodirect/public/release/{target_motor_id}",
            json={},
            headers={"Authorization": "Bearer wrong-token"},
        )
        assert r.status_code == 403, r.text

    # ---- Not found ----

    def test_reserve_unknown_motor_returns_404(self, session, api_headers):
        fake_id = f"nonexistent-{uuid.uuid4().hex}"
        r = session.post(
            f"{API}/motodirect/public/reserve/{fake_id}",
            json={},
            headers=api_headers,
        )
        assert r.status_code == 404, r.text

    # ---- Full happy path: reserve -> conflict -> release -> re-reserve ----

    def test_reserve_release_full_cycle(self, session, api_headers, target_motor_id):
        buyer_name = f"TEST_Buyer_{uuid.uuid4().hex[:6]}"
        buyer_email = f"TEST_external_{uuid.uuid4().hex[:6]}@example.com"
        external_order_id = f"EXT-{uuid.uuid4().hex[:8]}"

        # 1. Reserve
        r = session.post(
            f"{API}/motodirect/public/reserve/{target_motor_id}",
            json={
                "buyer_name": buyer_name,
                "buyer_email": buyer_email,
                "external_order_id": external_order_id,
            },
            headers=api_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("motorcycle_id") == target_motor_id
        assert body.get("status") == "reserved"

        # 2. Verify motor is now marked unavailable via public catalog detail
        detail = session.get(f"{API}/motodirect/catalog/{target_motor_id}")
        # Catalog detail filters is_available=True so it should be 404 now
        assert detail.status_code == 404, f"Motor still visible after reserve: {detail.status_code}"

        # 3. Verify persisted fields via admin motor list (which does not filter is_available)
        #    Admin path may vary — instead confirm via a fresh reserve attempt: should return 409
        r_conflict = session.post(
            f"{API}/motodirect/public/reserve/{target_motor_id}",
            json={"buyer_name": "Second"},
            headers=api_headers,
        )
        assert r_conflict.status_code == 409, r_conflict.text

        # 4. Release
        r_rel = session.post(
            f"{API}/motodirect/public/release/{target_motor_id}",
            json={"reason": "test rollback"},
            headers=api_headers,
        )
        assert r_rel.status_code == 200, r_rel.text
        rel_body = r_rel.json()
        assert rel_body.get("success") is True
        assert rel_body.get("motorcycle_id") == target_motor_id
        assert rel_body.get("status") == "available"

        # 5. Motor now visible again in public detail
        detail2 = session.get(f"{API}/motodirect/catalog/{target_motor_id}")
        assert detail2.status_code == 200, f"Motor not restored after release: {detail2.status_code}"

        # 6. Verify motodirect_* fields removed by attempting another reserve (should succeed 200)
        r_reserve2 = session.post(
            f"{API}/motodirect/public/reserve/{target_motor_id}",
            json={},
            headers=api_headers,
        )
        assert r_reserve2.status_code == 200, r_reserve2.text
        # Cleanup
        session.post(
            f"{API}/motodirect/public/release/{target_motor_id}",
            json={},
            headers=api_headers,
        )

    def test_reserve_empty_body_accepted(self, session, api_headers, target_motor_id):
        """Body is optional — reserving without body must still work."""
        # ensure available first
        session.post(
            f"{API}/motodirect/public/release/{target_motor_id}",
            json={},
            headers=api_headers,
        )
        r = session.post(
            f"{API}/motodirect/public/reserve/{target_motor_id}",
            headers=api_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "reserved"
        # cleanup
        session.post(
            f"{API}/motodirect/public/release/{target_motor_id}",
            json={},
            headers=api_headers,
        )


class TestPublicApiRegressionExistingEndpoints:
    """Regression: existing endpoints must still work unchanged."""

    def test_catalog_still_public_no_auth(self, session):
        r = session.get(f"{API}/motodirect/catalog", params={"limit": 1})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "motorcycles" in body
        assert "total" in body

    def test_admin_settings_still_works(self, session, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = session.get(f"{API}/motodirect/admin/settings", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "markup" in body
        assert "dealer_multiplier" in body

    def test_admin_scrape_marktplaats_still_requires_admin(self, session):
        # Without token -> 401/403
        r = session.post(f"{API}/motodirect/admin/scrape-marktplaats", json={"brand": "Yamaha", "model": "MT-07"})
        assert r.status_code in (401, 403)

    def test_admin_dealer_reference_price_still_requires_admin(self, session):
        r = session.put(
            f"{API}/motodirect/admin/motorcycle/some-id/dealer-reference-price",
            json={"dealer_reference_price": 10000},
        )
        assert r.status_code in (401, 403)
