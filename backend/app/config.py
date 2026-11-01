import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'swarm.db'}")

# "local" = SQLite stand-in for Meko (demo only). "real" = Meko's MCP server, see meko_backends.RealMeko.
MEKO_BACKEND = os.getenv("MEKO_BACKEND", "local")
MEKO_LOCAL_PATH = os.getenv("MEKO_LOCAL_PATH", str(BASE_DIR / "meko_local.db"))
MEKO_API_KEY = os.getenv("MEKO_API_KEY", "")  # mko_tkn_..., from the Meko portal: Settings > API Keys
MEKO_MCP_URL = os.getenv("MEKO_MCP_URL", "https://mcp.mekodata.ai/mcp")
MEKO_DATAPACK_PREFIX = os.getenv("MEKO_DATAPACK_PREFIX", "gs-")
MEKO_MIN_SCORE = float(os.getenv("MEKO_MIN_SCORE", "0.35"))  # Meko similarity below this is unrelated
MEKO_INDEX_PATH = os.getenv("MEKO_INDEX_PATH", str(BASE_DIR / "meko_index.db"))

# Staff sign-up needs this code, so nobody can sign themselves up as a warden or dean. Change it per deployment.
STAFF_SIGNUP_CODE = os.getenv("STAFF_SIGNUP_CODE", "campus-staff")
# Seeded demo accounts (see seed.py) use this password and are listed on the sign-in page.
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "demo1234")
DEMO_ACCOUNTS = os.getenv("DEMO_ACCOUNTS", "true").lower() == "true"

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen3:8b")
LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
# Optional, for hosts whose URL isn't known in advance (e.g. "https://.*\.onrender\.com" on Render).
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX") or None
