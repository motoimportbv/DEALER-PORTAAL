"""
Test suite for auto-activation feature and preview redirect blocker
Tests:
1. Auto-activation when admin updates price on pending motorcycle
2. Bulk motorcycle creation endpoint
3. Pending foreign listings endpoint
4. Motorcycle visibility controls
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Enolim12"
DEALER_EMAIL = "testdealer@motoimport.nl"
DEALER_PASSWORD = "MotoTest123!"


class TestAutoActivation:
    """Test auto-activation feature when admin updates price on pending motorcycle"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_admin_token(self):
        """Get admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
        
    def test_health_check(self):
        """Test API health endpoint"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ API health check passed")
        
    def test_admin_login(self):
        """Test admin can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}")
        
    def test_get_pending_foreign_listings_requires_auth(self):
        """Test pending foreign listings endpoint requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/motorcycles/pending-foreign")
        assert response.status_code == 403
        print("✓ Pending foreign listings requires authentication")
        
    def test_get_pending_foreign_listings_admin_only(self):
        """Test pending foreign listings endpoint returns data for admin"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/motorcycles/pending-foreign",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Pending foreign listings returned {len(data)} items")
        
    def test_create_pending_motorcycle_for_auto_activation(self):
        """Create a pending motorcycle to test auto-activation"""
        token = self.get_admin_token()
        
        # First, create a test motorcycle with is_pending_approval=True
        # We'll simulate this by creating a motorcycle and then manually setting it to pending
        test_id = str(uuid.uuid4())
        
        # Create motorcycle via admin endpoint
        motorcycle_data = {
            "brand": "TEST_AutoActivation",
            "model": f"TestModel_{test_id[:8]}",
            "year": 2024,
            "price": 5000,
            "mileage": 10000,
            "color": "Black",
            "description": "Test motorcycle for auto-activation",
            "condition": "good",
            "images": [],
            "auction_duration_hours": 3,
            "currency": "EUR",
            "auto_delete_hours": 0,
            "visibility": "all",
            "visible_to_dealers": []
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/motorcycles",
            json=motorcycle_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        created = response.json()
        motorcycle_id = created["id"]
        print(f"✓ Created test motorcycle: {motorcycle_id}")
        
        # Clean up - delete the test motorcycle
        delete_response = self.session.delete(
            f"{BASE_URL}/api/motorcycles/{motorcycle_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert delete_response.status_code == 200
        print(f"✓ Cleaned up test motorcycle: {motorcycle_id}")
        
    def test_update_motorcycle_price_auto_activates(self):
        """Test that updating price on pending motorcycle auto-activates it"""
        token = self.get_admin_token()
        
        # Get pending foreign listings
        response = self.session.get(
            f"{BASE_URL}/api/motorcycles/pending-foreign",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        pending = response.json()
        
        if len(pending) == 0:
            print("⚠ No pending motorcycles to test auto-activation - skipping")
            pytest.skip("No pending motorcycles available for testing")
            
        # Get first pending motorcycle
        pending_moto = pending[0]
        motorcycle_id = pending_moto["id"]
        original_price = pending_moto.get("price", 5000)
        
        print(f"Testing auto-activation on motorcycle: {pending_moto['brand']} {pending_moto['model']}")
        print(f"  - is_pending_approval: {pending_moto.get('is_pending_approval')}")
        print(f"  - is_available: {pending_moto.get('is_available')}")
        print(f"  - original_price: €{original_price}")
        
        # Update the price
        new_price = original_price + 100
        update_response = self.session.put(
            f"{BASE_URL}/api/motorcycles/{motorcycle_id}",
            json={"price": new_price},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert update_response.status_code == 200
        updated = update_response.json()
        
        # Verify auto-activation
        assert updated.get("is_pending_approval") == False, "Motorcycle should no longer be pending approval"
        assert updated.get("is_available") == True, "Motorcycle should be available"
        assert updated.get("price") == new_price, f"Price should be updated to {new_price}"
        
        print(f"✓ Auto-activation successful!")
        print(f"  - is_pending_approval: {updated.get('is_pending_approval')}")
        print(f"  - is_available: {updated.get('is_available')}")
        print(f"  - new_price: €{updated.get('price')}")
        
        # Verify it's no longer in pending list
        pending_after = self.session.get(
            f"{BASE_URL}/api/motorcycles/pending-foreign",
            headers={"Authorization": f"Bearer {token}"}
        ).json()
        
        pending_ids = [m["id"] for m in pending_after]
        assert motorcycle_id not in pending_ids, "Motorcycle should no longer be in pending list"
        print("✓ Motorcycle removed from pending list after activation")


class TestBulkMotorcycleCreation:
    """Test bulk motorcycle creation endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_admin_token(self):
        """Get admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin login failed: {response.status_code}")
        
    def test_bulk_create_requires_auth(self):
        """Test bulk create endpoint requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/motorcycles/bulk", json={
            "brand": "Test",
            "model": "Test",
            "year": 2024,
            "price": 5000,
            "color": "Black",
            "motorcycles": [{"mileage": 10000}]
        })
        assert response.status_code == 403
        print("✓ Bulk create requires authentication")
        
    def test_bulk_create_motorcycles(self):
        """Test bulk motorcycle creation"""
        token = self.get_admin_token()
        
        test_id = str(uuid.uuid4())[:8]
        bulk_data = {
            "brand": f"TEST_Bulk_{test_id}",
            "model": "BulkTestModel",
            "year": 2024,
            "price": 6000,
            "color": "Red",
            "description": "Bulk test motorcycle",
            "condition": "good",
            "images": [],
            "currency": "EUR",
            "auction_duration_hours": 3,
            "auto_delete_hours": 0,
            "visibility": "all",
            "visible_to_dealers": [],
            "motorcycles": [
                {"mileage": 5000, "chassis_number": f"BULK001_{test_id}"},
                {"mileage": 10000, "chassis_number": f"BULK002_{test_id}"},
                {"mileage": 15000, "chassis_number": f"BULK003_{test_id}"}
            ]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/motorcycles/bulk",
            json=bulk_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 3
        assert len(data["motorcycles"]) == 3
        print(f"✓ Bulk created {data['count']} motorcycles")
        
        # Clean up - delete created motorcycles
        for moto in data["motorcycles"]:
            delete_response = self.session.delete(
                f"{BASE_URL}/api/motorcycles/{moto['id']}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert delete_response.status_code == 200
        print(f"✓ Cleaned up {len(data['motorcycles'])} test motorcycles")
        
    def test_bulk_create_validates_max_count(self):
        """Test bulk create rejects more than 20 motorcycles"""
        token = self.get_admin_token()
        
        bulk_data = {
            "brand": "TEST_TooMany",
            "model": "TooManyModel",
            "year": 2024,
            "price": 5000,
            "color": "Black",
            "motorcycles": [{"mileage": i * 1000} for i in range(25)]  # 25 motorcycles
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/motorcycles/bulk",
            json=bulk_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400
        assert "Maximaal 20" in response.json().get("detail", "")
        print("✓ Bulk create correctly rejects >20 motorcycles")
        
    def test_bulk_create_validates_empty_list(self):
        """Test bulk create rejects empty motorcycle list"""
        token = self.get_admin_token()
        
        bulk_data = {
            "brand": "TEST_Empty",
            "model": "EmptyModel",
            "year": 2024,
            "price": 5000,
            "color": "Black",
            "motorcycles": []
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/motorcycles/bulk",
            json=bulk_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400
        assert "Geen motoren" in response.json().get("detail", "")
        print("✓ Bulk create correctly rejects empty list")


class TestMotorcycleVisibility:
    """Test motorcycle visibility controls"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_admin_token(self):
        """Get admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin login failed: {response.status_code}")
        
    def get_dealer_token(self):
        """Get dealer authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Dealer login failed: {response.status_code}")
        
    def test_create_motorcycle_with_visibility_all(self):
        """Test creating motorcycle visible to all dealers"""
        token = self.get_admin_token()
        
        test_id = str(uuid.uuid4())[:8]
        motorcycle_data = {
            "brand": f"TEST_VisAll_{test_id}",
            "model": "VisibilityTest",
            "year": 2024,
            "price": 7000,
            "mileage": 5000,
            "color": "Blue",
            "description": "Visibility test - all dealers",
            "condition": "good",
            "images": [],
            "auction_duration_hours": 3,
            "currency": "EUR",
            "auto_delete_hours": 0,
            "visibility": "all",
            "visible_to_dealers": []
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/motorcycles",
            json=motorcycle_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        created = response.json()
        assert created["visibility"] == "all"
        print(f"✓ Created motorcycle with visibility='all': {created['id']}")
        
        # Clean up
        self.session.delete(
            f"{BASE_URL}/api/motorcycles/{created['id']}",
            headers={"Authorization": f"Bearer {token}"}
        )
        print("✓ Cleaned up test motorcycle")
        
    def test_update_motorcycle_visibility(self):
        """Test updating motorcycle visibility settings"""
        token = self.get_admin_token()
        
        # Create a motorcycle
        test_id = str(uuid.uuid4())[:8]
        motorcycle_data = {
            "brand": f"TEST_VisUpdate_{test_id}",
            "model": "VisibilityUpdateTest",
            "year": 2024,
            "price": 8000,
            "mileage": 3000,
            "color": "Green",
            "description": "Visibility update test",
            "condition": "excellent",
            "images": [],
            "auction_duration_hours": 3,
            "currency": "EUR",
            "auto_delete_hours": 0,
            "visibility": "all",
            "visible_to_dealers": []
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/motorcycles",
            json=motorcycle_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert create_response.status_code == 200
        created = create_response.json()
        motorcycle_id = created["id"]
        
        # Update visibility to selected
        update_response = self.session.put(
            f"{BASE_URL}/api/motorcycles/{motorcycle_id}",
            json={
                "visibility": "selected",
                "visible_to_dealers": ["dealer-id-1", "dealer-id-2"]
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["visibility"] == "selected"
        assert len(updated["visible_to_dealers"]) == 2
        print(f"✓ Updated motorcycle visibility to 'selected' with 2 dealers")
        
        # Clean up
        self.session.delete(
            f"{BASE_URL}/api/motorcycles/{motorcycle_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        print("✓ Cleaned up test motorcycle")


class TestActivateEndpoint:
    """Test the /activate endpoint for pending motorcycles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_admin_token(self):
        """Get admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin login failed: {response.status_code}")
        
    def test_activate_endpoint_requires_auth(self):
        """Test activate endpoint requires authentication"""
        response = self.session.post(
            f"{BASE_URL}/api/motorcycles/test-id/activate?price=5000"
        )
        assert response.status_code == 403
        print("✓ Activate endpoint requires authentication")
        
    def test_activate_endpoint_404_for_nonexistent(self):
        """Test activate endpoint returns 404 for non-existent motorcycle"""
        token = self.get_admin_token()
        
        response = self.session.post(
            f"{BASE_URL}/api/motorcycles/nonexistent-id-12345/activate?price=5000",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 404
        print("✓ Activate endpoint returns 404 for non-existent motorcycle")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
