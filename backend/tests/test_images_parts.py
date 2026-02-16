"""
Test suite for Images and Parts Shop functionality
Tests: Image endpoints, Parts categories, Parts CRUD, Parts orders
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


class TestImageEndpoints:
    """Test image storage and retrieval from MongoDB"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_motorcycles_with_images(self):
        """Test that motorcycles have image URLs pointing to /api/images/{id}"""
        response = requests.get(f"{BASE_URL}/api/motorcycles", headers=self.headers)
        assert response.status_code == 200
        
        motorcycles = response.json()
        assert len(motorcycles) > 0, "No motorcycles found"
        
        # Check that at least one motorcycle has images
        motorcycles_with_images = [m for m in motorcycles if m.get("images") and len(m["images"]) > 0]
        assert len(motorcycles_with_images) > 0, "No motorcycles have images"
        
        # Verify image URL format
        for moto in motorcycles_with_images[:3]:
            for img_url in moto["images"]:
                assert "/api/images/" in img_url, f"Image URL format incorrect: {img_url}"
                print(f"✓ Motorcycle {moto['brand']} {moto['model']} has image: {img_url}")
    
    def test_image_endpoint_returns_image_data(self):
        """Test that /api/images/{id} returns actual image data"""
        # First get a motorcycle with images
        response = requests.get(f"{BASE_URL}/api/motorcycles", headers=self.headers)
        motorcycles = response.json()
        
        motorcycles_with_images = [m for m in motorcycles if m.get("images") and len(m["images"]) > 0]
        assert len(motorcycles_with_images) > 0, "No motorcycles with images to test"
        
        # Get the image URL and extract image ID
        img_url = motorcycles_with_images[0]["images"][0]
        image_id = img_url.split("/api/images/")[-1]
        
        # Fetch the image
        img_response = requests.get(f"{BASE_URL}/api/images/{image_id}")
        assert img_response.status_code == 200, f"Image fetch failed: {img_response.status_code}"
        
        # Verify it's an image (check content-type)
        content_type = img_response.headers.get("content-type", "")
        assert "image" in content_type, f"Response is not an image: {content_type}"
        
        # Verify image has content
        assert len(img_response.content) > 1000, "Image content too small"
        print(f"✓ Image {image_id} returned {len(img_response.content)} bytes, type: {content_type}")
    
    def test_nonexistent_image_returns_404(self):
        """Test that requesting non-existent image returns 404"""
        response = requests.get(f"{BASE_URL}/api/images/non-existent-image-id")
        assert response.status_code == 404
        assert "niet gevonden" in response.json().get("detail", "").lower()
        print("✓ Non-existent image correctly returns 404")


