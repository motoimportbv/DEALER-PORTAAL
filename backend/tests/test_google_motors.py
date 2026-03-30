"""
Test suite for Google Motors feature
- Public SEO endpoints (no auth)
- Dealer endpoints (requires dealer auth)
- Admin endpoints (requires admin auth - motoimportbv@gmail.com only)
- Stripe checkout endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
TEST_DEALER_EMAIL = "testgoogle@dealer.nl"
TEST_DEALER_PASSWORD = "Test2024!"
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Admin2024!"


class TestPublicMotorEndpoints:
    """Public SEO endpoints - NO authentication required"""
    
    def test_public_motors_list(self):
        """GET /api/public/motors - should return approved motors without auth"""
        response = requests.get(f"{BASE_URL}/api/public/motors")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of motors"
        print(f"✓ Public motors endpoint returns {len(data)} motors")
        
        # If there are motors, verify structure
        if len(data) > 0:
            motor = data[0]
            assert "id" in motor, "Motor should have id"
            assert "brand" in motor, "Motor should have brand"
            assert "model" in motor, "Motor should have model"
            assert "price" in motor, "Motor should have price"
            print(f"✓ First motor: {motor.get('brand')} {motor.get('model')} - €{motor.get('price')}")
    
    def test_public_motors_brands(self):
        """GET /api/public/motors/brands - should return distinct brands"""
        response = requests.get(f"{BASE_URL}/api/public/motors/brands")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list of brands"
        print(f"✓ Public brands endpoint returns {len(data)} brands: {data}")
    
    def test_public_motors_filter_by_brand(self):
        """GET /api/public/motors?brand=BMW - should filter by brand"""
        response = requests.get(f"{BASE_URL}/api/public/motors?brand=BMW")
        assert response.status_code == 200
        data = response.json()
        # All returned motors should be BMW
        for motor in data:
            assert motor.get("brand") == "BMW", f"Expected BMW, got {motor.get('brand')}"
        print(f"✓ Brand filter works - {len(data)} BMW motors found")
    
    def test_public_motors_sort_by_price(self):
        """GET /api/public/motors?sort_by=price_low - should sort by price"""
        response = requests.get(f"{BASE_URL}/api/public/motors?sort_by=price_low")
        assert response.status_code == 200
        data = response.json()
        if len(data) > 1:
            prices = [m.get("price", 0) for m in data]
            assert prices == sorted(prices), "Motors should be sorted by price ascending"
        print(f"✓ Price sort works")


class TestPublicMotorDetail:
    """Public motor detail endpoint"""
    
    @pytest.fixture
    def approved_motor_id(self):
        """Get an approved motor ID for testing"""
        response = requests.get(f"{BASE_URL}/api/public/motors")
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        pytest.skip("No approved motors available for testing")
    
    def test_public_motor_detail(self, approved_motor_id):
        """GET /api/public/motors/:id - should return motor with dealer info"""
        response = requests.get(f"{BASE_URL}/api/public/motors/{approved_motor_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        motor = response.json()
        
        # Verify all dealer info fields are present
        assert "dealer_company" in motor, "Should have dealer_company"
        assert "dealer_email" in motor, "Should have dealer_email"
        assert "dealer_phone" in motor, "Should have dealer_phone"
        assert "dealer_city" in motor, "Should have dealer_city"
        assert "dealer_contact_person" in motor, "Should have dealer_contact_person"
        
        print(f"✓ Motor detail: {motor.get('brand')} {motor.get('model')}")
        print(f"  Dealer: {motor.get('dealer_company')} - {motor.get('dealer_city')}")
        print(f"  Contact: {motor.get('dealer_contact_person')} - {motor.get('dealer_email')}")
    
    def test_public_motor_detail_not_found(self):
        """GET /api/public/motors/:id - should return 404 for non-existent motor"""
        response = requests.get(f"{BASE_URL}/api/public/motors/non-existent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent motor returns 404")


class TestPublicInterestForm:
    """Interest form submission endpoint"""
    
    @pytest.fixture
    def approved_motor_id(self):
        """Get an approved motor ID for testing"""
        response = requests.get(f"{BASE_URL}/api/public/motors")
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        pytest.skip("No approved motors available for testing")
    
    def test_interest_form_with_email(self, approved_motor_id):
        """POST /api/public/motors/:id/interest - should accept interest with email"""
        payload = {
            "name": "Test Buyer",
            "email": "testbuyer@example.com",
            "phone": "",
            "message": "I am interested in this motorcycle"
        }
        response = requests.post(
            f"{BASE_URL}/api/public/motors/{approved_motor_id}/interest",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "ok", "Should return status ok"
        print(f"✓ Interest form submitted successfully with email")
    
    def test_interest_form_with_phone(self, approved_motor_id):
        """POST /api/public/motors/:id/interest - should accept interest with phone"""
        payload = {
            "name": "Test Buyer 2",
            "email": "",
            "phone": "+31612345678",
            "message": ""
        }
        response = requests.post(
            f"{BASE_URL}/api/public/motors/{approved_motor_id}/interest",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Interest form submitted successfully with phone")
    
    def test_interest_form_requires_contact(self, approved_motor_id):
        """POST /api/public/motors/:id/interest - should require email or phone"""
        payload = {
            "name": "Test Buyer",
            "email": "",
            "phone": "",
            "message": "No contact info"
        }
        response = requests.post(
            f"{BASE_URL}/api/public/motors/{approved_motor_id}/interest",
            json=payload
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Interest form correctly requires email or phone")


class TestDealerAuthentication:
    """Test dealer login and token retrieval"""
    
    def test_dealer_login(self):
        """POST /api/auth/login - dealer should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_DEALER_EMAIL,
            "password": TEST_DEALER_PASSWORD
        })
        assert response.status_code == 200, f"Dealer login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "token" in data, "Should return token"
        print(f"✓ Dealer login successful")
        return data["token"]


