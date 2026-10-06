// Youche Cup — invite tracker + automatic two-team balancer
// Single-device, localStorage-persisted. PLAYERS comes from data.js (youche_cup.py).

const STORAGE_KEY = "youche-cup-state-v1";
const TEAM_SIZE = 12;
const FIELD = TEAM_SIZE * 2;

// Projected net-to-par: weights current form (L10) over the 2-year baseline.
// Lower = stronger. Falls back to whichever number exists.
function proj(p) {
  const a = p.netL10, b = p.net2yr;
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.round((0.6 * a + 0.4 * b) * 10) / 10;
}

function defaultState() {
  return {
    status: Object.fromEntries(PLAYERS.map((p, i) => [p.name, i < FIELD ? "invited" : "alternate"])),
    includePending: true,
    mode: "both",
    teamNames: ["Team 1", "Team 2"],
    pins: {},   // name -> 0 | 1
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = { ...defaultState(), ...JSON.parse(raw) };
      // Players added to data.js after the state was saved start as alternates
      PLAYERS.forEach(p => { if (!s.status[p.name]) s.status[p.name] = "alternate"; });
      return s;
    }
  } catch (e) { /* fall through */ }
  return defaultState();
}

let state = loadState();
let activeView = "roster";
let playerSort = "proj";

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

const byName = Object.fromEntries(PLAYERS.map(p => [p.name, p]));
const st = name => state.status[name];

// ---- Formatting (same conventions as the Calcutta tracker) ----

