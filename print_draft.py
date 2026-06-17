import json
from pathlib import Path

players = json.loads(Path('calcutta-players.json').read_text())

a = sorted([p for p in players if p['event_flight'] == 'A'], key=lambda p: -p['posted_hcp'])
b = sorted([p for p in players if p['event_flight'] == 'B'], key=lambda p:  p['avg_differential'])
c = sorted([p for p in players if p['event_flight'] == 'C'], key=lambda p:  p['avg_differential'])

TREND = {'improving': '📈', 'declining': '📉', 'stable': '➡ '}

def delta(p):
    return f"+{p['diff_vs_hcp']}" if p['diff_vs_hcp'] > 0 else str(p['diff_vs_hcp'])

def fmt_pick(p):
    sb = ' 🚨' if p['sandbagger_score'] >= 5 else ''
    return f"{p['signup_name']} ({p['avg_differential']}){sb}"

SEP = '─' * 80

print('=' * 80)
print('  CALCUTTA DRAFT SHEET — Youche CC')
print(f"  {len(a)} teams of 3  |  Snake draft  |  A players pick highest-HCP-first")
print('  True talent = avg handicap differential  |  Δ = posted HCP minus avg diff')
print('  📈 improving  📉 declining  ➡  stable  |  🚨 sandbag suspect')
print('=' * 80)

print(f"\n{SEP}")
print("  FLIGHT B — ranked by true talent (best pick = lowest avg differential)")
print(SEP)
for i, p in enumerate(b, 1):
    print(f"  {i:2}. {p['signup_name']:<22} HCP:{p['posted_hcp']:<6} AvgDiff:{p['avg_differential']:<7} Δ{delta(p):<7} {TREND[p['trend']]}")

print(f"\n{SEP}")
print("  FLIGHT C — ranked by true talent")
print(SEP)
for i, p in enumerate(c, 1):
    print(f"  {i:2}. {p['signup_name']:<22} HCP:{p['posted_hcp']:<6} AvgDiff:{p['avg_differential']:<7} Δ{delta(p):<7} {TREND[p['trend']]}")

print(f"\n{'=' * 80}")
print("  SNAKE DRAFT ORDER  (Round 1: B picks  |  Round 2: C picks, reversed)")
print(f"{'=' * 80}\n")

for i, ap in enumerate(a, 1):
    top_b = b[:3]
    top_c = c[:3]
    b_opts = '  |  '.join(fmt_pick(p) for p in top_b)
    c_opts = '  |  '.join(fmt_pick(p) for p in top_c)
    print(f"  R1 Pick {i:2} │ {ap['signup_name']:<22} HCP:{ap['posted_hcp']:<5} Avg:{ap['avg_differential']:<6} Δ{delta(ap)} {TREND[ap['trend']]}")
    print(f"             │  B options: {b_opts}")
    print(f"             │  C options: {c_opts}")
    print()

print("  ── Round 2 snake reversal — lowest A HCP picks C first ──\n")
for i, ap in enumerate(reversed(a), 1):
    top_c = c[:3]
    c_opts = '  |  '.join(fmt_pick(p) for p in top_c)
    print(f"  R2 Pick {i:2} │ {ap['signup_name']:<22} C options: {c_opts}")

print()
print("  Note: cross off players as they're picked to update 'top' available options.")
print("  The avg differential is a better talent indicator than posted handicap.")
