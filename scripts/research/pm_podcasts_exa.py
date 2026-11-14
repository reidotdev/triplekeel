"""REI-265: run podcast-only Exa queries for the product manager track.

Podcast-only setup (from pm_podcast_probe.py): Exa Search with
includeDomains ["exa.ai/library/podcast"] and the 12-month date window.
`highlights` gives the passage; `text` gives the transcript with speaker
labels and timestamps. Caches raw results in
research-cache/pm-skills-podcasts.json and skips cached queries.
"""

import json
import sys
import time
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent))
from pm_skills_exa import AREAS, END, LEVELS, START, post  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "research-cache" / "pm-skills-podcasts.json"
MAX_NEW_CALLS = 40
OBJECTIVE = (
    "Find podcast episodes where product managers or product leaders discuss {topic}. "
    "Rank episodes that spend real time on this topic first. Pull the skills, "
    "practices and mistakes the speakers name."
)


def build_queries():
    areas = yaml.safe_load(AREAS.read_text())["areas"]
    out = []
    for key, word in LEVELS.items():
        for qid, q in (("next_level", f"what separates a {word} product manager from the next level"),
                       ("ai_tools", f"how {word} product managers use AI tools in their work")):
            out.append({"id": f"{key}:{qid}", "level": key, "kind": "level", "query": q})
    for a in areas:
        name = a["name"][0].lower() + a["name"][1:]
        out.append({"id": f"area:{a['id']}", "area": a["id"], "kind": "area",
                    "query": f"product managers talking about {name}"})
        out.append({"id": f"mistakes:{a['id']}", "area": a["id"], "kind": "mistakes",
                    "query": f"mistakes product managers make with {name}"})
    return out


def main():
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {"calls": 0, "queries": {}}
    new = 0
    for q in build_queries():
        if q["id"] in cache["queries"]:
            continue
        if new >= MAX_NEW_CALLS:
            sys.exit("call budget reached")
        body = {
            "query": q["query"],
            "objective": OBJECTIVE.format(topic=q["query"]),
            "type": "auto",
            "includeDomains": ["exa.ai/library/podcast"],
            "startPublishedDate": START,
            "endPublishedDate": END,
            "contents": {"highlights": True, "text": True},
        }
        status, resp = post(body)
        new += 1
        cache["calls"] += 1
        if status != 200:
            sys.exit(f"{q['id']}: HTTP {status}: {str(resp)[:300]}")
        cache["queries"][q["id"]] = {**q, "request": body, "response": resp,
                                     "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        CACHE.write_text(json.dumps(cache))
        res = resp.get("results", [])
        print(f"{cache['calls']:3d} {q['id']}: {len(res)} results, "
              f"{sum('exa.ai/library/podcast' in r['url'] for r in res)} episodes")
    print(f"podcast calls: {cache['calls']}")


if __name__ == "__main__":
    main()
