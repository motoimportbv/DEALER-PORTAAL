# Backend Models
# Alle Pydantic models voor de Moto Import applicatie

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid


# ============ USER MODELS ============

class UserCreate(BaseModel):
    email: str
    password: str
    company_name: str
    kvk_number: str = ""
    address: str = ""
    postal_code: str = ""
    city: str = ""
    phone: str = ""
    contact_person: str = ""
    role: str = "dealer"

class SupplierCreate(BaseModel):
    email: str
    password: str
    company_name: str
    country: str
    contact_person: str = ""
    phone: str = ""
    address: str = ""
    city: str = ""
    postal_code: str = ""
    iban: str = ""

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    company_name: str
    kvk_number: str = ""
    address: str = ""
    postal_code: str = ""
    city: str = ""
    phone: str = ""
    contact_person: str = ""
    role: str
    is_approved: bool = False
    is_foreign_dealer: bool = False
    is_offline: bool = False
    country: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============ MOTORCYCLE MODELS ============

class MotorcycleCreate(BaseModel):
    brand: str
    model: str
    year: int
    price: float
    purchase_price: Optional[float] = None
    starting_price: Optional[float] = None
    mileage: int = 0
    color: str = ""
    description: str = ""
    condition: str = "good"
    images: List[str] = []
    auction_duration_hours: int = 3
    chassis_number: str = ""
    currency: str = "EUR"
    auto_delete_hours: int = 24
    has_maintenance_history: Optional[bool] = None
    maintenance_history_details: Optional[str] = None
    visibility: str = "all"
    visible_to_dealers: List[str] = []

class MotorcycleUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    price: Optional[float] = None
    purchase_price: Optional[float] = None
    starting_price: Optional[float] = None
    mileage: Optional[int] = None
    color: Optional[str] = None
    description: Optional[str] = None
    condition: Optional[str] = None
    images: Optional[List[str]] = None
    is_available: Optional[bool] = None
    chassis_number: Optional[str] = None
    license_plate: Optional[str] = None
    visibility: Optional[str] = None
    visible_to_dealers: Optional[List[str]] = None

class Motorcycle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    brand: str
    model: str
    year: int
    price: float
    purchase_price: Optional[float] = None
    starting_price: Optional[float] = None
    mileage: int
    color: str
    description: str
    condition: str
    images: List[str] = []
    is_available: bool = True
    is_paused: bool = False
    auction_end_time: Optional[str] = None
    highest_bid: Optional[float] = None
    highest_bidder_id: Optional[str] = None
    chassis_number: str = ""
    license_plate: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: str = ""
    auto_delete_at: Optional[str] = None
    is_dealer_listing: bool = False
    seller_company: Optional[str] = None
    seller_id: Optional[str] = None
    listing_fee_invoiced: bool = False
    is_foreign_listing: bool = False
    is_pending_approval: bool = False
    foreign_dealer_id: Optional[str] = None
    foreign_dealer_company: Optional[str] = None
    original_price: Optional[float] = None
    original_currency: str = "EUR"
    has_maintenance_history: Optional[bool] = None
    maintenance_history_details: Optional[str] = None
    visibility: str = "all"
    visible_to_dealers: List[str] = []
    supplier_price_reduced: bool = False
    supplier_price_reduction: float = 0.0
    supplier_price_reduced_at: Optional[str] = None

class BulkMotorcycleItem(BaseModel):
    mileage: int
    chassis_number: Optional[str] = None
    license_plate: Optional[str] = None

class BulkMotorcycleCreate(BaseModel):
    brand: str
    model: str
    year: int
    price: float
    color: str = ""
    condition: str = "good"
    description: str = ""
    images: List[str] = []
    motorcycles: List[BulkMotorcycleItem]


# ============ BID MODELS ============

class BidCreate(BaseModel):
    motorcycle_id: str
    amount: float

