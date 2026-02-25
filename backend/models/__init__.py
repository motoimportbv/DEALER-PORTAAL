# Models module
# Exports all models for easy importing

from models.schemas import (
    # User models
    UserCreate,
    SupplierCreate,
    UserLogin,
    User,
    
    # Motorcycle models
    MotorcycleCreate,
    MotorcycleUpdate,
    Motorcycle,
    BulkMotorcycleItem,
    BulkMotorcycleCreate,
    
    # Bid models
    BidCreate,
    Bid,
    
    # License plate models
    LicensePlateCreate,
    LicensePlate,
    
    # Order models
    OrderCreate,
    Order,
    OrderWithMotorcycle,
    BuyNowRequest,
    
    # Notification models
    Notification,
    
    # Chat models
    ChatMessage,
    ChatMessageCreate,
    
    # Push notification models
    PushSubscription,
    
    # Voucher models
    Voucher,
    
    # Price proposal models
    PriceProposalCreate,
    PriceProposal,
    
    # Wanted request models
    WantedRequestCreate,
    WantedRequestApprove,
    WantedRequest,
    
    # Parts models
    PartCategory,
    PartCategoryCreate,
    Part,
    PartCreate,
    PartUpdate,
    PartOrderItem,
    PartOrderCreate,
    PartOrder,
    
    # Auth request models
    NotificationAutoLogin,
    PermanentLoginRequest,
    ShortCodeLoginRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    ChangePasswordRequest,
    
    # Admin request models
    CreateAdminRequest,
    ResetPasswordRequest,
    DealerPhoneUpdate,
    
    # SMS request models
    SMSRequest,
    BulkSMSRequest,
    SelectedSMSRequest,
    
    # Email request models
    BulkEmailRequest,
    BulkEmailResponse,
    
    # Payment models
    PaymentRequest,
)
