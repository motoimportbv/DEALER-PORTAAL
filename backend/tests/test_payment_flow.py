"""
Test suite for Moto Import payment and authentication flows
Tests: Login, Motorcycle detail, Payment calculation, Stripe checkout
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bike-dealer-1.preview.emergentagent.com')

# Test credentials
DEALER_EMAIL = "dealer@test.nl"
DEALER_PASSWORD = "dealer123"
ADMIN_EMAIL = "admin@test.nl"
ADMIN_PASSWORD = "admin123"

# Test motorcycle ID
MOTORCYCLE_ID = "f517d361-8d92-430b-bb78-69f1c02d0670"


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_api_root(self):
        """Test API is running"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root: {data['message']}")
    
    def test_dealer_login(self):
        """Test dealer login with provided credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        assert response.status_code == 200, f"Dealer login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == DEALER_EMAIL
        assert data["user"]["role"] == "dealer"
        print(f"✓ Dealer login successful: {data['user']['company_name']}")
        return data["token"]
    
    def test_admin_login(self):
        """Test admin login with provided credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['company_name']}")
        return data["token"]


class TestMotorcycleDetail:
    """Motorcycle detail and availability tests"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Dealer authentication failed")
    
    def test_get_motorcycle_detail(self, dealer_token):
        """Test fetching motorcycle detail page"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.get(f"{BASE_URL}/api/motorcycles/{MOTORCYCLE_ID}", headers=headers)
        assert response.status_code == 200, f"Failed to get motorcycle: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["id"] == MOTORCYCLE_ID
        assert "brand" in data
        assert "model" in data
        assert "price" in data
        assert "starting_price" in data
        print(f"✓ Motorcycle detail: {data['brand']} {data['model']} - €{data['price']}")
        return data
    
    def test_get_motorcycle_bids(self, dealer_token):
        """Test fetching bids for motorcycle"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.get(f"{BASE_URL}/api/bids/{MOTORCYCLE_ID}", headers=headers)
        assert response.status_code == 200, f"Failed to get bids: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Motorcycle bids: {len(data)} bids found")
        return data


class TestPaymentCalculation:
    """Payment calculation tests - verify 10% deposit and €50 delivery"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Dealer authentication failed")
    
    @pytest.fixture
    def motorcycle_price(self, dealer_token):
        """Get motorcycle price for calculations"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.get(f"{BASE_URL}/api/motorcycles/{MOTORCYCLE_ID}", headers=headers)
        if response.status_code == 200:
            return response.json()["price"]
        pytest.skip("Could not get motorcycle price")
    
    def test_payment_calculation_without_delivery(self, dealer_token, motorcycle_price):
        """Test payment calculation without delivery - should be 10% deposit"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.get(
            f"{BASE_URL}/api/payments/calculate?motorcycle_id={MOTORCYCLE_ID}&needs_delivery=false",
            headers=headers
        )
        assert response.status_code == 200, f"Payment calculation failed: {response.text}"
        
        data = response.json()
        expected_deposit = motorcycle_price * 0.10
        
        assert "deposit_amount" in data
        assert "delivery_cost" in data
        assert "total_to_pay" in data
        assert data["deposit_percentage"] == 10.0
        assert data["deposit_amount"] == expected_deposit, f"Expected deposit {expected_deposit}, got {data['deposit_amount']}"
        assert data["delivery_cost"] == 0.0
        assert data["total_to_pay"] == expected_deposit
        
        print(f"✓ Payment without delivery: Deposit €{data['deposit_amount']} (10% of €{motorcycle_price})")
    
    def test_payment_calculation_with_delivery(self, dealer_token, motorcycle_price):
        """Test payment calculation with delivery - should be 10% deposit + €50"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.get(
            f"{BASE_URL}/api/payments/calculate?motorcycle_id={MOTORCYCLE_ID}&needs_delivery=true",
            headers=headers
        )
        assert response.status_code == 200, f"Payment calculation failed: {response.text}"
        
        data = response.json()
        expected_deposit = motorcycle_price * 0.10
        expected_total = expected_deposit + 50.0
        
        assert data["deposit_amount"] == expected_deposit
        assert data["delivery_cost"] == 50.0, f"Expected delivery cost €50, got €{data['delivery_cost']}"
        assert data["total_to_pay"] == expected_total, f"Expected total €{expected_total}, got €{data['total_to_pay']}"
        
        print(f"✓ Payment with delivery: Deposit €{data['deposit_amount']} + Delivery €50 = Total €{data['total_to_pay']}")


class TestStripeCheckout:
    """Stripe checkout creation tests"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Dealer authentication failed")
    
    def test_create_checkout_session_without_delivery(self, dealer_token):
        """Test creating Stripe checkout session without delivery"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.post(
            f"{BASE_URL}/api/payments/create-checkout",
            headers=headers,
            json={
                "motorcycle_id": MOTORCYCLE_ID,
                "needs_delivery": False,
                "order_type": "buy_now",
                "origin_url": "https://bike-dealer-1.preview.emergentagent.com"
            }
        )
        
        # May fail if motorcycle is already sold, check for both cases
        if response.status_code == 400:
            data = response.json()
            if "niet meer beschikbaar" in data.get("detail", ""):
                pytest.skip("Motorcycle is no longer available")
        
        assert response.status_code == 200, f"Checkout creation failed: {response.text}"
        
        data = response.json()
        assert "checkout_url" in data
        assert "session_id" in data
        assert "order_id" in data
        assert "deposit_amount" in data
        assert "total_to_pay" in data
        
        # Verify checkout URL is Stripe
        assert "checkout.stripe.com" in data["checkout_url"], f"Expected Stripe URL, got: {data['checkout_url']}"
        
        print(f"✓ Stripe checkout created: {data['checkout_url'][:60]}...")
        print(f"  - Deposit: €{data['deposit_amount']}")
        print(f"  - Total to pay: €{data['total_to_pay']}")
        return data
    
    def test_create_checkout_session_with_delivery(self, dealer_token):
        """Test creating Stripe checkout session with delivery"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.post(
            f"{BASE_URL}/api/payments/create-checkout",
            headers=headers,
            json={
                "motorcycle_id": MOTORCYCLE_ID,
                "needs_delivery": True,
                "order_type": "buy_now",
                "origin_url": "https://bike-dealer-1.preview.emergentagent.com"
            }
        )
        
        if response.status_code == 400:
            data = response.json()
            if "niet meer beschikbaar" in data.get("detail", ""):
                pytest.skip("Motorcycle is no longer available")
        
        assert response.status_code == 200, f"Checkout creation failed: {response.text}"
        
        data = response.json()
        assert "checkout_url" in data
        assert data["delivery_cost"] == 50.0, f"Expected delivery €50, got €{data['delivery_cost']}"
        
        print(f"✓ Stripe checkout with delivery: Total €{data['total_to_pay']} (includes €50 delivery)")
        return data