class Bid(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    motorcycle_id: str
    dealer_id: str
    dealer_company: str
    amount: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============ LICENSE PLATE MODELS ============

class LicensePlateCreate(BaseModel):
    dealer_id: str
    license_plate: str
    chassis_number: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    notes: Optional[str] = ""

class LicensePlate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dealer_id: str
    dealer_company: str
    dealer_email: str
    license_plate: str
    chassis_number: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    notes: str = ""
    document_url: Optional[str] = None
    document_filename: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============ ORDER MODELS ============

class OrderCreate(BaseModel):
    motorcycle_id: str
    notes: Optional[str] = ""
    needs_delivery: bool = False

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    motorcycle_id: str
    dealer_id: str
    dealer_email: str
    dealer_company: str
    status: str = "pending"
    notes: str = ""
    needs_delivery: bool = False
    delivery_cost: float = 0.0
    deposit_amount: float = 0.0
    total_price: float = 0.0
    payment_status: str = "unpaid"
    stripe_session_id: Optional[str] = None
    motorcycle_snapshot: Optional[dict] = None
    transport_status: str = "pending"
    transport_carrier: Optional[str] = None
    transport_tracking_number: Optional[str] = None
    transport_estimated_delivery: Optional[str] = None
    transport_notes: Optional[str] = None
    transport_updated_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OrderWithMotorcycle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    motorcycle_id: str
    dealer_id: str
    dealer_email: str = ""
    dealer_company: str = ""
    status: str = "pending"
    notes: str = ""
    needs_delivery: bool = False
    delivery_cost: float = 0.0
    needs_inspection: bool = False
    inspection_cost: float = 0.0
    needs_valuation: bool = False
    valuation_cost: float = 0.0
    needs_coc: bool = False
    coc_cost: float = 0.0
    coc_status: Optional[str] = None
    coc_supplier_name: Optional[str] = None
    coc_supplier_email: Optional[str] = None
    coc_admin_cost_chf: float = 0.0
    coc_updated_at: Optional[str] = None
    coc_pdf_filename: Optional[str] = None
    coc_pdf_uploaded_at: Optional[str] = None
    voucher_code: Optional[str] = None
    voucher_discount: float = 0.0
    deposit_amount: float = 0.0
    total_price: float = 0.0
    payment_status: str = "unpaid"
    created_at: Optional[str] = None
    motorcycle: Optional[dict] = None
    motorcycle_snapshot: Optional[dict] = None
    order_type: Optional[str] = None
    discount_amount: float = 0.0
    original_price: Optional[float] = None
    pakbon_completed: bool = False
    pakbon_completed_at: Optional[str] = None
    pakbon_completed_by: Optional[str] = None
    kentekenbewijs_url: Optional[str] = None
    payment_instructions: Optional[dict] = None
    supplier_info: Optional[dict] = None
    motorcycle_license_plate: Optional[str] = None
    archived: bool = False
    is_dealer_to_dealer: bool = False
    seller_company: Optional[str] = None
    seller_id: Optional[str] = None

class BuyNowRequest(BaseModel):
    motorcycle_id: str
    needs_delivery: bool = False
    needs_inspection: bool = False
    needs_valuation: bool = False
    needs_coc: bool = False
    voucher_code: Optional[str] = None

class TransportStatusUpdate(BaseModel):
    transport_status: str
    transport_carrier: Optional[str] = None
    transport_tracking_number: Optional[str] = None
    transport_estimated_delivery: Optional[str] = None
    transport_notes: Optional[str] = None

class AdminOrderForDealer(BaseModel):
    motorcycle_id: str
    dealer_id: str
    needs_delivery: bool = False
    needs_inspection: bool = False
    needs_valuation: bool = False


# ============ NOTIFICATION MODELS ============

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str
    title: str
    message: str
    motorcycle_id: Optional[str] = None
    is_read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============ CHAT MODELS ============

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    message: str
    is_read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ChatMessageCreate(BaseModel):
    message: str
    conversation_id: Optional[str] = None


# ============ PUSH NOTIFICATION MODELS ============

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict


# ============ VOUCHER MODELS ============

class Voucher(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    dealer_id: str
    amount: float = 250.0
    is_used: bool = False
    used_on_order_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    used_at: Optional[str] = None


# ============ PRICE PROPOSAL MODELS ============

class PriceProposalCreate(BaseModel):
    motorcycle_id: str
    proposed_price: float
    reason: str = ""
    request_inspection: bool = False
    request_appraisal: bool = False
    request_delivery: bool = False

class PriceProposal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    motorcycle_id: str
    dealer_id: str
    dealer_company: str
    dealer_email: str
    original_price: float
    proposed_price: float
    reason: str = ""
    request_inspection: bool = False
    request_appraisal: bool = False
    request_delivery: bool = False
    status: str = "pending"
    admin_response: str = ""
    counter_price: Optional[float] = None
    include_inspection: bool = False
    include_appraisal: bool = False
    include_delivery: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None


# ============ REVIEW MODELS ============

class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=10, max_length=1000)
    anonymous: bool = False

class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dealer_id: str
    dealer_company: str
    anonymous: bool = False
    rating: int
    text: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============ PRIVATE LISTING MODELS ============

class PrivateListingCreate(BaseModel):
    brand: str
    model: str
    year: int
    mileage: int
    price: float
    description: str = ""
    color: str = ""
    phone: str = ""
    email: str = ""
    city: str = ""
    name: str = ""
    photos: List[str] = []

class PrivateListing(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    user_email: str
    user_phone: str = ""
    city: str = ""
    brand: str
    model: str
    year: int
    mileage: int
    price: float
    description: str = ""
    color: str = ""
    photos: List[str] = []
    is_active: bool = False
    is_paid: bool = False
    payment_session_id: str = ""
    paid_at: Optional[str] = None
    expires_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============ WANTED REQUEST MODELS ============

class WantedRequestCreate(BaseModel):
    brand: str
    model: str = ""
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    max_mileage: Optional[int] = None
    max_budget: float
    notes: str = ""

class WantedRequestApprove(BaseModel):
    supplier_price: float
    admin_notes: str = ""

class WantedRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dealer_id: str
    dealer_company: str
    dealer_email: str
    dealer_phone: str = ""
    brand: str
    model: str = ""
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    max_mileage: Optional[int] = None
    max_budget: float
    supplier_price: Optional[float] = None
    notes: str = ""
    status: str = "pending"
    admin_notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    approved_at: Optional[str] = None
    expires_at: Optional[str] = None
    fulfilled_by: Optional[str] = None


# ============ PARTS SHOP MODELS ============

class PartCategory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PartCategoryCreate(BaseModel):
    name: str
    description: str = ""

class Part(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    price: float
    category_id: str
    category_name: str = ""
    compatible_brands: List[str] = []
    stock: int = 0
    sku: str = ""
    images: List[str] = []
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PartCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    category_id: str
    compatible_brands: List[str] = []
    stock: int = 0
    sku: str = ""
    images: List[str] = []

class PartUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category_id: Optional[str] = None
    compatible_brands: Optional[List[str]] = None
    stock: Optional[int] = None
    sku: Optional[str] = None
    images: Optional[List[str]] = None
    is_active: Optional[bool] = None

class PartOrderItem(BaseModel):
    part_id: str
    part_name: str = ""
    quantity: int
    price: float

class PartOrderCreate(BaseModel):
    items: List[PartOrderItem]
    needs_shipping: bool = True
    notes: str = ""

class PartOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str = ""
    dealer_id: str
    dealer_email: str
    dealer_company: str
    dealer_address: str = ""
    dealer_postal_code: str = ""
    dealer_city: str = ""
    dealer_phone: str = ""
    items: List[dict] = []
    subtotal: float = 0.0
    shipping_cost: float = 0.0
    total: float = 0.0
    status: str = "pending"
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    paid_at: Optional[str] = None


# ============ AUTH REQUEST MODELS ============

class NotificationAutoLogin(BaseModel):
    token: str

class EmailPreferences(BaseModel):
    receive_price_alerts: bool = True
    receive_order_updates: bool = True
    receive_new_motorcycles: bool = True

class PermanentLoginRequest(BaseModel):
    token: str

class ShortCodeLoginRequest(BaseModel):
    code: str

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ============ ADMIN REQUEST MODELS ============

class CreateAdminRequest(BaseModel):
    email: str
    password: str
    company_name: str = "Moto Import Admin"

class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str

class DealerPhoneUpdate(BaseModel):
    phone: str


# ============ SMS REQUEST MODELS ============

class SMSRequest(BaseModel):
    phone_number: str
    message: str

class BulkSMSRequest(BaseModel):
    message: str

class SelectedSMSRequest(BaseModel):
    dealer_ids: List[str]
    message: str


# ============ EMAIL REQUEST MODELS ============

class BulkEmailRequest(BaseModel):
    subject: str
    html_content: str
    recipient_type: str = "dealers"
    selected_dealer_ids: Optional[List[str]] = None
    marketing_list_file: Optional[str] = None

class BulkEmailResponse(BaseModel):
    sent_count: int
    failed_count: int
    total_recipients: int

class EmailFlyerRequest(BaseModel):
    filename: str
    recipient_email: str
    recipient_name: str = "Geachte heer/mevrouw"
    custom_message: str = ""


# ============ PAYMENT MODELS ============

class PaymentRequest(BaseModel):
    motorcycle_id: str
    needs_delivery: bool = False
    order_type: str = "buy_now"
    origin_url: str


# ============ GOOGLE MOTORS MODELS ============

class GoogleMotorCreate(BaseModel):
    brand: str
    model: str
    year: int
    price: float
    mileage: int = 0
    description: str = ""
    images: List[str] = []
    color: str = ""
    condition: str = ""


# ============ TAXATIE / BPM MODELS ============

class DamageItem(BaseModel):
    name: str = ""
    checked: bool = False
    cost: float = 0
    hours: float = 0
    material_cost: float = 0

class TaxatieCreate(BaseModel):
    brand: str = ""
    model: str = ""
    bouwjaar: str = ""
    mileage: int = 0
    color: str = ""
    vin_number: str = ""
    first_registration_date: str = ""
    fuel_type: str = "Benzine"
    cylinder_capacity: str = ""
    power_kw: float = 0
    netto_catalogusprijs: float = 0
    consumentenprijs: float = 0
    koerslijst_waarde: float = 0
    taxatie_inruil_waarde: float = 0
    damage_items: List[DamageItem] = []
    damage_notes: str = ""
    score_engine: int = 3
    score_frame: int = 3
    score_paint: int = 3
    score_tires: int = 3
    score_brakes: int = 3
    score_electrics: int = 3
    score_exhaust: int = 3
    score_suspension: int = 3
    score_chain_drive: int = 3
    score_general: int = 3
    notes_engine: str = ""
    notes_frame: str = ""
    notes_paint: str = ""
    notes_tires: str = ""
    notes_brakes: str = ""
    notes_electrics: str = ""
    notes_general: str = ""
    customer_name: str = ""
    customer_phone: str = ""
    customer_email: str = ""
    customer_address: str = ""
    photos: List[str] = []
    notes: str = ""
