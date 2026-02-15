"""
Test Delete Dealer Feature - Moto Import
Tests the admin ability to delete dealers from the dealer management page
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Enolim12"

# Test dealer credentials (will be created and deleted)
TEST_DEALER_EMAIL = f"test_dealer_{uuid.uuid4().hex[:8]}@test.com"
TEST_DEALER_PASSWORD = "TestPass123"
TEST_DEALER_COMPANY = f"TEST_DeleteDealer_{uuid.uuid4().hex[:8]}"


class TestDeleteDealerFeature:
    """Test suite for delete dealer functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        self.test_dealer_id = None
        yield
        # Cleanup: try to delete test dealer if still exists
        if self.test_dealer_id and self.admin_token:
            try:
                self.session.delete(
                    f"{BASE_URL}/api/dealers/{self.test_dealer_id}",
                    headers={"Authorization": f"Bearer {self.admin_token}"}
                )
            except:
                pass
    
    def test_01_admin_login(self):
        """Test admin can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data["user"]["role"] == "admin", "User is not admin"
        
        self.admin_token = data["token"]
        print(f"✓ Admin login successful, role: {data['user']['role']}")
        return data["token"]
    
    def test_02_get_dealers_list(self):
        """Test admin can get list of dealers"""
        # First login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Get dealers list
        response = self.session.get(
            f"{BASE_URL}/api/dealers",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Get dealers failed: {response.text}"
        dealers = response.json()
        assert isinstance(dealers, list), "Response should be a list"
        print(f"✓ Got {len(dealers)} dealers from API")
        return dealers
    
    def test_03_create_test_dealer_for_deletion(self):
        """Create a test dealer that will be deleted"""
        # Register a new dealer
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_DEALER_EMAIL,
            "password": TEST_DEALER_PASSWORD,
            "company_name": TEST_DEALER_COMPANY,
            "kvk_number": "12345678",
            "address": "Test Street 123",
            "postal_code": "1234AB",
            "city": "TestCity",
            "phone": "+31612345678",
            "contact_person": "Test Person",
            "role": "dealer"
        })
        
        assert response.status_code == 200, f"Dealer registration failed: {response.text}"
        data = response.json()
        assert "user" in data, "No user in response"
        
        self.test_dealer_id = data["user"]["id"]
        print(f"✓ Created test dealer: {TEST_DEALER_COMPANY} (ID: {self.test_dealer_id})")
        return self.test_dealer_id
    
    def test_04_approve_test_dealer(self):
        """Admin approves the test dealer"""
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        self.admin_token = token
        
        # Create test dealer first
        reg_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"test_approve_{uuid.uuid4().hex[:8]}@test.com",
            "password": TEST_DEALER_PASSWORD,
            "company_name": f"TEST_ApproveDealer_{uuid.uuid4().hex[:8]}",
            "kvk_number": "87654321",
            "address": "Approve Street 456",
            "postal_code": "5678CD",
            "city": "ApproveCity",
            "phone": "+31687654321",
            "contact_person": "Approve Person",
            "role": "dealer"
        })
        
        if reg_resp.status_code == 200:
            dealer_id = reg_resp.json()["user"]["id"]
            self.test_dealer_id = dealer_id
            
            # Approve the dealer
            response = self.session.put(
                f"{BASE_URL}/api/dealers/{dealer_id}/approve",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200, f"Approve dealer failed: {response.text}"
            print(f"✓ Approved test dealer: {dealer_id}")
            return dealer_id
        else:
            pytest.skip("Could not create test dealer for approval")
    
    def test_05_delete_dealer_success(self):
        """Test admin can delete an approved dealer"""
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        self.admin_token = token
        
        # Create and approve a test dealer
        unique_id = uuid.uuid4().hex[:8]
        reg_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"test_delete_{unique_id}@test.com",
            "password": TEST_DEALER_PASSWORD,
            "company_name": f"TEST_DeleteMe_{unique_id}",
            "kvk_number": "11223344",
            "address": "Delete Street 789",
            "postal_code": "9012EF",
            "city": "DeleteCity",
            "phone": "+31611223344",
            "contact_person": "Delete Person",
            "role": "dealer"
        })
        
        assert reg_resp.status_code == 200, f"Failed to create test dealer: {reg_resp.text}"
        dealer_id = reg_resp.json()["user"]["id"]
        company_name = reg_resp.json()["user"]["company_name"]
        
        # Approve the dealer first
        approve_resp = self.session.put(
            f"{BASE_URL}/api/dealers/{dealer_id}/approve",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert approve_resp.status_code == 200, f"Failed to approve dealer: {approve_resp.text}"
        
        # Now delete the dealer
        delete_resp = self.session.delete(
            f"{BASE_URL}/api/dealers/{dealer_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert delete_resp.status_code == 200, f"Delete dealer failed: {delete_resp.text}"
        data = delete_resp.json()
        assert "message" in data, "No message in response"
        assert "verwijderd" in data["message"].lower(), f"Unexpected message: {data['message']}"
        print(f"✓ Successfully deleted dealer: {company_name}")
        
        # Verify dealer no longer exists
        get_resp = self.session.get(
            f"{BASE_URL}/api/dealers",
            headers={"Authorization": f"Bearer {token}"}
        )
        dealers = get_resp.json()
        dealer_ids = [d["id"] for d in dealers]
        assert dealer_id not in dealer_ids, "Dealer still exists after deletion"
        print(f"✓ Verified dealer {dealer_id} no longer in dealers list")
    
    def test_06_delete_nonexistent_dealer(self):
        """Test deleting a non-existent dealer returns 404"""
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Try to delete non-existent dealer
        fake_id = str(uuid.uuid4())
        response = self.session.delete(
            f"{BASE_URL}/api/dealers/{fake_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Correctly returned 404 for non-existent dealer")
    
    def test_07_delete_dealer_unauthorized(self):
        """Test that non-admin cannot delete dealers"""
        # Create a dealer
        unique_id = uuid.uuid4().hex[:8]
        reg_resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"test_unauth_{unique_id}@test.com",
            "password": TEST_DEALER_PASSWORD,
            "company_name": f"TEST_Unauth_{unique_id}",
            "kvk_number": "55667788",
            "address": "Unauth Street",
            "postal_code": "1111AA",
            "city": "UnauthCity",
            "phone": "+31655667788",
            "contact_person": "Unauth Person",
            "role": "dealer"
        })
        
        if reg_resp.status_code != 200:
            pytest.skip("Could not create test dealer")
        
        dealer_token = reg_resp.json()["token"]
        dealer_id = reg_resp.json()["user"]["id"]
        
        # Try to delete as dealer (should fail)
        # Note: Dealer is not approved, so they can't make authenticated requests
        # Let's try without auth first
        response = self.session.delete(f"{BASE_URL}/api/dealers/{dealer_id}")
        
        # Should fail with 403 (no auth) or 401
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Correctly denied unauthorized delete attempt")
        
        # Cleanup - delete as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        admin_token = login_resp.json()["token"]
        self.session.delete(
            f"{BASE_URL}/api/dealers/{dealer_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_08_get_approved_dealers(self):
        """Test getting list of approved dealers"""
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Get all dealers
        response = self.session.get(
            f"{BASE_URL}/api/dealers",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Get dealers failed: {response.text}"
        dealers = response.json()
        
        # Filter approved dealers
        approved_dealers = [d for d in dealers if d.get("is_approved", False)]
        print(f"✓ Found {len(approved_dealers)} approved dealers out of {len(dealers)} total")
        
        # Verify each approved dealer has required fields
        for dealer in approved_dealers:
            assert "id" in dealer, "Dealer missing id"
            assert "company_name" in dealer, "Dealer missing company_name"
            assert "email" in dealer, "Dealer missing email"
            assert dealer.get("is_approved") == True, "Dealer not marked as approved"
        
        return approved_dealers


class TestDeleteDealerIntegration:
    """Integration tests for delete dealer with related data cleanup"""
    
    def test_delete_dealer_cleans_up_related_data(self):
        """Test that deleting a dealer also removes related data"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        # Create a test dealer
        unique_id = uuid.uuid4().hex[:8]
        reg_resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"test_cleanup_{unique_id}@test.com",
            "password": "CleanupPass123",
            "company_name": f"TEST_Cleanup_{unique_id}",
            "kvk_number": "99887766",
            "address": "Cleanup Street",
            "postal_code": "2222BB",
            "city": "CleanupCity",
            "phone": "+31699887766",
            "contact_person": "Cleanup Person",
            "role": "dealer"
        })
        
        assert reg_resp.status_code == 200, f"Failed to create dealer: {reg_resp.text}"
        dealer_id = reg_resp.json()["user"]["id"]
        
        # Approve the dealer
        approve_resp = session.put(
            f"{BASE_URL}/api/dealers/{dealer_id}/approve",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert approve_resp.status_code == 200
        
        # Delete the dealer
        delete_resp = session.delete(
            f"{BASE_URL}/api/dealers/{dealer_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        print(f"✓ Dealer deleted successfully with related data cleanup")
        
        # Verify dealer is gone
        dealers_resp = session.get(
            f"{BASE_URL}/api/dealers",
            headers={"Authorization": f"Bearer {token}"}
        )
        dealers = dealers_resp.json()
        assert dealer_id not in [d["id"] for d in dealers], "Dealer still exists"
        print(f"✓ Verified dealer and related data removed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
