"""REI-265 / REI-248: probe how to get podcast-only results from Exa Search.

Runs one query three ways and caches raw responses in
research-cache/podcast-probe.json. Needs EXA_API_KEY. Never prints it.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pm_skills_exa import END, START, post  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "research-cache" / "podcast-probe.json"
QUERY = "what separates a senior product manager from the next level"
VARIANTS = {
    "a_include_domains": {"includeDomains": ["exa.ai/library/podcast"]},
    "b_category": {"category": "podcast"},
    "c_both": {"includeDomains": ["exa.ai/library/podcast"], "category": "podcast"},
}


def main():
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    for name, extra in VARIANTS.items():
        if name in cache:
            continue
        body = {"query": QUERY, "type": "auto", "startPublishedDate": START,
                "endPublishedDate": END, "contents": {"highlights": True}, **extra}
        status, resp = post(body)
        cache[name] = {"request": body, "status": status, "response": resp}
        CACHE.write_text(json.dumps(cache, indent=1))
        print(name, status)


if __name__ == "__main__":
    main()
