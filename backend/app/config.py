import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'swarm.db'}")

# "local" = SQLite stand-in for Meko (demo only). "real" = the Meko SDK, see meko_backends.RealMeko.
MEKO_BACKEND = os.getenv("MEKO_BACKEND", "local")
MEKO_LOCAL_PATH = os.getenv("MEKO_LOCAL_PATH", str(BASE_DIR / "meko_local.db"))
MEKO_API_KEY = os.getenv("MEKO_API_KEY", "")

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen3:8b")
LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
