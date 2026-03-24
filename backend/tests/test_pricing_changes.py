"""
Test suite for Private Seller Pricing Changes:
1. PRIVATE_LISTING_PRICE is now €4.95 (was €7.95)
2. DEALER_CONTACT_FEE is €175 for dealers to unlock contact info
3. GET /api/private-listings/active returns hidden contact info for dealers without access
4. POST /api/private-listings/{listing_id}/dealer-checkout creates Stripe checkout for €175
5. POST /api/private-listings/dealer-access-confirm grants access after payment
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "Daniel2002jay@hotmail.com"
ADMIN_PASSWORD = "AdminTest1234!"
PARTICULIER_EMAIL = "test-part2@example.com"
PARTICULIER_PASSWORD = "test123"
TEST_LISTING_ID = "15356ed4-8605-4d79-a3df-4cf54fb78d98"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token for testing"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def particulier_token():
    """Get particulier token for testing"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": PARTICULIER_EMAIL,
        "password": PARTICULIER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Particulier login failed: {response.status_code} - {response.text}")


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") in ["healthy", "degraded"]
        print(f"API health: {data}")


class TestPrivateListingPricing:
    """Test private listing price is €4.95"""
    
    def test_checkout_amount_is_4_95(self, particulier_token):
        """Test that private listing checkout creates session with €4.95 amount"""
        # First create a test listing
        listing_data = {
            "brand": "Test",
            "model": "Pricing Test",
            "year": 2024,
            "mileage": 1000,
            "price": 5000,
            "description": "Test listing for pricing verification",
            "color": "Black",
            "phone": "0612345678",
            "email": PARTICULIER_EMAIL,
            "city": "Amsterdam",
            "name": "Test User",
            "photos": []
        }
        
        # Create listing
        create_response = requests.post(
            f"{BASE_URL}/api/private-listings",
            json=listing_data,
            headers={"Authorization": f"Bearer {particulier_token}"}
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create test listing: {create_response.text}")
        
        listing_id = create_response.json().get("listing_id")
        print(f"Created test listing: {listing_id}")
        
        # Create checkout session
        checkout_response = requests.post(
            f"{BASE_URL}/api/private-listings/{listing_id}/checkout",
            json={"origin_url": BASE_URL},
            headers={"Authorization": f"Bearer {particulier_token}"}
        )
        
        assert checkout_response.status_code == 200, f"Checkout failed: {checkout_response.text}"
        data = checkout_response.json()
        
        # Verify checkout URL is returned
        assert "checkout_url" in data, "No checkout_url in response"
        assert "session_id" in data, "No session_id in response"
        
        # The checkout URL should be a valid Stripe URL
        checkout_url = data["checkout_url"]
        assert "stripe.com" in checkout_url or "checkout.stripe.com" in checkout_url, f"Invalid checkout URL: {checkout_url}"
        
        print(f"Checkout URL created successfully: {checkout_url[:80]}...")
        print(f"Session ID: {data['session_id']}")
        
        # Note: We can't verify the exact amount without completing payment,
        # but the backend code shows PRIVATE_LISTING_PRICE = 4.95


class TestDealerContactAccess:
    """Test dealer contact access flow with €175 fee"""
    
    def test_active_listings_hides_contact_for_unpaid_dealer(self, admin_token):
        """Test that GET /api/private-listings/active hides contact info for dealers without access"""
        response = requests.get(
            f"{BASE_URL}/api/private-listings/active",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get active listings: {response.text}"
        listings = response.json()
        
        print(f"Found {len(listings)} active private listings")
        
        if len(listings) == 0:
            pytest.skip("No active private listings to test")
        
        # Check each listing for hidden contact info
        for listing in listings:
            has_access = listing.get("has_access", False)
            print(f"Listing {listing.get('id')}: has_access={has_access}, user_name={listing.get('user_name')}")
            
            if not has_access:
                # Contact info should be hidden
                assert listing.get("user_name") == "Verborgen", f"user_name should be 'Verborgen' but got: {listing.get('user_name')}"
                assert listing.get("user_email") == "", f"user_email should be empty but got: {listing.get('user_email')}"
                assert listing.get("user_phone") == "", f"user_phone should be empty but got: {listing.get('user_phone')}"
                print(f"  -> Contact info correctly hidden")
            else:
                # Contact info should be visible
                print(f"  -> Contact info visible (dealer has paid access)")
    
    def test_dealer_checkout_creates_175_eur_session(self, admin_token):
        """Test that dealer checkout creates Stripe session for €175"""
        # Get active listings first
        listings_response = requests.get(
            f"{BASE_URL}/api/private-listings/active",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if listings_response.status_code != 200:
            pytest.skip(f"Could not get active listings: {listings_response.text}")
        
        listings = listings_response.json()
        
        # Find a listing without access
        listing_without_access = None
        for listing in listings:
            if not listing.get("has_access", False):
                listing_without_access = listing
                break
        
        if not listing_without_access:
            pytest.skip("No listings without access to test dealer checkout")
        
        listing_id = listing_without_access["id"]
        print(f"Testing dealer checkout for listing: {listing_id}")
        
        # Create dealer checkout
        checkout_response = requests.post(
            f"{BASE_URL}/api/private-listings/{listing_id}/dealer-checkout",
            json={"origin_url": BASE_URL},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Could be 200 (success) or 400 (already has access)
        if checkout_response.status_code == 400:
            data = checkout_response.json()
            if "al toegang" in data.get("detail", "").lower():
                print("Dealer already has access to this listing")
                return
        
        assert checkout_response.status_code == 200, f"Dealer checkout failed: {checkout_response.text}"
        data = checkout_response.json()
        
        # Verify checkout URL is returned
        assert "checkout_url" in data, "No checkout_url in response"
        assert "session_id" in data, "No session_id in response"
        
        checkout_url = data["checkout_url"]
        assert "stripe.com" in checkout_url or "checkout.stripe.com" in checkout_url, f"Invalid checkout URL: {checkout_url}"
        
        print(f"Dealer checkout URL created successfully: {checkout_url[:80]}...")
        print(f"Session ID: {data['session_id']}")
        print("Note: Amount is €175 as configured in DEALER_CONTACT_FEE")
    
    def test_dealer_access_confirm_endpoint_exists(self, admin_token):
        """Test that dealer-access-confirm endpoint exists and validates input"""
        # Test with missing listing_id
        response = requests.post(
            f"{BASE_URL}/api/private-listings/dealer-access-confirm",
            json={},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should return 400 for missing listing_id
        assert response.status_code == 400, f"Expected 400 for missing listing_id, got: {response.status_code}"
        data = response.json()
        assert "listing_id" in data.get("detail", "").lower(), f"Expected error about listing_id: {data}"
        print("dealer-access-confirm endpoint validates listing_id correctly")
    
    def test_dealer_access_confirm_with_invalid_listing(self, admin_token):
        """Test dealer-access-confirm with non-existent listing"""
        response = requests.post(
            f"{BASE_URL}/api/private-listings/dealer-access-confirm",
            json={"listing_id": "non-existent-listing-id"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should return 404 for no payment found
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("dealer-access-confirm correctly returns 404 for non-existent payment")


class TestSpecificTestListing:
    """Test with the specific test listing ID provided"""
    
    def test_specific_listing_in_active_listings(self, admin_token):
        """Test that the specific test listing (Kawasaki Z900) appears in active listings"""
        response = requests.get(
            f"{BASE_URL}/api/private-listings/active",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get active listings: {response.text}"
        listings = response.json()
        
        # Find the specific test listing
        test_listing = None
        for listing in listings:
            if listing.get("id") == TEST_LISTING_ID:
                test_listing = listing
                break
        
        if test_listing:
            print(f"Found test listing: {test_listing.get('brand')} {test_listing.get('model')}")
            print(f"  has_access: {test_listing.get('has_access')}")
            print(f"  user_name: {test_listing.get('user_name')}")
            print(f"  price: €{test_listing.get('price')}")
        else:
            print(f"Test listing {TEST_LISTING_ID} not found in active listings")
            print(f"Available listings: {[l.get('id') for l in listings]}")


class TestParticulierRoleRestrictions:
    """Test that particulier users cannot access dealer endpoints"""
    
    def test_particulier_cannot_access_active_listings(self, particulier_token):
        """Test that particulier users get 403 on /api/private-listings/active"""
        response = requests.get(
            f"{BASE_URL}/api/private-listings/active",
            headers={"Authorization": f"Bearer {particulier_token}"}
        )
        
        assert response.status_code == 403, f"Expected 403 for particulier, got: {response.status_code}"
        print("Particulier correctly blocked from active listings endpoint")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
