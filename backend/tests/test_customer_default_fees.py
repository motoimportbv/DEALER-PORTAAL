"""Backend tests for Klantenbestand default_taxatie_fee + default_fee feature.

Verifies:
  - GET /api/customers returns default_taxatie_fee field
  - POST /api/customers persists default_taxatie_fee (number, null, clear)
  - POST /api/customers preserves default_fee (regression)
  - GET /api/customers?q=... filters
  - DELETE /api/customers/{id}
  - Role-based auth (admin/taxateur)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://promo-asset-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "motoimportbv@gmail.com", "password": "Admin2024!"}
TAXATEUR = {"email": "denizkabakolak10@hotmail.com", "password": "Kabakolakdeniz!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def taxateur_token():
    return _login(TAXATEUR)


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _find_customer(token, name):
    r = requests.get(f"{API}/customers?q={name}", headers=_hdr(token), timeout=20)
    assert r.status_code == 200
    for c in r.json():
        if c.get("name") == name:
            return c
    return None


@pytest.fixture
def cleanup_test_customers(admin_token, taxateur_token):
    created = []
    yield created
    # Cleanup created TEST_ customers from both users
    for tok in (admin_token, taxateur_token):
        try:
            r = requests.get(f"{API}/customers?q=TEST_", headers=_hdr(tok), timeout=20)
            if r.status_code == 200:
                for c in r.json():
                    if c.get("name", "").startswith("TEST_"):
                        requests.delete(f"{API}/customers/{c['id']}", headers=_hdr(tok), timeout=20)
        except Exception:
            pass


class TestCustomerDefaultFees:

    def test_list_customers_returns_default_taxatie_fee_field(self, admin_token):
        r = requests.get(f"{API}/customers", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Field should be present (even if null) when projection includes it
        # Find at least the schema by creating then re-reading (covered in other tests)

    def test_create_customer_with_default_taxatie_fee(self, admin_token, cleanup_test_customers):
        name = f"TEST_TaxFee_{uuid.uuid4().hex[:6]}"
        payload = {"name": name, "phone": "0612345678", "default_taxatie_fee": 175}
        r = requests.post(f"{API}/customers", json=payload, headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        # Verify via GET
        c = _find_customer(admin_token, name)
        assert c is not None, f"Customer {name} not found in list"
        assert "default_taxatie_fee" in c, f"default_taxatie_fee missing in response: {c}"
        assert c["default_taxatie_fee"] == 175.0
        cleanup_test_customers.append(c["id"])

    def test_create_customer_with_default_fee_regression(self, admin_token, cleanup_test_customers):
        name = f"TEST_ExtraFee_{uuid.uuid4().hex[:6]}"
        payload = {"name": name, "phone": "0611111111", "default_fee": 60}
        r = requests.post(f"{API}/customers", json=payload, headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        c = _find_customer(admin_token, name)
        assert c is not None
        assert c.get("default_fee") == 60.0
        cleanup_test_customers.append(c["id"])

    def test_create_customer_with_both_fees(self, admin_token, cleanup_test_customers):
        name = f"TEST_Both_{uuid.uuid4().hex[:6]}"
        payload = {"name": name, "phone": "0622222222", "default_taxatie_fee": 200, "default_fee": 75}
        r = requests.post(f"{API}/customers", json=payload, headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        c = _find_customer(admin_token, name)
        assert c is not None
        assert c.get("default_taxatie_fee") == 200.0
        assert c.get("default_fee") == 75.0
        cleanup_test_customers.append(c["id"])

    def test_clear_default_taxatie_fee(self, admin_token, cleanup_test_customers):
        name = f"TEST_Clear_{uuid.uuid4().hex[:6]}"
        # Create with fee
        r = requests.post(f"{API}/customers",
                          json={"name": name, "phone": "0633333333", "default_taxatie_fee": 180},
                          headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200
        c = _find_customer(admin_token, name)
        assert c["default_taxatie_fee"] == 180.0
        cleanup_test_customers.append(c["id"])

        # Clear with null
        r = requests.post(f"{API}/customers",
                          json={"name": name, "phone": "0633333333", "default_taxatie_fee": None},
                          headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200
        c2 = _find_customer(admin_token, name)
        assert c2.get("default_taxatie_fee") in (None, 0)  # cleared

        # Clear with empty string
        r = requests.post(f"{API}/customers",
                          json={"name": name, "phone": "0633333333", "default_taxatie_fee": 190},
                          headers=_hdr(admin_token), timeout=20)
        c3 = _find_customer(admin_token, name)
        assert c3.get("default_taxatie_fee") == 190.0
        r = requests.post(f"{API}/customers",
                          json={"name": name, "phone": "0633333333", "default_taxatie_fee": ""},
                          headers=_hdr(admin_token), timeout=20)
        c4 = _find_customer(admin_token, name)
        assert c4.get("default_taxatie_fee") in (None, 0)

    def test_filter_by_query(self, admin_token, cleanup_test_customers):
        uniq = uuid.uuid4().hex[:8]
        name = f"TEST_Filter_{uniq}"
        requests.post(f"{API}/customers",
                      json={"name": name, "phone": "0644444444", "default_taxatie_fee": 165},
                      headers=_hdr(admin_token), timeout=20)
        r = requests.get(f"{API}/customers?q={uniq}", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200
        results = r.json()
        assert any(c["name"] == name for c in results), "Filter by name did not return created customer"
        for c in results:
            if c["name"] == name:
                cleanup_test_customers.append(c["id"])

    def test_delete_customer(self, admin_token):
        name = f"TEST_Del_{uuid.uuid4().hex[:6]}"
        requests.post(f"{API}/customers",
                      json={"name": name, "phone": "0655555555"},
                      headers=_hdr(admin_token), timeout=20)
        c = _find_customer(admin_token, name)
        assert c is not None
        r = requests.delete(f"{API}/customers/{c['id']}", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "deleted"
        # Confirm gone
        assert _find_customer(admin_token, name) is None

    def test_delete_nonexistent_customer_returns_404(self, admin_token):
        r = requests.delete(f"{API}/customers/nonexistent-id-xyz", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 404

    def test_create_without_name_returns_400(self, admin_token):
        r = requests.post(f"{API}/customers", json={"name": "", "phone": "0699999999"},
                          headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 400

    def test_taxateur_can_access(self, taxateur_token, cleanup_test_customers):
        name = f"TEST_Tax_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/customers",
                          json={"name": name, "phone": "0666666666", "default_taxatie_fee": 175},
                          headers=_hdr(taxateur_token), timeout=20)
        assert r.status_code == 200, r.text
        c = _find_customer(taxateur_token, name)
        assert c is not None
        assert c.get("default_taxatie_fee") == 175.0

    def test_no_auth_returns_401(self):
        r = requests.get(f"{API}/customers", timeout=20)
        assert r.status_code in (401, 403)
