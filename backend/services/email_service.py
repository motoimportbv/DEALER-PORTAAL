# Email Service
# Gmail SMTP email verzending

import smtplib
import asyncio
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from config import (
    GMAIL_EMAIL, GMAIL_APP_PASSWORD, 
    ADMIN_EMAILS_FULL, ADMIN_EMAILS_DEALER_MOTO,
    EMAIL_FOOTER_DEALER, EMAIL_FOOTER_SUPPLIER
)

logger = logging.getLogger(__name__)


async def send_email(to_email: str, subject: str, html_content: str, cc: list = None) -> bool:
    """Send email via Gmail SMTP. Optional cc list."""
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Moto Import <{GMAIL_EMAIL}>"
        msg['To'] = to_email
        
        cc_list = [c for c in (cc or []) if c and c != to_email]
        if cc_list:
            msg['Cc'] = ", ".join(cc_list)
        recipients = [to_email] + cc_list
        
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        def send_sync():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
                server.sendmail(GMAIL_EMAIL, recipients, msg.as_string())
        
        await asyncio.to_thread(send_sync)
        logger.info(f"Email sent to {to_email}{' (cc: ' + ', '.join(cc_list) + ')' if cc_list else ''}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False


async def send_email_with_attachment(to_email: str, subject: str, html_content: str, attachment_path: str = None) -> bool:
    """Send email with optional attachment via Gmail SMTP"""
    try:
        msg = MIMEMultipart('mixed')
        msg['Subject'] = subject
        msg['From'] = f"Moto Import <{GMAIL_EMAIL}>"
        msg['To'] = to_email
        
        # Add HTML content
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Add attachment if provided
        if attachment_path:
            with open(attachment_path, 'rb') as f:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(f.read())
            encoders.encode_base64(part)
            filename = attachment_path.split('/')[-1]
            part.add_header('Content-Disposition', f'attachment; filename= {filename}')
            msg.attach(part)
        
        def send_sync():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
                server.sendmail(GMAIL_EMAIL, to_email, msg.as_string())
        
        await asyncio.to_thread(send_sync)
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email with attachment: {str(e)}")
        return False


async def send_admin_notification(subject: str, html_content: str, include_limited_admin: bool = False):
    """Send email notification to admin email addresses
    
    Args:
        subject: Email subject
        html_content: HTML email body
        include_limited_admin: If True, also sends to limited admin
                              Only use for: new dealer registrations and new motorcycles
    """
    # Determine which admins to notify
    if include_limited_admin:
        admin_list = ADMIN_EMAILS_DEALER_MOTO  # All 3 admins
    else:
        admin_list = ADMIN_EMAILS_FULL  # Only main admins
    
    for admin_email in admin_list:
        try:
            await send_email(admin_email, subject, html_content)
            logger.info(f"Admin notification sent to {admin_email}")
        except Exception as e:
            logger.error(f"Failed to send admin notification to {admin_email}: {e}")
