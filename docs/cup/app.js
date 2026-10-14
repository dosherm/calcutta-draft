// Youche Cup — live captains' draft
// Single-device, localStorage-persisted. PLAYERS comes from data.js (youche_cup.py).

const STORAGE_KEY = "youche-cup-state-v5";
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
// Agreed in advance: this player goes first overall to whoever wins the coin toss
const FIRST_PICK = PLAYERS.find(p => p.firstPick);

// Tiers: the field split into quarters by Handicap Index (A = lowest quarter).
// Each team takes exactly TEAM_SIZE / 4 players from every tier, captains included.
const TIERS = ["A", "B", "C", "D"];
const PER_TIER = TEAM_SIZE / TIERS.length;
const tierOf = {};
[...PLAYERS]
  .sort((a, b) => (a.hi ?? 99) - (b.hi ?? 99) || a.name.localeCompare(b.name))
  .forEach((p, i) => { tierOf[p.name] = TIERS[Math.floor(i * TIERS.length / PLAYERS.length)]; });
const tierPlayers = t => PLAYERS.filter(p => tierOf[p.name] === t);

function tierRange(t) {
  const hs = tierPlayers(t).map(p => p.hi).filter(h => h != null);
  return `HI ${fmtHi(Math.min(...hs))}–${fmtHi(Math.max(...hs))}`;
}

function tierBadge(p) {
  const t = tierOf[p.name];
  return `<span class="tier-badge tier-${t}">${t}</span>`;
}

function defaultState() {
  return {
    teamNames: CAPTAINS.map((c, t) => c ? `Team ${c.name.split(" ").slice(-1)[0]}` : `Team ${t + 1}`),
    draft: {
      started: false,
      first: 0,            // team index with the first pick
      format: "snake",     // "snake" (1-2-2-2…) or "alternate" (1-1-1…)
      picks: [],           // [{team, name}] in pick order
    },
    // your own ranked want list (names, best first), seeded from data.js "myList"
    myList: PLAYERS.filter(p => p.myList).sort((a, b) => a.myList - b.myList).map(p => p.name),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = { ...defaultState(), ...JSON.parse(raw) };
      // Drop picks of anyone no longer in the field
      s.draft.picks = s.draft.picks.filter(p => byName[p.name]);
      s.myList = (s.myList || []).filter(n => byName[n]);
      return s;
    }
  } catch (e) { /* fall through */ }
  return defaultState();
}

let state = loadState();
let activeView = "draft";
let playerSort = "hi";
let poolSort = "hi";
let poolTier = "all";

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

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

// Plus handicaps display golf-style: a course handicap of -1 is "+1"
function fmtCrs(c) {
  if (c === null || c === undefined) return "n/a";
  return c < 0 ? `+${-c}` : `${c}`;
}

function fmtHi(h) {
  if (h === null || h === undefined) return "n/a";
  return h < 0 ? `+${(-h).toFixed(1)}` : h.toFixed(1);
}

function playerMeta(p) {
  if (p.hi == null) return "No GHIN data";
  if (p.basis === "none") return `<b class="yhcp">Youche ${fmtCrs(p.courseHcp)}</b> (HI ${fmtHi(p.hi)}) &middot; <span class="limited-tag">no GHIN history</span>`;
  const low = p.lowHi != null ? `, low ${fmtHi(p.lowHi)}` : "";
  return `<b class="yhcp">Youche ${fmtCrs(p.courseHcp)}</b> (HI ${fmtHi(p.hi)}${low}) &middot; L10 ${fmtNet(p.netL10)} &middot; 2yr ${fmtNet(p.net2yr)} &middot; best ${fmtNet(p.netBest)} &middot; ${formIcon(p.form)}${sharpBadge(p)} &middot; <span class="proj">Proj ${fmtNet1(proj(p))}</span>${limitedTag(p)}`;
}

const sorters = {
  hi: (a, b) => (a.hi ?? 99) - (b.hi ?? 99),
  l10: (a, b) => (a.netL10 ?? 99) - (b.netL10 ?? 99) || (a.hi ?? 99) - (b.hi ?? 99),
  proj: (a, b) => (proj(a) ?? 99) - (proj(b) ?? 99) || (a.netBest ?? 99) - (b.netBest ?? 99),
};

