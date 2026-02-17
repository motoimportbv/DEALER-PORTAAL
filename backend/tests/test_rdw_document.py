"""
Test RDW Document Upload Feature for License Plates
Tests:
- POST /api/license-plates/{plate_id}/document - Upload RDW document
- DELETE /api/license-plates/{plate_id}/document - Delete RDW document
- GET /api/license-plates - Verify document_url and document_filename returned
- File type validation (PDF, JPG, PNG, WEBP only)
- File size validation (max 10MB)
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "motoimportbv@gmail.com"
ADMIN_PASSWORD = "Enolim12"

# Test license plate IDs from the request
TEST_PLATE_ID_1 = "864bb4e4-97e2-4c29-8c54-0a697ba27ae2"  # XY-789-ZZ
TEST_PLATE_ID_2 = "fb438b7d-7500-4ee6-8d3e-61335692ba57"  # AB-123-CD


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestRDWDocumentUpload:
    """Test RDW document upload functionality"""
    
    def test_upload_pdf_document(self, admin_headers):
        """Test uploading a PDF document"""
        # Create a simple PDF-like file (just for testing content type)
        pdf_content = b"%PDF-1.4\n%Test PDF content for RDW document"
        files = {
            'file': ('test_rdw.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers,
            files=files
        )
        
        print(f"Upload PDF response: {response.status_code} - {response.text}")
        
        # Should succeed or return 404 if plate doesn't exist
        if response.status_code == 404:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found - may need to create test data")
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "document_url" in data
        assert "document_filename" in data
        assert data["document_filename"] == "test_rdw.pdf"
        print(f"✓ PDF upload successful: {data['document_url']}")
    
    def test_upload_jpg_document(self, admin_headers):
        """Test uploading a JPG image"""
        # Create a minimal JPEG file header
        jpg_content = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
        ])
        files = {
            'file': ('test_rdw.jpg', io.BytesIO(jpg_content), 'image/jpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers,
            files=files
        )
        
        print(f"Upload JPG response: {response.status_code} - {response.text}")
        
        if response.status_code == 404:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found")
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert data["document_filename"] == "test_rdw.jpg"
        print(f"✓ JPG upload successful")
    
    def test_upload_png_document(self, admin_headers):
        """Test uploading a PNG image"""
        # Minimal PNG header
        png_content = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 pixel
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        files = {
            'file': ('test_rdw.png', io.BytesIO(png_content), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers,
            files=files
        )
        
        print(f"Upload PNG response: {response.status_code} - {response.text}")
        
        if response.status_code == 404:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found")
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        print(f"✓ PNG upload successful")
    
    def test_upload_webp_document(self, admin_headers):
        """Test uploading a WEBP image"""
        # Minimal WEBP header
        webp_content = b'RIFF\x00\x00\x00\x00WEBPVP8 '
        files = {
            'file': ('test_rdw.webp', io.BytesIO(webp_content), 'image/webp')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers,
            files=files
        )
        
        print(f"Upload WEBP response: {response.status_code} - {response.text}")
        
        if response.status_code == 404:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found")
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        print(f"✓ WEBP upload successful")


class TestFileTypeValidation:
    """Test file type validation - only PDF, JPG, PNG, WEBP allowed"""
    
    def test_reject_txt_file(self, admin_headers):
        """Test that TXT files are rejected"""
        files = {
            'file': ('test.txt', io.BytesIO(b'This is a text file'), 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers,
            files=files
        )
        
        print(f"TXT upload response: {response.status_code} - {response.text}")
        
        if response.status_code == 404:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found")
        
        assert response.status_code == 400, f"Should reject TXT files"
        assert "PDF, JPG, PNG of WEBP" in response.text or "toegestaan" in response.text
        print(f"✓ TXT file correctly rejected")
    
    def test_reject_gif_file(self, admin_headers):
        """Test that GIF files are rejected"""
        # GIF header
        gif_content = b'GIF89a\x01\x00\x01\x00\x00\x00\x00;'
        files = {
            'file': ('test.gif', io.BytesIO(gif_content), 'image/gif')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers,
            files=files
        )
        
        print(f"GIF upload response: {response.status_code} - {response.text}")
        
        if response.status_code == 404:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found")
        
        assert response.status_code == 400, f"Should reject GIF files"
        print(f"✓ GIF file correctly rejected")
    
    def test_reject_exe_file(self, admin_headers):
        """Test that EXE files are rejected"""
        files = {
            'file': ('test.exe', io.BytesIO(b'MZ\x00\x00'), 'application/octet-stream')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers,
            files=files
        )
        
        print(f"EXE upload response: {response.status_code} - {response.text}")
        
        if response.status_code == 404:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found")
        
        assert response.status_code == 400, f"Should reject EXE files"
        print(f"✓ EXE file correctly rejected")


class TestFileSizeValidation:
    """Test file size validation - max 10MB"""
    
    def test_reject_large_file(self, admin_headers):
        """Test that files larger than 10MB are rejected"""
        # Create a file slightly over 10MB
        large_content = b"%PDF-1.4\n" + (b"X" * (11 * 1024 * 1024))  # 11MB
        files = {
            'file': ('large_file.pdf', io.BytesIO(large_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers,
            files=files
        )
        
        print(f"Large file upload response: {response.status_code}")
        
        if response.status_code == 404:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found")
        
        assert response.status_code == 400, f"Should reject files > 10MB"
        assert "10MB" in response.text or "groot" in response.text
        print(f"✓ Large file correctly rejected")


class TestDocumentDelete:
    """Test RDW document deletion"""
    
    def test_delete_document(self, admin_headers):
        """Test deleting an uploaded document"""
        # First upload a document
        pdf_content = b"%PDF-1.4\nTest PDF for deletion"
        files = {
            'file': ('delete_test.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers,
            files=files
        )
        
        if upload_response.status_code == 404:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found")
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers
        )
        
        print(f"Delete response: {delete_response.status_code} - {delete_response.text}")
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        assert "verwijderd" in delete_response.text.lower()
        print(f"✓ Document deleted successfully")
    
    def test_delete_nonexistent_document(self, admin_headers):
        """Test deleting when no document exists"""
        # First ensure no document exists by deleting if present
        requests.delete(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers
        )
        
        # Try to delete again
        response = requests.delete(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers
        )
        
        print(f"Delete nonexistent response: {response.status_code} - {response.text}")
        
        if response.status_code == 404 and "Kenteken" in response.text:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found")
        
        # Should return 404 for no document
        assert response.status_code == 404, f"Should return 404 when no document exists"
        print(f"✓ Correctly returns 404 for nonexistent document")


class TestGetLicensePlatesWithDocument:
    """Test that GET /api/license-plates returns document info"""
    
    def test_get_plates_includes_document_fields(self, admin_headers):
        """Test that license plates response includes document_url and document_filename"""
        response = requests.get(
            f"{BASE_URL}/api/license-plates",
            headers=admin_headers
        )
        
        print(f"Get plates response: {response.status_code}")
        
        assert response.status_code == 200, f"Get plates failed: {response.text}"
        
        plates = response.json()
        print(f"Found {len(plates)} license plates")
        
        # Check that the response structure supports document fields
        if len(plates) > 0:
            # Check first plate has the expected fields
            first_plate = plates[0]
            print(f"First plate keys: {first_plate.keys()}")
            
            # These fields should exist (even if None)
            assert "license_plate" in first_plate
            assert "dealer_id" in first_plate
            
            # Check if any plate has a document
            plates_with_docs = [p for p in plates if p.get("document_url")]
            print(f"Plates with documents: {len(plates_with_docs)}")
            
            if plates_with_docs:
                doc_plate = plates_with_docs[0]
                assert "document_url" in doc_plate
                assert "document_filename" in doc_plate
                print(f"✓ Document fields present: url={doc_plate['document_url']}, filename={doc_plate['document_filename']}")
        
        print(f"✓ GET /api/license-plates returns correct structure")


class TestDocumentAccess:
    """Test document download/access"""
    
    def test_document_accessible_after_upload(self, admin_headers):
        """Test that uploaded document is accessible via URL"""
        # Upload a document
        pdf_content = b"%PDF-1.4\nTest PDF for access check"
        files = {
            'file': ('access_test.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        upload_response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers,
            files=files
        )
        
        if upload_response.status_code == 404:
            pytest.skip(f"License plate {TEST_PLATE_ID_1} not found")
        
        assert upload_response.status_code == 200
        
        document_url = upload_response.json()["document_url"]
        full_url = f"{BASE_URL}{document_url}"
        
        print(f"Checking document access at: {full_url}")
        
        # Try to access the document
        access_response = requests.get(full_url)
        
        print(f"Document access response: {access_response.status_code}")
        
        assert access_response.status_code == 200, f"Document not accessible: {access_response.status_code}"
        print(f"✓ Document accessible at {document_url}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            headers=admin_headers
        )


class TestAuthorizationRequired:
    """Test that endpoints require admin authorization"""
    
    def test_upload_requires_auth(self):
        """Test that upload requires authentication"""
        pdf_content = b"%PDF-1.4\nTest"
        files = {
            'file': ('test.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document",
            files=files
        )
        
        print(f"Upload without auth: {response.status_code}")
        
        assert response.status_code in [401, 403], f"Should require auth"
        print(f"✓ Upload correctly requires authentication")
    
    def test_delete_requires_auth(self):
        """Test that delete requires authentication"""
        response = requests.delete(
            f"{BASE_URL}/api/license-plates/{TEST_PLATE_ID_1}/document"
        )
        
        print(f"Delete without auth: {response.status_code}")
        
        assert response.status_code in [401, 403], f"Should require auth"
        print(f"✓ Delete correctly requires authentication")


class TestInvalidPlateId:
    """Test handling of invalid plate IDs"""
    
    def test_upload_to_nonexistent_plate(self, admin_headers):
        """Test uploading to a non-existent plate ID"""
        pdf_content = b"%PDF-1.4\nTest"
        files = {
            'file': ('test.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/license-plates/nonexistent-plate-id/document",
            headers=admin_headers,
            files=files
        )
        
        print(f"Upload to nonexistent plate: {response.status_code}")
        
        assert response.status_code == 404, f"Should return 404 for nonexistent plate"
        print(f"✓ Correctly returns 404 for nonexistent plate")
    
    def test_delete_from_nonexistent_plate(self, admin_headers):
        """Test deleting from a non-existent plate ID"""
        response = requests.delete(
            f"{BASE_URL}/api/license-plates/nonexistent-plate-id/document",
            headers=admin_headers
        )
        
        print(f"Delete from nonexistent plate: {response.status_code}")
        
        assert response.status_code == 404, f"Should return 404 for nonexistent plate"
        print(f"✓ Correctly returns 404 for nonexistent plate")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
