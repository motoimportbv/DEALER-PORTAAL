"""
Test suite for DELETE /api/orders/{order_id} endpoint
Tests the order deletion feature for dealers
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDeleteOrder:
    """Tests for DELETE /api/orders/{order_id} endpoint"""
    
    @pytest.fixture(scope="class")
    def dealer_token(self):
        """Get dealer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "zoektest@dealer.nl",
            "password": "ZoekTest123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Dealer authentication failed")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "motoimportbv@gmail.com",
            "password": "Enolim12"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture(scope="class")
    def dealer_info(self, dealer_token):
        """Get dealer user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        if response.status_code == 200:
            return response.json()
        pytest.skip("Could not get dealer info")
    
    def test_dealer_login_success(self):
        """Test that dealer can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "zoektest@dealer.nl",
            "password": "ZoekTest123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "zoektest@dealer.nl"
        print("SUCCESS: Dealer login works")
    
    def test_get_dealer_orders(self, dealer_token):
        """Test that dealer can get their orders"""
        response = requests.get(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200, f"Failed to get orders: {response.text}"
        orders = response.json()
        assert isinstance(orders, list)
        print(f"SUCCESS: Dealer has {len(orders)} orders")
        return orders
    
    def test_delete_order_requires_auth(self):
        """Test that delete order requires authentication"""
        fake_order_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/orders/{fake_order_id}")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Delete order requires authentication")
    
    def test_delete_nonexistent_order_returns_404(self, dealer_token):
        """Test that deleting non-existent order returns 404"""
        fake_order_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/orders/{fake_order_id}",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: Delete non-existent order returns 404")
    
    def test_create_and_delete_order_flow(self, dealer_token, dealer_info):
        """Test full flow: create order, verify it exists, delete it, verify motorcycle is available again"""
        # Step 1: Get available motorcycles
        response = requests.get(
            f"{BASE_URL}/api/motorcycles",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200
        motorcycles = response.json()
        
        # Find an available motorcycle
        available_motorcycle = None
        for m in motorcycles:
            if m.get("is_available", False) and not m.get("is_paused", False):
                available_motorcycle = m
                break
        
        if not available_motorcycle:
            pytest.skip("No available motorcycles to test with")
        
        motorcycle_id = available_motorcycle["id"]
        print(f"Found available motorcycle: {available_motorcycle['brand']} {available_motorcycle['model']} (ID: {motorcycle_id})")
        
        # Step 2: Create an order
        order_response = requests.post(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {dealer_token}"},
            json={
                "motorcycle_id": motorcycle_id,
                "notes": "TEST_DELETE_ORDER - This order will be deleted",
                "needs_delivery": False
            }
        )
        
        # Order creation might fail if motorcycle is already ordered - that's ok
        if order_response.status_code != 201:
            print(f"Could not create order (status {order_response.status_code}): {order_response.text}")
            pytest.skip("Could not create test order - motorcycle may already be ordered")
        
        order = order_response.json()
        order_id = order["id"]
        print(f"SUCCESS: Created order {order_id}")
        
        # Step 3: Verify order exists in dealer's orders
        orders_response = requests.get(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert orders_response.status_code == 200
        orders = orders_response.json()
        order_ids = [o["id"] for o in orders]
        assert order_id in order_ids, "Created order not found in dealer's orders"
        print(f"SUCCESS: Order {order_id} found in dealer's orders")
        
        # Step 4: Delete the order
        delete_response = requests.delete(
            f"{BASE_URL}/api/orders/{order_id}",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        delete_data = delete_response.json()
        assert "message" in delete_data
        assert "deleted" in delete_data["message"].lower() or "success" in delete_data["message"].lower()
        print(f"SUCCESS: Order deleted - {delete_data['message']}")
        
        # Step 5: Verify order no longer exists
        orders_after_response = requests.get(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert orders_after_response.status_code == 200
        orders_after = orders_after_response.json()
        order_ids_after = [o["id"] for o in orders_after]
        assert order_id not in order_ids_after, "Order still exists after deletion"
        print("SUCCESS: Order no longer in dealer's orders list")
        
        # Step 6: Verify motorcycle is available again
        motorcycle_response = requests.get(
            f"{BASE_URL}/api/motorcycles/{motorcycle_id}",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert motorcycle_response.status_code == 200
        motorcycle_after = motorcycle_response.json()
        assert motorcycle_after.get("is_available") == True, "Motorcycle should be available after order deletion"
        print(f"SUCCESS: Motorcycle {motorcycle_id} is available again after order deletion")
    
    def test_dealer_cannot_delete_other_dealers_order(self, admin_token, dealer_token, dealer_info):
        """Test that a dealer cannot delete another dealer's order"""
        # First, get all orders as admin to find an order from a different dealer
        admin_orders_response = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if admin_orders_response.status_code != 200:
            pytest.skip("Could not get admin orders")
        
        all_orders = admin_orders_response.json()
        dealer_id = dealer_info.get("id")
        
        # Find an order from a different dealer
        other_dealer_order = None
        for order in all_orders:
            if order.get("dealer_id") != dealer_id:
                other_dealer_order = order
                break
        
        if not other_dealer_order:
            pytest.skip("No orders from other dealers found to test authorization")
        
        # Try to delete another dealer's order
        delete_response = requests.delete(
            f"{BASE_URL}/api/orders/{other_dealer_order['id']}",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        
        assert delete_response.status_code == 403, f"Expected 403 Forbidden, got {delete_response.status_code}"
        print(f"SUCCESS: Dealer cannot delete other dealer's order (got 403 as expected)")
    
    def test_admin_can_delete_any_order(self, admin_token, dealer_token):
        """Test that admin can delete any order"""
        # First create an order as dealer
        # Get available motorcycles
        response = requests.get(
            f"{BASE_URL}/api/motorcycles",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200
        motorcycles = response.json()
        
        # Find an available motorcycle
        available_motorcycle = None
        for m in motorcycles:
            if m.get("is_available", False) and not m.get("is_paused", False):
                available_motorcycle = m
                break
        
        if not available_motorcycle:
            pytest.skip("No available motorcycles to test admin delete")
        
        # Create order as dealer
        order_response = requests.post(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {dealer_token}"},
            json={
                "motorcycle_id": available_motorcycle["id"],
                "notes": "TEST_ADMIN_DELETE - Admin will delete this",
                "needs_delivery": False
            }
        )
        
        if order_response.status_code != 201:
            pytest.skip("Could not create test order for admin delete test")
        
        order = order_response.json()
        order_id = order["id"]
        print(f"Created order {order_id} for admin delete test")
        
        # Admin deletes the order
        delete_response = requests.delete(
            f"{BASE_URL}/api/orders/{order_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert delete_response.status_code == 200, f"Admin delete failed: {delete_response.text}"
        print(f"SUCCESS: Admin can delete dealer's order")


class TestDeleteOrderEndpointDetails:
    """Additional tests for DELETE order endpoint edge cases"""
    
    @pytest.fixture(scope="class")
    def dealer_token(self):
        """Get dealer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "zoektest@dealer.nl",
            "password": "ZoekTest123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Dealer authentication failed")
    
    def test_delete_returns_success_message(self, dealer_token):
        """Test that delete returns proper success message"""
        # Get dealer's orders
        response = requests.get(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200
        orders = response.json()
        
        if not orders:
            pytest.skip("No orders to test delete message")
        
        # Find an order to delete (preferably one with TEST_ prefix in notes)
        order_to_delete = None
        for order in orders:
            if "TEST_" in order.get("notes", ""):
                order_to_delete = order
                break
        
        if not order_to_delete:
            # Just use the first order
            order_to_delete = orders[0]
        
        # Delete the order
        delete_response = requests.delete(
            f"{BASE_URL}/api/orders/{order_to_delete['id']}",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert "message" in data
        print(f"SUCCESS: Delete returns message: {data['message']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
