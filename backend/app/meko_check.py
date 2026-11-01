"""Check the real Meko connection: `python -m app.meko_check` (needs MEKO_API_KEY in .env).

Writes one memory into the `build` datapack, searches for it, then searches for something unrelated.
"""

import time

from . import config
from .meko_backends import RealMeko


def main() -> None:
    meko = RealMeko()
    tools = meko.mcp.request("tools/list", {}).get("tools", [])
    print(f"Connected to {config.MEKO_MCP_URL}: {len(tools)} tools")
    print(f"Datapack {config.MEKO_DATAPACK_PREFIX}build: {meko.datapack_id('build')}")
    t = time.perf_counter()
    item = meko.add("build", "Connection check: router PSU on Hostel B floor 2 was replaced", {"kind": "check"})
    print(f"memory_add -> {item} ({time.perf_counter() - t:.1f}s)")
    for query in ("Hostel B router power supply", "geyser keeps tripping"):
        t = time.perf_counter()
        hits = meko.search(["build"], query, 3, {"kind": "check"}, 0.15)
        print(f"recall {query!r} -> {[(h['id'][:8], h['score']) for h in hits]} ({time.perf_counter() - t:.1f}s)")


if __name__ == "__main__":
    main()
