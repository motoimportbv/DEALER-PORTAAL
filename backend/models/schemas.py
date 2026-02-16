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
    country: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============ MOTORCYCLE MODELS ============

class MotorcycleCreate(BaseModel):
    brand: str
    model: str
    year: int
    price: float
    starting_price: Optional[float] = None
    mileage: int = 0
    color: str = ""
    description: str = ""
    condition: str = "good"
    images: List[str] = []
    auction_duration_hours: int = 3


class MotorcycleUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    price: Optional[float] = None
    starting_price: Optional[float] = None
    mileage: Optional[int] = None
    color: Optional[str] = None
    description: Optional[str] = None
    condition: Optional[str] = None
    images: Optional[List[str]] = None
    is_available: Optional[bool] = None


class Motorcycle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    brand: str
    model: str
    year: int
    price: float
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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: str = ""
    is_dealer_listing: bool = False
    seller_company: Optional[str] = None
    seller_id: Optional[str] = None
    listing_fee_invoiced: bool = False
    is_foreign_listing: bool = False
    is_pending_approval: bool = False
    foreign_dealer_id: Optional[str] = None
    foreign_dealer_company: Optional[str] = None
    original_price: Optional[float] = None


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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class OrderWithMotorcycle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    motorcycle_id: str
    dealer_id: str
    dealer_email: str
    dealer_company: str
    status: str
    notes: str = ""
    needs_delivery: bool = False
    delivery_cost: float = 0.0
    deposit_amount: float = 0.0
    total_price: float = 0.0
    payment_status: str = "unpaid"
    created_at: str
    motorcycle: Optional[dict] = None


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


# ============ PARTS SHOP MODELS ============

MOTORCYCLE_BRANDS = ["Yamaha", "Honda", "Kawasaki", "Ducati", "Triumph", "KTM", "Suzuki", "BMW"]


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
