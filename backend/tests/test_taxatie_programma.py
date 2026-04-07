"""
Test suite for Taxatie Programma (Motorcycle Valuation Module)
Tests all CRUD operations and access control for the taxatie-programma endpoints.
Also verifies Google Motors endpoints still work after server.py modifications.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Admin2024!"
DEALER_EMAIL = "testgoogle@dealer.nl"
DEALER_PASSWORD = "Test2024!"


class TestTaxatieProgrammaBackend:
    """Test Taxatie Programma API endpoints"""
    
    admin_token = None
    dealer_token = None
    created_taxatie_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin and dealer tokens"""
        # Admin login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            TestTaxatieProgrammaBackend.admin_token = response.json().get("token")
            print(f"SUCCESS: Admin login successful")
        else:
            print(f"ERROR: Admin login failed: {response.status_code} - {response.text}")
            pytest.skip("Admin login failed")
        
        # Dealer login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        if response.status_code == 200:
            TestTaxatieProgrammaBackend.dealer_token = response.json().get("token")
            print(f"SUCCESS: Dealer login successful")
        else:
            print(f"WARNING: Dealer login failed (may not exist): {response.status_code}")
    
    # ============ TAXATIE PROGRAMMA CRUD TESTS ============
    
    def test_01_create_taxatie(self):
        """Test creating a new taxatie"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        taxatie_data = {
            "kenteken": "TEST-123-AB",
            "brand": "BMW",
            "model": "R1250GS Adventure",
            "year": 2023,
            "mileage": 15000,
            "color": "Zwart",
            "vin_number": "WB10A1234TEST5678",
            "first_registration": "01-03-2023",
            "fuel_type": "Benzine",
            "cylinder_capacity": "1254 cc",
            "power_kw": "100 kW / 136 pk",
            "customer_name": "Test Klant",
            "customer_phone": "+31612345678",
            "customer_email": "test@klant.nl",
            "customer_address": "Teststraat 1, 1234AB Amsterdam",
            "score_engine": 4,
            "score_frame": 5,
            "score_paint": 4,
            "score_tires": 3,
            "score_brakes": 4,
            "score_electrics": 5,
            "score_exhaust": 4,
            "score_suspension": 4,
            "score_chain_drive": 3,
            "score_general": 4,
            "notes_engine": "Loopt soepel",
            "notes_general": "Goede staat",
            "accessories": "Koffers, navigatie",
            "modifications": "Akrapovic uitlaat",
            "has_damage": False,
            "service_history": "Dealer onderhouden",
            "last_service_date": "01-12-2024",
            "apk_valid_until": "01-03-2026",
            "autotelex_value": 18000,
            "market_value": 19000,
            "replacement_value": 21000,
            "taxatie_value": 17500,
            "notes": "Test taxatie voor automatische tests"
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 200, f"Create taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert "taxatie_nummer" in data, "Response should contain taxatie_nummer"
        assert data["brand"] == "BMW", "Brand should match"
        assert data["model"] == "R1250GS Adventure", "Model should match"
        assert data["status"] == "concept", "Initial status should be 'concept'"
        assert data["average_score"] == 4.0, f"Average score should be 4.0, got {data.get('average_score')}"
        assert data["condition_label"] == "Goed", f"Condition label should be 'Goed', got {data.get('condition_label')}"
        
        TestTaxatieProgrammaBackend.created_taxatie_id = data["id"]
        print(f"SUCCESS: Created taxatie with ID: {data['id']}, nummer: {data['taxatie_nummer']}")
    
    def test_02_list_taxaties(self):
        """Test listing all taxaties"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/taxatie-programma", headers=headers)
        
        assert response.status_code == 200, f"List taxaties failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should have at least 1 taxatie"
        
        # Verify our created taxatie is in the list
        found = any(t["id"] == self.created_taxatie_id for t in data)
        assert found, "Created taxatie should be in the list"
        
        print(f"SUCCESS: Listed {len(data)} taxaties")
    
    def test_03_get_single_taxatie(self):
        """Test getting a single taxatie by ID"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", headers=headers)
        
        assert response.status_code == 200, f"Get taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["id"] == self.created_taxatie_id, "ID should match"
        assert data["brand"] == "BMW", "Brand should match"
        assert data["customer_name"] == "Test Klant", "Customer name should match"
        
        print(f"SUCCESS: Retrieved taxatie {data['taxatie_nummer']}")
    
    def test_04_update_taxatie(self):
        """Test updating a taxatie"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        update_data = {
            "kenteken": "TEST-123-AB",
            "brand": "BMW",
            "model": "R1250GS Adventure",
            "year": 2023,
            "mileage": 16000,  # Updated mileage
            "color": "Zwart",
            "vin_number": "WB10A1234TEST5678",
            "first_registration": "01-03-2023",
            "fuel_type": "Benzine",
            "cylinder_capacity": "1254 cc",
            "power_kw": "100 kW / 136 pk",
            "customer_name": "Test Klant Updated",  # Updated name
            "customer_phone": "+31612345678",
            "customer_email": "test@klant.nl",
            "customer_address": "Teststraat 1, 1234AB Amsterdam",
            "score_engine": 5,  # Updated score
            "score_frame": 5,
            "score_paint": 4,
            "score_tires": 4,  # Updated score
            "score_brakes": 4,
            "score_electrics": 5,
            "score_exhaust": 4,
            "score_suspension": 4,
            "score_chain_drive": 4,  # Updated score
            "score_general": 4,
            "notes_engine": "Loopt soepel",
            "notes_general": "Goede staat - bijgewerkt",  # Updated notes
            "accessories": "Koffers, navigatie, tanktas",  # Updated
            "modifications": "Akrapovic uitlaat",
            "has_damage": False,
            "service_history": "Dealer onderhouden",
            "last_service_date": "01-12-2024",
            "apk_valid_until": "01-03-2026",
            "autotelex_value": 18000,
            "market_value": 19000,
            "replacement_value": 21000,
            "taxatie_value": 18000,  # Updated value
            "notes": "Test taxatie bijgewerkt"
        }
        
        response = requests.put(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", json=update_data, headers=headers)
        
        assert response.status_code == 200, f"Update taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["mileage"] == 16000, "Mileage should be updated"
        assert data["customer_name"] == "Test Klant Updated", "Customer name should be updated"
        assert data["taxatie_value"] == 18000, "Taxatie value should be updated"
        assert data["average_score"] == 4.3, f"Average score should be 4.3, got {data.get('average_score')}"
        
        print(f"SUCCESS: Updated taxatie - new average score: {data['average_score']}")
    
    def test_05_finalize_taxatie(self):
        """Test finalizing a taxatie (changing status to definitief)"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}/finalize", headers=headers)
        
        assert response.status_code == 200, f"Finalize taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["status"] == "definitief", "Status should be 'definitief'"
        
        # Verify by getting the taxatie
        response = requests.get(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "definitief", "Status should be 'definitief' after finalize"
        
        print(f"SUCCESS: Finalized taxatie - status is now 'definitief'")
    
    def test_06_delete_taxatie(self):
        """Test deleting a taxatie"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.delete(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", headers=headers)
        
        assert response.status_code == 200, f"Delete taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["status"] == "deleted", "Response should confirm deletion"
        
        # Verify it's deleted
        response = requests.get(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", headers=headers)
        assert response.status_code == 404, "Deleted taxatie should return 404"
        
        print(f"SUCCESS: Deleted taxatie")
    
    # ============ ACCESS CONTROL TESTS ============
    
    def test_07_dealer_cannot_access_taxatie_list(self):
        """Test that dealer cannot access taxatie list"""
        if not self.dealer_token:
            pytest.skip("Dealer token not available")
        
        headers = {"Authorization": f"Bearer {self.dealer_token}"}
        
        response = requests.get(f"{BASE_URL}/api/taxatie-programma", headers=headers)
        
        assert response.status_code == 403, f"Dealer should get 403, got {response.status_code}"
        print(f"SUCCESS: Dealer correctly blocked from taxatie list (403)")
    
    def test_08_dealer_cannot_create_taxatie(self):
        """Test that dealer cannot create taxatie"""
        if not self.dealer_token:
            pytest.skip("Dealer token not available")
        
        headers = {"Authorization": f"Bearer {self.dealer_token}"}
        
        taxatie_data = {
            "brand": "Honda",
            "model": "CBR1000RR",
            "year": 2022
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 403, f"Dealer should get 403, got {response.status_code}"
        print(f"SUCCESS: Dealer correctly blocked from creating taxatie (403)")
    
    def test_09_unauthenticated_cannot_access(self):
        """Test that unauthenticated requests are blocked"""
        response = requests.get(f"{BASE_URL}/api/taxatie-programma")
        
        assert response.status_code in [401, 403], f"Unauthenticated should get 401/403, got {response.status_code}"
        print(f"SUCCESS: Unauthenticated request correctly blocked ({response.status_code})")
    
    # ============ GOOGLE MOTORS ENDPOINTS VERIFICATION ============
    
    def test_10_google_motors_public_endpoint(self):
        """Test that Google Motors public endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/public/motors")
        
        assert response.status_code == 200, f"Public motors endpoint failed: {response.status_code} - {response.text}"
        
        data = response.json()
        # API returns a list directly
        assert isinstance(data, list), "Response should be a list"
        
        print(f"SUCCESS: Google Motors public endpoint works - {len(data)} motors")
    
    def test_11_google_motors_brands_endpoint(self):
        """Test that Google Motors brands endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/public/motors/brands")
        
        assert response.status_code == 200, f"Public motors brands endpoint failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"SUCCESS: Google Motors brands endpoint works - {len(data)} brands")
    
    def test_12_google_motors_authenticated_endpoint(self):
        """Test that Google Motors authenticated endpoint still works"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/google-motors/all", headers=headers)
        
        assert response.status_code == 200, f"Google Motors all endpoint failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"SUCCESS: Google Motors authenticated endpoint works - {len(data)} motors")
    
    # ============ EDGE CASES ============
    
    def test_13_create_minimal_taxatie(self):
        """Test creating a taxatie with minimal data (only brand and model)"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        taxatie_data = {
            "brand": "Ducati",
            "model": "Panigale V4"
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 200, f"Create minimal taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["brand"] == "Ducati", "Brand should match"
        assert data["model"] == "Panigale V4", "Model should match"
        assert data["status"] == "concept", "Status should be concept"
        assert data["average_score"] == 3.0, "Default average score should be 3.0"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: Created minimal taxatie with defaults")
    
    def test_14_get_nonexistent_taxatie(self):
        """Test getting a non-existent taxatie returns 404"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/taxatie-programma/{fake_id}", headers=headers)
        
        assert response.status_code == 404, f"Non-existent taxatie should return 404, got {response.status_code}"
        print(f"SUCCESS: Non-existent taxatie correctly returns 404")
    
    def test_15_finalize_nonexistent_taxatie(self):
        """Test finalizing a non-existent taxatie returns 404"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        fake_id = str(uuid.uuid4())
        response = requests.post(f"{BASE_URL}/api/taxatie-programma/{fake_id}/finalize", headers=headers)
        
        assert response.status_code == 404, f"Finalize non-existent should return 404, got {response.status_code}"
        print(f"SUCCESS: Finalize non-existent taxatie correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