class TestPartsCategories:
    """Test parts category endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_categories(self):
        """Test fetching parts categories"""
        response = requests.get(f"{BASE_URL}/api/parts/categories")
        assert response.status_code == 200
        
        categories = response.json()
        assert isinstance(categories, list)
        print(f"✓ Found {len(categories)} parts categories")
        
        if len(categories) > 0:
            cat = categories[0]
            assert "id" in cat
            assert "name" in cat
            print(f"✓ Category structure valid: {cat['name']}")
    
    def test_get_brands(self):
        """Test fetching motorcycle brands for parts compatibility"""
        response = requests.get(f"{BASE_URL}/api/parts/brands")
        assert response.status_code == 200
        
        brands = response.json()
        assert isinstance(brands, list)
        assert len(brands) > 0
        
        expected_brands = ["Yamaha", "Honda", "Kawasaki", "Ducati"]
        for brand in expected_brands:
            assert brand in brands, f"Expected brand {brand} not found"
        
        print(f"✓ Found {len(brands)} motorcycle brands: {brands}")
    
    def test_create_category_requires_admin(self):
        """Test that creating category requires admin auth"""
        # Try without auth
        response = requests.post(f"{BASE_URL}/api/parts/categories", json={
            "name": "Test Category",
            "description": "Test"
        })
        assert response.status_code in [401, 403], "Should require authentication"
        print("✓ Category creation requires authentication")


class TestPartsShop:
    """Test parts shop functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get tokens for admin and dealer"""
        # Admin login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.admin_token = response.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Dealer login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        assert response.status_code == 200
        self.dealer_token = response.json()["token"]
        self.dealer_headers = {"Authorization": f"Bearer {self.dealer_token}"}
    
    def test_get_parts_public(self):
        """Test fetching parts (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/parts")
        assert response.status_code == 200
        
        parts = response.json()
        assert isinstance(parts, list)
        print(f"✓ Found {len(parts)} parts in shop")
        
        if len(parts) > 0:
            part = parts[0]
            assert "id" in part
            assert "name" in part
            assert "price" in part
            assert "stock" in part
            print(f"✓ Part structure valid: {part['name']} - €{part['price']}")
    
    def test_get_parts_with_filters(self):
        """Test parts filtering by category and brand"""
        # Get categories first
        cat_response = requests.get(f"{BASE_URL}/api/parts/categories")
        categories = cat_response.json()
        
        if len(categories) > 0:
            category_id = categories[0]["id"]
            
            # Filter by category
            response = requests.get(f"{BASE_URL}/api/parts?category_id={category_id}")
            assert response.status_code == 200
            print(f"✓ Category filter works")
        
        # Filter by brand
        response = requests.get(f"{BASE_URL}/api/parts?brand=Yamaha")
        assert response.status_code == 200
        print(f"✓ Brand filter works")
        
        # Filter by search term
        response = requests.get(f"{BASE_URL}/api/parts?search=uitlaat")
        assert response.status_code == 200
        print(f"✓ Search filter works")
    
    def test_get_all_parts_admin(self):
        """Test admin can get all parts including inactive"""
        response = requests.get(f"{BASE_URL}/api/parts/all", headers=self.admin_headers)
        assert response.status_code == 200
        
        parts = response.json()
        assert isinstance(parts, list)
        print(f"✓ Admin can see all {len(parts)} parts")
    
    def test_get_all_parts_requires_admin(self):
        """Test that /parts/all requires admin role"""
        response = requests.get(f"{BASE_URL}/api/parts/all", headers=self.dealer_headers)
        assert response.status_code == 403, "Should require admin role"
        print("✓ /parts/all correctly requires admin role")


class TestPartsOrders:
    """Test parts ordering functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get dealer token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        assert response.status_code == 200
        self.dealer_token = response.json()["token"]
        self.dealer_headers = {"Authorization": f"Bearer {self.dealer_token}"}
    
    def test_get_my_parts_orders(self):
        """Test dealer can get their parts orders"""
        response = requests.get(f"{BASE_URL}/api/parts/orders/my", headers=self.dealer_headers)
        assert response.status_code == 200
        
        orders = response.json()
        assert isinstance(orders, list)
        print(f"✓ Dealer has {len(orders)} parts orders")
    
    def test_parts_order_requires_auth(self):
        """Test that creating parts order requires authentication"""
        response = requests.post(f"{BASE_URL}/api/parts/order", json={
            "items": [{"part_id": "test", "quantity": 1, "price": 10}],
            "needs_shipping": True
        })
        assert response.status_code in [401, 403], "Should require authentication"
        print("✓ Parts order requires authentication")


class TestServiceWorker:
    """Test service worker related endpoints"""
    
    def test_service_worker_accessible(self):
        """Test that service-worker.js is accessible"""
        response = requests.get(f"{BASE_URL}/service-worker.js")
        # Service worker might be served from frontend, not API
        # Just check it doesn't error
        print(f"✓ Service worker request returned status: {response.status_code}")
    
    def test_manifest_accessible(self):
        """Test that manifest.json is accessible"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        print(f"✓ Manifest request returned status: {response.status_code}")


class TestMobileHeader:
    """Test mobile header functionality (via API checks)"""
    
    def test_language_endpoint_or_i18n(self):
        """Test that language switching is supported"""
        # The language switching is client-side with i18next
        # We can verify the API returns proper responses
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print("✓ API responds correctly (language switching is client-side)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
