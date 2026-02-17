"""
Test Short Code Login Feature
Tests the permanent login link functionality for iOS bookmarks
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DEALER_EMAIL = "zoektest@dealer.nl"
DEALER_PASSWORD = "ZoekTest123!"
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Enolim12"


class TestShortCodeVerification:
    """Test /api/auth/shortcode/{code} endpoint"""
    
    def test_valid_shortcode_returns_company_info(self):
        """Test that a valid short code returns company name and valid=true"""
        # First login to get a short code
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        # Get the user's permanent link info
        link_resp = requests.get(
            f"{BASE_URL}/api/auth/my-permanent-link",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert link_resp.status_code == 200
        
        if link_resp.json().get("has_permanent_link"):
            short_code = link_resp.json()["short_code"]
            
            # Verify the short code
            verify_resp = requests.get(f"{BASE_URL}/api/auth/shortcode/{short_code}")
            assert verify_resp.status_code == 200
            
            data = verify_resp.json()
            assert data["valid"] == True
            assert "company_name" in data
            assert "user_id" in data
            assert len(data["company_name"]) > 0
    
    def test_invalid_shortcode_returns_404(self):
        """Test that an invalid short code returns 404"""
        response = requests.get(f"{BASE_URL}/api/auth/shortcode/INVALID123")
        assert response.status_code == 404
        assert "Ongeldige code" in response.json().get("detail", "")
    
    def test_shortcode_case_insensitive(self):
        """Test that short codes work regardless of case"""
        # First login to get a short code
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Get the user's permanent link info
        link_resp = requests.get(
            f"{BASE_URL}/api/auth/my-permanent-link",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if link_resp.json().get("has_permanent_link"):
            short_code = link_resp.json()["short_code"]
            
            # Test lowercase
            verify_lower = requests.get(f"{BASE_URL}/api/auth/shortcode/{short_code.lower()}")
            assert verify_lower.status_code == 200
            
            # Test uppercase
            verify_upper = requests.get(f"{BASE_URL}/api/auth/shortcode/{short_code.upper()}")
            assert verify_upper.status_code == 200


class TestShortCodeLogin:
    """Test /api/auth/shortcode-login endpoint"""
    
    def test_shortcode_login_returns_token_and_user(self):
        """Test that shortcode login returns a valid token and user object"""
        # First login to get a short code
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Get the user's permanent link info
        link_resp = requests.get(
            f"{BASE_URL}/api/auth/my-permanent-link",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if link_resp.json().get("has_permanent_link"):
            short_code = link_resp.json()["short_code"]
            
            # Login with short code
            shortcode_login_resp = requests.post(
                f"{BASE_URL}/api/auth/shortcode-login",
                json={"code": short_code}
            )
            assert shortcode_login_resp.status_code == 200
            
            data = shortcode_login_resp.json()
            assert "token" in data
            assert "user" in data
            assert len(data["token"]) > 0
            assert data["user"]["email"] == DEALER_EMAIL
            assert data["user"]["role"] == "dealer"
    
    def test_shortcode_login_invalid_code_returns_401(self):
        """Test that invalid short code returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/shortcode-login",
            json={"code": "INVALID123"}
        )
        assert response.status_code == 401
        assert "Ongeldige code" in response.json().get("detail", "")
    
    def test_shortcode_login_token_is_valid(self):
        """Test that the token from shortcode login can be used for authenticated requests"""
        # First login to get a short code
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Get the user's permanent link info
        link_resp = requests.get(
            f"{BASE_URL}/api/auth/my-permanent-link",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if link_resp.json().get("has_permanent_link"):
            short_code = link_resp.json()["short_code"]
            
            # Login with short code
            shortcode_login_resp = requests.post(
                f"{BASE_URL}/api/auth/shortcode-login",
                json={"code": short_code}
            )
            new_token = shortcode_login_resp.json()["token"]
            
            # Use the new token to access protected endpoint
            me_resp = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {new_token}"}
            )
            assert me_resp.status_code == 200
            assert me_resp.json()["email"] == DEALER_EMAIL


