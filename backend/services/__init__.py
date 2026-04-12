# Services module
# Exports all services for easy importing

from services.auth_service import (
    hash_password,
    verify_password,
    create_token,
    create_notification_token,
    create_permanent_login_token,
    decode_token,
    get_current_user,
    get_optional_user,
    require_admin,
    require_pakbon,
    require_approved_dealer,
    require_foreign_dealer,
    generate_short_code,
    security,
    security_optional
)

from services.email_service import (
    send_email,
    send_email_with_attachment,
    send_admin_notification
)

from services.sms_service import (
    send_sms,
    is_twilio_configured,
    twilio_client
)

from services.storage_service import (
    init_storage,
    put_object,
    get_object,
    get_public_url
)

from services.currency_service import (
    get_chf_eur_margin,
    set_chf_eur_margin,
    get_chf_to_eur_rate,
    convert_chf_to_eur_with_margin,
    convert_chf_to_eur,
    DEFAULT_CHF_EUR_MARGIN
)
