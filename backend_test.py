import requests
import sys
import json
from datetime import datetime

class MotorcycleDealerAPITester:
    def __init__(self, base_url="https://dealer-moto-portal.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.dealer_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_motorcycle_id = None
        self.created_order_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_admin_registration(self):
        """Test admin registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        admin_data = {
            "email": f"admin{timestamp}@test.nl",
            "password": "admin123",
            "company_name": "Test Admin Company",
            "role": "admin"
        }
        success, response = self.run_test(
            "Admin Registration", "POST", "auth/register", 200, admin_data
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            return True
        return False

    def test_dealer_registration(self):
        """Test dealer registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        dealer_data = {
            "email": f"dealer{timestamp}@test.nl", 
            "password": "dealer123",
            "company_name": "Test Dealer Company",
            "kvk_number": "12345678",
            "address": "Test Street 123",
            "postal_code": "1234AB",
            "city": "Amsterdam",
            "phone": "+31612345678",
            "contact_person": "John Doe",
            "role": "dealer"
        }
        success, response = self.run_test(
            "Dealer Registration", "POST", "auth/register", 200, dealer_data
        )
        if success and 'token' in response:
            self.dealer_token = response['token']
            return True
        return False

    def test_admin_login(self):
        """Test admin login"""
        login_data = {
            "email": "admin@test.nl",
            "password": "admin123"
        }
        success, response = self.run_test(
            "Admin Login", "POST", "auth/login", 200, login_data
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            return True
        return False

    def test_dealer_login(self):
        """Test dealer login"""
        login_data = {
            "email": "dealer@test.nl",
            "password": "dealer123"
        }
        success, response = self.run_test(
            "Dealer Login", "POST", "auth/login", 200, login_data
        )
        if success and 'token' in response:
            self.dealer_token = response['token']
            return True
        return False

    def test_auth_me_admin(self):
        """Test get current user for admin"""
        return self.run_test("Get Admin Profile", "GET", "auth/me", 200, token=self.admin_token)

    def test_auth_me_dealer(self):
        """Test get current user for dealer"""
        return self.run_test("Get Dealer Profile", "GET", "auth/me", 200, token=self.dealer_token)

    def test_create_motorcycle(self):
        """Test creating a motorcycle (admin only)"""
        motorcycle_data = {
            "brand": "Ducati",
            "model": "Panigale V4",
            "year": 2023,
            "price": 25000.0,
            "starting_price": 20000.0,
            "mileage": 1500,
            "color": "Rosso Corsa",
            "description": "Prachtige Ducati Panigale V4 in perfecte staat",
            "condition": "excellent",
            "images": ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"],
            "auction_duration_hours": 3
        }
        success, response = self.run_test(
            "Create Motorcycle", "POST", "motorcycles", 200, motorcycle_data, self.admin_token
        )
        if success and 'id' in response:
            self.created_motorcycle_id = response['id']
            return True
        return False

    def test_get_motorcycles(self):
        """Test getting all motorcycles"""
        return self.run_test("Get All Motorcycles", "GET", "motorcycles", 200, token=self.admin_token)

    def test_get_available_motorcycles(self):
        """Test getting available motorcycles"""
        return self.run_test("Get Available Motorcycles", "GET", "motorcycles/available", 200, token=self.dealer_token)

    def test_get_motorcycle_detail(self):
        """Test getting specific motorcycle"""
        if not self.created_motorcycle_id:
            self.log_test("Get Motorcycle Detail", False, "No motorcycle ID available")
            return False
        return self.run_test(
            "Get Motorcycle Detail", "GET", f"motorcycles/{self.created_motorcycle_id}", 200, token=self.dealer_token
        )

    def test_update_motorcycle(self):
        """Test updating a motorcycle (admin only)"""
        if not self.created_motorcycle_id:
            self.log_test("Update Motorcycle", False, "No motorcycle ID available")
            return False
        
        update_data = {
            "price": 24000.0,
            "description": "Updated description - prijs verlaagd!"
        }
        return self.run_test(
            "Update Motorcycle", "PUT", f"motorcycles/{self.created_motorcycle_id}", 200, update_data, self.admin_token
        )

    def test_create_order(self):
        """Test creating an order (dealer only)"""
        if not self.created_motorcycle_id:
            self.log_test("Create Order", False, "No motorcycle ID available")
            return False
        
        order_data = {
            "motorcycle_id": self.created_motorcycle_id,
            "notes": "Graag zo snel mogelijk leveren"
        }
        success, response = self.run_test(
            "Create Order", "POST", "orders", 200, order_data, self.dealer_token
        )
        if success and 'id' in response:
            self.created_order_id = response['id']
            return True
        return False

    def test_get_orders_admin(self):
        """Test getting all orders (admin view)"""
        return self.run_test("Get Orders (Admin)", "GET", "orders", 200, token=self.admin_token)

    def test_get_orders_dealer(self):
        """Test getting dealer's orders"""
        return self.run_test("Get Orders (Dealer)", "GET", "orders", 200, token=self.dealer_token)

    def test_update_order_status(self):
        """Test updating order status (admin only)"""
        if not self.created_order_id:
            self.log_test("Update Order Status", False, "No order ID available")
            return False
        
        return self.run_test(
            "Update Order Status", "PUT", f"orders/{self.created_order_id}/status?status=approved", 200, token=self.admin_token
        )

    def test_get_stats(self):
        """Test getting admin statistics"""
        return self.run_test("Get Admin Stats", "GET", "stats", 200, token=self.admin_token)

    def test_delete_motorcycle(self):
        """Test deleting a motorcycle (admin only)"""
        if not self.created_motorcycle_id:
            self.log_test("Delete Motorcycle", False, "No motorcycle ID available")
            return False
        
        return self.run_test(
            "Delete Motorcycle", "DELETE", f"motorcycles/{self.created_motorcycle_id}", 200, token=self.admin_token
        )

    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        # Test dealer trying to create motorcycle
        motorcycle_data = {
            "brand": "Honda",
            "model": "CBR1000RR",
            "year": 2023,
            "price": 20000.0,
            "mileage": 0,
            "color": "Red",
            "description": "Test motorcycle",
            "condition": "new"
        }
        success, _ = self.run_test(
            "Dealer Create Motorcycle (Should Fail)", "POST", "motorcycles", 403, motorcycle_data, self.dealer_token
        )
        
        # Test accessing without token
        success2, _ = self.run_test(
            "No Auth Access (Should Fail)", "GET", "motorcycles", 401
        )
        
        return success and success2

def main():
    print("🏍️  Starting Motorcycle Dealer API Tests")
    print("=" * 50)
    
    tester = MotorcycleDealerAPITester()
    
    # Test sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_admin_registration,
        tester.test_dealer_registration,
        tester.test_admin_login,
        tester.test_dealer_login,
        tester.test_auth_me_admin,
        tester.test_auth_me_dealer,
        tester.test_create_motorcycle,
        tester.test_get_motorcycles,
        tester.test_get_available_motorcycles,
        tester.test_get_motorcycle_detail,
        tester.test_update_motorcycle,
        tester.test_create_order,
        tester.test_get_orders_admin,
        tester.test_get_orders_dealer,
        tester.test_update_order_status,
        tester.test_get_stats,
        tester.test_unauthorized_access,
        tester.test_delete_motorcycle
    ]
    
    # Run all tests
    for test in tests:
        test()
    
    # Print summary
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())