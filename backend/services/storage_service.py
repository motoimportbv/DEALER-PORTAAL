# Storage Service
# Emergent Object Storage integration

import logging
import requests
from config import STORAGE_URL, EMERGENT_KEY, APP_NAME

logger = logging.getLogger(__name__)

# Module-level storage key
storage_key = None


def init_storage():
    """Initialize Emergent Object Storage - call once at startup"""
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY not set - cloud storage disabled")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Emergent Object Storage initialized successfully")
        return storage_key
    except Exception as e:
        logger.error(f"Failed to initialize storage: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload file to Emergent Object Storage"""
    key = init_storage()
    if not key:
        raise Exception("Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple:
    """Download file from Emergent Object Storage"""
    key = init_storage()
    if not key:
        raise Exception("Storage not initialized")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def get_public_url(path: str) -> str:
    """Get public URL for an object"""
    key = init_storage()
    if not key:
        return None
    return f"{STORAGE_URL}/objects/{path}?key={key}"
