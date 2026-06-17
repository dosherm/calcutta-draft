#!/usr/bin/env python3
"""
Calcutta Draft Helper — Youche CC

Reads analysis-results.json and shows:
  1. Each flight ranked by true talent (avg differential)
  2. Snake draft order with top B/C picks for each A player

Usage: python3 draft_helper.py
"""

import json
import sys
from pathlib import Path

INPUT = Path(__file__).parent / "analysis-results.json"

def trend_icon(trend: str) -> str:
    return {"improving": "📈", "declining": "📉"}.get(trend, "➡️ ")

def flag(r: dict) -> str:
    if r.get("error"):          return "❓ NO DATA "
    s = r["sandbagger_score"]
    if s >= 7:                  return "🚨 SANDBAG "
    if s >= 4:                  return "⚠️  WATCH   "
    if r["trend"] == "improving": return "📈 HOT     "
    if r["trend"] == "declining": return "📉 COLD    "
    return                             "✅ CLEAN   "

def print_flight(players: list[dict], flight: str):
    ranked = sorted(players, key=lambda p: p["avg_differential"])
    print(f"\n{'═'*78}")
    print(f"  Flight {flight} — Ranked by True Talent  (avg differential, lower = better)")
    print(f"{'═'*78}")
    print(f"  {'#':<4}{'Name':<26}{'HCP':<7}{'Avg Diff':<10}{'Delta':<9}{'Vol':<8}{'Rds':<5}Status")
    print("  " + "─"*76)
    for i, p in enumerate(ranked, 1):
        delta = f"+{p['diff_vs_hcp']}" if p["diff_vs_hcp"] > 0 else str(p["diff_vs_hcp"])
        note  = f" ({p['rounds_fetched']}rds)" if p["rounds_fetched"] < 5 else ""
        print(f"  {i:<4}{p['name']:<26}{p['posted_hcp']:<7}{p['avg_differential']:<10}"
              f"{delta:<9}{p['volatility']:<8}{p['rounds_fetched']:<5}{flag(p)}{note}")

def main():
    if not INPUT.exists():
        print(f"\n❌  Run analyze.py first to generate {INPUT}")
        sys.exit(1)

    all_players: list[dict] = json.loads(INPUT.read_text())

    by_flight = {f: [p for p in all_players if p["flight"] == f] for f in "ABC"}

    print("\n🏌️  CALCUTTA DRAFT HELPER — Youche CC")
    print(f"    {len(all_players)} players | "
          f"A:{len(by_flight['A'])}  B:{len(by_flight['B'])}  C:{len(by_flight['C'])}")

    for flight in "ABC":
        print_flight(by_flight[flight], flight)

    # Snake draft — A players sorted highest HCP first (highest picks first in round 1)
    a_by_hcp  = sorted(by_flight["A"], key=lambda p: -p["posted_hcp"])
    b_ranked  = sorted(by_flight["B"], key=lambda p: p["avg_differential"])
    c_ranked  = sorted(by_flight["C"], key=lambda p: p["avg_differential"])

    print(f"\n\n{'═'*78}")
    print("  SNAKE DRAFT ORDER  (A players, highest HCP picks first)")
    print("  Shows top available B & C picks by true talent (avg differential)")
    print("  🚨 = sandbagger score ≥ 5  |  delta = posted HCP − avg diff (+= plays better)")
    print(f"{'═'*78}\n")

    for i, a in enumerate(a_by_hcp, 1):
        top_b = b_ranked[:3]
        top_c = c_ranked[:3]
        delta = f"+{a['diff_vs_hcp']}" if a["diff_vs_hcp"] > 0 else str(a["diff_vs_hcp"])

        print(f"  Pick {i:<3} {a['name']}  (HCP {a['posted_hcp']}, Avg Diff {a['avg_differential']}, Δ{delta})")

        def fmt(p: dict) -> str:
            warn = " 🚨" if p["sandbagger_score"] >= 5 else ""
            return f"{p['name']} [{p['avg_differential']}{warn}]"

        if top_b:
            print(f"          B picks: {' | '.join(fmt(p) for p in top_b)}")
        if top_c:
            print(f"          C picks: {' | '.join(fmt(p) for p in top_c)}")
        print()

    print("  ⚠️   Note: this does NOT remove picked players as you draft.")
    print("       Cross them off manually and re-run for live updates.\n")

if __name__ == "__main__":
    main()
