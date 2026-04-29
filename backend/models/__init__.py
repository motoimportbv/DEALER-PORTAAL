# Models module
# Exports all models for easy importing

from models.schemas import (
    # User models
    UserCreate, SupplierCreate, UserLogin, User,
    # Motorcycle models
    MotorcycleCreate, MotorcycleUpdate, Motorcycle,
    BulkMotorcycleItem, BulkMotorcycleCreate,
    # Bid models
    BidCreate, Bid,
    # License plate models
    LicensePlateCreate, LicensePlate,
    # Order models
    OrderCreate, Order, OrderWithMotorcycle, BuyNowRequest,
    TransportStatusUpdate, AdminOrderForDealer,
    # Notification models
    Notification,
    # Chat models
    ChatMessage, ChatMessageCreate,
    # Push notification models
    PushSubscription,
    # Voucher models
    Voucher,
    # Price proposal models
    PriceProposalCreate, PriceProposal,
    # Review models
    ReviewCreate, Review,
    # Private listing models
    PrivateListingCreate, PrivateListing,
    # Wanted request models
    WantedRequestCreate, WantedRequestApprove, WantedRequest,
    # Parts models
    PartCategory, PartCategoryCreate, Part, PartCreate, PartUpdate,
    PartOrderItem, PartOrderCreate, PartOrder,
    # Auth request models
    NotificationAutoLogin, EmailPreferences,
    PermanentLoginRequest, ShortCodeLoginRequest,
    PasswordResetRequest, PasswordResetConfirm, ChangePasswordRequest,
    # Admin request models
    CreateAdminRequest, CreateTaxateurRequest, ResetPasswordRequest, DealerPhoneUpdate,
    # SMS request models
    SMSRequest, BulkSMSRequest, SelectedSMSRequest,
    # Email request models
    BulkEmailRequest, BulkEmailResponse, EmailFlyerRequest,
    # Payment models
    PaymentRequest,
    # Google Motors models
    GoogleMotorCreate,
    # Taxatie models
    DamageItem, TaxatieCreate,
)
