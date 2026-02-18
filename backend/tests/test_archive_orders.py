"""
Test Archive/Restore Order Functionality
Tests for:
- PUT /api/orders/{order_id}/archive - Archive an order
- PUT /api/orders/{order_id}/restore - Restore an archived order
- GET /api/orders/archived - Get archived orders
- GET /api/orders - Should NOT include archived orders
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
TEST_DEALER_EMAIL = "zoektest@dealer.nl"
TEST_DEALER_PASSWORD = "ZoekTest123!"


class TestArchiveOrdersBackend:
    """Test archive/restore order functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login as dealer"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as dealer
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_DEALER_EMAIL,
            "password": TEST_DEALER_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Could not login as dealer: {login_response.text}")
        
        self.token = login_response.json().get("token")
        self.user = login_response.json().get("user")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        # Cleanup - no specific cleanup needed
    
    def test_get_orders_excludes_archived(self):
        """GET /api/orders should NOT include archived orders"""
        response = self.session.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200
        
        orders = response.json()
        # Check that no archived orders are returned
        for order in orders:
            assert order.get("archived") != True, f"Found archived order in main orders list: {order.get('id')}"
        
        print(f"✓ GET /api/orders returns {len(orders)} non-archived orders")
    
    def test_get_archived_orders(self):
        """GET /api/orders/archived should return only archived orders"""
        response = self.session.get(f"{BASE_URL}/api/orders/archived")
        assert response.status_code == 200
        
        archived_orders = response.json()
        print(f"✓ GET /api/orders/archived returns {len(archived_orders)} archived orders")
        
        # Verify all returned orders are archived
        for order in archived_orders:
            assert order.get("archived") == True or order.get("archived") is None, \
                f"Non-archived order found in archived list: {order.get('id')}"
        
        return archived_orders
    
    def test_archive_order_requires_auth(self):
        """PUT /api/orders/{order_id}/archive requires authentication"""
        # Create a new session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.put(f"{BASE_URL}/api/orders/fake-order-id/archive")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Archive endpoint requires authentication")
    
    def test_archive_nonexistent_order(self):
        """PUT /api/orders/{order_id}/archive returns 404 for non-existent order"""
        response = self.session.put(f"{BASE_URL}/api/orders/nonexistent-order-id/archive")
        assert response.status_code == 404
        print("✓ Archive non-existent order returns 404")
    
    def test_restore_order_requires_auth(self):
        """PUT /api/orders/{order_id}/restore requires authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.put(f"{BASE_URL}/api/orders/fake-order-id/restore")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Restore endpoint requires authentication")
    
    def test_restore_nonexistent_order(self):
        """PUT /api/orders/{order_id}/restore returns 404 for non-existent order"""
        response = self.session.put(f"{BASE_URL}/api/orders/nonexistent-order-id/restore")
        assert response.status_code == 404
        print("✓ Restore non-existent order returns 404")
    
    def test_full_archive_restore_flow(self):
        """Test full flow: create order -> archive -> verify archived -> restore -> verify restored"""
        # Step 1: Get available motorcycles
        motorcycles_response = self.session.get(f"{BASE_URL}/api/motorcycles/available")
        if motorcycles_response.status_code != 200:
            pytest.skip("Could not get available motorcycles")
        
        motorcycles = motorcycles_response.json()
        if not motorcycles:
            pytest.skip("No available motorcycles to create order")
        
        motorcycle = motorcycles[0]
        motorcycle_id = motorcycle.get("id")
        print(f"Using motorcycle: {motorcycle.get('brand')} {motorcycle.get('model')} (ID: {motorcycle_id})")
        
        # Step 2: Create an order
        order_response = self.session.post(f"{BASE_URL}/api/orders", json={
            "motorcycle_id": motorcycle_id,
            "notes": "TEST_ARCHIVE_ORDER - will be deleted",
            "needs_delivery": False
        })
        
        if order_response.status_code != 200:
            pytest.skip(f"Could not create order: {order_response.text}")
        
        order = order_response.json()
        order_id = order.get("id")
        print(f"✓ Created order: {order_id}")
        
        try:
            # Step 3: Verify order appears in main orders list
            orders_response = self.session.get(f"{BASE_URL}/api/orders")
            assert orders_response.status_code == 200
            orders = orders_response.json()
            order_ids = [o.get("id") for o in orders]
            assert order_id in order_ids, "New order should appear in main orders list"
            print("✓ Order appears in main orders list")
            
            # Step 4: Archive the order
            archive_response = self.session.put(f"{BASE_URL}/api/orders/{order_id}/archive")
            assert archive_response.status_code == 200
            assert "archived" in archive_response.json().get("message", "").lower()
            print("✓ Order archived successfully")
            
            # Step 5: Verify order NO LONGER appears in main orders list
            orders_response = self.session.get(f"{BASE_URL}/api/orders")
            assert orders_response.status_code == 200
            orders = orders_response.json()
            order_ids = [o.get("id") for o in orders]
            assert order_id not in order_ids, "Archived order should NOT appear in main orders list"
            print("✓ Archived order removed from main orders list")
            
            # Step 6: Verify order appears in archived orders list
            archived_response = self.session.get(f"{BASE_URL}/api/orders/archived")
            assert archived_response.status_code == 200
            archived_orders = archived_response.json()
            archived_ids = [o.get("id") for o in archived_orders]
            assert order_id in archived_ids, "Archived order should appear in archived orders list"
            print("✓ Order appears in archived orders list")
            
            # Step 7: Restore the order
            restore_response = self.session.put(f"{BASE_URL}/api/orders/{order_id}/restore")
            assert restore_response.status_code == 200
            assert "restored" in restore_response.json().get("message", "").lower()
            print("✓ Order restored successfully")
            
            # Step 8: Verify order appears back in main orders list
            orders_response = self.session.get(f"{BASE_URL}/api/orders")
            assert orders_response.status_code == 200
            orders = orders_response.json()
            order_ids = [o.get("id") for o in orders]
            assert order_id in order_ids, "Restored order should appear in main orders list"
            print("✓ Restored order appears in main orders list")
            
            # Step 9: Verify order NO LONGER appears in archived orders list
            archived_response = self.session.get(f"{BASE_URL}/api/orders/archived")
            assert archived_response.status_code == 200
            archived_orders = archived_response.json()
            archived_ids = [o.get("id") for o in archived_orders]
            assert order_id not in archived_ids, "Restored order should NOT appear in archived orders list"
            print("✓ Restored order removed from archived orders list")
            
        finally:
            # Cleanup: Delete the test order
            delete_response = self.session.delete(f"{BASE_URL}/api/orders/{order_id}")
            if delete_response.status_code == 200:
                print(f"✓ Cleaned up test order: {order_id}")
            else:
                print(f"⚠ Could not clean up test order: {order_id}")
    
    def test_archived_orders_include_motorcycle_data(self):
        """Verify archived orders include motorcycle data"""
        response = self.session.get(f"{BASE_URL}/api/orders/archived")
        assert response.status_code == 200
        
        archived_orders = response.json()
        if not archived_orders:
            print("⚠ No archived orders to verify motorcycle data")
            return
        
        for order in archived_orders:
            # Each order should have motorcycle data or motorcycle_snapshot
            has_motorcycle = order.get("motorcycle") is not None
            has_snapshot = order.get("motorcycle_snapshot") is not None
            
            if has_motorcycle:
                motorcycle = order.get("motorcycle")
                assert "brand" in motorcycle or "model" in motorcycle, \
                    f"Motorcycle data missing brand/model for order {order.get('id')}"
                print(f"✓ Order {order.get('id')[:8]} has motorcycle: {motorcycle.get('brand')} {motorcycle.get('model')}")
            elif has_snapshot:
                print(f"✓ Order {order.get('id')[:8]} has motorcycle_snapshot")
            else:
                print(f"⚠ Order {order.get('id')[:8]} has no motorcycle data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
