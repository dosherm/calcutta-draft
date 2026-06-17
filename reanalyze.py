#!/usr/bin/env python3
"""
Calcutta re-analysis v2 — Youche CC

Richer form/value assessment than the old "avg 18-hole differential vs posted HCP".

Per player it pulls:
  - Last 20 scores (uses 9-hole rounds via their 18-hole scaled equivalent)
  - Current Handicap Index + 365-day low index (search.json)
  - Weekly Handicap Index history for the last year (handicap_history.json)

and computes:
  - n_rounds, avg_diff (18-hole-equivalent), recent5_avg (current form), volatility
  - index, low_hi, gap_to_low (index - low_hi)   -> upside / "how much lower they've gone"
  - index_trend_delta (index ~9 weeks ago - now)  -> +improving / -declining
  - form: Improving / Stable / Declining           (from index history, single source of truth)
  - sharp: bool  (index within 0.6 of 365-day low) -> peaking / dangerous pick
  - value_vs_index (index - recent5_avg)           -> scoring better than card right now if >0
"""

import json, os, statistics, time, importlib.util
from datetime import date, timedelta
from pathlib import Path

spec = importlib.util.spec_from_file_location("analyze", "analyze.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
m.load_env()

GHIN = m.GHIN_API_BASE


def usable_diffs(scores):
    """18-hole-equivalent differentials, using scaled 9-hole values, rejecting corrupt records."""
    out = []  # (date, diff, score_type, is_tournament)
    for s in scores:
        if s.get("status", "").lower() != "validated":
            continue
        holes = s.get("number_of_holes", 18)
        if holes < 18:
            d = s.get("scaled_up_differential")
        else:
            if (s.get("adjusted_gross_score") or 0) < 50:  # impossible 18-hole gross -> corrupt
                continue
            d = s.get("differential")
        if d is None:
            continue
        d = float(d)
        if d < -2 or d > 54:  # outside any plausible human range
            continue
        st = s.get("score_type", "")
        out.append((s.get("played_at", ""), d, st, st in ("T", "C")))
    # most-recent first already; sort defensively by date desc
    out.sort(key=lambda x: x[0], reverse=True)
    return out


def index_history(client, ghin):
    today = date.today()
    begin = today - timedelta(days=400)
    try:
        r = client._http("GET", f"{GHIN}/golfers/{ghin}/handicap_history.json",
                         params={"date_begin": begin.isoformat(), "date_end": today.isoformat(), "rev_count": 60})
        revs = r.get("handicap_revisions", [])
        # newest first; keep (date, value)
        pts = []
        for rv in revs:
            try:
                pts.append((rv["RevDate"][:10], float(rv["Value"])))
            except (KeyError, ValueError, TypeError):
                pass
        return pts
    except Exception:
        return []


def analyze(client, name, ghin):
    res = {"signup_name": name, "ghin_id": ghin}

    # index info
    live_hi, low_hi = None, None
    try:
        s = client._http("GET", f"{GHIN}/golfers/search.json",
                        params={"golfer_id": ghin, "page": 1, "per_page": 5})
        g = s["golfers"][0]
        live_hi = float(g["hi_value"])
        low_hi = float(g["low_hi"]) if g.get("low_hi") not in (None, "") else live_hi
    except Exception as e:
        res["error"] = f"index lookup failed: {e}"

    # scores
    sc = client.get_scores(ghin, limit=20)
    diffs = usable_diffs(sc)
    vals = [d for _, d, _, _ in diffs]

    # index history -> trend
    hist = index_history(client, ghin)  # newest first
    trend_delta = 0.0
    if len(hist) >= 6:
        now_v = hist[0][1]
        # ~9 weekly revisions back, or oldest available
        back = hist[min(9, len(hist) - 1)][1]
        trend_delta = round(back - now_v, 1)  # + = index fell = improving

    if vals:
        avg = round(statistics.mean(vals), 2)
        recent5 = round(statistics.mean(vals[:5]), 2) if len(vals) >= 3 else avg
        vol = round(statistics.stdev(vals), 2) if len(vals) > 1 else 0.0
    else:
        avg = recent5 = live_hi if live_hi is not None else 0.0
        vol = 0.0

    index = live_hi if live_hi is not None else (vals and avg or 0.0)
    low = low_hi if low_hi is not None else index
    gap_to_low = round(index - low, 1)

    has_data = bool(vals) and live_hi is not None

    if not has_data:
        form = "No data"
    elif trend_delta >= 0.4:
        form = "Improving"
    elif trend_delta <= -0.4:
        form = "Declining"
    else:
        form = "Stable"

    # "sharp" = at/near their 365-day best; only meaningful with real data
    sharp = has_data and gap_to_low <= 0.6

    res.update({
        "posted_hcp": index,
        "low_hi": low,
        "gap_to_low": gap_to_low,
        "n_rounds": len(vals),
        "avg_diff_18equiv": avg,
        "recent5_avg": recent5,
        "value_vs_index": round(index - recent5, 1),  # + = scoring better than card lately
        "volatility": vol,
        "index_trend_delta": trend_delta,
        "form": form,
        "sharp": sharp,
        "recent_diffs": [round(v, 1) for v in vals[:10]],
        "history_points": len(hist),
        "error": res.get("error"),
    })
    return res


def main():
    client = m.GhinClient(os.environ["GHIN_USERNAME"], os.environ["GHIN_PASSWORD"])
    players = json.loads(Path("calcutta-players.json").read_text())
    print(f"Re-analyzing {len(players)} players with richer signals...\n")
    out = []
    for i, p in enumerate(players, 1):
        r = analyze(client, p["signup_name"], p["ghin_id"])
        # preserve flight/course handicap that were computed elsewhere
        r["event_flight"] = p.get("event_flight")
        r["course_handicap"] = p.get("course_handicap")
        r["over_max"] = p.get("over_max")
        out.append(r)
        sharp = " SHARP" if r["sharp"] else ""
        print(f"  {i:2}/{len(players)} {p['signup_name']:<20} HI {r['posted_hcp']:<5} low {r['low_hi']:<5} "
              f"avg {r['avg_diff_18equiv']:<6} rec5 {r['recent5_avg']:<6} form {r['form']:<10}{sharp}  (n={r['n_rounds']}, hist={r['history_points']})")
        time.sleep(0.1)

    Path("reanalysis-results.json").write_text(json.dumps(out, indent=2))
    print("\nSaved reanalysis-results.json")


if __name__ == "__main__":
    main()
