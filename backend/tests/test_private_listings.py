"""
Test suite for Private Listings (Particulier) feature
Tests: Registration, Login, Create Listing, Checkout, My Listings, Active Listings
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_EMAIL = f"test-part-{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "test123"
TEST_NAME = "Test Particulier"


class TestPrivateListingsRegistration:
    """Test particulier registration endpoint"""
    
    def test_register_particulier_success(self):
        """POST /api/private-listings/register - should create account with role 'particulier'"""
        response = requests.post(f"{BASE_URL}/api/private-listings/register", json={
            "name": TEST_NAME,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "phone": "06-12345678",
            "city": "Amsterdam"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify token is returned
        assert "token" in data, "Response should contain token"
        assert len(data["token"]) > 0, "Token should not be empty"
        
        # Verify user data
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "particulier", f"Role should be 'particulier', got {data['user']['role']}"
        assert data["user"]["email"] == TEST_EMAIL, "Email should match"
        assert data["user"]["name"] == TEST_NAME, "Name should match"
        
        # Store token for other tests
        pytest.particulier_token = data["token"]
        pytest.particulier_user_id = data["user"]["id"]
        print(f"✓ Particulier registered successfully with role: {data['user']['role']}")
    
    def test_register_duplicate_email(self):
        """POST /api/private-listings/register - should reject duplicate email"""
        response = requests.post(f"{BASE_URL}/api/private-listings/register", json={
            "name": "Another User",
            "email": TEST_EMAIL,  # Same email as before
            "password": "password123"
        })
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        print("✓ Duplicate email correctly rejected")
    
    def test_register_missing_fields(self):
        """POST /api/private-listings/register - should require name, email, password"""
        response = requests.post(f"{BASE_URL}/api/private-listings/register", json={
            "email": "incomplete@example.com"
            # Missing name and password
        })
        
        assert response.status_code == 400, f"Expected 400 for missing fields, got {response.status_code}"
        print("✓ Missing fields correctly rejected")


class TestParticulierLogin:
    """Test login for particulier users"""
    
    def test_login_particulier_success(self):
        """POST /api/auth/login - should return role 'particulier'"""
        # First ensure we have a registered user
        if not hasattr(pytest, 'particulier_token'):
            # Register first
            reg_response = requests.post(f"{BASE_URL}/api/private-listings/register", json={
                "name": TEST_NAME,
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
            })
            if reg_response.status_code == 200:
                pytest.particulier_token = reg_response.json()["token"]
        
        # Now test login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "particulier", f"Role should be 'particulier', got {data['user']['role']}"
        
        # Update token
        pytest.particulier_token = data["token"]
        print(f"✓ Particulier login successful, role: {data['user']['role']}")
    
    def test_login_with_existing_test_account(self):
        """POST /api/auth/login - test with provided test account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test-part2@example.com",
            "password": "test123"
        })
        
        # This may fail if account doesn't exist yet
        if response.status_code == 200:
            data = response.json()
            assert data["user"]["role"] == "particulier", f"Expected role 'particulier', got {data['user']['role']}"
            print(f"✓ Test account login successful, role: {data['user']['role']}")
        else:
            print(f"⚠ Test account not found (status {response.status_code}), creating new one")
            # Create the test account
            reg_response = requests.post(f"{BASE_URL}/api/private-listings/register", json={
                "name": "Test Part 2",
                "email": "test-part2@example.com",
                "password": "test123",
            })
            if reg_response.status_code == 200:
                pytest.test_account_token = reg_response.json()["token"]
                print("✓ Test account created successfully")


