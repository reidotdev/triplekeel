"""REI-265: count skill mentions in the cached Exa results.

The skill list and patterns below were written by hand after reading the
results. Each result counts once per skill per level (deduped by URL).
Writes research-cache/pm-skills-counts.json.
"""

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "research-cache" / "pm-skills-exa.json"
OUT = ROOT / "research-cache" / "pm-skills-counts.json"

# Draft areas first, then candidate new areas.
SKILLS = {
    "problem_discovery": r"user research|customer interview|interview(?:ing)? (?:users|customers)|discovery|talk(?:ing)? to (?:users|customers)|problem statement|jobs[- ]to[- ]be[- ]done|\bJTBD\b|usability test",
    "specs": r"\bPRDs?\b|product requirements|\bspecs?\b|specification|user stor(?:y|ies)|acceptance criteria|requirements doc",
    "prioritization": r"prioriti[sz]|roadmap|backlog|trade-?offs?|\bRICE\b|say(?:ing)? no\b",
    "metrics": r"metrics?\b|\bKPIs?\b|A/B test|experiment|analytics|\bSQL\b|data analysis|data-driven|north star|\bOKRs?\b",
    "eng_design_collab": r"engineer(?:s|ing)? (?:and|&) design|design(?:ers?)? (?:and|&) engineer|cross-functional|work(?:ing)? (?:closely )?with (?:engineering|engineers|design)|sprint|\bagile\b|\bscrum\b|product trio",
    "stakeholder_comms": r"stakeholder|alignment|\balign\b|influenc|executive|leadership team|status update|communicat",
    "ai_prototyping": r"prototyp|vibe[- ]?cod|\bCursor\b|Lovable|\bv0\b|\bBolt\b|Replit|Claude Code|\bCodex\b|build(?:ing)? with AI",
    "ai_product_sense": r"\bLLMs?\b|\bevals?\b|evaluation|hallucinat|guardrail|\bRAG\b|non-?determinis|model (?:quality|behavio|cost)|AI[- ]powered|AI features?|agentic",
    "go_to_market": r"go-to-market|\bGTM\b|launch|positioning|pricing|sales enablement|marketing",
    "strategy": r"strateg|\bvision\b",
    # candidate new areas
    "ai_workflow": r"AI (?:tools?|assistants?|agents?) (?:to|for|in) (?:their|my|your|the) (?:work|job|day|workflow)|use[sd]? (?:Claude|ChatGPT|Copilot|Codex|Gemini) (?:to|for)|AI[- ]native|\bautomat|context (?:file|engineering)|custom GPT|\bskills? file|Team OS|AI workflow|second brain",
    "business_outcomes": r"business (?:impact|outcomes?|value|model|acumen)|revenue|\bP&L\b|\bROI\b|unit economics|commercial|outcomes? over output|value for the (?:customer|business)",
    "technical_fluency": r"technical (?:fluency|depth|understanding|background|skills)|\bAPIs?\b|architecture|system design|data pipeline|\bcode\b|coding",
    "judgment_taste": r"\bjudg(?:e)?ment\b|\btaste\b|product sense|intuition|decision[- ]making|first principles|critical thinking",
    "ownership_agency": r"ownership|high[- ]agency|\bagency\b|\bowns?\b|accountab|bias (?:for|to) action",
    "leadership_coaching": r"mentor|coach(?:ing)? (?:other|junior|PMs|the team)|hiring|grow(?:ing)? (?:the|a) team|people manage|manag(?:e|ing) (?:other )?PMs|develop(?:ing)? (?:other|junior) PMs",
    "delivery_execution": r"\bdeliver(?:y|ing)?\b|execution|\bship(?:s|ping|ped)?\b|release|\bQA\b|quality assurance|go[- ]live",
    "ai_governance": r"responsible AI|AI governance|compliance|\bprivacy\b|safety|\brisk\b|regulat|security",
    "customer_feedback": r"customer feedback|user feedback|support tickets|feedback loop|voice of (?:the )?customer|\bNPS\b|churn",
}
PAT = {k: re.compile(v, re.I) for k, v in SKILLS.items()}
AREAS = list(SKILLS)[:10]


def main():
    c = json.loads(CACHE.read_text())
    per_level = defaultdict(lambda: defaultdict(set))       # level -> skill -> urls
    level_wide = defaultdict(lambda: defaultdict(set))      # podcast + jobs only
    by_kind = defaultdict(lambda: defaultdict(set))         # kind -> skill -> urls
    level_urls = defaultdict(set)
    on_topic = defaultdict(lambda: defaultdict(lambda: {"how": set(), "mistakes": set()}))
    results = {}
    for qid, q in c["queries"].items():
        lvl, kind = q["level"], q["kind"]
        for r in q["response"]["results"]:
            text = r["title"] + "\n" + "\n".join(r.get("highlights", []))
            hits = {k for k, p in PAT.items() if p.search(text)}
            level_urls[lvl].add(r["url"])
            results.setdefault(r["url"], {"title": r["title"], "date": r.get("publishedDate", "")[:10],
                                          "skills": sorted(hits), "queries": []})["queries"].append(qid)
            for k in hits:
                per_level[lvl][k].add(r["url"])
                by_kind[kind][k].add(r["url"])
                if kind in ("podcast", "jobs"):
                    level_wide[lvl][k].add(r["url"])
            if kind in ("how", "mistakes") and q["area"] in hits:
                on_topic[q["area"]][lvl][kind].add(r["url"])
    out = {
        "calls": c["calls"],
        "unique_urls": len(results),
        "level_result_counts": {l: len(u) for l, u in level_urls.items()},
        "per_level": {l: {k: len(v) for k, v in s.items()} for l, s in per_level.items()},
        "level_wide": {l: {k: len(v) for k, v in s.items()} for l, s in level_wide.items()},
        "by_kind": {kd: {k: len(v) for k, v in s.items()} for kd, s in by_kind.items()},
        "on_topic": {a: {l: {kd: len(v) for kd, v in d.items()} for l, d in lv.items()} for a, lv in on_topic.items()},
        "results": results,
    }
    OUT.write_text(json.dumps(out, indent=1))
    skills = list(SKILLS)
    print(f"calls {out['calls']}, unique urls {out['unique_urls']}, per level {out['level_result_counts']}")
    print(f"{'skill':20} {'jun':>4} {'mid':>4} {'sen':>4} | wide j/m/s (of ~30) | pod  job  how  mis")
    for k in skills:
        pl = [out["per_level"][l].get(k, 0) for l in ("junior", "mid", "senior")]
        lw = [out["level_wide"][l].get(k, 0) for l in ("junior", "mid", "senior")]
        bk = [out["by_kind"][kd].get(k, 0) for kd in ("podcast", "jobs", "how", "mistakes")]
        print(f"{k:20} {pl[0]:4} {pl[1]:4} {pl[2]:4} | {lw[0]:3} {lw[1]:3} {lw[2]:3}          | " + " ".join(f"{x:4}" for x in bk))
    print("\non-topic results from the area's own queries (how/mistakes, of 10 each)")
    for a in AREAS:
        print(a, {l: (d["how"], d["mistakes"]) for l, d in out["on_topic"][a].items()})


if __name__ == "__main__":
    main()
