"""
Comprehensive API tests for Moto Import platform
Tests: Auth, Motorcycles, Orders, Dealers, Translations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Enolim12"
DEALER_EMAIL = "zoektest@dealer.nl"
DEALER_PASSWORD = "ZoekTest123!"


class TestHealthAndBasicEndpoints:
    """Test basic API health and endpoints"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"SUCCESS: API root returns: {data['message']}")


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"SUCCESS: Admin login works, role: {data['user']['role']}")
    
    def test_dealer_login(self):
        """Test dealer login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "dealer"
        assert "is_approved" in data["user"]
        print(f"SUCCESS: Dealer login works, is_approved: {data['user']['is_approved']}")
    
    def test_invalid_login(self):
        """Test invalid login credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("SUCCESS: Invalid login returns 401")
    
    def test_auth_me_endpoint(self):
        """Test /auth/me endpoint"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Test /auth/me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert data["email"] == DEALER_EMAIL
        print(f"SUCCESS: /auth/me returns user data for {data['email']}")


class TestMotorcycles:
    """Test motorcycle endpoints"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_available_motorcycles(self, dealer_token):
        """Test getting available motorcycles"""
        response = requests.get(f"{BASE_URL}/api/motorcycles/available", headers={
            "Authorization": f"Bearer {dealer_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} available motorcycles")
    
    def test_get_all_motorcycles_admin(self, admin_token):
        """Test getting all motorcycles as admin"""
        response = requests.get(f"{BASE_URL}/api/motorcycles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Admin got {len(data)} total motorcycles")
    
    def test_get_motorcycle_detail(self, dealer_token):
        """Test getting motorcycle detail"""
        # First get list
        list_response = requests.get(f"{BASE_URL}/api/motorcycles/available", headers={
            "Authorization": f"Bearer {dealer_token}"
        })
        motorcycles = list_response.json()
        
        if len(motorcycles) > 0:
            motorcycle_id = motorcycles[0]["id"]
            response = requests.get(f"{BASE_URL}/api/motorcycles/{motorcycle_id}", headers={
                "Authorization": f"Bearer {dealer_token}"
            })
            assert response.status_code == 200
            data = response.json()
            assert "brand" in data
            assert "model" in data
            assert "price" in data
            print(f"SUCCESS: Got motorcycle detail: {data['brand']} {data['model']}")
        else:
            pytest.skip("No motorcycles available to test")


class TestOrders:
    """Test order endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_orders_admin(self, admin_token):
        """Test getting orders as admin"""
        response = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Admin got {len(data)} orders")
    
    def test_get_orders_dealer(self, dealer_token):
        """Test getting orders as dealer"""
        response = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {dealer_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Dealer got {len(data)} orders")


class TestDealers:
    """Test dealer management endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_dealers_admin(self, admin_token):
        """Test getting dealers as admin"""
        response = requests.get(f"{BASE_URL}/api/dealers", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Admin got {len(data)} dealers")
    
    def test_get_pending_dealers(self, admin_token):
        """Test getting pending dealers"""
        response = requests.get(f"{BASE_URL}/api/dealers/pending", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} pending dealers")


class TestSupplierRegistration:
    """Test supplier registration endpoint"""
    
    def test_supplier_registration_validation(self):
        """Test supplier registration with missing fields"""
        response = requests.post(f"{BASE_URL}/api/auth/register-supplier", json={
            "email": "test@test.com",
            "password": "test123"
            # Missing required fields
        })
        # Should fail validation
        assert response.status_code in [400, 422]
        print("SUCCESS: Supplier registration validates required fields")


class TestVoucher:
    """Test voucher endpoints"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_my_voucher(self, dealer_token):
        """Test getting user's voucher"""
        response = requests.get(f"{BASE_URL}/api/voucher/my-voucher", headers={
            "Authorization": f"Bearer {dealer_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "has_voucher" in data
        print(f"SUCCESS: Voucher endpoint works, has_voucher: {data['has_voucher']}")


class TestPakbon:
    """Test pakbon endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_pakbon_for_order(self, admin_token):
        """Test getting pakbon for an order"""
        # First get orders
        orders_response = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        orders = orders_response.json()
        
        if len(orders) > 0:
            order_id = orders[0]["id"]
            response = requests.get(f"{BASE_URL}/api/pakbon/{order_id}", headers={
                "Authorization": f"Bearer {admin_token}"
            })
            assert response.status_code == 200
            data = response.json()
            assert "order" in data
            print(f"SUCCESS: Got pakbon for order {order_id}")
        else:
            pytest.skip("No orders available to test pakbon")


class TestTermsAndConditions:
    """Test terms and conditions endpoint"""
    
    def test_accept_terms_requires_auth(self):
        """Test that accept terms requires authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/accept-terms")
        assert response.status_code == 401
        print("SUCCESS: Accept terms requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
