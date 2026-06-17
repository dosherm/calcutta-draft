#!/usr/bin/env python3
"""
Calcutta Analysis Tool — Youche CC

Pulls last 20 rounds for each player from GHIN, computes:
  - Average handicap differential vs posted handicap index
  - Sandbagger score (0-10)
  - Volatility (std dev of differentials)
  - Trend (improving / declining / stable)
  - Flight assignment (A / B / C)

Usage:
  cp .env.example .env    # fill in GHIN_USERNAME and GHIN_PASSWORD
  python3 analyze.py
"""

import csv
import json
import os
import sys
import time
import statistics
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from typing import Optional

# ── Config ────────────────────────────────────────────────────────────────────

ROUNDS_TO_FETCH = 20
ROSTER_CSV = Path(__file__).parent.parent / "Men_s League 2026 Golfer Spreadsheet V2.csv"
OUTPUT_JSON = Path(__file__).parent / "analysis-results.json"
OUTPUT_CSV  = Path(__file__).parent / "analysis-results.csv"

FLIGHT_A_MAX = 9.9
FLIGHT_B_MAX = 18.9

GHIN_API_BASE = "https://api2.ghin.com/api/v1"

# ── Load .env ─────────────────────────────────────────────────────────────────

def load_env():
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

# ── GHIN API client ───────────────────────────────────────────────────────────

FIREBASE_URL = "https://firebaseinstallations.googleapis.com/v1/projects/ghin-mobile-app/installations"
FIREBASE_API_KEY = "AIzaSyBxgTOAWxiud0HuaE5tN-5NTlzFnrtyz-I"
FIREBASE_PAYLOAD = {
    "appId": "1:884417644529:web:47fb315bc6c70242f72650",
    "authVersion": "FIS_v2",
    "sdkVersion": "w:0.5.7",
    "fid": "fg6JfS0U01YmrelthLX9Iz",
}

