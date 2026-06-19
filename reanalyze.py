#!/usr/bin/env python3
"""
Calcutta re-analysis v3 — Youche CC  (2-YEAR score history)

Pulls each player's full score history (scores/search.json, paginated) back
2 years, instead of just the WHS last-20 window. Uses 9-hole rounds via their
18-hole scaled equivalent, rejects corrupt/outlier records, and computes:

  - n_rounds (2yr), baseline_2yr (avg 18-equiv differential = true level)
  - recent_avg (last 10 rounds = current form), prior_avg (rounds 11-30)
  - trend_delta (prior_avg - recent_avg)  -> + improving / - declining
  - best_diff (lowest differential in 2yr = ceiling / potential)
  - volatility (stdev), index (live HI), low_hi (365-day low)
  - form: Improving / Stable / Declining
  - sharp: index at/near 365-day low (peaking)
"""

import json, os, statistics, time, importlib.util
from datetime import date, timedelta
from pathlib import Path

spec = importlib.util.spec_from_file_location("analyze", "analyze.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
m.load_env()
GHIN = m.GHIN_API_BASE

YEARS = 2
CUTOFF = (date.today() - timedelta(days=365 * YEARS)).isoformat()


def fetch_history(client, ghin, cutoff=CUTOFF, max_pages=8):
    """All scores back to `cutoff`, via paginated scores/search.json."""
    out = []
    for page in range(1, max_pages + 1):
        try:
            r = client._http("GET", f"{GHIN}/scores/search.json",
                            params={"golfer_id": ghin, "page": page, "per_page": 100})
        except Exception:
            break
        sc = r.get("Scores") or r.get("scores") or []
        if not sc:
            break
        out.extend(sc)
        oldest = min((s.get("played_at", "") for s in sc if s.get("played_at")), default="")
        if oldest and oldest < cutoff:
            break
        time.sleep(0.05)
    # keep only within window, newest first
    out = [s for s in out if (s.get("played_at", "") >= cutoff)]
    out.sort(key=lambda s: s.get("played_at", ""), reverse=True)
    return out


def diff_18equiv(s):
    """18-hole-equivalent differential, or None if unusable/corrupt."""
    if s.get("status", "").lower() != "validated":
        return None
    holes = s.get("number_of_holes", 18)
    if holes < 18:
        d = s.get("scaled_up_differential")
    else:
        if (s.get("adjusted_gross_score") or 0) < 50:  # impossible 18-hole gross
            return None
        d = s.get("differential")
    if d is None:
        return None
    d = float(d)
    if d < -2 or d > 54:
        return None
    return d


def index_info(client, ghin):
    try:
        s = client._http("GET", f"{GHIN}/golfers/search.json",
                        params={"golfer_id": ghin, "page": 1, "per_page": 5})
        g = s["golfers"][0]
        hi = float(g["hi_value"])
        low_raw = g.get("low_hi")
        try:
            low = float(low_raw) if low_raw not in (None, "") else hi
        except (TypeError, ValueError):
            low = hi  # e.g. "-" when no 365-day low has been recorded yet
        return hi, low
    except Exception:
        return None, None


def analyze(client, name, ghin):
    hi, low = index_info(client, ghin)
    scores = fetch_history(client, ghin)
    vals = [d for d in (diff_18equiv(s) for s in scores) if d is not None]  # newest first

    n = len(vals)
    if n:
        baseline = round(statistics.mean(vals), 2)
        recent = round(statistics.mean(vals[:10]), 2) if n >= 5 else baseline
        prior = round(statistics.mean(vals[10:30]), 2) if n >= 20 else baseline
        vol = round(statistics.stdev(vals), 2) if n > 1 else 0.0
        best = round(min(vals), 1)
        trend_delta = round(prior - recent, 1)
    else:
        baseline = recent = prior = (hi if hi is not None else 0.0)
        vol = 0.0; best = hi if hi is not None else 0.0; trend_delta = 0.0

    index = hi if hi is not None else baseline
    low = low if low is not None else index
    gap_to_low = round(index - low, 1)
    has_data = n > 0 and hi is not None

    if not has_data:
        form = "No data"
    elif trend_delta >= 0.4:
        form = "Improving"
    elif trend_delta <= -0.4:
        form = "Declining"
    else:
        form = "Stable"

    return {
        "signup_name": name, "ghin_id": ghin,
        "posted_hcp": index, "low_hi": low, "gap_to_low": gap_to_low,
        "n_rounds": n, "baseline_2yr": baseline,
        "recent_avg": recent, "prior_avg": prior,
        "best_diff": best, "volatility": vol,
        "trend_delta": trend_delta, "form": form,
        "sharp": has_data and gap_to_low <= 0.6,
        "recent_diffs": [round(v, 1) for v in vals[:10]],
    }


def main():
    client = m.GhinClient(os.environ["GHIN_USERNAME"], os.environ["GHIN_PASSWORD"])
    players = json.loads(Path("calcutta-players.json").read_text())
    print(f"Re-analyzing {len(players)} players over {YEARS}yr (since {CUTOFF})...\n")
    out = []
    for i, p in enumerate(players, 1):
        r = analyze(client, p["signup_name"], p["ghin_id"])
        r["event_flight"] = p.get("event_flight")
        r["course_handicap"] = p.get("course_handicap")
        r["over_max"] = p.get("over_max")
        out.append(r)
        sharp = " SHARP" if r["sharp"] else ""
        print(f"  {i:2}/{len(players)} {p['signup_name']:<20} HI {r['posted_hcp']:<5} low {r['low_hi']:<5} "
              f"2yr {r['baseline_2yr']:<6} L10 {r['recent_avg']:<6} best {r['best_diff']:<5} "
              f"{r['form']:<10}{sharp} (n={r['n_rounds']})")
        time.sleep(0.05)
    Path("reanalysis-results.json").write_text(json.dumps(out, indent=2))
    print("\nSaved reanalysis-results.json")


if __name__ == "__main__":
    main()
