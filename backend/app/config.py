import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
MODEL = os.getenv("OPENROUTER_MODEL", "").strip()
BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").strip().rstrip("/")
REPUTATION_KEY = os.getenv("SAFE_BROWSING_API_KEY", "").strip()
AI_CONFIGURED = bool(API_KEY and MODEL and BASE_URL.startswith("https://"))
MAX_IMAGE = 5 * 1024 * 1024
ALLOWED_ORIGINS = frozenset(filter(None, (
    origin.strip() for origin in os.getenv(
        "SCAMSHIELD_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
)))