class TestAdminDashboard:
    """Admin dashboard and statistics tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin authentication failed")
    
    def test_get_admin_stats(self, admin_token):
        """Test fetching admin statistics"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/stats", headers=headers)
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        data = response.json()
        assert "total_motorcycles" in data
        assert "available_motorcycles" in data
        assert "total_orders" in data
        assert "pending_orders" in data
        assert "total_dealers" in data
        
        print(f"✓ Admin stats:")
        print(f"  - Total motorcycles: {data['total_motorcycles']}")
        print(f"  - Available: {data['available_motorcycles']}")
        print(f"  - Total orders: {data['total_orders']}")
        print(f"  - Pending orders: {data['pending_orders']}")
        print(f"  - Total dealers: {data['total_dealers']}")
        return data
    
    def test_get_all_motorcycles(self, admin_token):
        """Test fetching all motorcycles as admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/motorcycles", headers=headers)
        assert response.status_code == 200, f"Failed to get motorcycles: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin motorcycles list: {len(data)} motorcycles")
        return data
    
    def test_get_all_orders(self, admin_token):
        """Test fetching all orders as admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        assert response.status_code == 200, f"Failed to get orders: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin orders list: {len(data)} orders")
        return data
    
    def test_get_all_dealers(self, admin_token):
        """Test fetching all dealers as admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dealers", headers=headers)
        assert response.status_code == 200, f"Failed to get dealers: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin dealers list: {len(data)} dealers")
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
