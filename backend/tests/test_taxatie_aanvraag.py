"""Backend tests for /api/public/taxatie-aanvraag + /api/admin/taxatie-aanvragen."""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://promo-asset-lab.preview.emergentagent.com').rstrip('/')

ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Admin2024!"
TAXATEUR_EMAIL = "denizkabakolak10@hotmail.com"
TAXATEUR_PASSWORD = "Kabakolakdeniz!"
DEALER_EMAIL = "zoektest@dealer.nl"
DEALER_PASSWORD = "Test2024!"

FIXED_FIELDS = [
    "foto_voorwiel", "foto_achterwiel", "foto_km_stand", "foto_chassisnummer",
    "foto_motorfiets_links", "foto_motorfiets_rechts", "foto_inkoop_verklaring",
    "foto_kenteken_voor", "foto_kenteken_achter",
]

# Tiny PNG bytes (1x1)
import base64
TINY_JPG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def _img():
    return ('test.jpg', io.BytesIO(TINY_JPG), 'image/jpeg')


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def taxateur_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TAXATEUR_EMAIL, "password": TAXATEUR_PASSWORD}, timeout=15)
    if r.status_code != 200:
        return None
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def dealer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": DEALER_EMAIL, "password": DEALER_PASSWORD}, timeout=15)
    if r.status_code != 200:
        return None
    return r.json().get("token") or r.json().get("access_token")


TEST_NAME = f"TEST_AANVRAAG_{int(time.time())}"

created = {"aanvraag_id": None, "customer_id": None, "file_url": None}


# ============ PUBLIC SUBMISSION ============

class TestPublicSubmission:
    def test_submit_success(self):
        data = {
            "bedrijfsnaam": TEST_NAME,
            "contactpersoon": "Tester",
            "email": "test@dealer.test",
            "telefoon": "0612345678",
            "adres": "Teststraat 1",
            "woonplaats": "Amsterdam",
            "rsin": "123456789",
            "opmerking": "Test submission",
        }
        files = [(f, _img()) for f in FIXED_FIELDS]
        # 3 detail photos
        for _ in range(3):
            files.append(("detail_fotos", _img()))
        r = requests.post(f"{BASE_URL}/api/public/taxatie-aanvraag", data=data, files=files, timeout=60)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        body = r.json()
        assert body["status"] == "ok"
        assert "id" in body
        assert body["files_uploaded"] == 12  # 9 + 3
        assert body.get("customer_id"), "customer_id should be present"
        created["aanvraag_id"] = body["id"]
        created["customer_id"] = body["customer_id"]

    def test_too_many_detail_photos(self):
        data = {
            "bedrijfsnaam": "TEST_TOO_MANY",
            "email": "x@y.test",
            "adres": "A", "woonplaats": "B", "rsin": "1",
        }
        files = [(f, _img()) for f in FIXED_FIELDS]
        for _ in range(21):
            files.append(("detail_fotos", _img()))
        r = requests.post(f"{BASE_URL}/api/public/taxatie-aanvraag", data=data, files=files, timeout=60)
        assert r.status_code == 400
        assert "Maximaal 20" in r.json().get("detail", "")

    def test_missing_required_photo(self):
        data = {
            "bedrijfsnaam": "TEST_MISSING",
            "email": "x@y.test",
            "adres": "A", "woonplaats": "B", "rsin": "1",
        }
        # Skip foto_voorwiel
        files = [(f, _img()) for f in FIXED_FIELDS if f != "foto_voorwiel"]
        r = requests.post(f"{BASE_URL}/api/public/taxatie-aanvraag", data=data, files=files, timeout=60)
        assert r.status_code == 422


# ============ STATIC FILE SERVING ============

class TestStaticFiles:
    def test_uploaded_file_accessible(self, admin_token):
        # Get aanvraag details to extract file URL
        if not created["aanvraag_id"]:
            pytest.skip("No aanvraag created")
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/taxatie-aanvragen/{created['aanvraag_id']}", headers=h, timeout=15)
        assert r.status_code == 200
        files = r.json().get("files", [])
        assert len(files) > 0
        url = files[0]["url"]
        created["file_url"] = url
        full = f"{BASE_URL}{url}"
        r2 = requests.get(full, timeout=15)
        assert r2.status_code == 200, f"file URL {full} returned {r2.status_code}"
        assert "image" in r2.headers.get("content-type", "").lower()


# ============ ADMIN ENDPOINTS ============

