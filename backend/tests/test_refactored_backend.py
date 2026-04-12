"""
Test suite for refactored backend - verifies all endpoints work after code split
Tests: Auth, Motorcycles, Orders, Dealers, Exchange Rate, Stats, Notifications,
       Taxatie, Parts, License Plates, Proposals, Wanted Requests, Reviews,
       Admin endpoints, Public endpoints, Health check
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Admin2024!"
DEALER_EMAIL = "zoektest@dealer.nl"
DEALER_PASSWORD = "Test2024!"


class TestHealthAndBasics:
    """Health check and basic endpoint tests"""
    
    def test_health_endpoint(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print("✓ Health endpoint working")
    
    def test_root_endpoint(self):
        """GET /api/ returns API running message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Root endpoint working")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """POST /api/auth/login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}")
    
    def test_dealer_login_success(self):
        """POST /api/auth/login with dealer credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "dealer"
        print(f"✓ Dealer login successful: {data['user']['email']}")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def dealer_token():
    """Get dealer authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": DEALER_EMAIL,
        "password": DEALER_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Dealer authentication failed")


class TestMotorcycles:
    """Motorcycle endpoint tests"""
    
    def test_get_motorcycles_admin(self, admin_token):
        """GET /api/motorcycles (admin auth) returns motorcycle list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/motorcycles", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Motorcycles endpoint working - {len(data)} motorcycles found")
    
    def test_get_motorcycles_requires_auth(self):
        """GET /api/motorcycles without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/motorcycles")
        assert response.status_code in [401, 403]
        print("✓ Motorcycles endpoint requires authentication")
    
    def test_customer_share_endpoint(self, admin_token):
        """GET /api/motorcycles/{id}/customer-share returns motorcycle without price fields"""
        # First get a motorcycle ID
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/motorcycles", headers=headers)
        if response.status_code == 200 and len(response.json()) > 0:
            motor_id = response.json()[0]["id"]
            # Test customer share endpoint (no auth required)
            share_response = requests.get(f"{BASE_URL}/api/motorcycles/{motor_id}/customer-share")
            assert share_response.status_code == 200
            data = share_response.json()
            # Should not contain price fields
            assert "purchase_price" not in data or data.get("purchase_price") is None
            print(f"✓ Customer share endpoint working for motor {motor_id}")
        else:
            pytest.skip("No motorcycles available for testing")


class TestOrders:
    """Order endpoint tests"""
    
    def test_get_orders_admin(self, admin_token):
        """GET /api/orders (admin auth) returns order list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Orders endpoint working - {len(data)} orders found")
    
    def test_get_orders_requires_auth(self):
        """GET /api/orders without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/orders")
        assert response.status_code in [401, 403]
        print("✓ Orders endpoint requires authentication")


class TestDealers:
    """Dealer endpoint tests"""
    
    def test_get_dealers_admin(self, admin_token):
        """GET /api/dealers (admin auth) returns dealer list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dealers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Dealers endpoint working - {len(data)} dealers found")
    
    def test_get_approved_dealers_admin(self, admin_token):
        """GET /api/admin/approved-dealers (admin auth) returns approved dealers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/approved-dealers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Approved dealers endpoint working - {len(data)} approved dealers")


class TestExchangeRate:
    """Exchange rate endpoint tests"""
    
    def test_get_exchange_rate(self):
        """GET /api/exchange-rate/chf-eur returns exchange rate"""
        response = requests.get(f"{BASE_URL}/api/exchange-rate/chf-eur")
        assert response.status_code == 200
        data = response.json()
        assert "rate" in data
        assert isinstance(data["rate"], (int, float))
        print(f"✓ Exchange rate endpoint working - CHF/EUR rate: {data['rate']}")


