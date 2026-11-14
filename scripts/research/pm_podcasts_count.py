"""REI-265: parse and count the podcast-only Exa results.

Parses each episode's `text` (header fields + transcript turns with speaker
and timestamps), maps each highlight back to the transcript turn it came
from, and counts skill mentions with the patterns in pm_skills_count.py.
Writes research-cache/pm-skills-podcast-counts.json.
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pm_skills_count import AREAS, PAT  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "research-cache" / "pm-skills-podcasts.json"
OUT = ROOT / "research-cache" / "pm-skills-podcast-counts.json"
FIELD = re.compile(r"^- \*\*(\w+):\*\* (.+)$", re.M)
TURN = re.compile(r"^\*\*(.+?) · (\d+:\d+(?::\d+)?\.\d+)–(\d+:\d+(?::\d+)?\.\d+)\*\*\n\n(.*?)(?=\n\n\*\*.+? · \d|\Z)", re.M | re.S)
LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
# Hand labels for the tuned queries: indexes (0-9) of results judged on topic after reading
# the title and highlight. Keyword patterns miss many of these, so both are reported.
TUNED_ON_TOPIC = {
    "tuned:eng_design_collab:1": [0],
    "tuned:eng_design_collab:2": [0, 1, 2, 3, 4, 5, 6],
    "tuned:eng_design_collab:3": [0, 1, 2, 3, 5, 8, 9],
    "tuned:eng_design_collab:4": [0, 1, 2, 7],
    "tuned:eng_design_collab:5": [1, 3, 4],
    "tuned:ai_product_sense:1": [0, 1, 2, 4, 5, 9],
    "tuned:ai_product_sense:2": [0, 1, 2, 3, 5, 8],
    "tuned:ai_product_sense:3": [1, 2, 3, 4, 5, 6, 7, 8],
    "tuned:ai_product_sense:4": [1, 2, 3, 4, 5, 6, 7],
    "tuned:ai_product_sense:5": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
}
SUBSTANTIVE = 5  # area pattern matches in the transcript to call an episode "about" the area


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def parse(text):
    head, _, body = text.partition("## Transcript")
    fields = {k: LINK.sub(r"\1", v).strip() for k, v in FIELD.findall(head)}
    turns = [(sp, a, b, norm(t)) for sp, a, b, t in TURN.findall(body.strip() + "\n")]
    return fields, turns


def locate(highlight, turns):
    """Return (speaker, start) of the turn holding the start of the highlight."""
    h = norm(highlight)
    for probe in (h[:80], h[:40], h[20:60]):
        for sp, a, _b, t in turns:
            if probe and probe in t:
                return sp, a
    return None, None


def main():
    c = json.loads(CACHE.read_text())
    episodes, field_counts, speaker_unknown, turns_total = {}, Counter(), 0, 0
    per_level = defaultdict(lambda: defaultdict(set))
    on_topic = defaultdict(lambda: {"area": set(), "mistakes": set()})
    located = [0, 0]
    out_of_window = 0
    tuned = {}
    for qid, q in c["queries"].items():
        if q["kind"] == "tuned":
            res = q["response"]["results"]
            tuned[qid] = {
                "query": q["query"], "area": q["area"],
                "keyword_hits": sum(bool(PAT[q["area"]].search(r["title"] + "\n" + "\n".join(r.get("highlights", []))))
                                    for r in res),
                "on_topic_by_hand": len(TUNED_ON_TOPIC.get(qid, [])),
                "results": [{"title": r["title"], "url": r["url"], "date": r["publishedDate"][:10],
                             "on_topic": i in TUNED_ON_TOPIC.get(qid, []),
                             "passages": [dict(zip(("speaker", "start"), locate(h, parse(r.get("text", ""))[1])))
                                          for h in r.get("highlights", [])]}
                            for i, r in enumerate(res)],
            }
            continue
        for r in q["response"]["results"]:
            text = r.get("text", "")
            fields, turns = parse(text)
            if r["url"] not in episodes:
                field_counts.update(fields.keys())
                field_counts["_transcript_turns"] += bool(turns)
                speaker_unknown += sum(sp.startswith("Unidentified Speaker") for sp, *_ in turns)
                turns_total += len(turns)
                if not ("2025-11-14" <= r["publishedDate"][:10] <= "2026-11-14"):
                    out_of_window += 1
            passages = []
            for h in r.get("highlights", []):
                sp, ts = locate(h, turns)
                located[0] += 1
                located[1] += ts is not None
                passages.append({"speaker": sp, "start": ts, "text": norm(h)})
            hl = r["title"] + "\n" + "\n".join(r.get("highlights", []))
            hits = sorted(k for k, p in PAT.items() if p.search(hl))
            density = {a: len(PAT[a].findall(text)) for a in AREAS}
            ep = episodes.setdefault(r["url"], {
                "title": r["title"], "date": r["publishedDate"][:10], "show": fields.get("Podcast"),
                "hosts": fields.get("Hosts"), "guests": fields.get("Guests"),
                "duration": fields.get("Duration"), "density": density, "queries": [], "passages": {}})
            ep["queries"].append(qid)
            ep["passages"][qid] = passages
            if q["kind"] == "level":
                for k in hits:
                    per_level[q["level"]][k].add(r["url"])
            else:
                if q["area"] in hits:
                    on_topic[q["area"]][q["kind"]].add(r["url"])
    substantive = {a: sorted(u for u, e in episodes.items() if e["density"][a] >= SUBSTANTIVE) for a in AREAS}
    out = {
        "calls": c["calls"], "episodes": len(episodes), "out_of_window": out_of_window,
        "field_counts": dict(field_counts), "turns_total": turns_total, "speaker_unknown": speaker_unknown,
        "highlights_located": located,
        "per_level": {lv: {k: len(v) for k, v in s.items()} for lv, s in per_level.items()},
        "on_topic": {a: {k: len(v) for k, v in d.items()} for a, d in on_topic.items()},
        "substantive": {a: len(v) for a, v in substantive.items()},
        "episodes_detail": episodes,
        "tuned": tuned,
    }
    OUT.write_text(json.dumps(out, indent=1))
    print({k: v for k, v in out.items() if k not in ("episodes_detail", "per_level", "on_topic", "substantive")})
    print(f"{'skill':20} jun mid sen (of 20)")
    for k in PAT:
        print(f"{k:20} " + " ".join(f"{out['per_level'][lv].get(k, 0):3}" for lv in ("junior", "mid", "senior")))
    print("\narea: on-topic (area q, mistakes q, of 10 each) | episodes with >=5 mentions in transcript (of all)")
    for a in AREAS:
        d = out["on_topic"].get(a, {})
        print(f"{a:20} {d.get('area', 0):3} {d.get('mistakes', 0):3} | {out['substantive'][a]}")
    print("\ntuned queries: on topic by hand / keyword hits (of 10)")
    for qid, d in tuned.items():
        print(f"{qid:28} {d['on_topic_by_hand']:2} / {d['keyword_hits']:2}  {d['query']}")


if __name__ == "__main__":
    main()
