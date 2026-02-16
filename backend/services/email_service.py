# Email service - Gmail SMTP utilities

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# Gmail Config
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')
GMAIL_EMAIL = os.environ.get('GMAIL_EMAIL', '')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')


async def send_email(to_email: str, subject: str, html_content: str, bcc_admin: bool = True):
    """Send email via Gmail SMTP"""
    if not GMAIL_EMAIL or not GMAIL_APP_PASSWORD:
        logger.warning("Gmail credentials not configured")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = GMAIL_EMAIL
        msg['To'] = to_email
        
        recipients = [to_email]
        if bcc_admin and ADMIN_EMAIL and ADMIN_EMAIL != to_email:
            recipients.append(ADMIN_EMAIL)
        
        msg.attach(MIMEText(html_content, 'html'))
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_EMAIL, recipients, msg.as_string())
        
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


async def send_admin_notification(subject: str, html_content: str):
    """Send notification email to admin only"""
    if not ADMIN_EMAIL:
        logger.warning("Admin email not configured")
        return False
    
    return await send_email(ADMIN_EMAIL, subject, html_content, bcc_admin=False)
