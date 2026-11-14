"""REI-265: run the Exa skills check queries for the product manager track.

Reads tracks/product-manager/skill-areas.yaml, runs Exa /search for each
query, and caches raw results in research-cache/pm-skills-exa.json.
Cached queries are skipped on rerun. Needs EXA_API_KEY. Never prints it.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "research-cache" / "pm-skills-exa.json"
AREAS = ROOT / "tracks" / "product-manager" / "skill-areas.yaml"
START, END = "2025-11-14T00:00:00.000Z", "2026-11-14T23:59:59.000Z"
LEVELS = {"junior": "junior", "mid": "mid-level", "senior": "senior"}
MAX_CALLS = 300

OBJ_PODCAST = (
    "Find podcast episodes, episode transcripts and show notes where product "
    "leaders talk about {topic}. Rank podcast and interview content first; "
    "exclude job ads and course sales pages. Pull the specific skills, "
    "behaviours and tools named."
)
OBJ_JOBS = (
    "Find real {level} product manager job postings from 2026. Rank job "
    "postings and job descriptions first; exclude salary guides and generic "
    "career advice. Pull the listed responsibilities and required skills."
)
OBJ_AREA = (
    "Find recent articles, newsletters and talks from practising product "
    "managers about {topic}. Rank first-hand practitioner writing first; "
    "exclude SEO listicles and course sales pages. Pull the concrete "
    "practices, skills and mistakes named."
)


def build_queries():
    data = yaml.safe_load(AREAS.read_text())
    out = []
    for key, word in LEVELS.items():
        out.append({"id": f"{key}:podcast:next_level", "level": key, "kind": "podcast",
                    "query": f"podcast: what separates a {word} product manager from the next level",
                    "objective": OBJ_PODCAST.format(topic=f"what separates a {word} PM from the next level")})
        out.append({"id": f"{key}:podcast:ai_tools", "level": key, "kind": "podcast",
                    "query": f"podcast: how {word} product managers use AI tools in their work",
                    "objective": OBJ_PODCAST.format(topic=f"how {word} PMs use AI tools in their work")})
        out.append({"id": f"{key}:jobs", "level": key, "kind": "jobs",
                    "query": f"{word} product manager job responsibilities 2026 job posting",
                    "objective": OBJ_JOBS.format(level=word)})
        for area in data["areas"]:
            how, mistakes = area["levels"][key]["exa_queries"]
            out.append({"id": f"{key}:how:{area['id']}", "level": key, "kind": "how",
                        "area": area["id"], "query": how,
                        "objective": OBJ_AREA.format(topic=how)})
            out.append({"id": f"{key}:mistakes:{area['id']}", "level": key, "kind": "mistakes",
                        "area": area["id"], "query": mistakes,
                        "objective": OBJ_AREA.format(topic=mistakes)})
    return out


def post(body):
    """POST /search. Returns (HTTP status, JSON body). Retries network errors and 5xx."""
    req = urllib.request.Request(
        "https://api.exa.ai/search",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-api-key": os.environ["EXA_API_KEY"]},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            if e.code < 500:
                return e.code, {"error": e.read().decode(errors="replace")[:2000]}
            print(f"  retry {attempt + 1}: HTTP {e.code}", file=sys.stderr)
        except Exception as e:  # network error; never print headers
            print(f"  retry {attempt + 1}: {type(e).__name__}", file=sys.stderr)
        time.sleep(2**attempt)
    raise RuntimeError("Exa request failed after retries")


def search(q):
    body = {
        "query": q["query"],
        "objective": q["objective"],
        "type": "auto",
        "startPublishedDate": START,
        "endPublishedDate": END,
        "contents": {"highlights": True},
    }
    status, resp = post(body)
    if status != 200:
        raise RuntimeError(f"failed: {q['id']}: HTTP {status}")
    return body, resp


def main():
    if not os.environ.get("EXA_API_KEY"):
        sys.exit("EXA_API_KEY is not set")
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {"calls": 0, "queries": {}}
    for q in build_queries():
        if q["id"] in cache["queries"]:
            continue
        if cache["calls"] >= MAX_CALLS:
            sys.exit("call budget reached")
        body, resp = search(q)
        cache["calls"] += 1
        cache["queries"][q["id"]] = {**q, "request": body, "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                     "response": resp}
        print(f"{cache['calls']:3d} {q['id']}: {len(resp.get('results', []))} results")
        CACHE.parent.mkdir(exist_ok=True)
        CACHE.write_text(json.dumps(cache, indent=1))
    print(f"total Exa calls: {cache['calls']}")


if __name__ == "__main__":
    main()
