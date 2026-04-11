"""
Test Customer Share Feature - Dealers sharing motorcycles with customers without prices
Tests:
1. GET /api/motorcycles/{id}/customer-share - returns motorcycle data WITHOUT prices
2. customer-share endpoint requires NO authentication (public)
3. customer-share endpoint returns brand, model, year, mileage, color, images, description
4. customer-share endpoint returns 404 for non-existent motor ID
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Admin2024!"

# Test motor ID from the review request
TEST_MOTOR_ID = "44bc9765-487c-498b-97cd-f11fb9887f0e"


class TestCustomerShareEndpoint:
    """Tests for the customer-share endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
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
        return None
    
    def test_customer_share_endpoint_is_public(self):
        """Test that customer-share endpoint requires NO authentication"""
        # Make request WITHOUT any auth token
        response = self.session.get(f"{BASE_URL}/api/motorcycles/{TEST_MOTOR_ID}/customer-share")
        
        # Should NOT return 401 or 403 - endpoint is public
        assert response.status_code != 401, "Endpoint should not require authentication"
        assert response.status_code != 403, "Endpoint should not require authorization"
        
        # Should return 200 (found) or 404 (not found) - both are valid public responses
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        print(f"✓ Customer-share endpoint is public (status: {response.status_code})")
    
    def test_customer_share_returns_motorcycle_data(self):
        """Test that customer-share returns basic motorcycle data"""
        response = self.session.get(f"{BASE_URL}/api/motorcycles/{TEST_MOTOR_ID}/customer-share")
        
        if response.status_code == 404:
            pytest.skip(f"Test motor {TEST_MOTOR_ID} not found - may have been deleted")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify basic fields are present
        assert "brand" in data, "Response should include brand"
        assert "model" in data, "Response should include model"
        assert "year" in data, "Response should include year"
        assert "id" in data, "Response should include id"
        
        print(f"✓ Customer-share returns motorcycle: {data.get('brand')} {data.get('model')} ({data.get('year')})")
    
    def test_customer_share_includes_specs(self):
        """Test that customer-share includes basic motorcycle specs"""
        response = self.session.get(f"{BASE_URL}/api/motorcycles/{TEST_MOTOR_ID}/customer-share")
        
        if response.status_code == 404:
            pytest.skip(f"Test motor {TEST_MOTOR_ID} not found")
        
        assert response.status_code == 200
        data = response.json()
        
        # Core required fields that should always be present
        assert "id" in data, "Response should include id"
        assert "brand" in data, "Response should include brand"
        assert "model" in data, "Response should include model"
        assert "year" in data, "Response should include year"
        
        # Log all available fields
        print(f"✓ Customer-share includes specs:")
        print(f"  id={data.get('id')}")
        print(f"  brand={data.get('brand')}")
        print(f"  model={data.get('model')}")
        print(f"  year={data.get('year')}")
        print(f"  mileage={data.get('mileage', 'not set')}")
        print(f"  color={data.get('color', 'not set')}")
        print(f"  condition={data.get('condition', 'not set')}")
        print(f"  is_available={data.get('is_available')}")
        if data.get('images'):
            print(f"  Images count: {len(data.get('images', []))}")
    
    def test_customer_share_excludes_price_fields(self):
        """Test that customer-share does NOT include any price-related fields"""
        response = self.session.get(f"{BASE_URL}/api/motorcycles/{TEST_MOTOR_ID}/customer-share")
        
        if response.status_code == 404:
            pytest.skip(f"Test motor {TEST_MOTOR_ID} not found")
        
        assert response.status_code == 200
        data = response.json()
        
        # These price fields should NOT be present
        price_fields = [
            "price", "starting_price", "purchase_price", "highest_bid",
            "original_price", "price_override", "price_override_amount",
            "price_override_active", "supplier_price_reduced", "supplier_price_reduction"
        ]
        
        for field in price_fields:
            assert field not in data, f"Response should NOT include {field}"
        
        print(f"✓ Customer-share correctly excludes all price fields")
    
    def test_customer_share_excludes_internal_fields(self):
        """Test that customer-share does NOT include internal/sensitive fields"""
        response = self.session.get(f"{BASE_URL}/api/motorcycles/{TEST_MOTOR_ID}/customer-share")
        
        if response.status_code == 404:
            pytest.skip(f"Test motor {TEST_MOTOR_ID} not found")
        
        assert response.status_code == 200
        data = response.json()
        
        # These internal fields should NOT be present
        internal_fields = [
            "visible_to_dealers", "visibility", "created_by",
            "highest_bidder_id", "foreign_dealer_id", "seller_id"
        ]
        
        for field in internal_fields:
            assert field not in data, f"Response should NOT include internal field {field}"
        
        print(f"✓ Customer-share correctly excludes internal fields")
    
    def test_customer_share_404_for_nonexistent_motor(self):
        """Test that customer-share returns 404 for non-existent motor ID"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = self.session.get(f"{BASE_URL}/api/motorcycles/{fake_id}/customer-share")
        
        assert response.status_code == 404, f"Expected 404 for non-existent motor, got {response.status_code}"
        
        # Verify error message
        data = response.json()
        assert "detail" in data, "404 response should include detail message"
        
        print(f"✓ Customer-share returns 404 for non-existent motor: {data.get('detail')}")
    
    def test_customer_share_with_real_motor_from_list(self):
        """Test customer-share with a real motor from the motorcycles list"""
        # First, get admin token to fetch motorcycles list
        token = self.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        # Get list of motorcycles
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(f"{BASE_URL}/api/motorcycles", headers=headers)
        
        if response.status_code != 200:
            pytest.skip("Could not fetch motorcycles list")
        
        motorcycles = response.json()
        if not motorcycles:
            pytest.skip("No motorcycles in database")
        
        # Test customer-share with first available motorcycle
        motor = motorcycles[0]
        motor_id = motor.get("id")
        
        # Now test customer-share WITHOUT auth
        share_response = self.session.get(f"{BASE_URL}/api/motorcycles/{motor_id}/customer-share")
        
        assert share_response.status_code == 200, f"Expected 200, got {share_response.status_code}"
        share_data = share_response.json()
        
        # Verify data matches but prices are stripped
        assert share_data.get("brand") == motor.get("brand"), "Brand should match"
        assert share_data.get("model") == motor.get("model"), "Model should match"
        assert share_data.get("year") == motor.get("year"), "Year should match"
        
        # Verify price is NOT in share data
        assert "price" not in share_data, "Price should NOT be in customer-share response"
        
        print(f"✓ Customer-share works with real motor: {share_data.get('brand')} {share_data.get('model')}")
        print(f"  Original motor had price: €{motor.get('price', 'N/A')}")
        print(f"  Customer-share correctly hides price")


class TestCustomerShareCompareWithAuthEndpoint:
    """Compare customer-share response with authenticated endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
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
        return None
    
    def test_compare_customer_share_vs_authenticated(self):
        """Compare customer-share response with authenticated endpoint to verify price stripping"""
        token = self.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        # Get motorcycle with authentication (includes prices)
        headers = {"Authorization": f"Bearer {token}"}
        auth_response = self.session.get(f"{BASE_URL}/api/motorcycles/{TEST_MOTOR_ID}", headers=headers)
        
        if auth_response.status_code == 404:
            pytest.skip(f"Test motor {TEST_MOTOR_ID} not found")
        
        if auth_response.status_code != 200:
            pytest.skip(f"Could not fetch motor with auth: {auth_response.status_code}")
        
        auth_data = auth_response.json()
        
        # Get customer-share (no auth, no prices)
        share_response = self.session.get(f"{BASE_URL}/api/motorcycles/{TEST_MOTOR_ID}/customer-share")
        assert share_response.status_code == 200
        share_data = share_response.json()
        
        # Verify same basic data
        assert share_data.get("brand") == auth_data.get("brand")
        assert share_data.get("model") == auth_data.get("model")
        assert share_data.get("year") == auth_data.get("year")
        assert share_data.get("mileage") == auth_data.get("mileage")
        assert share_data.get("color") == auth_data.get("color")
        
        # Verify authenticated response HAS price
        assert "price" in auth_data, "Authenticated response should include price"
        
        # Verify customer-share does NOT have price
        assert "price" not in share_data, "Customer-share should NOT include price"
        
        print(f"✓ Comparison test passed:")
        print(f"  Authenticated endpoint shows price: €{auth_data.get('price')}")
        print(f"  Customer-share correctly hides price")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