class GhinClient:
    def __init__(self, username: str, password: str):
        self.token: Optional[str] = None
        self._login(username, password)

    def _http(self, method: str, url: str, body: Optional[dict] = None,
              params: Optional[dict] = None, headers: Optional[dict] = None) -> dict:
        if params:
            url += "?" + urllib.parse.urlencode(params)
        data = json.dumps(body).encode() if body else None
        hdrs = {"Content-Type": "application/json", "Accept": "application/json"}
        if headers:
            hdrs.update(headers)
        if self.token:
            hdrs["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"HTTP {e.code} {url}: {e.read().decode()[:200]}")

    def _login(self, username: str, password: str):
        # Step 1: get Firebase session token
        fb = self._http("POST", FIREBASE_URL, body=FIREBASE_PAYLOAD,
                        headers={"x-goog-api-key": FIREBASE_API_KEY})
        firebase_token = fb["authToken"]["token"]

        # Step 2: GHIN login
        resp = self._http("POST", f"{GHIN_API_BASE}/golfer_login.json", body={
            "token": firebase_token,
            "user": {"email_or_ghin": username, "password": password},
        })
        self.token = resp.get("golfer_user", {}).get("golfer_user_token")
        if not self.token:
            raise RuntimeError(f"Login failed — no token in response: {list(resp.keys())}")

    def get_scores(self, ghin_number: str, limit: int = 20) -> list[dict]:
        resp = self._http("GET", f"{GHIN_API_BASE}/golfers/{ghin_number}/scores.json",
                          params={"limit": limit, "offset": 0})
        # API returns scores split across recent_scores and revision_scores dicts
        recent   = resp.get("recent_scores",   {}).get("scores", []) if isinstance(resp.get("recent_scores"),   dict) else []
        revision = resp.get("revision_scores", {}).get("scores", []) if isinstance(resp.get("revision_scores"), dict) else []
        return recent + revision

    def get_handicap(self, ghin_number: str) -> Optional[float]:
        try:
            resp = self._http("GET", f"{GHIN_API_BASE}/golfers/search.json",
                              params={"golfer_id": ghin_number, "page": 1, "per_page": 5})
            golfers = resp.get("golfers", [])
            if not golfers:
                return None
            return float(golfers[0]["hi_value"])
        except Exception:
            return None

# ── Helpers ───────────────────────────────────────────────────────────────────

def assign_flight(hcp: float) -> str:
    if hcp <= FLIGHT_A_MAX: return "A"
    if hcp <= FLIGHT_B_MAX: return "B"
    return "C"

def calc_trend(diffs: list[float]) -> str:
    if len(diffs) < 4:
        return "stable"
    mid = len(diffs) // 2
    # GHIN returns most recent first
    recent_avg = statistics.mean(diffs[:mid])
    older_avg  = statistics.mean(diffs[mid:])
    delta = older_avg - recent_avg  # positive = recent scores lower = improving
    if delta > 1.5: return "improving"
    if delta < -1.5: return "declining"
    return "stable"

def sandbagger_score(diff_vs_hcp: float, vol: float, rounds_below: int, total: int) -> float:
    if total == 0: return 0.0
    gap_score  = min(max(diff_vs_hcp * 1.5, 0), 5)
    freq_score = (rounds_below / total) * 3
    vol_score  = min(vol / 5, 2)
    return round(min(gap_score + freq_score + vol_score, 10), 1)

def flag_label(s: float, error: bool) -> str:
    if error:        return "❓ NO DATA"
    if s >= 7:       return "🚨 SANDBAG "
    if s >= 4:       return "⚠️  WATCH   "
    return           "✅ CLEAN   "

# ── Load roster ───────────────────────────────────────────────────────────────

def load_roster() -> list[dict]:
    players = []
    with open(ROSTER_CSV, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            ghin = row.get("GHIN Id", "").strip()
            idx  = row.get("Index", "").strip()
            active = row.get("GHIN Active", "").strip()
            if not ghin or not idx or active != "Yes":
                continue
            try:
                hcp = float(idx)
            except ValueError:
                continue
            players.append({
                "name":     f"{row.get('First Name','').strip()} {row.get('Last Name','').strip()}".strip(),
                "ghin_id":  ghin,
                "posted_hcp": hcp,
                "flight":   assign_flight(hcp),
            })
    return players

# ── Analyze one player ────────────────────────────────────────────────────────

def analyze_player(client: GhinClient, player: dict) -> dict:
    result = {
        "name":           player["name"],
        "ghin_id":        player["ghin_id"],
        "posted_hcp":     player["posted_hcp"],
        "flight":         player["flight"],
        "rounds_fetched": 0,
        "avg_differential": player["posted_hcp"],
        "diff_vs_hcp":    0.0,
        "sandbagger_score": 0.0,
        "volatility":     0.0,
        "trend":          "stable",
        "recent_diffs":   [],
        "error":          None,
    }

    try:
        scores = client.get_scores(player["ghin_id"], limit=ROUNDS_TO_FETCH)
        valid = [
            float(s["differential"])
            for s in scores
            if s.get("differential") is not None
               and s.get("number_of_holes", 18) >= 18
               and s.get("status", "").lower() == "validated"
        ]

        if not valid:
            result["error"] = "no 18-hole scores"
            return result

        avg = statistics.mean(valid)
        vol = statistics.stdev(valid) if len(valid) > 1 else 0.0
        diff_vs_hcp = round(player["posted_hcp"] - avg, 2)
        rounds_below = sum(1 for d in valid if d <= player["posted_hcp"] - 2)

        result.update({
            "rounds_fetched":   len(valid),
            "avg_differential": round(avg, 2),
            "diff_vs_hcp":      diff_vs_hcp,
            "sandbagger_score": sandbagger_score(diff_vs_hcp, vol, rounds_below, len(valid)),
            "volatility":       round(vol, 2),
            "trend":            calc_trend(valid),
            "recent_diffs":     valid[:10],
        })
    except Exception as e:
        result["error"] = str(e)

    return result

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    load_env()

    username = os.environ.get("GHIN_USERNAME")
    password = os.environ.get("GHIN_PASSWORD")

    if not username or not password:
        print("❌  Create a .env file with GHIN_USERNAME and GHIN_PASSWORD")
        print("    See .env.example for the format")
        sys.exit(1)

    print("\n🔐  Logging in to GHIN...")
    try:
        client = GhinClient(username, password)
        print("✅  Authenticated\n")
    except RuntimeError as e:
        print(f"❌  {e}")
        sys.exit(1)

    roster = load_roster()
    flights = {f: sum(1 for p in roster if p["flight"] == f) for f in "ABC"}
    print(f"📋  Loaded {len(roster)} active players from roster")
    print(f"    A flight (0–{FLIGHT_A_MAX}):   {flights['A']} players")
    print(f"    B flight ({FLIGHT_A_MAX+0.1:.1f}–{FLIGHT_B_MAX}): {flights['B']} players")
    print(f"    C flight ({FLIGHT_B_MAX+0.1:.1f}+):     {flights['C']} players\n")

    results = []
    for i, player in enumerate(roster, 1):
        print(f"\r  Fetching {i}/{len(roster)}: {player['name']:<30}", end="", flush=True)
        results.append(analyze_player(client, player))
        time.sleep(0.15)  # be polite to the API

    print("\n\n✅  Done. Writing results...\n")

    # Sort: by flight, then sandbagger score desc
    results.sort(key=lambda r: (r["flight"], -r["sandbagger_score"]))

    OUTPUT_JSON.write_text(json.dumps(results, indent=2))

    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "flight", "name", "ghin_id", "posted_hcp", "avg_differential",
            "diff_vs_hcp", "sandbagger_score", "volatility", "trend",
            "rounds_fetched", "recent_diffs", "error"
        ])
        writer.writeheader()
        for r in results:
            writer.writerow({**r, "recent_diffs": ", ".join(str(d) for d in r["recent_diffs"])})

    # Print top suspects
    for flight in "ABC":
        flight_players = [r for r in results if r["flight"] == flight and r["rounds_fetched"] >= 5]
        if not flight_players:
            continue
        print(f"{'═'*70}")
        print(f"  Flight {flight} — Top Sandbagger Suspects")
        print(f"{'═'*70}")
        for i, p in enumerate(flight_players[:5], 1):
            delta = f"+{p['diff_vs_hcp']}" if p["diff_vs_hcp"] > 0 else str(p["diff_vs_hcp"])
            print(f"  {i}. {flag_label(p['sandbagger_score'], bool(p['error']))} "
                  f"{p['name']:<24} HCP:{p['posted_hcp']:<6} "
                  f"AvgDiff:{p['avg_differential']:<7} Δ:{delta:<7} "
                  f"Score:{p['sandbagger_score']}/10 | {p['trend']}")
        print()

    errors = [r for r in results if r["error"]]
    if errors:
        print(f"⚠️   {len(errors)} players had errors (no scores / API issue):")
        for r in errors[:5]:
            print(f"    - {r['name']} ({r['ghin_id']}): {r['error']}")
        print()

    print(f"📁  Results saved to:")
    print(f"    {OUTPUT_JSON}")
    print(f"    {OUTPUT_CSV}\n")

if __name__ == "__main__":
    main()
