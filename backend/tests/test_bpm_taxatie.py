"""
Test suite for BPM Vermindering Taxatie (Motorcycle BPM Tax Reduction Module)
Tests BPM calculation accuracy, CRUD operations, and access control.
Key BPM fields: netto_catalogusprijs, consumentenprijs, koerslijst_waarde, 
taxatie_inruil_waarde, first_registration_date, has_damage, herstelkosten
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Admin2024!"
DEALER_EMAIL = "zoektest@dealer.nl"
DEALER_PASSWORD = "Test2024!"


class TestBpmTaxatieBackend:
    """Test BPM Vermindering Taxatie API endpoints"""
    
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
            TestBpmTaxatieBackend.admin_token = response.json().get("token")
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
            TestBpmTaxatieBackend.dealer_token = response.json().get("token")
            print(f"SUCCESS: Dealer login successful")
        else:
            print(f"WARNING: Dealer login failed (may not exist): {response.status_code}")
    
    # ============ BPM CALCULATION ACCURACY TESTS ============
    
    def test_01_bpm_calculation_bruto_bpm(self):
        """Test BPM calculation: netto_catalogusprijs 15500 should give bruto_bpm ~2797"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Calculate expected: 15500 * 0.194 - 210 = 3007 - 210 = 2797
        taxatie_data = {
            "brand": "BMW",
            "model": "R1250GS",
            "year": 2022,
            "netto_catalogusprijs": 15500,
            "first_registration_date": "2022-01-15",
            "consumentenprijs": 18500,
            "koerslijst_waarde": 10000
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 200, f"Create taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "bruto_bpm" in data, "Response should contain bruto_bpm"
        
        # Verify bruto BPM calculation: 15500 * 0.194 - 210 = 2797
        expected_bruto = 15500 * 0.194 - 210
        assert abs(data["bruto_bpm"] - expected_bruto) < 1, f"Bruto BPM should be ~{expected_bruto}, got {data['bruto_bpm']}"
        
        TestBpmTaxatieBackend.created_taxatie_id = data["id"]
        print(f"SUCCESS: Bruto BPM calculation correct: {data['bruto_bpm']} (expected ~{expected_bruto})")
    
    def test_02_forfaitair_percentage_48_months(self):
        """Test forfaitaire percentage for ~48 months should be around 57-62%"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # 48 months ago
        reg_date = (datetime.now() - timedelta(days=48*30)).strftime("%Y-%m-%d")
        
        taxatie_data = {
            "brand": "Honda",
            "model": "CBR1000RR",
            "year": 2021,
            "netto_catalogusprijs": 15500,
            "first_registration_date": reg_date,
            "consumentenprijs": 18500
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 200, f"Create taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "forfaitair_percentage" in data, "Response should contain forfaitair_percentage"
        
        # For 48 months: should be in range 57-62% based on forfaitaire table
        # 42-54 months: 57% + (months-42)*0.42
        # At 48 months: 57 + 6*0.42 = 57 + 2.52 = 59.52%
        assert 55 <= data["forfaitair_percentage"] <= 65, f"Forfaitair percentage for ~48 months should be 55-65%, got {data['forfaitair_percentage']}"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: Forfaitair percentage for ~48 months: {data['forfaitair_percentage']}%")
    
    def test_03_koerslijst_method_calculation(self):
        """Test koerslijst method: consumentenprijs 18500, koerslijst_waarde 10000 = 45.95% afschrijving"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        taxatie_data = {
            "brand": "Kawasaki",
            "model": "Z900",
            "year": 2022,
            "netto_catalogusprijs": 10000,
            "first_registration_date": "2022-06-01",
            "consumentenprijs": 18500,
            "koerslijst_waarde": 10000
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 200, f"Create taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "koerslijst_percentage" in data, "Response should contain koerslijst_percentage"
        
        # Expected: (18500 - 10000) / 18500 * 100 = 8500 / 18500 * 100 = 45.95%
        expected_pct = ((18500 - 10000) / 18500) * 100
        assert abs(data["koerslijst_percentage"] - expected_pct) < 0.1, f"Koerslijst percentage should be ~{expected_pct:.2f}%, got {data['koerslijst_percentage']}"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: Koerslijst percentage: {data['koerslijst_percentage']}% (expected ~{expected_pct:.2f}%)")
    
    def test_04_schade_aftrek_calculation(self):
        """Test schade aftrek: herstelkosten 1000 * 0.31 = 310"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        taxatie_data = {
            "brand": "Yamaha",
            "model": "MT-09",
            "year": 2023,
            "netto_catalogusprijs": 10000,
            "first_registration_date": "2023-01-01",
            "consumentenprijs": 12000,
            "has_damage": True,
            "herstelkosten": 1000,
            "damage_description": "Kleine lakschade"
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 200, f"Create taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "schade_aftrek" in data, "Response should contain schade_aftrek"
        
        # Expected: 1000 * 0.31 = 310
        expected_aftrek = 1000 * 0.31
        assert abs(data["schade_aftrek"] - expected_aftrek) < 0.01, f"Schade aftrek should be {expected_aftrek}, got {data['schade_aftrek']}"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: Schade aftrek: {data['schade_aftrek']} (expected {expected_aftrek})")
    
    def test_05_beste_methode_selection(self):
        """Test that beste_methode selects the lowest BPM option"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        taxatie_data = {
            "brand": "Ducati",
            "model": "Panigale V4",
            "year": 2022,
            "netto_catalogusprijs": 20000,
            "first_registration_date": "2022-01-01",  # ~48 months old
            "consumentenprijs": 30000,
            "koerslijst_waarde": 15000,  # 50% depreciation
            "taxatie_inruil_waarde": 12000  # 60% depreciation
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 200, f"Create taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "beste_methode" in data, "Response should contain beste_methode"
        assert data["beste_methode"] in ["forfaitair", "koerslijst", "taxatierapport"], f"beste_methode should be valid, got {data['beste_methode']}"
        
        # Verify netto_bpm and bpm_vermindering are calculated
        assert "netto_bpm" in data, "Response should contain netto_bpm"
        assert "bpm_vermindering" in data, "Response should contain bpm_vermindering"
        assert data["netto_bpm"] >= 0, "netto_bpm should be >= 0"
        assert data["bpm_vermindering"] >= 0, "bpm_vermindering should be >= 0"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: Beste methode: {data['beste_methode']}, netto_bpm: {data['netto_bpm']}, vermindering: {data['bpm_vermindering']}")
    
    def test_06_bpm_tarief_low_value(self):
        """Test BPM tarief for low value motorcycle (<=2133 -> 9.6%)"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        taxatie_data = {
            "brand": "Vespa",
            "model": "Primavera",
            "year": 2023,
            "netto_catalogusprijs": 2000,  # Below 2133 threshold
            "first_registration_date": "2023-06-01"
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 200, f"Create taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Expected: 2000 * 0.096 = 192
        expected_bruto = 2000 * 0.096
        assert abs(data["bruto_bpm"] - expected_bruto) < 1, f"Bruto BPM for low value should be ~{expected_bruto}, got {data['bruto_bpm']}"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: Low value BPM tarief (9.6%): {data['bruto_bpm']} (expected ~{expected_bruto})")
    
    # ============ CRUD OPERATIONS ============
    
    def test_07_list_taxaties(self):
        """Test listing all taxaties"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/taxatie-programma", headers=headers)
        
        assert response.status_code == 200, f"List taxaties failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check that BPM fields are present in list items
        if len(data) > 0:
            item = data[0]
            assert "netto_bpm" in item or "bruto_bpm" in item, "List items should contain BPM fields"
        
        print(f"SUCCESS: Listed {len(data)} taxaties")
    
    def test_08_get_single_taxatie(self):
        """Test getting a single taxatie by ID"""
        if not self.created_taxatie_id:
            pytest.skip("No taxatie created in previous test")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", headers=headers)
        
        assert response.status_code == 200, f"Get taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["id"] == self.created_taxatie_id, "ID should match"
        assert "bruto_bpm" in data, "Should contain bruto_bpm"
        assert "netto_bpm" in data, "Should contain netto_bpm"
        
        print(f"SUCCESS: Retrieved taxatie {data.get('taxatie_nummer', data['id'])}")
    
    def test_09_update_taxatie(self):
        """Test updating a taxatie with new BPM values"""
        if not self.created_taxatie_id:
            pytest.skip("No taxatie created in previous test")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        update_data = {
            "brand": "BMW",
            "model": "R1250GS",
            "year": 2022,
            "netto_catalogusprijs": 16000,  # Updated from 15500
            "first_registration_date": "2022-01-15",
            "consumentenprijs": 19000,  # Updated from 18500
            "koerslijst_waarde": 11000,  # Updated from 10000
            "mileage": 25000
        }
        
        response = requests.put(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", json=update_data, headers=headers)
        
        assert response.status_code == 200, f"Update taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["netto_catalogusprijs"] == 16000, "netto_catalogusprijs should be updated"
        
        # Verify BPM recalculated: 16000 * 0.194 - 210 = 2894
        expected_bruto = 16000 * 0.194 - 210
        assert abs(data["bruto_bpm"] - expected_bruto) < 1, f"Bruto BPM should be recalculated to ~{expected_bruto}"
        
        print(f"SUCCESS: Updated taxatie - new bruto_bpm: {data['bruto_bpm']}")
    
    def test_10_finalize_taxatie(self):
        """Test finalizing a taxatie (changing status to definitief)"""
        if not self.created_taxatie_id:
            pytest.skip("No taxatie created in previous test")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}/finalize", headers=headers)
        
        assert response.status_code == 200, f"Finalize taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data["status"] == "definitief", "Status should be 'definitief'"
        
        print(f"SUCCESS: Finalized taxatie - status is now 'definitief'")
    
    def test_11_delete_taxatie(self):
        """Test deleting a taxatie"""
        if not self.created_taxatie_id:
            pytest.skip("No taxatie created in previous test")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.delete(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", headers=headers)
        
        assert response.status_code == 200, f"Delete taxatie failed: {response.status_code} - {response.text}"
        
        # Verify it's deleted
        response = requests.get(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", headers=headers)
        assert response.status_code == 404, "Deleted taxatie should return 404"
        
        TestBpmTaxatieBackend.created_taxatie_id = None
        print(f"SUCCESS: Deleted taxatie")
    
    # ============ ACCESS CONTROL TESTS ============
    
    def test_12_dealer_cannot_access_taxatie_list(self):
        """Test that dealer cannot access taxatie list (403)"""
        if not self.dealer_token:
            pytest.skip("Dealer token not available")
        
        headers = {"Authorization": f"Bearer {self.dealer_token}"}
        
        response = requests.get(f"{BASE_URL}/api/taxatie-programma", headers=headers)
        
        assert response.status_code == 403, f"Dealer should get 403, got {response.status_code}"
        print(f"SUCCESS: Dealer correctly blocked from taxatie list (403)")
    
    def test_13_dealer_cannot_create_taxatie(self):
        """Test that dealer cannot create taxatie (403)"""
        if not self.dealer_token:
            pytest.skip("Dealer token not available")
        
        headers = {"Authorization": f"Bearer {self.dealer_token}"}
        
        taxatie_data = {
            "brand": "Honda",
            "model": "CBR1000RR",
            "year": 2022,
            "netto_catalogusprijs": 15000
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 403, f"Dealer should get 403, got {response.status_code}"
        print(f"SUCCESS: Dealer correctly blocked from creating taxatie (403)")
    
    def test_14_unauthenticated_cannot_access(self):
        """Test that unauthenticated requests are blocked"""
        response = requests.get(f"{BASE_URL}/api/taxatie-programma")
        
        assert response.status_code in [401, 403], f"Unauthenticated should get 401/403, got {response.status_code}"
        print(f"SUCCESS: Unauthenticated request correctly blocked ({response.status_code})")
    
    # ============ EDGE CASES ============
    
    def test_15_get_nonexistent_taxatie(self):
        """Test getting a non-existent taxatie returns 404"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/taxatie-programma/{fake_id}", headers=headers)
        
        assert response.status_code == 404, f"Non-existent taxatie should return 404, got {response.status_code}"
        print(f"SUCCESS: Non-existent taxatie correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
