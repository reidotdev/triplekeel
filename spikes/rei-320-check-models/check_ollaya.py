#!/usr/bin/env python3
"""REI-320: check a decision model against the REI-247 hand labels.

Talks to any server with the TypeSafe decision API (POST /v1/systemone).
By default that's a local Ollaya server running Kev, so nothing leaves the
Mac. Uses only the Python standard library.

Usage:
  python check_ollaya.py [--model kev:0.8b] [--base http://localhost:11435]
                         [--runs N] [--only p01,p03] [--out results]

For a hosted API, pass --base and set TYPESAFE_API_KEY. Use invented
prompts only: hosted APIs send the text off the Mac.
"""

import argparse
import json
import math
import os
import statistics
import time
import urllib.error
import urllib.request
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))

# Only the follow-up habits may be n/a. The Apple run overused n/a when
# every habit allowed it.
NA_HABITS = {"specific_feedback", "vague_fix"}

KEYWORD_BASELINE = (249, 289)


def criteria_for(habit_id):
    criteria = {
        "yes": "The prompt clearly does this.",
        "partly": "The prompt does this only partly or vaguely.",
        "no": "The prompt doesn't do this.",
    }
    if habit_id in NA_HABITS:
        criteria["n/a"] = "Doesn't apply: the prompt starts something new instead of following up."
    return criteria


def build_request(model, prompt_text, habits):
    return {
        "model": model,
        "state": prompt_text,
        "questions": {
            h["id"]: {
                "type": "choice",
                "instructions": h["definition"],
                "criteria": criteria_for(h["id"]),
            }
            for h in habits
        },
    }


def post(base, path, body, timeout=120):
    headers = {"Content-Type": "application/json"}
    key = os.environ.get("TYPESAFE_API_KEY")
    if key:
        headers["Authorization"] = f"Bearer {key}"
    request = urllib.request.Request(
        base.rstrip("/") + path,
        data=json.dumps(body).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def percentile(values, p):
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, math.ceil(p * len(ordered)) - 1))
    return ordered[index]


