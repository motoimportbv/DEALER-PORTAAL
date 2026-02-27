"""
Test Admin Analytics and Marketing Files Endpoints
Tests for:
- Conversion analytics endpoint
- Marketing files endpoint
- Mark sold elsewhere endpoint (for foreign dealers)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Enolim12"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


class TestConversionAnalytics:
    """Tests for /api/admin/analytics/conversion endpoint"""
    
    def test_conversion_analytics_returns_200(self, admin_client):
        """Test that conversion analytics endpoint returns 200"""
        response = admin_client.get(f"{BASE_URL}/api/admin/analytics/conversion")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_conversion_analytics_has_summary(self, admin_client):
        """Test that response contains summary with required fields"""
        response = admin_client.get(f"{BASE_URL}/api/admin/analytics/conversion")
        data = response.json()
        
        assert "summary" in data, "Response should contain 'summary'"
        summary = data["summary"]
        
        # Check required summary fields
        required_fields = [
            "total_views_30d",
            "total_orders_30d",
            "unique_motorcycles_viewed",
            "motorcycles_sold",
            "conversion_rate",
            "avg_views_before_sale",
            "total_revenue_30d"
        ]
        for field in required_fields:
            assert field in summary, f"Summary should contain '{field}'"
    
    def test_conversion_analytics_has_brand_performance(self, admin_client):
        """Test that response contains brand_performance array"""
        response = admin_client.get(f"{BASE_URL}/api/admin/analytics/conversion")
        data = response.json()
        
        assert "brand_performance" in data, "Response should contain 'brand_performance'"
        assert isinstance(data["brand_performance"], list), "brand_performance should be a list"
        
        # If there are brands, check structure
        if len(data["brand_performance"]) > 0:
            brand = data["brand_performance"][0]
            assert "brand" in brand, "Brand item should have 'brand' field"
            assert "views" in brand, "Brand item should have 'views' field"
            assert "purchases" in brand, "Brand item should have 'purchases' field"
            assert "conversion_rate" in brand, "Brand item should have 'conversion_rate' field"
    
    def test_conversion_analytics_has_top_dealers(self, admin_client):
        """Test that response contains top_converting_dealers array"""
        response = admin_client.get(f"{BASE_URL}/api/admin/analytics/conversion")
        data = response.json()
        
        assert "top_converting_dealers" in data, "Response should contain 'top_converting_dealers'"
        assert isinstance(data["top_converting_dealers"], list), "top_converting_dealers should be a list"
    
    def test_conversion_analytics_has_price_range_performance(self, admin_client):
        """Test that response contains price_range_performance array"""
        response = admin_client.get(f"{BASE_URL}/api/admin/analytics/conversion")
        data = response.json()
        
        assert "price_range_performance" in data, "Response should contain 'price_range_performance'"
        assert isinstance(data["price_range_performance"], list), "price_range_performance should be a list"
        
        # Check price ranges exist
        if len(data["price_range_performance"]) > 0:
            price_range = data["price_range_performance"][0]
            assert "range" in price_range, "Price range item should have 'range' field"
            assert "views" in price_range, "Price range item should have 'views' field"
            assert "purchases" in price_range, "Price range item should have 'purchases' field"
            assert "revenue" in price_range, "Price range item should have 'revenue' field"
    
    def test_conversion_analytics_requires_admin(self):
        """Test that endpoint requires admin authentication"""
        # Test without auth
        response = requests.get(f"{BASE_URL}/api/admin/analytics/conversion")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestMarketingFiles:
    """Tests for /api/admin/marketing-files endpoint"""
    
    def test_marketing_files_returns_200(self, admin_client):
        """Test that marketing files endpoint returns 200"""
        response = admin_client.get(f"{BASE_URL}/api/admin/marketing-files")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_marketing_files_has_required_fields(self, admin_client):
        """Test that response contains required fields"""
        response = admin_client.get(f"{BASE_URL}/api/admin/marketing-files")
        data = response.json()
        
        assert "files" in data, "Response should contain 'files'"
        assert "total_files" in data, "Response should contain 'total_files'"
        assert "migrated_count" in data, "Response should contain 'migrated_count'"
        assert "total_size_mb" in data, "Response should contain 'total_size_mb'"
    
    def test_marketing_files_count_is_39(self, admin_client):
        """Test that total files count is 39 as expected"""
        response = admin_client.get(f"{BASE_URL}/api/admin/marketing-files")
        data = response.json()
        
        assert data["total_files"] == 39, f"Expected 39 total files, got {data['total_files']}"
    
    def test_marketing_files_all_migrated(self, admin_client):
        """Test that all 39 files are migrated to cloud"""
        response = admin_client.get(f"{BASE_URL}/api/admin/marketing-files")
        data = response.json()
        
        assert data["migrated_count"] == 39, f"Expected 39 migrated files, got {data['migrated_count']}"
        assert data["migrated_count"] == data["total_files"], "All files should be migrated"
    
    def test_marketing_files_structure(self, admin_client):
        """Test that each file has correct structure"""
        response = admin_client.get(f"{BASE_URL}/api/admin/marketing-files")
        data = response.json()
        
        assert len(data["files"]) > 0, "Should have at least one file"
        
        file = data["files"][0]
        required_fields = ["filename", "size_kb", "local_path", "cloud_url", "migrated", "migrated_at"]
        for field in required_fields:
            assert field in file, f"File should have '{field}' field"
        
        # Check migrated file has cloud_url
        assert file["migrated"] == True, "File should be migrated"
        assert file["cloud_url"] is not None, "Migrated file should have cloud_url"
        assert file["migrated_at"] is not None, "Migrated file should have migrated_at timestamp"
    
    def test_marketing_files_requires_admin(self):
        """Test that endpoint requires admin authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/marketing-files")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestMarkSoldElsewhere:
    """Tests for /api/motorcycles/foreign-listings/{id}/mark-sold-elsewhere endpoint"""
    
    def test_mark_sold_elsewhere_requires_foreign_dealer(self, admin_client):
        """Test that endpoint requires foreign dealer role"""
        # Admin should not be able to use this endpoint
        response = admin_client.post(f"{BASE_URL}/api/motorcycles/foreign-listings/test-id/mark-sold-elsewhere")
        # Should get 403 because admin is not a foreign dealer
        assert response.status_code == 403, f"Expected 403 for non-foreign dealer, got {response.status_code}"
    
    def test_mark_sold_elsewhere_requires_auth(self):
        """Test that endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/motorcycles/foreign-listings/test-id/mark-sold-elsewhere")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestDealerAnalytics:
    """Tests for /api/admin/analytics/dealer/{dealer_id} endpoint"""
    
    def test_dealer_analytics_returns_404_for_invalid_dealer(self, admin_client):
        """Test that endpoint returns 404 for non-existent dealer"""
        response = admin_client.get(f"{BASE_URL}/api/admin/analytics/dealer/invalid-dealer-id")
        assert response.status_code == 404, f"Expected 404 for invalid dealer, got {response.status_code}"
    
    def test_dealer_analytics_requires_admin(self):
        """Test that endpoint requires admin authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics/dealer/some-id")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
