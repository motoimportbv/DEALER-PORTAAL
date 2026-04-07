"""
Test suite for BPM Damage Checklist Feature (Iteration 23)
Tests the NEW damage checklist with 26 motorcycle-specific damage items.
Each item can be checked and assigned individual repair costs.
Total repair costs auto-calculate, and 31% is deducted from BPM.

Key features tested:
- DamageItem model: {name: str, checked: bool, cost: float}
- damage_items array in TaxatieCreate model
- has_damage computed from damage_items (not a separate field)
- herstelkosten auto-calculated from checked damage_items costs
- schade_aftrek = total_herstelkosten * 0.31
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

# 26 default damage items from frontend
DEFAULT_DAMAGE_ITEMS = [
    {"name": "Kuipdelen / Stroomlijnkappen", "checked": False, "cost": 0},
    {"name": "Tank (deuken / krassen)", "checked": False, "cost": 0},
    {"name": "Lak / Spuitwerk", "checked": False, "cost": 0},
    {"name": "Uitlaat (roest / lek)", "checked": False, "cost": 0},
    {"name": "Motorblok (lekkage / geluid)", "checked": False, "cost": 0},
    {"name": "Frame / Chassis (scheuren / roest)", "checked": False, "cost": 0},
    {"name": "Voorvork (lekkage / krom)", "checked": False, "cost": 0},
    {"name": "Achterdemper (lek / versleten)", "checked": False, "cost": 0},
    {"name": "Remschijven / Remblokken", "checked": False, "cost": 0},
    {"name": "Banden (versleten / oud)", "checked": False, "cost": 0},
    {"name": "Ketting / Tandwielen", "checked": False, "cost": 0},
    {"name": "Koppeling (versleten)", "checked": False, "cost": 0},
    {"name": "Accu", "checked": False, "cost": 0},
    {"name": "Verlichting (koplamp / achterlicht)", "checked": False, "cost": 0},
    {"name": "Knipperlichten / Richtingaanwijzers", "checked": False, "cost": 0},
    {"name": "Spiegels", "checked": False, "cost": 0},
    {"name": "Dashboard / Instrumenten", "checked": False, "cost": 0},
    {"name": "Stuurlagers", "checked": False, "cost": 0},
    {"name": "Wiellagers", "checked": False, "cost": 0},
    {"name": "Zadel (gescheurd / versleten)", "checked": False, "cost": 0},
    {"name": "Windscherm", "checked": False, "cost": 0},
    {"name": "Voetsteunen / Schakelpedaal", "checked": False, "cost": 0},
    {"name": "Koelvloeistof systeem", "checked": False, "cost": 0},
    {"name": "Remvloeistof / Remleidingen", "checked": False, "cost": 0},
    {"name": "Corrosie / Roest algemeen", "checked": False, "cost": 0},
    {"name": "Overig", "checked": False, "cost": 0},
]


class TestDamageChecklistBackend:
    """Test BPM Damage Checklist API functionality"""
    
    admin_token = None
    created_taxatie_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            TestDamageChecklistBackend.admin_token = response.json().get("token")
            print(f"SUCCESS: Admin login successful")
        else:
            print(f"ERROR: Admin login failed: {response.status_code} - {response.text}")
            pytest.skip("Admin login failed")
    
    # ============ DAMAGE ITEMS ARRAY TESTS ============
    
    def test_01_create_taxatie_with_damage_items_array(self):
        """Test POST /api/taxatie-programma with damage_items array"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create damage items with some checked
        damage_items = [
            {"name": "Kuipdelen / Stroomlijnkappen", "checked": True, "cost": 500},
            {"name": "Tank (deuken / krassen)", "checked": True, "cost": 300},
            {"name": "Lak / Spuitwerk", "checked": False, "cost": 0},
            {"name": "Uitlaat (roest / lek)", "checked": True, "cost": 200},
        ]
        
        taxatie_data = {
            "brand": "TEST_Yamaha",
            "model": "MT-09",
            "year": 2023,
            "netto_catalogusprijs": 10000,
            "first_registration_date": "2023-01-01",
            "consumentenprijs": 12000,
            "damage_items": damage_items,
            "damage_notes": "Test damage notes"
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        
        assert response.status_code == 200, f"Create taxatie failed: {response.status_code} - {response.text}"
        
        data = response.json()
        TestDamageChecklistBackend.created_taxatie_id = data["id"]
        
        # Verify damage_items are stored
        assert "damage_items" in data, "Response should contain damage_items"
        assert len(data["damage_items"]) == 4, f"Should have 4 damage items, got {len(data['damage_items'])}"
        
        # Verify checked items
        checked_items = [d for d in data["damage_items"] if d.get("checked")]
        assert len(checked_items) == 3, f"Should have 3 checked items, got {len(checked_items)}"
        
        print(f"SUCCESS: Created taxatie with {len(data['damage_items'])} damage items, {len(checked_items)} checked")
    
    def test_02_has_damage_computed_from_damage_items(self):
        """Test that has_damage is computed from damage_items (not a separate field)"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create with checked damage items
        damage_items = [
            {"name": "Banden", "checked": True, "cost": 400},
        ]
        
        taxatie_data = {
            "brand": "TEST_Honda",
            "model": "CBR600RR",
            "year": 2022,
            "netto_catalogusprijs": 8000,
            "first_registration_date": "2022-06-01",
            "damage_items": damage_items
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.status_code}"
        
        data = response.json()
        
        # has_damage should be True because we have checked items with cost > 0
        assert data.get("has_damage") == True, f"has_damage should be True, got {data.get('has_damage')}"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: has_damage correctly computed as True from damage_items")
    
    def test_03_has_damage_false_when_no_checked_items(self):
        """Test has_damage is False when no items are checked"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create with no checked damage items
        damage_items = [
            {"name": "Banden", "checked": False, "cost": 0},
            {"name": "Remmen", "checked": False, "cost": 0},
        ]
        
        taxatie_data = {
            "brand": "TEST_Kawasaki",
            "model": "Z650",
            "year": 2023,
            "netto_catalogusprijs": 7000,
            "first_registration_date": "2023-03-01",
            "damage_items": damage_items
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.status_code}"
        
        data = response.json()
        
        # has_damage should be False
        assert data.get("has_damage") == False, f"has_damage should be False, got {data.get('has_damage')}"
        assert data.get("herstelkosten") == 0, f"herstelkosten should be 0, got {data.get('herstelkosten')}"
        assert data.get("schade_aftrek") == 0, f"schade_aftrek should be 0, got {data.get('schade_aftrek')}"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: has_damage correctly computed as False when no items checked")
    
    def test_04_herstelkosten_auto_calculated_from_checked_items(self):
        """Test herstelkosten is auto-calculated from checked damage_items costs"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create with specific costs
        damage_items = [
            {"name": "Kuipdelen", "checked": True, "cost": 500},
            {"name": "Tank", "checked": True, "cost": 300},
            {"name": "Lak", "checked": False, "cost": 1000},  # Not checked, should not count
            {"name": "Uitlaat", "checked": True, "cost": 200},
        ]
        
        taxatie_data = {
            "brand": "TEST_Ducati",
            "model": "Monster",
            "year": 2022,
            "netto_catalogusprijs": 12000,
            "first_registration_date": "2022-01-01",
            "damage_items": damage_items
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.status_code}"
        
        data = response.json()
        
        # Expected: 500 + 300 + 200 = 1000 (not including unchecked 1000)
        expected_herstelkosten = 500 + 300 + 200
        assert data.get("herstelkosten") == expected_herstelkosten, f"herstelkosten should be {expected_herstelkosten}, got {data.get('herstelkosten')}"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: herstelkosten correctly calculated as {expected_herstelkosten}")
    
    def test_05_schade_aftrek_31_percent_of_herstelkosten(self):
        """Test schade_aftrek = total_herstelkosten * 0.31"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create with 1000 total herstelkosten
        damage_items = [
            {"name": "Banden", "checked": True, "cost": 600},
            {"name": "Remmen", "checked": True, "cost": 400},
        ]
        
        taxatie_data = {
            "brand": "TEST_Triumph",
            "model": "Street Triple",
            "year": 2023,
            "netto_catalogusprijs": 11000,
            "first_registration_date": "2023-01-01",
            "damage_items": damage_items
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.status_code}"
        
        data = response.json()
        
        # Expected: 1000 * 0.31 = 310
        expected_schade_aftrek = 1000 * 0.31
        assert abs(data.get("schade_aftrek", 0) - expected_schade_aftrek) < 0.01, f"schade_aftrek should be {expected_schade_aftrek}, got {data.get('schade_aftrek')}"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: schade_aftrek correctly calculated as {expected_schade_aftrek} (31% of 1000)")
    
    def test_06_schade_aftrek_affects_netto_bpm(self):
        """Test that schade_aftrek is deducted from BPM"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create with significant damage
        damage_items = [
            {"name": "Motorblok", "checked": True, "cost": 2000},
            {"name": "Frame", "checked": True, "cost": 1000},
        ]
        
        taxatie_data = {
            "brand": "TEST_BMW",
            "model": "S1000RR",
            "year": 2023,
            "netto_catalogusprijs": 15000,
            "first_registration_date": "2023-06-01",
            "damage_items": damage_items
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.status_code}"
        
        data = response.json()
        
        # Calculate expected values
        # Bruto BPM: 15000 * 0.194 - 210 = 2700
        expected_bruto = 15000 * 0.194 - 210
        # Herstelkosten: 3000
        # Schade aftrek: 3000 * 0.31 = 930
        expected_schade_aftrek = 3000 * 0.31
        
        assert abs(data.get("bruto_bpm", 0) - expected_bruto) < 1, f"bruto_bpm should be ~{expected_bruto}"
        assert abs(data.get("schade_aftrek", 0) - expected_schade_aftrek) < 0.01, f"schade_aftrek should be {expected_schade_aftrek}"
        
        # netto_bpm should be reduced by schade_aftrek
        # netto_bpm = lowest_method_bpm - schade_aftrek
        assert data.get("netto_bpm", 0) < data.get("bruto_bpm", 0), "netto_bpm should be less than bruto_bpm"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: schade_aftrek ({data.get('schade_aftrek')}) correctly deducted from BPM")
    
    def test_07_update_taxatie_with_new_damage_items(self):
        """Test updating taxatie with modified damage items"""
        if not self.created_taxatie_id:
            pytest.skip("No taxatie created")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Update with different damage items
        new_damage_items = [
            {"name": "Kuipdelen", "checked": True, "cost": 800},  # Increased
            {"name": "Tank", "checked": False, "cost": 0},  # Unchecked
            {"name": "Lak", "checked": True, "cost": 600},  # New checked item
        ]
        
        update_data = {
            "brand": "TEST_Yamaha",
            "model": "MT-09",
            "year": 2023,
            "netto_catalogusprijs": 10000,
            "first_registration_date": "2023-01-01",
            "damage_items": new_damage_items
        }
        
        response = requests.put(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", json=update_data, headers=headers)
        assert response.status_code == 200, f"Update failed: {response.status_code}"
        
        data = response.json()
        
        # Expected: 800 + 600 = 1400
        expected_herstelkosten = 1400
        assert data.get("herstelkosten") == expected_herstelkosten, f"herstelkosten should be {expected_herstelkosten}, got {data.get('herstelkosten')}"
        
        # Expected schade_aftrek: 1400 * 0.31 = 434
        expected_schade_aftrek = 1400 * 0.31
        assert abs(data.get("schade_aftrek", 0) - expected_schade_aftrek) < 0.01, f"schade_aftrek should be {expected_schade_aftrek}"
        
        print(f"SUCCESS: Updated taxatie with new damage items, herstelkosten={expected_herstelkosten}")
    
    def test_08_unchecking_item_resets_cost_in_calculation(self):
        """Test that unchecked items don't contribute to herstelkosten even if cost > 0"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create with unchecked items that have costs (edge case)
        damage_items = [
            {"name": "Banden", "checked": False, "cost": 500},  # Has cost but not checked
            {"name": "Remmen", "checked": True, "cost": 200},
        ]
        
        taxatie_data = {
            "brand": "TEST_Suzuki",
            "model": "GSX-R750",
            "year": 2022,
            "netto_catalogusprijs": 9000,
            "first_registration_date": "2022-01-01",
            "damage_items": damage_items
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.status_code}"
        
        data = response.json()
        
        # Only checked item should count: 200 (not 500 + 200)
        assert data.get("herstelkosten") == 200, f"herstelkosten should be 200 (only checked items), got {data.get('herstelkosten')}"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: Unchecked items correctly excluded from herstelkosten calculation")
    
    def test_09_all_26_damage_items_accepted(self):
        """Test that all 26 default damage items can be submitted"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Use all 26 default items with some checked
        damage_items = DEFAULT_DAMAGE_ITEMS.copy()
        # Check first 5 items with costs
        for i in range(5):
            damage_items[i] = {"name": damage_items[i]["name"], "checked": True, "cost": 100 * (i + 1)}
        
        taxatie_data = {
            "brand": "TEST_KTM",
            "model": "Duke 890",
            "year": 2023,
            "netto_catalogusprijs": 10000,
            "first_registration_date": "2023-01-01",
            "damage_items": damage_items
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.status_code}"
        
        data = response.json()
        
        # Should have all 26 items
        assert len(data.get("damage_items", [])) == 26, f"Should have 26 damage items, got {len(data.get('damage_items', []))}"
        
        # Expected herstelkosten: 100 + 200 + 300 + 400 + 500 = 1500
        expected_herstelkosten = 100 + 200 + 300 + 400 + 500
        assert data.get("herstelkosten") == expected_herstelkosten, f"herstelkosten should be {expected_herstelkosten}"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: All 26 damage items accepted and processed correctly")
    
    def test_10_damage_notes_stored(self):
        """Test that damage_notes (toelichting) is stored correctly"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        damage_items = [
            {"name": "Motorblok", "checked": True, "cost": 1500},
        ]
        
        taxatie_data = {
            "brand": "TEST_Aprilia",
            "model": "RSV4",
            "year": 2022,
            "netto_catalogusprijs": 18000,
            "first_registration_date": "2022-01-01",
            "damage_items": damage_items,
            "damage_notes": "Olielekkage bij de koppakking, moet vervangen worden"
        }
        
        response = requests.post(f"{BASE_URL}/api/taxatie-programma", json=taxatie_data, headers=headers)
        assert response.status_code == 200, f"Create failed: {response.status_code}"
        
        data = response.json()
        
        assert data.get("damage_notes") == "Olielekkage bij de koppakking, moet vervangen worden", "damage_notes should be stored"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/taxatie-programma/{data['id']}", headers=headers)
        
        print(f"SUCCESS: damage_notes correctly stored")
    
    def test_11_get_taxatie_includes_damage_items(self):
        """Test GET /api/taxatie-programma/{id} includes damage_items"""
        if not self.created_taxatie_id:
            pytest.skip("No taxatie created")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", headers=headers)
        assert response.status_code == 200, f"Get failed: {response.status_code}"
        
        data = response.json()
        
        assert "damage_items" in data, "Response should include damage_items"
        assert isinstance(data["damage_items"], list), "damage_items should be a list"
        
        print(f"SUCCESS: GET taxatie includes damage_items array")
    
    def test_12_list_taxaties_shows_damage_count(self):
        """Test that list endpoint returns taxaties with damage info"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/taxatie-programma", headers=headers)
        assert response.status_code == 200, f"List failed: {response.status_code}"
        
        data = response.json()
        
        # Find our test taxatie
        test_taxaties = [t for t in data if t.get("brand", "").startswith("TEST_")]
        
        if test_taxaties:
            taxatie = test_taxaties[0]
            # Should have damage-related fields
            assert "damage_items" in taxatie or "has_damage" in taxatie, "List items should include damage info"
            print(f"SUCCESS: List endpoint includes damage info")
        else:
            print(f"INFO: No test taxaties found in list, skipping damage count check")
    
    def test_99_cleanup(self):
        """Clean up test data"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Delete created taxatie
        if self.created_taxatie_id:
            response = requests.delete(f"{BASE_URL}/api/taxatie-programma/{self.created_taxatie_id}", headers=headers)
            print(f"Cleanup: Deleted taxatie {self.created_taxatie_id}")
        
        # Delete any remaining TEST_ taxaties
        response = requests.get(f"{BASE_URL}/api/taxatie-programma", headers=headers)
        if response.status_code == 200:
            taxaties = response.json()
            for t in taxaties:
                if t.get("brand", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/taxatie-programma/{t['id']}", headers=headers)
                    print(f"Cleanup: Deleted TEST taxatie {t['id']}")
        
        print("SUCCESS: Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
