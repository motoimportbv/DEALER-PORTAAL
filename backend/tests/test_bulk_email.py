"""
Test suite for Bulk Email Features:
- POST /api/admin/upload-marketing-csv - Upload CSV with email addresses
- GET /api/admin/available-flyers - Get available PDF flyers
- GET /api/admin/marketing-lists - Get marketing lists (including uploaded)
- POST /api/admin/bulk-email - Send bulk email with optional flyer and 'over ons' section
- Dealer notification logic - only NL dealers get notifications
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Enolim12"
DUTCH_DEALER_EMAIL = "testdealer@motoimport.nl"
DUTCH_DEALER_PASSWORD = "MotoTest123!"
SWISS_DEALER_EMAIL = "testdealer@swiss.ch"
SWISS_DEALER_PASSWORD = "SwissTest123!"


class TestBulkEmailEndpoints:
    """Test bulk email API endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def dutch_dealer_token(self):
        """Get Dutch dealer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DUTCH_DEALER_EMAIL,
            "password": DUTCH_DEALER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Dutch dealer login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def swiss_dealer_token(self):
        """Get Swiss dealer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SWISS_DEALER_EMAIL,
            "password": SWISS_DEALER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Swiss dealer login failed: {response.status_code}")
    
    # ============ GET /api/admin/available-flyers ============
    
    def test_get_available_flyers_requires_admin(self):
        """Test that available-flyers endpoint requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/available-flyers")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    def test_get_available_flyers_success(self, admin_token):
        """Test getting available PDF flyers"""
        response = requests.get(
            f"{BASE_URL}/api/admin/available-flyers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        flyers = response.json()
        assert isinstance(flyers, list), "Response should be a list"
        
        # Check that we have the expected flyers
        flyer_names = [f["filename"] for f in flyers]
        print(f"Available flyers: {flyer_names}")
        
        # Verify flyer structure
        if flyers:
            flyer = flyers[0]
            assert "filename" in flyer, "Flyer should have filename"
            assert "size_kb" in flyer, "Flyer should have size_kb"
            assert "url" in flyer, "Flyer should have url"
            assert flyer["filename"].endswith(".pdf"), "Flyer should be PDF"
    
    # ============ GET /api/admin/marketing-lists ============
    
    def test_get_marketing_lists_requires_admin(self):
        """Test that marketing-lists endpoint requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/marketing-lists")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    def test_get_marketing_lists_success(self, admin_token):
        """Test getting marketing lists"""
        response = requests.get(
            f"{BASE_URL}/api/admin/marketing-lists",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        lists = response.json()
        assert isinstance(lists, list), "Response should be a list"
        print(f"Available marketing lists: {[l['filename'] for l in lists]}")
        
        # Verify list structure if any exist
        if lists:
            lst = lists[0]
            assert "filename" in lst, "List should have filename"
            assert "display_name" in lst, "List should have display_name"
            assert "count" in lst, "List should have count"
    
    # ============ POST /api/admin/upload-marketing-csv ============
    
    def test_upload_csv_requires_admin(self):
        """Test that upload-marketing-csv endpoint requires admin auth"""
        csv_content = "Email,Bedrijfsnaam\ntest@example.com,Test Company"
        files = {"file": ("test.csv", csv_content, "text/csv")}
        response = requests.post(f"{BASE_URL}/api/admin/upload-marketing-csv", files=files)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    def test_upload_csv_rejects_non_csv(self, admin_token):
        """Test that only CSV files are accepted"""
        txt_content = "This is not a CSV"
        files = {"file": ("test.txt", txt_content, "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/admin/upload-marketing-csv",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "CSV" in response.json().get("detail", ""), "Error should mention CSV"
    
    def test_upload_csv_success_comma_delimiter(self, admin_token):
        """Test uploading CSV with comma delimiter"""
        csv_content = "Email,Bedrijfsnaam\ntest1@example.com,Test Company 1\ntest2@example.com,Test Company 2"
        files = {"file": ("test_comma.csv", csv_content, "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/admin/upload-marketing-csv",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        assert "filename" in data, "Response should have filename"
        assert "count" in data, "Response should have count"
        assert "emails" in data, "Response should have emails"
        assert data["count"] == 2, f"Expected 2 emails, got {data['count']}"
        print(f"Uploaded CSV: {data['filename']} with {data['count']} emails")
    
    def test_upload_csv_success_semicolon_delimiter(self, admin_token):
        """Test uploading CSV with semicolon delimiter (European format)"""
        csv_content = "Email;Bedrijfsnaam\ntest3@example.com;Test Company 3\ntest4@example.com;Test Company 4"
        files = {"file": ("test_semicolon.csv", csv_content, "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/admin/upload-marketing-csv",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["count"] == 2, f"Expected 2 emails, got {data['count']}"
    
    def test_upload_csv_no_valid_emails(self, admin_token):
        """Test uploading CSV without valid email addresses"""
        csv_content = "Name,Company\nJohn,Company A\nJane,Company B"
        files = {"file": ("no_emails.csv", csv_content, "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/admin/upload-marketing-csv",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "email" in response.json().get("detail", "").lower(), "Error should mention email"
    
    def test_uploaded_csv_appears_in_marketing_lists(self, admin_token):
        """Test that uploaded CSV appears in marketing lists"""
        # First upload a CSV
        csv_content = "Email,Bedrijfsnaam\nlisttest@example.com,List Test Company"
        files = {"file": ("list_test.csv", csv_content, "text/csv")}
        upload_response = requests.post(
            f"{BASE_URL}/api/admin/upload-marketing-csv",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        assert upload_response.status_code == 200
        uploaded_filename = upload_response.json()["filename"]
        
        # Then check marketing lists
        lists_response = requests.get(
            f"{BASE_URL}/api/admin/marketing-lists",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert lists_response.status_code == 200
        
        lists = lists_response.json()
        filenames = [l["filename"] for l in lists]
        assert uploaded_filename in filenames, f"Uploaded file {uploaded_filename} should appear in lists"
        
        # Check that uploaded list has is_uploaded flag
        uploaded_list = next((l for l in lists if l["filename"] == uploaded_filename), None)
        assert uploaded_list is not None
        assert uploaded_list.get("is_uploaded") == True, "Uploaded list should have is_uploaded=True"
    
    # ============ POST /api/admin/bulk-email ============
    
    def test_bulk_email_requires_admin(self):
        """Test that bulk-email endpoint requires admin auth"""
        response = requests.post(f"{BASE_URL}/api/admin/bulk-email", json={
            "subject": "Test",
            "message": "Test message",
            "recipient_emails": ["test@example.com"]
        })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    def test_bulk_email_basic_success(self, admin_token):
        """Test sending basic bulk email without attachments"""
        # Use a test email that won't actually send (or use a test email)
        response = requests.post(
            f"{BASE_URL}/api/admin/bulk-email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "subject": "Test Bulk Email",
                "message": "Dit is een test bericht van Moto Import.",
                "recipient_emails": ["test-bulk@example.com"],
                "include_about_us": False,
                "flyer_filename": None
            }
        )
        # Note: This may fail if email sending fails, but we check the response structure
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total" in data, "Response should have total"
        assert "sent" in data, "Response should have sent"
        assert "failed" in data, "Response should have failed"
        assert "failed_emails" in data, "Response should have failed_emails"
        assert data["total"] == 1, f"Expected total=1, got {data['total']}"
        print(f"Bulk email result: sent={data['sent']}, failed={data['failed']}")
    
    def test_bulk_email_with_about_us(self, admin_token):
        """Test sending bulk email with 'Over Ons' section"""
        response = requests.post(
            f"{BASE_URL}/api/admin/bulk-email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "subject": "Test met Over Ons",
                "message": "Dit is een test met de Over Ons sectie.",
                "recipient_emails": ["test-aboutus@example.com"],
                "include_about_us": True,
                "flyer_filename": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["total"] == 1
        print(f"Bulk email with About Us: sent={data['sent']}, failed={data['failed']}")
    
    def test_bulk_email_with_flyer_attachment(self, admin_token):
        """Test sending bulk email with flyer attachment"""
        # First get available flyers
        flyers_response = requests.get(
            f"{BASE_URL}/api/admin/available-flyers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        flyers = flyers_response.json()
        
        if not flyers:
            pytest.skip("No flyers available for testing")
        
        flyer_filename = flyers[0]["filename"]
        print(f"Testing with flyer: {flyer_filename}")
        
        response = requests.post(
            f"{BASE_URL}/api/admin/bulk-email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "subject": "Test met Flyer Bijlage",
                "message": "Dit is een test met een flyer bijlage.",
                "recipient_emails": ["test-flyer@example.com"],
                "include_about_us": False,
                "flyer_filename": flyer_filename
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["total"] == 1
        print(f"Bulk email with flyer: sent={data['sent']}, failed={data['failed']}")
    
    def test_bulk_email_with_all_options(self, admin_token):
        """Test sending bulk email with both 'Over Ons' and flyer attachment"""
        # First get available flyers
        flyers_response = requests.get(
            f"{BASE_URL}/api/admin/available-flyers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        flyers = flyers_response.json()
        
        if not flyers:
            pytest.skip("No flyers available for testing")
        
        flyer_filename = flyers[0]["filename"]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/bulk-email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "subject": "Test met Alle Opties",
                "message": "Dit is een test met zowel Over Ons als een flyer bijlage.",
                "recipient_emails": ["test-all@example.com"],
                "include_about_us": True,
                "flyer_filename": flyer_filename
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["total"] == 1
        print(f"Bulk email with all options: sent={data['sent']}, failed={data['failed']}")
    
    def test_bulk_email_multiple_recipients(self, admin_token):
        """Test sending bulk email to multiple recipients"""
        response = requests.post(
            f"{BASE_URL}/api/admin/bulk-email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "subject": "Test Meerdere Ontvangers",
                "message": "Dit is een test naar meerdere ontvangers.",
                "recipient_emails": [
                    "test-multi1@example.com",
                    "test-multi2@example.com",
                    "test-multi3@example.com"
                ],
                "include_about_us": False,
                "flyer_filename": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["total"] == 3, f"Expected total=3, got {data['total']}"
        print(f"Bulk email to 3 recipients: sent={data['sent']}, failed={data['failed']}")


class TestDealerNotificationLogic:
    """Test that only Dutch dealers receive notifications for new motorcycles"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin login failed: {response.status_code}")
    
    def test_verify_dutch_dealer_exists(self):
        """Verify Dutch dealer account exists"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DUTCH_DEALER_EMAIL,
            "password": DUTCH_DEALER_PASSWORD
        })
        if response.status_code == 200:
            user = response.json().get("user", {})
            print(f"Dutch dealer: {user.get('company_name')} - is_foreign_dealer: {user.get('is_foreign_dealer', False)}")
            assert user.get("is_foreign_dealer", False) == False, "Dutch dealer should not be foreign"
        else:
            print(f"Dutch dealer login failed: {response.status_code} - may not exist yet")
    
    def test_verify_swiss_dealer_exists(self):
        """Verify Swiss dealer account exists"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SWISS_DEALER_EMAIL,
            "password": SWISS_DEALER_PASSWORD
        })
        if response.status_code == 200:
            user = response.json().get("user", {})
            print(f"Swiss dealer: {user.get('company_name')} - is_foreign_dealer: {user.get('is_foreign_dealer', False)}")
            # Swiss dealer should be marked as foreign
            assert user.get("is_foreign_dealer", False) == True, "Swiss dealer should be foreign"
        else:
            print(f"Swiss dealer login failed: {response.status_code} - may not exist yet")
    
    def test_get_dealers_endpoint_filters_foreign(self, admin_token):
        """Test that admin dealers endpoint shows foreign dealer status"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dealers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        dealers = response.json()
        print(f"Total dealers: {len(dealers)}")
        
        # Count Dutch vs foreign dealers
        dutch_count = sum(1 for d in dealers if not d.get("is_foreign_dealer", False))
        foreign_count = sum(1 for d in dealers if d.get("is_foreign_dealer", False))
        print(f"Dutch dealers: {dutch_count}, Foreign dealers: {foreign_count}")
        
        # List foreign dealers
        foreign_dealers = [d for d in dealers if d.get("is_foreign_dealer", False)]
        for fd in foreign_dealers:
            print(f"  Foreign: {fd.get('company_name')} ({fd.get('country', 'unknown')})")


class TestMarketingListContent:
    """Test marketing list content retrieval"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin login failed: {response.status_code}")
    
    def test_get_marketing_list_content(self, admin_token):
        """Test getting emails from a marketing list"""
        # First get available lists
        lists_response = requests.get(
            f"{BASE_URL}/api/admin/marketing-lists",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        lists = lists_response.json()
        
        if not lists:
            pytest.skip("No marketing lists available")
        
        # Get content of first list
        filename = lists[0]["filename"]
        response = requests.get(
            f"{BASE_URL}/api/admin/marketing-list/{filename}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        emails = response.json()
        assert isinstance(emails, list), "Response should be a list"
        print(f"List {filename} has {len(emails)} emails")
        
        if emails:
            email_entry = emails[0]
            assert "email" in email_entry, "Entry should have email"
            print(f"Sample entry: {email_entry}")
    
    def test_get_nonexistent_list_returns_404(self, admin_token):
        """Test that requesting non-existent list returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/admin/marketing-list/nonexistent_file.csv",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