def pct(part, whole):
    return f"{part / whole * 100:.1f}%" if whole else "–"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="kev:0.8b")
    parser.add_argument("--base", default="http://localhost:11435")
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--only", default="")
    parser.add_argument("--prompts", default=os.path.join(HERE, "../rei-247-gemma-speed/prompts.json"))
    parser.add_argument("--habits", default=os.path.join(HERE, "habits.json"))
    parser.add_argument("--out", default=os.path.join(HERE, "results"))
    args = parser.parse_args()

    with open(args.prompts) as f:
        rows = json.load(f)
    with open(args.habits) as f:
        habits = json.load(f)
    if args.only:
        wanted = {p.strip() for p in args.only.split(",")}
        rows = [r for r in rows if r["id"] in wanted]

    # Warm-up: loads the model so the first timed call doesn't include it.
    print(f"Warming up {args.model} at {args.base}…")
    start = time.perf_counter()
    try:
        post(args.base, "/v1/systemone", build_request(args.model, "Build a todo app.", habits[:1]), timeout=600)
    except urllib.error.HTTPError as e:
        print(f"Server error {e.code}: {e.read().decode(errors='replace')}")
        raise SystemExit(1)
    except urllib.error.URLError as e:
        print(f"Can't reach {args.base}: {e.reason}. Is the server running?")
        raise SystemExit(1)
    warm_ms = (time.perf_counter() - start) * 1000
    print(f"Warm-up: {warm_ms:.0f} ms. Checking {len(rows)} prompts, {args.runs} run(s).")

    calls = []
    for run in range(1, args.runs + 1):
        for i, row in enumerate(rows, 1):
            start = time.perf_counter()
            error = None
            answers = {}
            try:
                response = post(args.base, "/v1/systemone", build_request(args.model, row["text"], habits))
                answers = response.get("answers", {})
                served_by = response.get("model", args.model)
            except urllib.error.HTTPError as e:
                error = f"HTTP {e.code}: {e.read().decode(errors='replace')[:300]}"
                served_by = args.model
            except Exception as e:  # noqa: BLE001 - record and carry on
                error = repr(e)
                served_by = args.model
            ms = (time.perf_counter() - start) * 1000
            verdicts = [
                {
                    "habit": h["id"],
                    "answer": answers.get(h["id"], {}).get("choice", "missing"),
                    "confidence": answers.get(h["id"], {}).get("confidence"),
                    "probabilities": answers.get(h["id"], {}).get("probabilities"),
                }
                for h in habits
            ]
            calls.append({"run": run, "promptID": row["id"], "ms": ms, "model": served_by, "error": error, "verdicts": verdicts})
            print(f"run {run} · {i}/{len(rows)} {row['id']} · {ms:.0f} ms{' · error' if error else ''}")

    markdown = report(args, rows, habits, calls, warm_ms)
    os.makedirs(args.out, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    safe_model = args.model.replace(":", "-").replace("/", "-")
    with open(os.path.join(args.out, f"{stamp}-{safe_model}.md"), "w") as f:
        f.write(markdown)
    with open(os.path.join(args.out, f"{stamp}-{safe_model}.json"), "w") as f:
        json.dump(calls, f, indent=2, sort_keys=True)
    print(f"Saved {os.path.join(args.out, f'{stamp}-{safe_model}')}.md and .json\n")
    print(markdown)


def report(args, rows, habits, calls, warm_ms):
    expected = {r["id"]: r["expected"] for r in rows}
    strict = lenient = total = 0
    per_habit = {h["id"]: {"ok": 0, "total": 0, "fp": 0, "fn": 0} for h in habits}
    conf_right, conf_wrong = [], []
    misses = []

    for call in calls:
        for v in call["verdicts"]:
            label = expected[call["promptID"]].get(v["habit"])
            if label is None or label == "n/a":
                continue
            stats = per_habit[v["habit"]]
            total += 1
            stats["total"] += 1
            found = v["answer"] in ("yes", "partly")
            should = label in ("yes", "partly")
            if v["answer"] == label:
                strict += 1
                stats["ok"] += 1
            else:
                misses.append(f"{call['promptID']} {v['habit']}: said {v['answer']} ({v['confidence']}), label {label}")
            if found == should:
                lenient += 1
            if found and not should:
                stats["fp"] += 1
            if should and not found:
                stats["fn"] += 1
            if v["confidence"] is not None:
                (conf_right if v["answer"] == label else conf_wrong).append(v["confidence"])

    times = [c["ms"] for c in calls]
    third = max(len(times) // 3, 1)
    errors = [c["error"] for c in calls if c["error"]]
    served = sorted({c["model"] for c in calls})
    b_ok, b_total = KEYWORD_BASELINE

    out = [
        "## REI-320 decision model results",
        "",
        f"Model: {args.model} (served by {', '.join(served)}) at {args.base}. {len(rows)} prompts, {len(habits)} habits, "
        f"{args.runs} run(s). Warm-up: {warm_ms:.0f} ms. n/a allowed only for {', '.join(sorted(NA_HABITS))}.",
        "",
        "| Scorer | Strict agreement | Found vs not found | p50 ms/prompt | p95 ms/prompt | Errors |",
        "|---|---:|---:|---:|---:|---:|",
        f"| Keyword (REI-247) | {b_ok}/{b_total} ({pct(b_ok, b_total)}) | – | <1 | <8 | – |",
        f"| {args.model} | {strict}/{total} ({pct(strict, total)}) | {lenient}/{total} ({pct(lenient, total)}) | "
        f"{percentile(times, 0.5):.0f} | {percentile(times, 0.95):.0f} | {len(errors)} |",
        "",
        f"Speed over time: first third p50 {percentile(times[:third], 0.5):.0f} ms, last third p50 {percentile(times[-third:], 0.5):.0f} ms.",
        "",
        "Calibration: mean confidence "
        + (f"{statistics.mean(conf_right):.2f} when right" if conf_right else "– when right")
        + ", "
        + (f"{statistics.mean(conf_wrong):.2f} when wrong." if conf_wrong else "– when wrong."),
        "",
        "### Per habit",
        "",
        "| Habit | Correct | FP | FN |",
        "|---|---:|---:|---:|",
    ]
    for h in habits:
        s = per_habit[h["id"]]
        out.append(f"| {h['id']} | {s['ok']}/{s['total']} | {s['fp']} | {s['fn']} |")
    out += [
        "",
        "FP: the model found the habit but the label says no. FN: the label says yes or partly but the model said no or n/a.",
        "",
        f"### Misses ({len(misses)})",
        "",
    ]
    out += [f"- {m}" for m in misses[:40]] or ["None."]
    if len(misses) > 40:
        out.append(f"- … {len(misses) - 40} more in the JSON file")
    if errors:
        out += ["", "### Errors", ""] + [f"- `{e}`" for e in sorted(set(errors))[:10]]
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    main()