class TestStats:
    """Stats endpoint tests"""
    
    def test_get_stats_admin(self, admin_token):
        """GET /api/stats (admin auth) returns stats object"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Stats endpoint working")


class TestNotifications:
    """Notification endpoint tests"""
    
    def test_get_notifications_admin(self, admin_token):
        """GET /api/notifications (admin auth) returns notifications"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Notifications endpoint working - {len(data)} notifications")
    
    def test_get_unread_count(self, admin_token):
        """GET /api/notifications/unread-count returns count"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ Unread count endpoint working - {data['count']} unread")


class TestTaxatie:
    """Taxatie endpoint tests"""
    
    def test_get_taxatie_programma_admin(self, admin_token):
        """GET /api/taxatie-programma (admin auth) returns taxaties"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/taxatie-programma", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Taxatie programma endpoint working - {len(data)} taxaties")


class TestParts:
    """Parts shop endpoint tests"""
    
    def test_get_part_categories(self):
        """GET /api/parts/categories returns part categories"""
        response = requests.get(f"{BASE_URL}/api/parts/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Parts categories endpoint working - {len(data)} categories")


class TestLicensePlates:
    """License plates endpoint tests"""
    
    def test_get_license_plates_admin(self, admin_token):
        """GET /api/license-plates (admin auth) returns license plates"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/license-plates", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ License plates endpoint working - {len(data)} plates")


class TestProposals:
    """Price proposals endpoint tests"""
    
    def test_get_price_proposals_admin(self, admin_token):
        """GET /api/price-proposals (admin auth) returns proposals"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/price-proposals", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Price proposals endpoint working - {len(data)} proposals")
    
    def test_get_proposals_count(self, admin_token):
        """GET /api/price-proposals/count returns count"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/price-proposals/count", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ Proposals count endpoint working - {data['count']} proposals")


class TestWantedRequests:
    """Wanted requests endpoint tests"""
    
    def test_get_wanted_requests_admin(self, admin_token):
        """GET /api/wanted-requests (admin auth) returns wanted requests"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/wanted-requests", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Wanted requests endpoint working - {len(data)} requests")
    
    def test_get_pending_count(self, admin_token):
        """GET /api/wanted-requests/pending-count returns count"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/wanted-requests/pending-count", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ Pending wanted count endpoint working - {data['count']} pending")


class TestReviews:
    """Reviews endpoint tests"""
    
    def test_get_reviews(self):
        """GET /api/reviews returns reviews"""
        response = requests.get(f"{BASE_URL}/api/reviews")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Reviews endpoint working - {len(data)} reviews")


class TestPublicEndpoints:
    """Public endpoint tests"""
    
    def test_get_public_motors(self):
        """GET /api/public/motors returns public motors"""
        response = requests.get(f"{BASE_URL}/api/public/motors")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Public motors endpoint working - {len(data)} public motors")


class TestAdminEndpoints:
    """Admin-specific endpoint tests"""
    
    def test_get_marketing_files_admin(self, admin_token):
        """GET /api/admin/marketing-files (admin auth) returns marketing files"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/marketing-files", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Response is a dict with 'files' key
        assert isinstance(data, dict)
        assert "files" in data
        assert isinstance(data["files"], list)
        print(f"✓ Marketing files endpoint working - {len(data['files'])} files")
    
    def test_get_analytics_conversion(self, admin_token):
        """GET /api/admin/analytics/conversion returns conversion data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/analytics/conversion", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Analytics conversion endpoint working")
    
    def test_get_activity_notifications_count(self, admin_token):
        """GET /api/admin/activity-notifications/unread-count returns count"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/activity-notifications/unread-count", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ Activity notifications count endpoint working - {data['count']} unread")
    
    def test_get_top_dealers(self, admin_token):
        """GET /api/stats/top-dealers returns top dealers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/stats/top-dealers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Top dealers endpoint working - {len(data)} top dealers")


class TestDealerEndpoints:
    """Dealer-specific endpoint tests"""
    
    def test_get_dealer_welcome_message(self, dealer_token):
        """GET /api/dealer/welcome-message returns welcome message"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.get(f"{BASE_URL}/api/dealer/welcome-message", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Dealer welcome message endpoint working")
    
    def test_get_auth_me(self, dealer_token):
        """GET /api/auth/me returns current user"""
        headers = {"Authorization": f"Bearer {dealer_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        print(f"✓ Auth me endpoint working - user: {data['email']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