function sortSeg(current, attr) {
  const seg = (val, label) => `<button class="${current === val ? "on" : ""}" data-${attr}="${val}">${label}</button>`;
  return `<span class="seg">${seg("hi", "Youche hcp")}${seg("l10", "L10 net")}${seg("proj", "Proj net")}</span>`;
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

function draftPool() {
  return PLAYERS.filter(p => !isDrafted(p.name));
}

const tierCount = (team, t) => teamRoster(team).filter(p => tierOf[p.name] === t).length;
const tierOpen = (team, t) => tierCount(team, t) < PER_TIER;
const canPick = (team, name) => team !== null && !isDrafted(name) && tierOpen(team, tierOf[name]);

// ---- My List: a private ranked want list. Picked players drop off the view
// (they stay stored, so undoing a pick puts them back in their old spot). ----

const onMyList = name => state.myList.includes(name);
const myListAvailable = () => state.myList.filter(n => !isDrafted(n));

function toggleMyList(name) {
  if (onMyList(name)) state.myList = state.myList.filter(n => n !== name);
  else state.myList.push(name);
  saveState();
  render();
}

// Move among the still-available names only, so picked players don't get in the way
function moveMyList(name, dir) {
  const avail = myListAvailable();
  const i = avail.indexOf(name), j = i + dir;
  if (i < 0 || j < 0 || j >= avail.length) return;
  const a = state.myList.indexOf(avail[i]), b = state.myList.indexOf(avail[j]);
  [state.myList[a], state.myList[b]] = [state.myList[b], state.myList[a]];
  saveState();
  render();
}

function starBtn(p) {
  if (isCaptain(p.name)) return "";
  const on = onMyList(p.name);
  return `<button class="star-btn${on ? " on" : ""}" data-star="${p.name}" title="${on ? "Remove from" : "Add to"} My List">${on ? "&#9733;" : "&#9734;"}</button>`;
}

function myListRank(name) {
  const i = myListAvailable().indexOf(name);
  return i >= 0 ? ` <span class="mylist-rank">My #${i + 1}</span>` : "";
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

function makePick(name) {
  const team = onTheClock();
  if (!canPick(team, name)) return;
  state.draft.picks.push({ team, name });
  saveState();
  render();
}

function undoPick() {
  state.draft.picks.pop();
  saveState();
  render();
}

function draftedLabel(p) {
  const pk = state.draft.picks.find(x => x.name === p.name);
  return pk ? ` <span class="drafted-to">${state.teamNames[pk.team]}</span>` : "";
}

// ---- Draft view ----

const shortName = t => state.teamNames[t].replace(/^Team /, "");

// Tier preview for the setup screen: who is in each tier
function tierPreview() {
  return TIERS.map(t => `
    <div class="tier-preview">
      <div class="tier-head">${tierBadge(tierPlayers(t)[0])} Tier ${t} <span class="tm-meta">${tierRange(t)}</span></div>
      <div class="tm-meta">${tierPlayers(t).sort(sorters.hi).map(p => p.name + (isCaptain(p.name) ? " (C)" : "")).join(", ")}</div>
    </div>`).join("");
}

function renderSetup() {
  const d = state.draft;
  const name = t => state.teamNames[t];
  const seg = (val, label) => `<button class="${d.format === val ? "on" : ""}" data-format="${val}">${label}</button>`;
  const firstBtn = t => `<button class="${d.first === t ? "on" : ""}" data-first="${t}">${name(t)}</button>`;
  const order = pickSequence().slice(0, 8).map(shortName).join(", ");

  return `
    <div class="setup-intro">
      <h2>Set Up the Draft</h2>
      <p>${CAPTAINS.map(cp => cp ? cp.name : "?").join(" and ")} each draft ${PICKS_PER_TEAM} players for a team of ${TEAM_SIZE}:
      <b>${PER_TIER} A's, ${PER_TIER} B's, ${PER_TIER} C's and ${PER_TIER} D's</b>. Tiers are quarters of the field by Handicap Index,
      and captains count toward their own tier. Pick from any tier in any order. Once a team has ${PER_TIER} from a tier, that tier is closed to them.
      ${FIRST_PICK ? ` <b>${FIRST_PICK.name}</b> goes automatically to whoever wins the coin toss as pick 1.` : ""}</p>
    </div>
    <div class="ctrl-row">
      <label>Coin toss winner</label>
      <span class="seg">${firstBtn(0)}${firstBtn(1)}</span>
      <button id="coin-btn" class="st-btn">&#129689; Flip a coin</button>
    </div>
    <div class="ctrl-row">
      <label>Format</label>
      <span class="seg">${seg("snake", "Snake (1-2-2…)")}${seg("alternate", "Alternate (1-1…)")}</span>
      <div class="tm-meta" style="width:100%">Order: ${order}…</div>
    </div>
    <div class="section-label">The tiers</div>
    ${tierPreview()}
    <button id="start-btn" class="big-btn start">Start Draft &#8594;</button>
  `;
}

// Each team's progress through the tiers: one pip per spot, filled as players land
function tierBoard(onClock) {
  const head = `<div class="tb-cell"></div>${TIERS.map(t => `<div class="tb-cell tb-head">${t}</div>`).join("")}`;
  const rows = [0, 1].map(team => {
    const cells = TIERS.map(t => {
      const n = tierCount(team, t);
      const pips = Array.from({ length: PER_TIER }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("");
      return `<div class="tb-cell${n >= PER_TIER ? " full" : ""}"><span class="pips t${team}">${pips}</span></div>`;
    }).join("");
    return `<div class="tb-cell tb-team${team === onClock ? " clock" : ""}">${shortName(team)}</div>${cells}`;
  }).join("");
  return `<div class="tier-board">${head}${rows}</div>`;
}

function poolCard(p, team) {
  const ok = canPick(team, p.name);
  return `
    <div class="player-card tier-card tier-${tierOf[p.name]}${ok ? "" : " locked"}">
      ${starBtn(p)}
      <div class="pinfo">
        <div class="pname">${tierBadge(p)} ${p.name}${myListRank(p.name)}</div>
        <div class="pmeta">${playerMeta(p)}</div>
      </div>
      ${ok ? `<button class="pick-btn" data-pick="${p.name}">Draft</button>`
           : `<span class="full-tag">${tierOf[p.name]} full</span>`}
    </div>`;
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
      <p>Both teams have ${TEAM_SIZE} players, ${PER_TIER} from each tier. See the Teams tab.</p>
    </div>${tierBoard(null)}${undoBtn}`;
  }

  const seq = pickSequence();
  const nextUp = seq.slice(picksDone + 1, picksDone + 4).map(shortName).join(", ");
  const needs = TIERS.filter(t => tierOpen(team, t))
    .map(t => `${PER_TIER - tierCount(team, t)} ${t}`).join(" &middot; ");

  const shown = poolTier === "all" ? TIERS : [poolTier];
  const sections = shown.map(t => {
    const pool = draftPool().filter(p => tierOf[p.name] === t).sort(sorters[poolSort]);
    if (!pool.length) return poolTier === "all" ? "" : `<p class="tm-meta">Tier ${t} is all drafted.</p>`;
    const need = [0, 1].map(tm => `${shortName(tm)} ${PER_TIER - tierCount(tm, t)}`).join(", ");
    const closed = !tierOpen(team, t)
      ? `<div class="tier-closed">${state.teamNames[team]} has its ${PER_TIER} ${t}'s. The rest of Tier ${t} goes to ${state.teamNames[1 - team]}.</div>` : "";
    return `
      <div class="section-label tier-label">${tierBadge(pool[0])} Tier ${t} &middot; ${pool.length} left
        <span class="tier-need">still needed: ${need}</span></div>
      ${closed}
      ${pool.map(p => poolCard(p, team)).join("")}`;
  }).join("");

  const mine = myListAvailable();
  const myStrip = mine.length ? `
    <div class="mylist-strip">
      <div class="mylist-head">My List &middot; next up</div>
      ${mine.slice(0, 3).map((n, i) => `
        <div class="mylist-row">
          <span><span class="mylist-num">${i + 1}</span>${tierBadge(byName[n])} ${n} <span class="tm-meta">Youche ${fmtCrs(byName[n].courseHcp)}</span></span>
          ${canPick(team, n) ? `<button class="pick-btn small" data-pick="${n}">Draft</button>`
                             : `<span class="full-tag">${tierOf[n]} full</span>`}
        </div>`).join("")}
      ${mine.length > 3 ? `<div class="tm-meta">+${mine.length - 3} more on My List</div>` : ""}
    </div>` : "";

  const tierSeg = [["all", "All"], ...TIERS.map(t => [t, t])].map(([v, l]) =>
    `<button class="${poolTier === v ? "on" : ""}" data-pooltier="${v}">${l}</button>`).join("");

  return `
    <div class="draft-status">
      <div class="pick-label">Pick ${picksDone + 1} of ${TOTAL_PICKS}</div>
      <div class="on-clock">${state.teamNames[team]}</div>
      <div class="on-clock-sub">${CAPTAINS[team] ? CAPTAINS[team].name : ""} is on the clock &middot; needs ${needs}${nextUp ? ` &middot; then ${nextUp}` : ""}</div>
    </div>
    ${tierBoard(team)}
    ${undoBtn}
    ${myStrip}
    <div class="ctrl-row"><label>Tier</label><span class="seg">${tierSeg}</span></div>
    <div class="ctrl-row"><label>Sort by</label>${sortSeg(poolSort, "poolsort")}</div>
    ${sections || "<p>No players left in the pool.</p>"}
  `;
}

// ---- My List view ----

function renderMyList() {
  const mine = myListAvailable();
  const picked = state.myList.filter(n => isDrafted(n));
  const rows = mine.map((n, i) => {
    const p = byName[n];
    return `
      <div class="player-card mylist-card">
        <span class="mylist-num big">${i + 1}</span>
        <div class="pinfo">
          <div class="pname">${tierBadge(p)} ${n}</div>
          <div class="pmeta">${playerMeta(p)}</div>
        </div>
        <span class="order-ctrls">
          <button class="ord-btn" data-mymove="-1" data-name="${n}" ${i === 0 ? "disabled" : ""}>&#9650;</button>
          <button class="ord-btn" data-mymove="1" data-name="${n}" ${i === mine.length - 1 ? "disabled" : ""}>&#9660;</button>
          <button class="ord-btn" data-star="${n}" title="Remove">&#10005;</button>
        </span>
      </div>`;
  }).join("");

  const rest = draftPool().filter(p => !onMyList(p.name)).sort(sorters[poolSort]);
  const addRows = rest.map(p => `
    <div class="player-card">
      <div class="pinfo">
        <div class="pname">${tierBadge(p)} ${p.name}</div>
        <div class="pmeta">${playerMeta(p)}</div>
      </div>
      <button class="pick-btn add-btn" data-star="${p.name}">+ Add</button>
    </div>`).join("");

  return `
    <div class="guide-intro">
      <h2>My List</h2>
      <p>Your own order of who you want. Use &#9650;&#9660; to rearrange. When a player is drafted by either team he
      drops off. Undo a pick and he comes back in the same spot. Only you see this list.</p>
    </div>
    ${rows ? `<div class="section-label">Your order (${mine.length})</div>${rows}` : '<div class="notice">Your list is empty. Add players below, or tap &#9734; on the Draft tab.</div>'}
    ${picked.length ? `<div class="tm-meta" style="margin:4px 4px 12px">Already picked: ${picked.join(", ")}</div>` : ""}
    ${addRows ? `<div class="section-label">Add players (${rest.length})</div>${addRows}` : ""}
  `;
}

// ---- Teams view ----

function teamStats(team) {
  const valid = team.filter(p => p.hi != null);
  return {
    n: team.length,
    avgCrs: valid.length ? valid.reduce((s, p) => s + p.courseHcp, 0) / valid.length : null,
    totCrs: valid.reduce((s, p) => s + p.courseHcp, 0),
  };
}

function renderTeams() {
  const cards = [0, 1].map(t => {
    const roster = teamRoster(t);
    const s = teamStats(roster);
    const rows = TIERS.map(tier => {
      const inTier = roster.filter(p => tierOf[p.name] === tier);
      const filled = inTier.map(p => {
        const pickNo = state.draft.picks.findIndex(x => x.name === p.name);
        const label = isCaptain(p.name) ? "C" : `#${pickNo + 1}`;
        return `
          <div class="tm-row">
            <div>
              <div class="tm-name">${tierBadge(p)} <span class="cup-rank">${label}</span>${p.name}</div>
              <div class="tm-meta"><b class="yhcp">Youche ${fmtCrs(p.courseHcp)}</b> &middot; L10 ${fmtNet(p.netL10)} &middot; 2yr ${fmtNet(p.net2yr)} &middot; ${p.form || ""}${p.sharp ? " &#9889;" : ""}</div>
            </div>
          </div>`;
      });
      const open = Array.from({ length: PER_TIER - inTier.length }, () => `
          <div class="tm-row open-slot"><div class="tm-name"><span class="tier-badge tier-${tier}">${tier}</span> <span class="tm-meta">open ${tier} spot</span></div></div>`);
      return filled.join("") + open.join("");
    }).join("");
    return `
      <div class="cup-team t${t}">
        <input class="team-name" data-team="${t}" value="${state.teamNames[t].replace(/"/g, "&quot;")}">
        <div class="team-totals">${s.n} of ${TEAM_SIZE} &middot; total Youche hcp <b>${s.totCrs}</b> &middot; avg <b>${fmt1(s.avgCrs)}</b></div>
        ${rows}
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
    TIERS.forEach(tier => teamRoster(t).filter(p => tierOf[p.name] === tier).forEach(p =>
      lines.push(`  ${tier}  ${p.name}${isCaptain(p.name) ? " (C)" : ""} (Youche ${fmtCrs(p.courseHcp)})`)));
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
  const list = [...PLAYERS].sort(sorters[playerSort]);
  const rows = list.map(p => `
    <div class="player-card${isDrafted(p.name) && !isCaptain(p.name) ? " drafted" : ""}">
      ${isDrafted(p.name) ? "" : starBtn(p)}
      <div class="pinfo">
        <div class="pname">${tierBadge(p)} ${p.name}${capTag(p)}${draftedLabel(p)}${myListRank(p.name)}</div>
        <div class="pmeta">${playerMeta(p)}</div>
      </div>
    </div>`).join("");
  return `
    <div class="ctrl-row"><label>Sort by</label>${sortSeg(playerSort, "sort")}</div>
    <div class="section-label">${list.length} players</div>
    ${rows}`;
}

// ---- Stats Guide ----

const GUIDE_STATS = [
  {
    term: "A / B / C / D", sub: "Draft Tier",
    def: "The field split into quarters by Handicap Index: A is the lowest quarter, D the highest. Each team ends with 3 from every tier, captains included.",
    good: "Spend early picks where the gap between the best and the rest of a tier is biggest.",
    bad: "Once a team has its 3 from a tier, the rest of that tier goes to the other team."
  },
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
    term: "Youche", sub: "Youche White Tees Handicap",
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
      <p>Same player evaluation as the Calcutta, without flights. The main number on each card is the player's
      handicap at Youche from the white tees (Course Rating 70.4, Slope 127, Par 71), worked out from their current
      GHIN Handicap Index (HI). Net-to-par figures use that same handicap.</p>
    </div>
    <div class="guide-list">${cards}</div>`;
}

// ---- Render ----

function render() {
  const app = document.getElementById("app");
  if (activeView === "draft") app.innerHTML = renderDraft();
  else if (activeView === "mylist") app.innerHTML = renderMyList();
  else if (activeView === "teams") app.innerHTML = renderTeams();
  else if (activeView === "players") app.innerHTML = renderPlayers();
  else app.innerHTML = renderGuide();

  const on = (sel, fn) => app.querySelectorAll(sel).forEach(b => b.addEventListener("click", () => fn(b)));
  on("[data-pick]", b => makePick(b.dataset.pick));
  on("[data-star]", b => toggleMyList(b.dataset.star));
  on("[data-mymove]", b => moveMyList(b.dataset.name, +b.dataset.mymove));
  on("[data-sort]", b => { playerSort = b.dataset.sort; render(); });
  on("[data-poolsort]", b => { poolSort = b.dataset.poolsort; render(); });
  on("[data-pooltier]", b => { poolTier = b.dataset.pooltier; render(); });
  on("[data-first]", b => { state.draft.first = +b.dataset.first; saveState(); render(); });
  on("[data-format]", b => { state.draft.format = b.dataset.format; saveState(); render(); });
  on("#coin-btn", () => {
    state.draft.first = Math.random() < 0.5 ? 0 : 1;
    saveState(); render();
    alert(`${state.teamNames[state.draft.first]} wins the toss${FIRST_PICK ? ` and gets ${FIRST_PICK.name}` : " and picks first"}.`);
  });
  on("#start-btn", () => {
    state.draft.started = true;
    if (FIRST_PICK && !state.draft.picks.length) {
      state.draft.picks.push({ team: state.draft.first, name: FIRST_PICK.name });
    }
    saveState(); render();
  });
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
  if (!confirm("Reset the draft? This clears every pick (team names and My List are kept).")) return;
  state.draft = defaultState().draft;
  saveState();
  render();
});

render();
