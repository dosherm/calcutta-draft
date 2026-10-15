#!/usr/bin/python3
"""
Youche Cup — text each drafted player his Team Sherman card via Messages.

  python3 send_cards.py "John Jordan" "Dean Ricci"          # dry run: show the plan, send nothing
  python3 send_cards.py --teams teams.txt                   # players read from "Copy Teams as Text"
  python3 send_cards.py --teams teams.txt --test            # every card goes ONLY to the test numbers
  python3 send_cards.py --teams teams.txt --live            # texts the players themselves

Phone numbers and test recipients live in youche-cup-phones.json (gitignored).
Cards are Team_Sherman_<First>_<Last>.png in --cards (default ~/Downloads/Team_Sherman_Cards).
Captains and anyone without a card or a number are skipped and reported.
"""

import argparse, json, re, shutil, sqlite3, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).parent
PHONES = HERE / "youche-cup-phones.json"
ROSTER = HERE / "youche-cup-roster.json"
DEFAULT_CARDS = Path.home() / "Downloads" / "Team_Sherman_Cards"
# Messages can't attach files from Downloads when scripted (error 25), so cards
# are copied here first; Pictures is readable by Messages.
STAGING = Path.home() / "Pictures" / "Youche Cup Cards"
CHAT_DB = Path.home() / "Library" / "Messages" / "chat.db"
TEAM = "Team Sherman"


def players_from_teams_text(text, team):
    """Names listed under `team` in the app's "Copy Teams as Text" output."""
    names, inside = [], False
    for line in text.splitlines():
        if not line.strip():
            continue
        if not line.startswith(" "):          # a team header
            inside = line.strip().lower() == team.lower()
            continue
        if inside:
            # "  B  John Jordan (Youche 12)" or "  A  Dan Sherman (C) (Youche 7)"
            m = re.match(r"\s+(?:[ABCD]\s+)?(.+?)\s*(?:\(C\))?\s*\(Youche", line)
            if m:
                names.append(m.group(1).strip())
    return names


def applescript_str(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def send(number, card, note=None):
    """Send `note` (optional) then the image via Messages: iMessage first, SMS if that fails."""
    STAGING.mkdir(parents=True, exist_ok=True)
    card = Path(shutil.copy2(card, STAGING / card.name))
    for service in ("iMessage", "SMS"):
        lines = [
            'tell application "Messages"',
            f'  set acct to 1st account whose service type = {service}',
            f'  set p to participant {applescript_str(number)} of acct',
        ]
        if note:
            lines.append(f'  send {applescript_str(note)} to p')
        lines += [f'  send POSIX file {applescript_str(str(card))} to p', 'end tell']
        r = subprocess.run(["osascript", "-e", "\n".join(lines)], capture_output=True, text=True)
        if r.returncode == 0:
            return service
        err = r.stderr.strip()
    raise RuntimeError(err)


def failed_images(since):
    """Image attachments sent since `since` (unix time) that Messages marked as failed."""
    q = """SELECT h.id, a.transfer_name FROM message m
           JOIN handle h ON h.ROWID = m.handle_id
           JOIN message_attachment_join j ON j.message_id = m.ROWID
           JOIN attachment a ON a.ROWID = j.attachment_id
           WHERE m.is_from_me = 1 AND m.error != 0
             AND m.date / 1000000000 + 978307200 >= ?"""
    with sqlite3.connect(f"file:{CHAT_DB}?mode=ro", uri=True) as db:
        return db.execute(q, (int(since),)).fetchall()


def fmt(n):
    return f"({n[2:5]}) {n[5:8]}-{n[8:]}" if n and n.startswith("+1") else (n or "no number")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*", help="drafted players, as on the roster")
    ap.add_argument("--teams", help="file with the app's Copy Teams as Text output ('-' for stdin)")
    ap.add_argument("--team", default=TEAM)
    ap.add_argument("--cards", type=Path, default=DEFAULT_CARDS)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--test", action="store_true", help="send every card only to the test numbers")
    mode.add_argument("--live", action="store_true", help="text the players themselves")
    ap.add_argument("--message", help="text sent before each card (live mode)")
    args = ap.parse_args()

    data = json.loads(PHONES.read_text())
    phones, testers = data["phones"], data.get("test_recipients", [])
    roster = json.loads(ROSTER.read_text())
    captains = {p["name"] for p in roster if "captain" in p}

    names = list(args.names)
    if args.teams:
        text = sys.stdin.read() if args.teams == "-" else Path(args.teams).read_text()
        names += players_from_teams_text(text, args.team)
    if not names:
        sys.exit("No players given. Pass names or --teams.")

    plan, skipped = [], []
    for name in dict.fromkeys(names):
        card = args.cards / f"Team_Sherman_{name.replace(' ', '_')}.png"
        if name in captains:
            skipped.append((name, "captain"))
        elif name not in phones:
            skipped.append((name, "not on the roster"))
        elif not card.exists():
            skipped.append((name, f"no card ({card.name})"))
        elif not phones[name]:
            skipped.append((name, "no phone number"))
        else:
            plan.append((name, phones[name], card))

    mode_name = "LIVE" if args.live else "TEST" if args.test else "DRY RUN"
    print(f"{mode_name}: {len(plan)} card(s) for {args.team}")
    for name, num, card in plan:
        to = ", ".join(fmt(t) for t in testers) if args.test else fmt(num)
        print(f"  {name:<18} {card.name:<36} -> {to}")
    for name, why in skipped:
        print(f"  skip {name:<18} {why}")

    if not (args.test or args.live):
        print("\nNothing sent. Add --test or --live to send.")
        return
    if args.test and not testers:
        sys.exit("No test_recipients in youche-cup-phones.json.")

    started = time.time()
    sent = failed = 0
    for name, num, card in plan:
        targets = testers if args.test else [num]
        for t in targets:
            note = (f"TEST: {name}'s card (live would go to {fmt(num)})" if args.test else args.message)
            try:
                svc = send(t, card, note)
                print(f"  sent {name} -> {fmt(t)} via {svc}")
                sent += 1
            except RuntimeError as e:
                print(f"  FAILED {name} -> {fmt(t)}: {e}")
                failed += 1
            time.sleep(1.5)
    print(f"\n{sent} handed to Messages, {failed} refused.")
    time.sleep(10)
    bad = failed_images(started)
    if bad:
        print(f"Messages reports {len(bad)} image(s) NOT delivered:")
        for who, name in bad:
            print(f"  {name} -> {fmt(who)}")
    else:
        print("Messages reports no failed images.")


if __name__ == "__main__":
    main()