class TestAdminEndpoints:
    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/taxatie-aanvragen", timeout=15)
        assert r.status_code in (401, 403)

    def test_list_forbidden_for_dealer(self, dealer_token):
        if not dealer_token:
            pytest.skip("no dealer token")
        h = {"Authorization": f"Bearer {dealer_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/taxatie-aanvragen", headers=h, timeout=15)
        assert r.status_code in (401, 403)

    def test_list_works_for_admin(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/taxatie-aanvragen", headers=h, timeout=15)
        assert r.status_code == 200
        aanvragen = r.json().get("aanvragen", [])
        assert isinstance(aanvragen, list)
        assert any(a["id"] == created["aanvraag_id"] for a in aanvragen)
        # Newest first
        if len(aanvragen) >= 2:
            assert aanvragen[0]["created_at"] >= aanvragen[-1]["created_at"]

    def test_list_works_for_taxateur(self, taxateur_token):
        if not taxateur_token:
            pytest.skip("no taxateur token")
        h = {"Authorization": f"Bearer {taxateur_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/taxatie-aanvragen", headers=h, timeout=15)
        # Per spec taxateur should have access
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"

    def test_get_single(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/taxatie-aanvragen/{created['aanvraag_id']}", headers=h, timeout=15)
        assert r.status_code == 200
        doc = r.json()
        assert doc["bedrijfsnaam"] == TEST_NAME
        assert doc["status"] == "nieuw"
        assert len(doc["files"]) == 12

    def test_status_update_valid(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(
            f"{BASE_URL}/api/admin/taxatie-aanvragen/{created['aanvraag_id']}/status",
            json={"status": "in_behandeling"}, headers=h, timeout=15,
        )
        assert r.status_code == 200
        # Verify
        r2 = requests.get(f"{BASE_URL}/api/admin/taxatie-aanvragen/{created['aanvraag_id']}", headers=h, timeout=15)
        assert r2.json()["status"] == "in_behandeling"

    def test_status_update_invalid(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(
            f"{BASE_URL}/api/admin/taxatie-aanvragen/{created['aanvraag_id']}/status",
            json={"status": "bogus"}, headers=h, timeout=15,
        )
        assert r.status_code == 400


# ============ CUSTOMER AUTO-CREATE ============

class TestCustomerLink:
    def test_customer_created_for_admin(self, admin_token):
        if not created["customer_id"]:
            pytest.skip("No customer created")
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/customers", headers=h, timeout=15)
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("customers", [])
        match = [c for c in items if c.get("id") == created["customer_id"]]
        assert match, f"Customer {created['customer_id']} not found in /api/customers"
        c = match[0]
        assert c["name"] == TEST_NAME
        assert c.get("rsin") == "123456789"
        assert c.get("city") == "Amsterdam"

    def test_upsert_no_duplicate(self, admin_token):
        # Submit again with same bedrijfsnaam -> customer should NOT duplicate
        data = {
            "bedrijfsnaam": TEST_NAME,
            "email": "test2@dealer.test",
            "telefoon": "0699999999",
            "adres": "Newstraat 9", "woonplaats": "Rotterdam", "rsin": "987654321",
        }
        files = [(f, _img()) for f in FIXED_FIELDS]
        r = requests.post(f"{BASE_URL}/api/public/taxatie-aanvraag", data=data, files=files, timeout=60)
        assert r.status_code == 200
        body = r.json()
        # Same customer_id as before
        assert body["customer_id"] == created["customer_id"], "Customer should be upserted, not duplicated"
        # Cleanup this 2nd aanvraag
        h = {"Authorization": f"Bearer {admin_token}"}
        requests.delete(f"{BASE_URL}/api/admin/taxatie-aanvragen/{body['id']}", headers=h, timeout=15)


# ============ CLEANUP ============

class TestZCleanup:
    def test_delete_aanvraag(self, admin_token):
        if not created["aanvraag_id"]:
            pytest.skip()
        h = {"Authorization": f"Bearer {admin_token}"}
        # Delete
        r = requests.delete(f"{BASE_URL}/api/admin/taxatie-aanvragen/{created['aanvraag_id']}", headers=h, timeout=15)
        assert r.status_code == 200
        # Verify gone
        r2 = requests.get(f"{BASE_URL}/api/admin/taxatie-aanvragen/{created['aanvraag_id']}", headers=h, timeout=15)
        assert r2.status_code == 404
        # Verify file gone
        if created["file_url"]:
            r3 = requests.get(f"{BASE_URL}{created['file_url']}", timeout=15)
            assert r3.status_code == 404, f"file should be deleted but got {r3.status_code}"

    def test_delete_customer(self, admin_token):
        if not created["customer_id"]:
            pytest.skip()
        h = {"Authorization": f"Bearer {admin_token}"}
        requests.delete(f"{BASE_URL}/api/customers/{created['customer_id']}", headers=h, timeout=15)