function fmtNet(n) {
  if (n === null || n === undefined) return "n/a";
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

function fmt1(n) {
  if (n === null || n === undefined || isNaN(n)) return "n/a";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function fmtNet1(n) {
  if (n === null || n === undefined || isNaN(n)) return "n/a";
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "E";
  return r > 0 ? `+${r.toFixed(1)}` : r.toFixed(1);
}

function formIcon(form) {
  if (form === "Improving") return '<span class="trend-icon trend-improving">&#9650; Improving</span>';
  if (form === "Declining") return '<span class="trend-icon trend-declining">&#9660; Declining</span>';
  if (form === "No data")   return '<span class="trend-icon trend-stable">No data</span>';
  return '<span class="trend-icon trend-stable">&#8226; Stable</span>';
}

function sharpBadge(p) {
  return p.sharp ? ' <span class="sharp-badge">&#9889; SHARP</span>' : "";
}

function limitedTag(p) {
  return p.basis === "limited" ? '<span class="limited-tag" title="Only last ~20 rounds available; refresh GHIN for 2-year data">20-rd data</span>' : "";
}

function playerMeta(p) {
  if (p.hi == null) return "No GHIN data";
  const low = p.lowHi != null ? ` (low ${p.lowHi})` : "";
  return `HI ${p.hi}${low} &middot; Crs ${p.courseHcp} &middot; L10 ${fmtNet(p.netL10)} &middot; 2yr ${fmtNet(p.net2yr)} &middot; best ${fmtNet(p.netBest)} &middot; ${formIcon(p.form)}${sharpBadge(p)} &middot; <span class="proj">Proj ${fmtNet1(proj(p))}</span>${limitedTag(p)}`;
}

// ---- Field selection ----

// Players who make the teams: accepted (plus pending invitees when projecting),
// capped at 24 in Cup points order.
function fieldPlayers() {
  const ok = s => s === "accepted" || (state.includePending && s === "invited");
  return PLAYERS.filter(p => ok(st(p.name))).slice(0, FIELD);
}

function counts() {
  const c = { accepted: 0, invited: 0, declined: 0, alternate: 0 };
  PLAYERS.forEach(p => { c[st(p.name)]++; });
  return c;
}

// ---- Balancer ----

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const sd = a => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

function balanceTeams(players) {
  const n = players.length;
  const hi = players.map(p => p.hi ?? 0);
  const pj = players.map(p => proj(p) ?? 0);
  const sHi = sd(hi) || 1, sPj = sd(pj) || 1;
  const mode = state.mode;

  const cost = assign => {
    const t = [[], []], u = [[], []];
    assign.forEach((team, i) => { t[team].push(hi[i]); u[team].push(pj[i]); });
    const dHi = Math.abs(mean(t[0]) - mean(t[1])) / sHi;
    const dPj = Math.abs(mean(u[0]) - mean(u[1])) / sPj;
    // Small term keeps the spread of handicaps similar so match-play pairings line up
    const dSpread = Math.abs(sd(t[0]) - sd(t[1])) / sHi;
    if (mode === "hcp") return dHi + 0.1 * dSpread;
    if (mode === "net") return dPj + 0.1 * dSpread;
    return dHi + dPj + 0.1 * dSpread;
  };

  const sizes = [Math.ceil(n / 2), Math.floor(n / 2)];
  const pinned = players.map(p => state.pins[p.name]);
  // Honor pins only while the pinned team still has room
  const room = [...sizes];
  const fixed = pinned.map(t => {
    if (t === 0 || t === 1) { if (room[t] > 0) { room[t]--; return t; } }
    return null;
  });
  const free = fixed.map((t, i) => t === null ? i : -1).filter(i => i >= 0);

  const rng = mulberry32(hashStr(players.map(p => p.name).join("|") + mode + JSON.stringify(fixed)));
  let best = null, bestCost = Infinity;

  for (let r = 0; r < 60; r++) {
    const order = [...free];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const assign = [...fixed];
    order.forEach((idx, k) => { assign[idx] = k < room[0] ? 0 : 1; });

    let c = cost(assign);
    let improved = true;
    while (improved) {
      improved = false;
      for (let a = 0; a < free.length; a++) {
        for (let b = a + 1; b < free.length; b++) {
          const i = free[a], j = free[b];
          if (assign[i] === assign[j]) continue;
          [assign[i], assign[j]] = [assign[j], assign[i]];
          const c2 = cost(assign);
          if (c2 < c - 1e-9) { c = c2; improved = true; }
          else [assign[i], assign[j]] = [assign[j], assign[i]];
        }
      }
    }
    if (c < bestCost) { bestCost = c; best = assign; }
  }

  const teams = [[], []];
  (best || []).forEach((t, i) => teams[t].push(players[i]));
  teams.forEach(t => t.sort((a, b) => (a.hi ?? 99) - (b.hi ?? 99)));
  return teams;
}

function teamStats(team) {
  const valid = team.filter(p => p.hi != null);
  return {
    n: team.length,
    avgHi: mean(valid.map(p => p.hi)),
    totCrs: valid.reduce((s, p) => s + p.courseHcp, 0),
    avgProj: mean(valid.map(p => proj(p)).filter(x => x != null)),
    avgL10: mean(valid.map(p => p.netL10).filter(x => x != null)),
    avg2yr: mean(valid.map(p => p.net2yr).filter(x => x != null)),
    imp: team.filter(p => p.form === "Improving").length,
    dec: team.filter(p => p.form === "Declining").length,
    sharp: team.filter(p => p.sharp).length,
    pending: team.filter(p => st(p.name) === "invited").length,
  };
}

// ---- Actions ----

function setStatus(name, s) {
  state.status[name] = s;
  if (s === "declined" || s === "alternate") delete state.pins[name];
  saveState();
  render();
}

function togglePin(name, team) {
  if (state.pins[name] === team) delete state.pins[name];
  else state.pins[name] = team;
  saveState();
  render();
}

// ---- Roster view ----

function statusButtons(p) {
  const s = st(p.name);
  if (s === "alternate") {
    return `
      <button class="st-btn invite-next" data-status="invited" data-name="${p.name}">Invite</button>`;
  }
  const btn = (val, label) => {
    const on = s === val;
    // Tapping the active choice reverts to "invited / no answer yet"
    return `<button class="st-btn ${val}${on ? " on" : ""}" data-status="${on ? "invited" : val}" data-name="${p.name}">${label}</button>`;
  };
  return btn("accepted", "&#10003; In") + btn("declined", "&#10007; Out");
}

function rosterCard(p) {
  const s = st(p.name);
  const pts = p.points != null ? `${p.points} pts` : "pts n/a";
  return `
    <div class="player-card st-${s}">
      <div class="pinfo">
        <div class="pname"><span class="cup-rank">${p.rank}</span>${p.name}</div>
        <div class="cup-pts">${pts} &middot; ${p.wins} win${p.wins === 1 ? "" : "s"} in ${p.events} events</div>
        <div class="pmeta">${playerMeta(p)}</div>
      </div>
      <div class="status-group">${statusButtons(p)}</div>
    </div>`;
}

function renderRoster() {
  const c = counts();
  const open = Math.max(0, FIELD - c.accepted - c.invited);
  const nextAlts = PLAYERS.filter(p => st(p.name) === "alternate").slice(0, open);

  let notice;
  if (c.accepted >= FIELD) {
    notice = `<div class="notice ok">Field is full: ${c.accepted} players have accepted.${c.accepted > FIELD ? ` Only the top ${FIELD} by Cup points are placed on teams.` : ""}</div>`;
  } else if (open > 0) {
    notice = `<div class="notice">${open} spot${open > 1 ? "s" : ""} open after declines. Next up: <b>${nextAlts.map(p => p.name).join(", ") || "no alternates left"}</b>.</div>`;
  } else {
    notice = `<div class="notice">${c.invited} invitation${c.invited === 1 ? "" : "s"} still waiting on an answer. Teams use ${state.includePending ? "accepted + pending" : "accepted only"} players and rebalance automatically.</div>`;
  }

  const section = (label, list) => list.length
    ? `<div class="section-label">${label} (${list.length})</div>${list.map(rosterCard).join("")}` : "";

  return `
    <div class="summary-bar">
      <div><div class="num">${c.accepted}</div><div class="lbl">Accepted</div></div>
      <div><div class="num">${c.invited}</div><div class="lbl">Pending</div></div>
      <div><div class="num">${c.declined}</div><div class="lbl">Declined</div></div>
      <div><div class="num">${Math.max(0, FIELD - c.accepted)}</div><div class="lbl">Spots left</div></div>
    </div>
    ${notice}
    ${section("Invited", PLAYERS.filter(p => ["invited", "accepted"].includes(st(p.name))))}
    ${section("Alternates", PLAYERS.filter(p => st(p.name) === "alternate"))}
    ${section("Declined", PLAYERS.filter(p => st(p.name) === "declined"))}
  `;
}

// ---- Teams view ----

function teamsControls() {
  const seg = (val, label) => `<button class="${state.mode === val ? "on" : ""}" data-mode="${val}">${label}</button>`;
  return `
    <div class="ctrl-row">
      <label>Balance on</label>
      <span class="seg">${seg("both", "Both")}${seg("hcp", "Handicap")}${seg("net", "Net form")}</span>
      <span class="chk"><input type="checkbox" id="pending-chk" ${state.includePending ? "checked" : ""}> Include pending invites</span>
    </div>`;
}

function renderTeams() {
  const field = fieldPlayers();
  const teams = balanceTeams(field);
  const s = teams.map(teamStats);

  const short = FIELD - field.length;
  const notice = short > 0
    ? `<div class="notice">${field.length} players in the field, ${short} short of ${FIELD}. ${state.includePending ? "Invite alternates from the Roster tab." : "Turn on “Include pending invites” to project the full field."}</div>`
    : (s[0].pending + s[1].pending
      ? `<div class="notice">Projection: includes ${s[0].pending + s[1].pending} player(s) who haven't answered yet.</div>`
      : `<div class="notice ok">All ${FIELD} players confirmed.</div>`);

  const row = (label, f, better) => {
    const v = [f(s[0]), f(s[1])];
    return `<tr><td>${label}</td><td>${v[0]}</td><td>${v[1]}</td></tr>`;
  };
  const balance = `
    <div class="balance-card">
      <b>Balance check</b>
      <table>
        <tr><th></th><th>${state.teamNames[0]}</th><th>${state.teamNames[1]}</th></tr>
        ${row("Players", t => t.n)}
        ${row("Avg HI", t => fmt1(t.avgHi))}
        ${row("Total course hcp", t => t.totCrs)}
        ${row("Avg Proj net", t => fmtNet1(t.avgProj))}
        ${row("Avg L10 net", t => fmtNet1(t.avgL10))}
        ${row("Avg 2yr net", t => fmtNet1(t.avg2yr))}
        ${row("Improving / Declining", t => `${t.imp} / ${t.dec}`)}
        ${row("SHARP", t => t.sharp)}
      </table>
    </div>`;

  const cards = teams.map((team, ti) => {
    const rows = team.map(p => {
      const pin = state.pins[p.name] === ti;
      return `
        <div class="tm-row${st(p.name) === "invited" ? " pending" : ""}">
          <div>
            <div class="tm-name">${p.name}</div>
            <div class="tm-meta">HI ${p.hi ?? "n/a"} &middot; Crs ${p.courseHcp ?? "n/a"} &middot; Proj ${fmtNet1(proj(p))} &middot; ${p.form || ""}${p.sharp ? " &#9889;" : ""}</div>
          </div>
          <span>
            <button class="pin-btn${pin ? " on" : ""}" data-pin="${ti}" data-name="${p.name}" title="Lock to this team">&#128204;</button>
            <button class="pin-btn" data-pin="${1 - ti}" data-name="${p.name}" title="Lock to the other team">&#8644;</button>
          </span>
        </div>`;
    }).join("");
    return `
      <div class="cup-team t${ti}">
        <input class="team-name" data-team="${ti}" value="${state.teamNames[ti].replace(/"/g, "&quot;")}">
        <div class="team-totals">${s[ti].n} players &middot; avg HI <b>${fmt1(s[ti].avgHi)}</b> &middot; avg Proj <b>${fmtNet1(s[ti].avgProj)}</b></div>
        ${rows || '<div class="tm-meta">No players yet</div>'}
      </div>`;
  }).join("");

  const pinCount = Object.keys(state.pins).length;
  const clearPins = pinCount
    ? `<button id="clear-pins-btn" class="undo-btn">Clear ${pinCount} locked player${pinCount > 1 ? "s" : ""}</button>` : "";

  return `
    ${teamsControls()}
    ${notice}
    ${balance}
    <button id="copy-teams-btn" class="copy-teams-btn">&#128203; Copy Teams as Text</button>
    ${clearPins}
    <div class="teams-grid">${cards}</div>
    <p class="tm-meta" style="margin-top:12px">&#128204; locks a player (e.g. a captain) to their team; &#8644; locks them to the other team. Everyone else is placed automatically.</p>
  `;
}

function teamsAsText() {
  const teams = balanceTeams(fieldPlayers());
  const lines = ["Youche Cup — Teams", ""];
  teams.forEach((team, ti) => {
    const s = teamStats(team);
    lines.push(`${state.teamNames[ti]} (avg HI ${fmt1(s.avgHi)})`);
    team.forEach(p => lines.push(`  ${p.name} (HI ${p.hi ?? "n/a"})${st(p.name) === "invited" ? " - pending" : ""}`));
    lines.push("");
  });
  return lines.join("\n").trim();
}

function copyTeamsText() {
  const text = teamsAsText();
  const btn = document.getElementById("copy-teams-btn");
  const flash = label => {
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = label;
    setTimeout(() => { btn.textContent = original; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => flash("Copied!")).catch(() => flash("Copy failed"));
  } else {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); flash("Copied!"); } catch (e) { flash("Copy failed"); }
    document.body.removeChild(ta);
  }
}

// ---- Players view ----

function renderPlayers() {
  const sorters = {
    proj: (a, b) => (proj(a) ?? 99) - (proj(b) ?? 99) || (a.netBest ?? 99) - (b.netBest ?? 99),
    hi: (a, b) => (a.hi ?? 99) - (b.hi ?? 99),
    rank: (a, b) => PLAYERS.indexOf(a) - PLAYERS.indexOf(b),
  };
  const list = [...PLAYERS].filter(p => st(p.name) !== "declined").sort(sorters[playerSort]);
  const seg = (val, label) => `<button class="${playerSort === val ? "on" : ""}" data-sort="${val}">${label}</button>`;
  const rows = list.map((p, i) => `
    <div class="player-card st-${st(p.name)}">
      <div class="pinfo">
        <div class="pname"><span class="cup-rank">${i + 1}.</span>${p.name} <span class="cup-pts">&middot; Cup #${p.rank}</span></div>
        <div class="pmeta">${playerMeta(p)}</div>
      </div>
    </div>`).join("");
  return `
    <div class="ctrl-row">
      <label>Sort by</label>
      <span class="seg">${seg("proj", "Proj net")}${seg("hi", "Handicap")}${seg("rank", "Cup points")}</span>
    </div>
    <div class="section-label">${list.length} candidates (declined hidden)</div>
    ${rows}`;
}

// ---- Stats Guide ----

const GUIDE_STATS = [
  {
    term: "HI", sub: "Handicap Index",
    def: "The player's current official USGA/WHS Handicap Index.",
    good: "Low HI = strong ball-striker. In net matches everyone gets their strokes, so HI alone doesn't make a player stronger.",
    bad: "A high HI isn't bad by itself. Form and consistency matter more once strokes level the field."
  },
  {
    term: "Low", sub: "365-Day Low Index",
    def: "The lowest Handicap Index they've had in the last 365 days, their best recent form.",
    good: "Current HI close to Low means they're playing near their peak right now (⚡ SHARP).",
    bad: "A big gap between HI and Low means they're scoring worse than their proven ceiling right now."
  },
  {
    term: "Crs", sub: "Course Handicap",
    def: "Strokes received on Youche's white tees (Course Rating 70.4, Slope 127, Par 71).",
    good: "Neither good nor bad. It converts gross to net. The Teams tab totals it per team.",
    bad: "A big gap in total course handicap between teams means one side is giving up a lot of strokes in gross formats."
  },
  {
    term: "L10", sub: "Net-to-Par, Last 10 Rounds",
    def: "Average net score to par (white tees) over their most recent 10 rounds. E = even, + = over, − = under.",
    good: "Low or negative means they've recently been playing at or better than their handicap.",
    bad: "+5 or more means recent rounds have been well above what their handicap predicts."
  },
  {
    term: "2yr", sub: "Net-to-Par, 2-Year Average",
    def: "The same net-to-par number averaged over 2 years of GHIN scores, their long-run level. A few strokes over is normal, because handicaps are built from a player's best rounds.",
    good: "2yr at or above L10 means current form matches or beats their long-term norm.",
    bad: "2yr well below L10 means they're playing worse than usual right now and may bounce back."
  },
  {
    term: "Best", sub: "Net-to-Par, Personal Best",
    def: "Their single best net round over the period, their ceiling on a hot day.",
    good: "Strongly negative (e.g. −7) means they can go very low. Great in match play.",
    bad: "Close to E means a lower ceiling and less upside."
  },
  {
    term: "Form", sub: "Improving / Stable / Declining",
    def: "Compares the last 10 rounds to rounds 11–30 back.",
    good: "▲ Improving: trending up, often before their handicap catches up.",
    bad: "▼ Declining: recent results slipping, so their handicap may be generous right now."
  },
  {
    term: "⚡ SHARP", sub: "Badge",
    def: "Current Handicap Index is within 0.6 of their 365-day low.",
    good: "Playing peak golf right now.",
    bad: "No badge just means more room between current form and their best."
  },
  {
    term: "Proj", sub: "Projected Net-to-Par",
    def: "60% L10 + 40% 2yr. One number for how a player should score net right now, weighted toward current form. Lower is stronger.",
    good: "Used by the balancer so neither team stacks the in-form players.",
    bad: "It's a projection from posted scores. Players who rarely post can be misjudged."
  },
  {
    term: "20-rd data", sub: "Tag",
    def: "No 2-year history yet for this player (they weren't in the Calcutta field). Their numbers come from their last ~20 GHIN rounds as of June 2026, and there's no 365-day low.",
    good: "Run python3 youche_cup.py --refresh with GHIN access to replace these with full, current 2-year data for everyone.",
    bad: "Treat these players' Form, Best and SHARP as rougher estimates until refreshed."
  },
];

function renderGuide() {
  const cards = GUIDE_STATS.map(s => `
    <div class="guide-card">
      <div class="guide-term">${s.term} <span class="guide-sub">${s.sub}</span></div>
      <div class="guide-def">${s.def}</div>
      <div class="guide-rating good"><span class="guide-tag good-tag">GOOD</span> ${s.good}</div>
      <div class="guide-rating bad"><span class="guide-tag bad-tag">WATCH FOR</span> ${s.bad}</div>
    </div>`).join("");
  return `
    <div class="guide-intro">
      <h2>Stats Guide</h2>
      <p>Same player evaluation as the Calcutta, without flights. Net-to-par figures are on Youche whites
      (70.4/127/71) using the player's own handicap.</p>
      <p><b>How teams are balanced:</b> the top ${FIELD} available players (by Cup points) are split
      ${TEAM_SIZE}–${TEAM_SIZE}. The balancer tries thousands of splits and keeps the one where the teams'
      average Handicap Index and/or average Proj net are closest, with the spread of handicaps kept similar
      so match-play pairings line up. Any time someone accepts or declines, teams are rebuilt automatically.</p>
    </div>
    <div class="guide-list">${cards}</div>`;
}

// ---- Render ----

function render() {
  const app = document.getElementById("app");
  if (activeView === "roster") app.innerHTML = renderRoster();
  else if (activeView === "teams") app.innerHTML = renderTeams();
  else if (activeView === "players") app.innerHTML = renderPlayers();
  else app.innerHTML = renderGuide();

  app.querySelectorAll("[data-status]").forEach(b =>
    b.addEventListener("click", () => setStatus(b.dataset.name, b.dataset.status)));
  app.querySelectorAll("[data-pin]").forEach(b =>
    b.addEventListener("click", () => togglePin(b.dataset.name, parseInt(b.dataset.pin, 10))));
  app.querySelectorAll("[data-mode]").forEach(b =>
    b.addEventListener("click", () => { state.mode = b.dataset.mode; saveState(); render(); }));
  app.querySelectorAll("[data-sort]").forEach(b =>
    b.addEventListener("click", () => { playerSort = b.dataset.sort; render(); }));
  app.querySelectorAll("input.team-name").forEach(inp =>
    inp.addEventListener("change", () => {
      state.teamNames[+inp.dataset.team] = inp.value.trim() || `Team ${+inp.dataset.team + 1}`;
      saveState(); render();
    }));

  const pending = document.getElementById("pending-chk");
  if (pending) pending.addEventListener("change", () => { state.includePending = pending.checked; saveState(); render(); });

  const clear = document.getElementById("clear-pins-btn");
  if (clear) clear.addEventListener("click", () => { state.pins = {}; saveState(); render(); });

  const copyBtn = document.getElementById("copy-teams-btn");
  if (copyBtn) copyBtn.addEventListener("click", copyTeamsText);
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeView = btn.dataset.view;
    render();
  });
});

document.getElementById("reset-btn").addEventListener("click", () => {
  if (confirm("Reset everything? This clears all accept/decline answers, locks and team names.")) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    state = defaultState();
    render();
  }
});

render();
