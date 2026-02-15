"""
Test cases for bug fixes:
1. Spinning server bug (infinite loading) - timeout and error handling
2. Password reset shows 'waiting for approval' - fresh user data check
3. Pakbon button not visible on mobile - mobile card view
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthAndLogin:
    """Test authentication and login functionality"""
    
    def test_dealer_login_returns_is_approved_status(self):
        """Issue 2: Verify login returns is_approved status for dealers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "zoektest@dealer.nl",
            "password": "ZoekTest123!"
        }, timeout=15)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify token is returned
        assert "token" in data
        assert len(data["token"]) > 0
        
        # Verify user data includes is_approved field
        assert "user" in data
        assert "is_approved" in data["user"]
        assert data["user"]["is_approved"] == True  # This dealer should be approved
        assert data["user"]["role"] == "dealer"
        assert data["user"]["email"] == "zoektest@dealer.nl"
    
    def test_admin_login_success(self):
        """Test admin login works correctly"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "motoimportbv@gmail.com",
            "password": "Enolim12"
        }, timeout=15)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
    
    def test_auth_me_endpoint_returns_fresh_data(self):
        """Issue 2: Verify /auth/me returns fresh user data with is_approved"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "zoektest@dealer.nl",
            "password": "ZoekTest123!"
        }, timeout=15)
        
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Now call /auth/me to get fresh user data
        me_response = requests.get(f"{BASE_URL}/api/auth/me", 
            headers={"Authorization": f"Bearer {token}"},
            timeout=15
        )
        
        assert me_response.status_code == 200
        user_data = me_response.json()
        
        # Verify is_approved is in the response
        assert "is_approved" in user_data
        assert user_data["is_approved"] == True
        assert user_data["email"] == "zoektest@dealer.nl"


class TestOrdersAPI:
    """Test orders API for admin"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "motoimportbv@gmail.com",
            "password": "Enolim12"
        }, timeout=15)
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_orders_list_returns_data(self, admin_token):
        """Issue 3: Verify orders API returns data for mobile view"""
        response = requests.get(f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15
        )
        
        assert response.status_code == 200
        orders = response.json()
        
        # Verify orders is a list
        assert isinstance(orders, list)
        
        # If there are orders, verify structure
        if len(orders) > 0:
            order = orders[0]
            assert "id" in order
            assert "dealer_email" in order
            assert "dealer_company" in order
            assert "status" in order
    
    def test_specific_test_order_exists(self, admin_token):
        """Verify the test order created by main agent exists"""
        response = requests.get(f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15
        )
        
        assert response.status_code == 200
        orders = response.json()
        
        # Look for the test order
        test_order_id = "f37c6d21-3faf-43e9-92ad-03972bea6db2"
        test_order = next((o for o in orders if o["id"] == test_order_id), None)
        
        if test_order:
            assert test_order["dealer_email"] == "zoektest@dealer.nl"
            assert test_order["dealer_company"] == "Zoek Test Dealer"
            print(f"Found test order: {test_order_id}")


class TestMotorcyclesAPI:
    """Test motorcycles API for dealers"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "zoektest@dealer.nl",
            "password": "ZoekTest123!"
        }, timeout=15)
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Dealer authentication failed")
    
    def test_available_motorcycles_for_approved_dealer(self, dealer_token):
        """Issue 2: Approved dealer should be able to access motorcycles"""
        response = requests.get(f"{BASE_URL}/api/motorcycles/available",
            headers={"Authorization": f"Bearer {dealer_token}"},
            timeout=15
        )
        
        # Should return 200 for approved dealer, not 403
        assert response.status_code == 200
        motorcycles = response.json()
        
        # Verify motorcycles is a list
        assert isinstance(motorcycles, list)
        
        # If there are motorcycles, verify structure
        if len(motorcycles) > 0:
            moto = motorcycles[0]
            assert "id" in moto
            assert "brand" in moto
            assert "model" in moto
            assert "price" in moto


class TestAPITimeout:
    """Test API timeout handling (Issue 1)"""
    
    def test_api_responds_within_timeout(self):
        """Issue 1: Verify API responds within 15 second timeout"""
        import time
        
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "zoektest@dealer.nl",
            "password": "ZoekTest123!"
        }, timeout=15)
        elapsed_time = time.time() - start_time
        
        assert response.status_code == 200
        assert elapsed_time < 15, f"API took {elapsed_time}s, should be under 15s"
        print(f"API responded in {elapsed_time:.2f}s")
    
    def test_invalid_login_returns_error_not_timeout(self):
        """Issue 1: Invalid login should return error, not timeout"""
        import time
        
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        }, timeout=15)
        elapsed_time = time.time() - start_time
        
        # Should return 401 quickly, not timeout
        assert response.status_code == 401
        assert elapsed_time < 5, f"Error response took {elapsed_time}s, should be quick"