class TestGeneratePermanentLink:
    """Test /api/auth/generate-permanent-link endpoint"""
    
    def test_generate_permanent_link_returns_url_and_code(self):
        """Test that generating a permanent link returns URL and short code"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Generate permanent link
        gen_resp = requests.post(
            f"{BASE_URL}/api/auth/generate-permanent-link",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert gen_resp.status_code == 200
        
        data = gen_resp.json()
        assert "permanent_url" in data
        assert "short_code" in data
        assert "token" in data
        assert "message" in data
        
        # Verify URL format contains /go/{code}
        assert f"/go/{data['short_code']}" in data["permanent_url"]
        
        # Verify short code is 8 characters
        assert len(data["short_code"]) == 8
    
    def test_generate_permanent_link_requires_auth(self):
        """Test that generating a permanent link requires authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/generate-permanent-link")
        assert response.status_code in [401, 403]
    
    def test_regenerate_link_creates_new_code(self):
        """Test that regenerating creates a new short code"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Generate first link
        gen_resp1 = requests.post(
            f"{BASE_URL}/api/auth/generate-permanent-link",
            headers={"Authorization": f"Bearer {token}"}
        )
        code1 = gen_resp1.json()["short_code"]
        
        # Generate second link
        gen_resp2 = requests.post(
            f"{BASE_URL}/api/auth/generate-permanent-link",
            headers={"Authorization": f"Bearer {token}"}
        )
        code2 = gen_resp2.json()["short_code"]
        
        # Codes should be different
        assert code1 != code2


class TestMyPermanentLink:
    """Test /api/auth/my-permanent-link endpoint"""
    
    def test_get_my_permanent_link_returns_link_info(self):
        """Test that getting permanent link returns correct info"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Get permanent link
        link_resp = requests.get(
            f"{BASE_URL}/api/auth/my-permanent-link",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert link_resp.status_code == 200
        
        data = link_resp.json()
        assert "has_permanent_link" in data
        
        if data["has_permanent_link"]:
            assert "permanent_url" in data
            assert "short_code" in data
            assert "created_at" in data
    
    def test_get_my_permanent_link_requires_auth(self):
        """Test that getting permanent link requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/my-permanent-link")
        assert response.status_code in [401, 403]


class TestEndToEndShortCodeFlow:
    """End-to-end test of the complete short code login flow"""
    
    def test_complete_flow_generate_verify_login(self):
        """Test the complete flow: generate -> verify -> login"""
        # Step 1: Login with password
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        # Step 2: Generate permanent link
        gen_resp = requests.post(
            f"{BASE_URL}/api/auth/generate-permanent-link",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert gen_resp.status_code == 200
        short_code = gen_resp.json()["short_code"]
        permanent_url = gen_resp.json()["permanent_url"]
        
        # Step 3: Verify the short code (simulating frontend check)
        verify_resp = requests.get(f"{BASE_URL}/api/auth/shortcode/{short_code}")
        assert verify_resp.status_code == 200
        assert verify_resp.json()["valid"] == True
        
        # Step 4: Login with short code (simulating bookmark click)
        shortcode_login_resp = requests.post(
            f"{BASE_URL}/api/auth/shortcode-login",
            json={"code": short_code}
        )
        assert shortcode_login_resp.status_code == 200
        
        new_token = shortcode_login_resp.json()["token"]
        user = shortcode_login_resp.json()["user"]
        
        # Step 5: Verify the new token works
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {new_token}"}
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == DEALER_EMAIL
        
        print(f"✅ Complete flow successful!")
        print(f"   Short code: {short_code}")
        print(f"   Permanent URL: {permanent_url}")
        print(f"   User: {user['company_name']} ({user['email']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
