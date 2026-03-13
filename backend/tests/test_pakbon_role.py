"""
Test suite for pakbon (packing slip) role functionality
Tests: login, orders access, role restrictions, API endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PAKBON_EMAIL = "ellenmilone@gmail.com"
PAKBON_PASSWORD = "MotoImport2024!"
ADMIN_EMAIL = "Daniel2002jay@hotmail.com"
ADMIN_PASSWORD = "AdminTest1234!"


class TestPakbonLogin:
    """Test pakbon user authentication"""
    
    def test_pakbon_user_can_login(self):
        """Verify pakbon user can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PAKBON_EMAIL,
            "password": PAKBON_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        
        # Verify user role is pakbon
        user = data["user"]
        assert user["role"] == "pakbon", f"Expected role 'pakbon', got '{user['role']}'"
        assert user["email"] == PAKBON_EMAIL
        print(f"✓ Pakbon user logged in successfully with role: {user['role']}")
    
    def test_pakbon_login_returns_token(self):
        """Verify login returns valid JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PAKBON_EMAIL,
            "password": PAKBON_PASSWORD
        })
        
        assert response.status_code == 200
        data = response.json()
        
        token = data.get("token")
        assert token is not None
        assert len(token) > 50, "Token seems too short"
        print(f"✓ Token returned (length: {len(token)})")


class TestPakbonOrdersAccess:
    """Test pakbon user access to orders endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PAKBON_EMAIL,
            "password": PAKBON_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Pakbon login failed")
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pakbon_can_access_orders(self):
        """Verify pakbon role can access /api/orders endpoint"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=self.headers)
        
        assert response.status_code == 200, f"Orders access failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of orders"
        print(f"✓ Pakbon can access orders endpoint, found {len(data)} orders")
    
    def test_pakbon_sees_all_orders_like_admin(self):
        """Verify pakbon role sees all orders (same as admin)"""
        # Get orders as pakbon
        pakbon_response = requests.get(f"{BASE_URL}/api/orders", headers=self.headers)
        assert pakbon_response.status_code == 200
        pakbon_orders = pakbon_response.json()
        
        # Get orders as admin for comparison
        admin_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if admin_login.status_code == 200:
            admin_headers = {"Authorization": f"Bearer {admin_login.json()['token']}"}
            admin_response = requests.get(f"{BASE_URL}/api/orders", headers=admin_headers)
            
            if admin_response.status_code == 200:
                admin_orders = admin_response.json()
                # Both should see the same orders
                assert len(pakbon_orders) == len(admin_orders), \
                    f"Pakbon sees {len(pakbon_orders)} orders, admin sees {len(admin_orders)}"
                print(f"✓ Pakbon sees same number of orders as admin: {len(pakbon_orders)}")
    
    def test_orders_have_required_fields(self):
        """Verify orders returned have required fields for pakbon display"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=self.headers)
        assert response.status_code == 200
        orders = response.json()
        
        if len(orders) > 0:
            order = orders[0]
            # Check required fields for pakbon dashboard
            assert "id" in order, "Order missing 'id' field"
            assert "motorcycle" in order or "motorcycle_snapshot" in order, "Order missing motorcycle data"
            assert "dealer_company" in order or "dealer_id" in order, "Order missing dealer info"
            print(f"✓ Order has required fields: {list(order.keys())[:10]}...")
        else:
            print("⚠ No orders found to verify fields")


class TestPakbonAccessRestrictions:
    """Test that pakbon role CANNOT access restricted endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PAKBON_EMAIL,
            "password": PAKBON_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Pakbon login failed")
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pakbon_cannot_access_admin_dealers(self):
        """Verify pakbon cannot access admin dealer management"""
        response = requests.get(f"{BASE_URL}/api/dealers", headers=self.headers)
        # Should be 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Pakbon correctly blocked from /api/dealers")
    
    def test_pakbon_cannot_create_motorcycles(self):
        """Verify pakbon cannot create new motorcycles"""
        response = requests.post(f"{BASE_URL}/api/motorcycles", 
            headers=self.headers,
            json={
                "brand": "Test",
                "model": "Test",
                "year": 2024,
                "price": 10000,
                "mileage": 0,
                "color": "Black",
                "description": "Test",
                "condition": "good"
            }
        )
        # Should be 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Pakbon correctly blocked from creating motorcycles")
    
    def test_pakbon_cannot_delete_motorcycles(self):
        """Verify pakbon cannot delete motorcycles"""
        response = requests.delete(f"{BASE_URL}/api/motorcycles/fake-id", headers=self.headers)
        # Should be 403 (or 404 if it checks first)
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        print("✓ Pakbon correctly blocked from deleting motorcycles")
    
    def test_pakbon_cannot_access_parts_management(self):
        """Verify pakbon cannot access admin parts management"""
        response = requests.post(f"{BASE_URL}/api/parts", 
            headers=self.headers,
            json={
                "name": "Test Part",
                "price": 100,
                "category_id": "test"
            }
        )
        # Should be 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Pakbon correctly blocked from parts management")


class TestPakbonMeEndpoint:
    """Test /api/auth/me endpoint returns correct pakbon user data"""
    
    def test_me_returns_pakbon_role(self):
        """Verify /api/auth/me returns correct role for pakbon user"""
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PAKBON_EMAIL,
            "password": PAKBON_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Get user info
        me_response = requests.get(f"{BASE_URL}/api/auth/me", 
            headers={"Authorization": f"Bearer {token}"})
        
        assert me_response.status_code == 200
        user = me_response.json()
        
        assert user["role"] == "pakbon", f"Expected role 'pakbon', got '{user['role']}'"
        assert user["email"] == PAKBON_EMAIL
        print(f"✓ /api/auth/me returns correct pakbon user data")


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
