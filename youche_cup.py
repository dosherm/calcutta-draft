#!/usr/bin/env python3
"""
Youche Cup — player evaluation data builder

Builds docs/cup/data.js for the Youche Cup team tool, using the same player
evaluation as the Calcutta (live HI, 365-day low, course handicap, net-to-par
L10 / 2yr / best, Form, SHARP) — without flights.

  python3 youche_cup.py            # build from data already in the repo
  python3 youche_cup.py --refresh  # pull fresh 2-year GHIN history for all
                                   # players first (needs .env GHIN creds and
                                   # network access to api2.ghin.com)

Sources, in priority order:
  1. youche-cup-ghin.json      (written by --refresh: full 2yr history, current)
  2. calcutta-players.json     (Calcutta 2yr evaluation, June 2026)
  3. analysis-results.json     (last ~20 rounds only; no 365-day low) -> "limited"
"""

import json, sys, time
from pathlib import Path

HERE = Path(__file__).parent
ROSTER = HERE / "youche-cup-roster.json"
FRESH = HERE / "youche-cup-ghin.json"
OUT = HERE / "docs" / "cup" / "data.js"

# Youche white tees, same as the Calcutta
RATING, SLOPE, PAR = 70.4, 127, 71


def course_hcp(hi):
    return round(hi * SLOPE / 113 + (RATING - PAR))


def net_to_par(diff, crs):
    """Average differential -> net score to par on Youche whites."""
    if diff is None:
        return None
    return round(diff * SLOPE / 113 + RATING - PAR - crs)


def from_2yr(r, asof):
    """Reanalysis-shaped record (reanalyze.analyze / calcutta-players.json)."""
    hi = r["posted_hcp"]
    crs = r.get("course_handicap", course_hcp(hi))
    # Keep the Calcutta's published net figures where they exist so both apps agree
    net = lambda key, diff: r[key] if r.get(key) is not None else net_to_par(r[diff], crs)
    return {
        "hi": hi, "lowHi": r.get("low_hi"), "courseHcp": crs,
        "netL10": net("net_l10", "recent_avg"),
        "net2yr": net("net_2yr", "baseline_2yr"),
        "netBest": net("net_best", "best_diff"),
        "rounds": r["n_rounds"], "form": r["form"], "sharp": bool(r.get("sharp")),
        "volatility": r.get("volatility"), "basis": "2yr", "asof": asof,
    }


def from_limited(r):
    """analysis-results.json record: last ~20 WHS rounds, no 365-day low."""
    hi = r["posted_hcp"]
    crs = course_hcp(hi)
    diffs = r.get("recent_diffs") or []
    l10 = sum(diffs[:10]) / len(diffs[:10]) if diffs else None
    return {
        "hi": hi, "lowHi": None, "courseHcp": crs,
        "netL10": net_to_par(l10, crs),
        "net2yr": net_to_par(r.get("avg_differential"), crs),
        "netBest": net_to_par(min(diffs), crs) if diffs else None,
        "rounds": r.get("rounds_fetched", 0),
        "form": {"improving": "Improving", "declining": "Declining"}.get(r.get("trend"), "Stable"),
        "sharp": False, "volatility": r.get("volatility"),
        "basis": "limited", "asof": "Jun 2026",
    }


def load(path, key):
    if not path.exists():
        return {}
    return {p[key]: p for p in json.loads(path.read_text())}


def refresh(roster, ghin_ids):
    import importlib.util
    spec = importlib.util.spec_from_file_location("reanalyze", HERE / "reanalyze.py")
    ra = importlib.util.module_from_spec(spec); spec.loader.exec_module(ra)
    import os
    client = ra.m.GhinClient(os.environ["GHIN_USERNAME"], os.environ["GHIN_PASSWORD"])
    out = []
    for i, p in enumerate(roster, 1):
        gid = ghin_ids.get(p["name"])
        if not gid:
            print(f"  {i:2} {p['name']:<20} no GHIN id — skipped"); continue
        r = ra.analyze(client, p["name"], gid)
        out.append(r)
        print(f"  {i:2}/{len(roster)} {p['name']:<20} HI {r['posted_hcp']:<5} low {r['low_hi']:<5} "
              f"L10 {r['recent_avg']:<6} 2yr {r['baseline_2yr']:<6} {r['form']} (n={r['n_rounds']})")
        time.sleep(0.05)
    FRESH.write_text(json.dumps(out, indent=2))
    print(f"Saved {FRESH.name}")


def main():
    roster = json.loads(ROSTER.read_text())
    cal = load(HERE / "calcutta-players.json", "signup_name")
    lim = load(HERE / "analysis-results.json", "name")

    ghin_ids = {}
    for p in roster:
        for n in (p["name"], p.get("alias")):
            src = cal.get(n) or lim.get(n)
            if n and src:
                ghin_ids[p["name"]] = src["ghin_id"]; break

    if "--refresh" in sys.argv:
        refresh(roster, ghin_ids)
    fresh = load(FRESH, "signup_name")
    fresh_asof = time.strftime("%b %Y", time.localtime(FRESH.stat().st_mtime)) if FRESH.exists() else None

    players = []
    for p in roster:
        names = [p["name"]] + ([p["alias"]] if p.get("alias") else [])
        ev = None
        for n in names:
            if n in fresh: ev = from_2yr(fresh[n], fresh_asof); break
        if ev is None:
            for n in names:
                if n in cal: ev = from_2yr(cal[n], "Jun 2026"); break
        if ev is None:
            for n in names:
                if n in lim: ev = from_limited(lim[n]); break
        if ev is None:
            ev = {"hi": None, "basis": "none"}
        players.append({"name": p["name"], "rank": p["rank"], "events": p["events"],
                        "wins": p["wins"], "points": p["points"],
                        "ghin": ghin_ids.get(p["name"]), **ev})

    OUT.write_text("// Generated by youche_cup.py — do not edit by hand.\nconst PLAYERS = "
                   + json.dumps(players, indent=2) + ";\n")
    basis = {}
    for pl in players:
        basis[pl["basis"]] = basis.get(pl["basis"], 0) + 1
    print(f"Wrote {OUT.relative_to(HERE)}: {len(players)} players  {basis}")


if __name__ == "__main__":
    main()
