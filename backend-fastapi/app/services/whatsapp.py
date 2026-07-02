import os
import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

async def send_whatsapp_message(phone: str, text: str) -> bool:
    """
    Send a WhatsApp message using Evolution API.
    Phone must be in international format with country code, e.g., '5511999999999'.
    """
    if not settings.EVOLUTION_API_KEY:
        logger.warning("Evolution API Key not set. Simulating WhatsApp message send.")
        logger.info(f"Mock WhatsApp -> {phone}: {text}")
        return True

    url = f"{settings.EVOLUTION_API_URL}/message/sendText/{settings.EVOLUTION_INSTANCE}"
    
    headers = {
        "apikey": settings.EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }

    # Format phone number for Evolution API (needs remoteJid format)
    # Removing +, -, (, ), and spaces
    clean_phone = "".join(filter(str.isdigit, phone))
    remote_jid = f"{clean_phone}@s.whatsapp.net"

    payload = {
        "number": remote_jid,
        "text": text,
        "delay": 1200 # slightly delay to simulate human typing
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            logger.info(f"WhatsApp message sent to {phone} successfully.")
            return True
    except Exception as e:
        logger.error(f"Failed to send WhatsApp message to {phone}: {str(e)}")
        return False
