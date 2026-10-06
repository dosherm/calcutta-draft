// Youche Cup — invite tracker + live captains' draft
// Single-device, localStorage-persisted. PLAYERS comes from data.js (youche_cup.py).

const STORAGE_KEY = "youche-cup-state-v3";
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

// Captains (data.js "captain": 0 | 1) are in, head their own team, and the
// teams are named after them.
const CAPTAINS = [0, 1].map(t => PLAYERS.find(p => p.captain === t));
const isCaptain = name => CAPTAINS.some(c => c && c.name === name);
const byName = Object.fromEntries(PLAYERS.map(p => [p.name, p]));

function defaultState() {
  // The top 24 who haven't already said no get invited; the rest are alternates
  let invited = 0;
  const status = Object.fromEntries(PLAYERS.map(p => {
    if (p.captain != null) { invited++; return [p.name, "accepted"]; }
    if (p.status === "declined") return [p.name, "declined"];
    return [p.name, invited++ < FIELD ? "invited" : "alternate"];
  }));
  return {
    status,
    teamNames: CAPTAINS.map((c, t) => c ? `Team ${c.name.split(" ").slice(-1)[0]}` : `Team ${t + 1}`),
    draft: {
      started: false,
      first: 0,            // team index with the first pick
      format: "snake",     // "snake" (1-2-2-2…) or "alternate" (1-1-1…)
      picks: [],           // [{team, name}] in pick order
    },
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
let playerSort = "rank";
let poolSort = "rank";

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

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

function capTag(p) {
  return isCaptain(p.name) ? ' <span class="cap-c">C</span>' : "";
}

function playerMeta(p) {
  if (p.hi == null) return "No GHIN data";
  const low = p.lowHi != null ? ` (low ${p.lowHi})` : "";
  return `HI ${p.hi}${low} &middot; Crs ${p.courseHcp} &middot; L10 ${fmtNet(p.netL10)} &middot; 2yr ${fmtNet(p.net2yr)} &middot; best ${fmtNet(p.netBest)} &middot; ${formIcon(p.form)}${sharpBadge(p)} &middot; <span class="proj">Proj ${fmtNet1(proj(p))}</span>${limitedTag(p)}`;
}

const sorters = {
  rank: (a, b) => PLAYERS.indexOf(a) - PLAYERS.indexOf(b),
  hi: (a, b) => (a.hi ?? 99) - (b.hi ?? 99),
  proj: (a, b) => (proj(a) ?? 99) - (proj(b) ?? 99) || (a.netBest ?? 99) - (b.netBest ?? 99),
};

function sortSeg(current, attr) {
  const seg = (val, label) => `<button class="${current === val ? "on" : ""}" data-${attr}="${val}">${label}</button>`;
  return `<span class="seg">${seg("rank", "Cup points")}${seg("hi", "Handicap")}${seg("proj", "Proj net")}</span>`;
}

function counts() {
  const c = { accepted: 0, invited: 0, declined: 0, alternate: 0 };
  PLAYERS.forEach(p => { c[st(p.name)]++; });
  return c;
}

// ---- Draft model ----

const PICKS_PER_TEAM = TEAM_SIZE - 1;   // captains are already on their teams
const TOTAL_PICKS = PICKS_PER_TEAM * 2;

// Team index for each pick slot. Snake: A, B B, A A, B B… Alternate: A B A B…
function pickSequence() {
  const { first, format } = state.draft;
  const second = 1 - first;
  const seq = [];
  for (let i = 0; i < TOTAL_PICKS; i++) {
    if (format === "alternate") seq.push(i % 2 === 0 ? first : second);
    else seq.push(Math.floor((i + 1) / 2) % 2 === 0 ? first : second);
  }
  return seq;
}

function teamRoster(t) {
  const cap = CAPTAINS[t];
  return [...(cap ? [cap] : []), ...state.draft.picks.filter(p => p.team === t).map(p => byName[p.name])];
}

const isDrafted = name => isCaptain(name) || state.draft.picks.some(p => p.name === name);

// Accepted and still-pending invitees can be drafted; alternates and declines can't.
function draftPool() {
  return PLAYERS.filter(p => !isDrafted(p.name) && ["accepted", "invited"].includes(st(p.name)));
}

// The team owed the earliest slot in the sequence. Normally that's just the next
// slot, but if a drafted player drops out, his team gets the next pick it's owed.
function onTheClock() {
  const made = [0, 1].map(t => state.draft.picks.filter(p => p.team === t).length);
  const due = [0, 0];
  for (const t of pickSequence()) {
    due[t]++;
    if (due[t] > made[t]) return t;
  }
  return null;
}

// ---- Actions ----

function setStatus(name, s) {
  state.status[name] = s;
  // A drafted player who drops out comes off his team; that captain picks again later
  if (s === "declined" || s === "alternate") {
    state.draft.picks = state.draft.picks.filter(p => p.name !== name);
  }
  saveState();
  render();
}

function makePick(name) {
  const team = onTheClock();
  if (team === null || isDrafted(name)) return;
  state.draft.picks.push({ team, name });
  saveState();
  render();
}

function undoPick() {
  state.draft.picks.pop();
  saveState();
  render();
}

// ---- Roster view ----

function statusButtons(p) {
  if (isCaptain(p.name)) return '<span class="captain-badge">CAPTAIN</span>';
  const s = st(p.name);
  if (s === "alternate") {
    return `<button class="st-btn invite-next" data-status="invited" data-name="${p.name}">Invite</button>`;
  }
  const btn = (val, label) => {
    const on = s === val;
    // Tapping the active choice reverts to "invited / no answer yet"
    return `<button class="st-btn ${val}${on ? " on" : ""}" data-status="${on ? "invited" : val}" data-name="${p.name}">${label}</button>`;
  };
  return btn("accepted", "&#10003; In") + btn("declined", "&#10007; Out");
}

function draftedLabel(p) {
  const pk = state.draft.picks.find(x => x.name === p.name);
  return pk ? ` <span class="drafted-to">${state.teamNames[pk.team]}</span>` : "";
}

function rosterCard(p) {
  const s = st(p.name);
  const pts = p.points != null ? `${p.points} pts` : "pts n/a";
  return `
    <div class="player-card st-${s}">
      <div class="pinfo">
        <div class="pname"><span class="cup-rank">${p.rank}</span>${p.name}${capTag(p)}${draftedLabel(p)}</div>
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
    notice = `<div class="notice ok">Field is full: ${c.accepted} players have accepted.</div>`;
  } else if (open > 0) {
    notice = `<div class="notice">${open} spot${open > 1 ? "s" : ""} open after declines. Next up: <b>${nextAlts.map(p => p.name).join(", ") || "no alternates left"}</b>.</div>`;
  } else {
    notice = `<div class="notice">${c.invited} invitation${c.invited === 1 ? "" : "s"} still waiting on an answer.</div>`;
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

// ---- Draft view ----

function renderSetup() {
  const d = state.draft;
  const name = t => state.teamNames[t];
  const seg = (val, label) => `<button class="${d.format === val ? "on" : ""}" data-format="${val}">${label}</button>`;
  const firstBtn = t => `<button class="${d.first === t ? "on" : ""}" data-first="${t}">${name(t)}</button>`;
  const order = pickSequence().slice(0, 8).map(t => name(t).replace(/^Team /, "")).join(", ");
  const c = counts();

  return `
    <div class="setup-intro">
      <h2>Set Up the Draft</h2>
      <p>${CAPTAINS.map(cp => cp ? cp.name : "?").join(" and ")} each draft ${PICKS_PER_TEAM} players for a team of ${TEAM_SIZE}.
      Accepted players and invitees still waiting to answer can be drafted.</p>
    </div>
    <div class="ctrl-row">
      <label>First pick</label>
      <span class="seg">${firstBtn(0)}${firstBtn(1)}</span>
      <button id="coin-btn" class="st-btn">&#129689; Flip a coin</button>
    </div>
    <div class="ctrl-row">
      <label>Format</label>
      <span class="seg">${seg("snake", "Snake (1-2-2…)")}${seg("alternate", "Alternate (1-1…)")}</span>
      <div class="tm-meta" style="width:100%">Order: ${order}…</div>
    </div>
    ${c.invited ? `<div class="notice">${c.invited} invitee${c.invited === 1 ? " hasn't" : "s haven't"} answered yet. They'll still show in the draft pool, marked pending.</div>` : ""}
    <button id="start-btn" class="big-btn start">Start Draft &#8594;</button>
  `;
}

function renderDraft() {
  if (!state.draft.started) return renderSetup();

  const picksDone = state.draft.picks.length;
  const team = onTheClock();
  const last = state.draft.picks[picksDone - 1];
  const undoBtn = last
    ? `<button id="undo-btn" class="undo-btn">&#8630; Undo last pick (${last.name})</button>` : "";

  if (team === null) {
    return `<div class="draft-complete">
      <h2>Draft Complete</h2>
      <p>Both teams have ${TEAM_SIZE} players. See the Teams tab.</p>
    </div>${undoBtn}`;
  }

  const pool = draftPool().sort(sorters[poolSort]);
  const seq = pickSequence();
  const nextUp = seq.slice(picksDone + 1, picksDone + 4).map(t => state.teamNames[t].replace(/^Team /, "")).join(", ");
  const cards = pool.map(p => `
    <div class="player-card st-${st(p.name)}">
      <div class="pinfo">
        <div class="pname"><span class="cup-rank">${p.rank}</span>${p.name}${st(p.name) === "invited" ? ' <span class="pending-tag">pending</span>' : ""}</div>
        <div class="pmeta">${playerMeta(p)}</div>
      </div>
      <button class="pick-btn" data-pick="${p.name}">Draft</button>
    </div>`).join("");

  return `
    <div class="draft-status">
      <div class="pick-label">Pick ${picksDone + 1} of ${TOTAL_PICKS}</div>
      <div class="on-clock">${state.teamNames[team]}</div>
      <div class="on-clock-sub">${CAPTAINS[team] ? CAPTAINS[team].name : ""} is on the clock &middot; ${teamRoster(team).length} of ${TEAM_SIZE} on the team${nextUp ? ` &middot; then ${nextUp}` : ""}</div>
    </div>
    ${undoBtn}
    <div class="ctrl-row"><label>Sort by</label>${sortSeg(poolSort, "poolsort")}</div>
    <div class="section-label">Available (${pool.length})</div>
    ${cards || "<p>No players left in the pool. Invite alternates from the Roster tab.</p>"}
  `;
}

// ---- Teams view ----

function teamStats(team) {
  const valid = team.filter(p => p.hi != null);
  return {
    n: team.length,
    avgHi: valid.length ? valid.reduce((s, p) => s + p.hi, 0) / valid.length : null,
    totCrs: valid.reduce((s, p) => s + p.courseHcp, 0),
  };
}

function renderTeams() {
  const cards = [0, 1].map(t => {
    const roster = teamRoster(t);
    const s = teamStats(roster);
    const rows = roster.map(p => {
      const pickNo = state.draft.picks.findIndex(x => x.name === p.name);
      const label = isCaptain(p.name) ? "C" : `#${pickNo + 1}`;
      return `
        <div class="tm-row${st(p.name) === "invited" ? " pending" : ""}">
          <div>
            <div class="tm-name"><span class="cup-rank">${label}</span>${p.name}</div>
            <div class="tm-meta">HI ${p.hi ?? "n/a"} &middot; Crs ${p.courseHcp ?? "n/a"} &middot; L10 ${fmtNet(p.netL10)} &middot; 2yr ${fmtNet(p.net2yr)} &middot; ${p.form || ""}${p.sharp ? " &#9889;" : ""}</div>
          </div>
        </div>`;
    }).join("");
    const empty = TEAM_SIZE - roster.length;
    return `
      <div class="cup-team t${t}">
        <input class="team-name" data-team="${t}" value="${state.teamNames[t].replace(/"/g, "&quot;")}">
        <div class="team-totals">${s.n} of ${TEAM_SIZE} &middot; avg HI <b>${fmt1(s.avgHi)}</b> &middot; total course hcp <b>${s.totCrs}</b></div>
        ${rows}
        ${empty > 0 ? `<div class="tm-meta" style="padding-top:6px">${empty} spot${empty > 1 ? "s" : ""} to fill</div>` : ""}
      </div>`;
  }).join("");

  return `
    <button id="copy-teams-btn" class="copy-teams-btn">&#128203; Copy Teams as Text</button>
    <div class="teams-grid">${cards}</div>
    <p class="tm-meta" style="margin-top:12px">Tap a team name to rename it.</p>
  `;
}

function teamsAsText() {
  const lines = ["Youche Cup — Teams", ""];
  [0, 1].forEach(t => {
    lines.push(state.teamNames[t]);
    teamRoster(t).forEach(p =>
      lines.push(`  ${p.name}${isCaptain(p.name) ? " (C)" : ""} (HI ${p.hi ?? "n/a"})${st(p.name) === "invited" ? " - pending" : ""}`));
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
  const list = [...PLAYERS].filter(p => st(p.name) !== "declined").sort(sorters[playerSort]);
  const rows = list.map(p => `
    <div class="player-card st-${st(p.name)}${isDrafted(p.name) && !isCaptain(p.name) ? " drafted" : ""}">
      <div class="pinfo">
        <div class="pname"><span class="cup-rank">${p.rank}</span>${p.name}${capTag(p)}${draftedLabel(p)}</div>
        <div class="pmeta">${playerMeta(p)}</div>
      </div>
    </div>`).join("");
  return `
    <div class="ctrl-row"><label>Sort by</label>${sortSeg(playerSort, "sort")}</div>
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
    bad: "In gross formats, a team with a much higher total is giving up a lot of strokes."
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
    good: "A quick way to compare players with different handicaps.",
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
    </div>
    <div class="guide-list">${cards}</div>`;
}

// ---- Render ----

function render() {
  const app = document.getElementById("app");
  if (activeView === "roster") app.innerHTML = renderRoster();
  else if (activeView === "draft") app.innerHTML = renderDraft();
  else if (activeView === "teams") app.innerHTML = renderTeams();
  else if (activeView === "players") app.innerHTML = renderPlayers();
  else app.innerHTML = renderGuide();

  const on = (sel, fn) => app.querySelectorAll(sel).forEach(b => b.addEventListener("click", () => fn(b)));
  on("[data-status]", b => setStatus(b.dataset.name, b.dataset.status));
  on("[data-pick]", b => makePick(b.dataset.pick));
  on("[data-sort]", b => { playerSort = b.dataset.sort; render(); });
  on("[data-poolsort]", b => { poolSort = b.dataset.poolsort; render(); });
  on("[data-first]", b => { state.draft.first = +b.dataset.first; saveState(); render(); });
  on("[data-format]", b => { state.draft.format = b.dataset.format; saveState(); render(); });
  on("#coin-btn", () => {
    state.draft.first = Math.random() < 0.5 ? 0 : 1;
    saveState(); render();
    alert(`${state.teamNames[state.draft.first]} picks first.`);
  });
  on("#start-btn", () => { state.draft.started = true; saveState(); render(); });
  on("#undo-btn", undoPick);
  on("#copy-teams-btn", copyTeamsText);

  app.querySelectorAll("input.team-name").forEach(inp =>
    inp.addEventListener("change", () => {
      state.teamNames[+inp.dataset.team] = inp.value.trim() || `Team ${+inp.dataset.team + 1}`;
      saveState(); render();
    }));
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
  const choice = prompt("Type DRAFT to clear just the draft picks, or ALL to also clear every accept/decline answer.");
  if (!choice) return;
  if (choice.trim().toUpperCase() === "DRAFT") {
    state.draft = defaultState().draft;
  } else if (choice.trim().toUpperCase() === "ALL") {
    state = defaultState();
  } else return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  render();
});

render();
