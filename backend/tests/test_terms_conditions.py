"""
Test Terms and Conditions Feature
- Register new dealer
- Login returns terms_accepted status
- Accept terms endpoint
- Verify terms_accepted persists
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTermsAndConditions:
    """Test Terms and Conditions feature for dealers"""
    
    @pytest.fixture(scope="class")
    def test_dealer(self):
        """Create a unique test dealer for this test class"""
        unique_id = str(uuid.uuid4())[:8]
        return {
            "email": f"TEST_terms_{unique_id}@dealer.nl",
            "password": "TermsTest123!",
            "company_name": f"Terms Test BV {unique_id}",
            "kvk_number": "12345678",
            "address": "Test Street 1",
            "postal_code": "1234AB",
            "city": "Amsterdam",
            "phone": "+31612345678",
            "contact_person": "Test Person",
            "role": "dealer"
        }
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin token for approving dealers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "motoimportbv@gmail.com",
            "password": "Enolim12"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed - skipping tests")
    
    def test_01_register_new_dealer(self, test_dealer):
        """Register a new test dealer"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json=test_dealer)
        
        # May return 400 if email already exists, which is fine
        if response.status_code == 400:
            pytest.skip("Test dealer already exists")
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_dealer["email"]
        assert data["user"]["is_approved"] == False  # New dealers are not approved
        
        # Store user_id for later tests
        test_dealer["user_id"] = data["user"]["id"]
        test_dealer["token"] = data["token"]
        
        print(f"✓ Registered new dealer: {test_dealer['email']}")
    
    def test_02_admin_approve_dealer(self, test_dealer, admin_token):
        """Admin approves the new dealer"""
        if "user_id" not in test_dealer:
            pytest.skip("Dealer not registered")
        
        response = requests.put(
            f"{BASE_URL}/api/admin/dealers/{test_dealer['user_id']}/approve",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Approval failed: {response.text}"
        print(f"✓ Admin approved dealer: {test_dealer['email']}")
    
    def test_03_login_returns_terms_accepted_false(self, test_dealer):
        """Login should return terms_accepted: false for new dealer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_dealer["email"],
            "password": test_dealer["password"]
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify terms_accepted is in response and is False
        assert "user" in data
        assert "terms_accepted" in data["user"], "terms_accepted field missing from login response"
        assert data["user"]["terms_accepted"] == False, "New dealer should have terms_accepted=False"
        
        # Store token for later tests
        test_dealer["token"] = data["token"]
        
        print(f"✓ Login returns terms_accepted: {data['user']['terms_accepted']}")
    
    def test_04_accept_terms_without_checkbox_should_work(self, test_dealer):
        """Accept terms endpoint should work (checkbox validation is frontend-only)"""
        if "token" not in test_dealer:
            pytest.skip("No token available")
        
        response = requests.post(
            f"{BASE_URL}/api/auth/accept-terms",
            headers={"Authorization": f"Bearer {test_dealer['token']}"},
            json={}
        )
        
        assert response.status_code == 200, f"Accept terms failed: {response.text}"
        data = response.json()
        
        assert data.get("terms_accepted") == True
        print(f"✓ Terms accepted successfully")
    
    def test_05_login_returns_terms_accepted_true(self, test_dealer):
        """After accepting, login should return terms_accepted: true"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_dealer["email"],
            "password": test_dealer["password"]
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify terms_accepted is now True
        assert data["user"]["terms_accepted"] == True, "terms_accepted should be True after accepting"
        
        print(f"✓ Login now returns terms_accepted: {data['user']['terms_accepted']}")
    
    def test_06_auth_me_returns_terms_accepted(self, test_dealer):
        """GET /auth/me should return terms_accepted status"""
        if "token" not in test_dealer:
            pytest.skip("No token available")
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {test_dealer['token']}"}
        )
        
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        
        # Verify terms_accepted is in response
        assert "terms_accepted" in data, "terms_accepted field missing from /auth/me response"
        assert data["terms_accepted"] == True
        
        print(f"✓ /auth/me returns terms_accepted: {data['terms_accepted']}")


class TestExistingDealerTerms:
    """Test terms_accepted for existing approved dealer"""
    
    def test_existing_dealer_login(self):
        """Test login for existing dealer (zoektest@dealer.nl)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "zoektest@dealer.nl",
            "password": "ZoekTest123!"
        })
        
        # This dealer may or may not exist
        if response.status_code != 200:
            pytest.skip("Existing test dealer not available")
        
        data = response.json()
        
        # Verify terms_accepted field exists
        assert "user" in data
        assert "terms_accepted" in data["user"], "terms_accepted field missing from login response"
        
        print(f"✓ Existing dealer terms_accepted: {data['user']['terms_accepted']}")


class TestAcceptTermsEndpoint:
    """Test the accept-terms endpoint directly"""
    
    def test_accept_terms_requires_auth(self):
        """Accept terms should require authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/accept-terms", json={})
        
        assert response.status_code in [401, 403], "Accept terms should require auth"
        print("✓ Accept terms requires authentication")
    
    def test_accept_terms_with_invalid_token(self):
        """Accept terms should reject invalid token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/accept-terms",
            headers={"Authorization": "Bearer invalid_token"},
            json={}
        )
        
        assert response.status_code == 401, "Should reject invalid token"
        print("✓ Accept terms rejects invalid token")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