class TestCreatePrivateListing:
    """Test creating private motorcycle listings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Ensure we have a valid token"""
        if not hasattr(pytest, 'particulier_token'):
            # Register a new user
            response = requests.post(f"{BASE_URL}/api/private-listings/register", json={
                "name": f"Test User {uuid.uuid4().hex[:6]}",
                "email": f"test-{uuid.uuid4().hex[:8]}@example.com",
                "password": "test123",
            })
            if response.status_code == 200:
                pytest.particulier_token = response.json()["token"]
    
    def test_create_listing_success(self):
        """POST /api/private-listings - should create listing with brand/model/year/mileage/price"""
        headers = {"Authorization": f"Bearer {pytest.particulier_token}"}
        
        response = requests.post(f"{BASE_URL}/api/private-listings", json={
            "brand": "BMW",
            "model": "R 1250 GS",
            "year": 2022,
            "mileage": 15000,
            "price": 18500,
            "description": "Zeer nette motor, eerste eigenaar",
            "color": "Zwart",
            "phone": "06-12345678",
            "email": "test@example.com",
            "city": "Amsterdam"
        }, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "listing_id" in data, "Response should contain listing_id"
        assert len(data["listing_id"]) > 0, "listing_id should not be empty"
        
        # Store for checkout test
        pytest.listing_id = data["listing_id"]
        print(f"✓ Listing created successfully with ID: {data['listing_id']}")
    
    def test_create_listing_unauthorized(self):
        """POST /api/private-listings - should require authentication"""
        response = requests.post(f"{BASE_URL}/api/private-listings", json={
            "brand": "Honda",
            "model": "CBR 600",
            "year": 2021,
            "mileage": 10000,
            "price": 8000
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthorized request correctly rejected")
    
    def test_create_listing_dealer_forbidden(self):
        """POST /api/private-listings - should reject dealer role"""
        # First login as a dealer (if exists)
        dealer_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Daniel2002jay@hotmail.com",  # Admin account
            "password": "AdminTest1234!"
        })
        
        if dealer_login.status_code == 200:
            dealer_token = dealer_login.json()["token"]
            headers = {"Authorization": f"Bearer {dealer_token}"}
            
            response = requests.post(f"{BASE_URL}/api/private-listings", json={
                "brand": "Yamaha",
                "model": "MT-07",
                "year": 2023,
                "mileage": 5000,
                "price": 7500
            }, headers=headers)
            
            assert response.status_code == 403, f"Expected 403 for non-particulier, got {response.status_code}"
            print("✓ Non-particulier correctly rejected from creating listing")


class TestStripeCheckout:
    """Test Stripe checkout for private listings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Ensure we have a listing to checkout"""
        if not hasattr(pytest, 'particulier_token') or not hasattr(pytest, 'listing_id'):
            # Create a new user and listing
            email = f"test-{uuid.uuid4().hex[:8]}@example.com"
            reg_response = requests.post(f"{BASE_URL}/api/private-listings/register", json={
                "name": "Checkout Test User",
                "email": email,
                "password": "test123",
            })
            if reg_response.status_code == 200:
                pytest.particulier_token = reg_response.json()["token"]
                
                # Create listing
                headers = {"Authorization": f"Bearer {pytest.particulier_token}"}
                listing_response = requests.post(f"{BASE_URL}/api/private-listings", json={
                    "brand": "Ducati",
                    "model": "Monster 821",
                    "year": 2020,
                    "mileage": 12000,
                    "price": 9500
                }, headers=headers)
                if listing_response.status_code == 200:
                    pytest.listing_id = listing_response.json()["listing_id"]
    
    def test_checkout_returns_url(self):
        """POST /api/private-listings/{listing_id}/checkout - should return checkout_url"""
        headers = {"Authorization": f"Bearer {pytest.particulier_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/private-listings/{pytest.listing_id}/checkout",
            json={"origin_url": "https://promo-asset-lab.preview.emergentagent.com"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "checkout_url" in data, "Response should contain checkout_url"
        assert data["checkout_url"].startswith("https://checkout.stripe.com"), \
            f"checkout_url should be Stripe URL, got: {data['checkout_url'][:50]}..."
        assert "session_id" in data, "Response should contain session_id"
        
        print(f"✓ Stripe checkout URL returned: {data['checkout_url'][:60]}...")
    
    def test_checkout_invalid_listing(self):
        """POST /api/private-listings/{listing_id}/checkout - should reject invalid listing"""
        headers = {"Authorization": f"Bearer {pytest.particulier_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/private-listings/invalid-listing-id/checkout",
            json={"origin_url": "https://example.com"},
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid listing correctly rejected")


class TestMyListings:
    """Test fetching user's own listings"""
    
    def test_get_my_listings(self):
        """GET /api/private-listings/my - should return user's own listings"""
        if not hasattr(pytest, 'particulier_token'):
            pytest.skip("No particulier token available")
        
        headers = {"Authorization": f"Bearer {pytest.particulier_token}"}
        
        response = requests.get(f"{BASE_URL}/api/private-listings/my", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            listing = data[0]
            assert "id" in listing, "Listing should have id"
            assert "brand" in listing, "Listing should have brand"
            assert "model" in listing, "Listing should have model"
            assert "price" in listing, "Listing should have price"
            print(f"✓ Found {len(data)} listing(s) for user")
        else:
            print("✓ My listings endpoint works (no listings yet)")
    
    def test_my_listings_unauthorized(self):
        """GET /api/private-listings/my - should require authentication"""
        response = requests.get(f"{BASE_URL}/api/private-listings/my")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthorized request correctly rejected")


class TestActiveListings:
    """Test fetching active listings for dealers"""
    
    def test_active_listings_for_dealer(self):
        """GET /api/private-listings/active - should return active listings for dealers"""
        # Login as admin (who can also access)
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "Daniel2002jay@hotmail.com",
            "password": "AdminTest1234!"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Could not login as admin/dealer")
        
        token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/private-listings/active", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Active listings endpoint works, found {len(data)} active listing(s)")
    
    def test_active_listings_forbidden_for_particulier(self):
        """GET /api/private-listings/active - should reject particulier role"""
        if not hasattr(pytest, 'particulier_token'):
            pytest.skip("No particulier token available")
        
        headers = {"Authorization": f"Bearer {pytest.particulier_token}"}
        
        response = requests.get(f"{BASE_URL}/api/private-listings/active", headers=headers)
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Particulier correctly rejected from active listings")


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """GET /api/health - API should be running"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ API health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
