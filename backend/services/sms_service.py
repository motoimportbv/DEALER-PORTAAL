# SMS Service
# Twilio SMS integration

import logging
from twilio.rest import Client as TwilioClient
from config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

logger = logging.getLogger(__name__)

# Initialize Twilio client
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logger.info("Twilio client initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize Twilio client: {e}")


async def send_sms(phone_number: str, message: str) -> dict:
    """Send SMS via Twilio"""
    if not twilio_client:
        return {"success": False, "error": "Twilio not configured"}
    
    try:
        # Clean phone number
        clean_number = phone_number.strip()
        if not clean_number.startswith('+'):
            # Assume Dutch number if no country code
            if clean_number.startswith('0'):
                clean_number = '+31' + clean_number[1:]
            else:
                clean_number = '+31' + clean_number
        
        # Send message
        message_obj = twilio_client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=clean_number
        )
        
        logger.info(f"SMS sent to {clean_number}: {message_obj.sid}")
        return {
            "success": True,
            "sid": message_obj.sid,
            "status": message_obj.status
        }
    except Exception as e:
        logger.error(f"Failed to send SMS to {phone_number}: {e}")
        return {"success": False, "error": str(e)}


def is_twilio_configured() -> bool:
    """Check if Twilio is properly configured"""
    return twilio_client is not None