class TestDealerGoogleMotorsEndpoints:
    """Dealer endpoints for Google Motors - requires dealer auth"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_DEALER_EMAIL,
            "password": TEST_DEALER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Dealer login failed: {response.text}")
        return response.json()["token"]
    
    @pytest.fixture
    def dealer_headers(self, dealer_token):
        return {"Authorization": f"Bearer {dealer_token}"}
    
    def test_get_subscription_status(self, dealer_headers):
        """GET /api/google-motors/subscription - should return subscription status"""
        response = requests.get(f"{BASE_URL}/api/google-motors/subscription", headers=dealer_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "has_monthly" in data, "Should have has_monthly field"
        assert "per_motor_credits" in data, "Should have per_motor_credits field"
        assert "active_motors" in data, "Should have active_motors field"
        
        print(f"✓ Subscription status:")
        print(f"  Monthly active: {data.get('has_monthly')}")
        print(f"  Per-motor credits: {data.get('per_motor_credits')}")
        print(f"  Active motors: {data.get('active_motors')}")
    
    def test_get_my_google_motors(self, dealer_headers):
        """GET /api/google-motors/my - should return dealer's motors"""
        response = requests.get(f"{BASE_URL}/api/google-motors/my", headers=dealer_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Should return list of motors"
        print(f"✓ Dealer has {len(data)} Google motors")
        
        for motor in data:
            print(f"  - {motor.get('brand')} {motor.get('model')} ({motor.get('status')})")
    
    def test_checkout_per_motor_plan(self, dealer_headers):
        """POST /api/google-motors/checkout - should create Stripe checkout for per_motor plan"""
        response = requests.post(
            f"{BASE_URL}/api/google-motors/checkout",
            json={"plan": "per_motor", "origin_url": "https://test.example.com"},
            headers=dealer_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "checkout_url" in data, "Should return checkout_url"
        assert "session_id" in data, "Should return session_id"
        assert data["checkout_url"].startswith("https://checkout.stripe.com"), "Should be Stripe URL"
        
        print(f"✓ Per-motor checkout created: {data['session_id'][:20]}...")
    
    def test_checkout_monthly_plan(self, dealer_headers):
        """POST /api/google-motors/checkout - should create Stripe checkout for monthly plan"""
        response = requests.post(
            f"{BASE_URL}/api/google-motors/checkout",
            json={"plan": "monthly", "origin_url": "https://test.example.com"},
            headers=dealer_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "checkout_url" in data, "Should return checkout_url"
        print(f"✓ Monthly checkout created: {data['session_id'][:20]}...")
    
    def test_checkout_invalid_plan(self, dealer_headers):
        """POST /api/google-motors/checkout - should reject invalid plan"""
        response = requests.post(
            f"{BASE_URL}/api/google-motors/checkout",
            json={"plan": "invalid_plan"},
            headers=dealer_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Invalid plan correctly rejected")


class TestAdminAuthentication:
    """Test admin login"""
    
    def test_admin_login(self):
        """POST /api/auth/login - admin should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "token" in data, "Should return token"
        print(f"✓ Admin login successful")


class TestAdminGoogleMotorsEndpoints:
    """Admin endpoints for Google Motors - requires admin auth (motoimportbv@gmail.com)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json()["token"]
    
    @pytest.fixture
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_get_all_google_motors(self, admin_headers):
        """GET /api/google-motors/all - admin should see all motors"""
        response = requests.get(f"{BASE_URL}/api/google-motors/all", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list"
        print(f"✓ Admin sees {len(data)} total Google motors")
        
        # Count by status
        pending = sum(1 for m in data if m.get("status") == "pending")
        approved = sum(1 for m in data if m.get("status") == "approved")
        rejected = sum(1 for m in data if m.get("status") == "rejected")
        print(f"  Pending: {pending}, Approved: {approved}, Rejected: {rejected}")
    
    def test_get_pending_google_motors(self, admin_headers):
        """GET /api/google-motors/pending - admin should see pending motors"""
        response = requests.get(f"{BASE_URL}/api/google-motors/pending", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # All should be pending
        for motor in data:
            assert motor.get("status") == "pending", f"Expected pending, got {motor.get('status')}"
        
        print(f"✓ Admin sees {len(data)} pending motors")


class TestAdminAccessControl:
    """Test that non-admin users cannot access admin endpoints"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_DEALER_EMAIL,
            "password": TEST_DEALER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Dealer login failed")
        return response.json()["token"]
    
    def test_dealer_cannot_access_admin_pending(self, dealer_token):
        """Dealer should not be able to access admin pending endpoint"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.get(f"{BASE_URL}/api/google-motors/pending", headers=headers)
        # Should be 403 (forbidden) or 401 (unauthorized)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Dealer correctly blocked from admin pending endpoint")
    
    def test_dealer_cannot_access_admin_all(self, dealer_token):
        """Dealer should not be able to access admin all endpoint"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.get(f"{BASE_URL}/api/google-motors/all", headers=headers)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Dealer correctly blocked from admin all endpoint")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
