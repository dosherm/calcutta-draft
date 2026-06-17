// Youche CC Calcutta — live draft tracker
// Single-device, localStorage-persisted. PLAYERS comes from data.js.

const STORAGE_KEY = "calcutta-draft-state-v1";

const flightA = PLAYERS.filter(p => p.flight === "A").sort((a, b) => b.hcp - a.hcp); // highest HCP first
const flightB = PLAYERS.filter(p => p.flight === "B");
const flightC = PLAYERS.filter(p => p.flight === "C");

// Snake draft order: Round 1 = A captains (highest HCP first) pick a B partner.
// Round 2 = reversed order, each A captain picks a C partner.
const pickOrder = [
  ...flightA.map(a => ({ captain: a.name, role: "B" })),
  ...[...flightA].reverse().map(a => ({ captain: a.name, role: "C" })),
];

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through */ }
  }
  return {
    pickIndex: 0,
    teams: Object.fromEntries(flightA.map(a => [a.name, { a: a.name, b: null, c: null }])),
  };
}

let state = loadState();
let activeView = "draft";

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function findPlayer(name) {
  return PLAYERS.find(p => p.name === name);
}

function isDrafted(name) {
  return Object.values(state.teams).some(t => t.b === name || t.c === name);
}

function trendIcon(trend) {
  if (trend === "improving") return '<span class="trend-icon trend-improving">&#9650; Improving</span>';
  if (trend === "declining") return '<span class="trend-icon trend-declining">&#9660; Declining</span>';
  return '<span class="trend-icon trend-stable">&#8226; Stable</span>';
}

function playerMeta(p) {
  const overFlag = p.overMax ? ' <span class="over-flag">OVER 24!</span>' : "";
  return `HCP ${p.hcp} &middot; Course HCP ${p.courseHcp}${overFlag} &middot; Avg Diff ${p.avgDiff} &middot; ${trendIcon(p.trend)}`;
}

function makePick(captainName, playerName) {
  state.teams[captainName][pickOrder[state.pickIndex].role.toLowerCase()] = playerName;
  state.pickIndex += 1;
  saveState();
  render();
}

function renderDraft() {
  const total = pickOrder.length;
  if (state.pickIndex >= total) {
    return `<div class="draft-complete">
      <h2>Draft Complete</h2>
      <p>All ${flightA.length} teams are set. Check the Teams tab for the full rosters.</p>
    </div>`;
  }

  const pick = pickOrder[state.pickIndex];
  const captain = findPlayer(pick.captain);
  const round = pick.role === "B" ? 1 : 2;
  const pool = (pick.role === "B" ? flightB : flightC).filter(p => !isDrafted(p.name));
  const sortedPool = [...pool].sort((a, b) => a.avgDiff - b.avgDiff);

  const cards = sortedPool.map(p => `
    <div class="player-card flight-${p.flight}">
      <div class="pinfo">
        <div class="pname">${p.name}</div>
        <div class="pmeta">${playerMeta(p)}</div>
      </div>
      <button class="pick-btn" data-captain="${captain.name}" data-player="${p.name}">Draft</button>
    </div>
  `).join("");

  return `
    <div class="draft-status">
      <div class="pick-label">Pick ${state.pickIndex + 1} of ${total}</div>
      <div class="on-clock">${captain.name}</div>
      <div class="on-clock-sub">Flight A captain &middot; HCP ${captain.hcp} &middot; picking a Flight ${pick.role} partner</div>
      <span class="round-pill">Round ${round}</span>
    </div>
    <div class="section-label">Available Flight ${pick.role} Players (best true talent first)</div>
    ${cards || "<p>No players left in this flight.</p>"}
  `;
}

function renderTeams() {
  return flightA.map(a => {
    const team = state.teams[a.name];
    const bP = team.b ? findPlayer(team.b) : null;
    const cP = team.c ? findPlayer(team.c) : null;
    return `
      <div class="team-card">
        <h3>Team ${a.name}</h3>
        <div class="team-slot"><span class="role">A</span> <span>${a.name} (HCP ${a.hcp})</span></div>
        <div class="team-slot"><span class="role">B</span> ${bP ? `<span>${bP.name} (HCP ${bP.hcp})</span>` : '<span class="empty">not yet drafted</span>'}</div>
        <div class="team-slot"><span class="role">C</span> ${cP ? `<span>${cP.name} (HCP ${cP.hcp})</span>` : '<span class="empty">not yet drafted</span>'}</div>
      </div>
    `;
  }).join("");
}

function renderPlayers() {
  const blocks = ["A", "B", "C"].map(flight => {
    const list = PLAYERS.filter(p => p.flight === flight).sort((a, b) => a.hcp - b.hcp);
    const rows = list.map(p => {
      const drafted = flight !== "A" && isDrafted(p.name);
      return `
        <div class="player-card flight-${p.flight}${drafted ? " drafted" : ""}">
          <div class="pinfo">
            <div class="pname">${p.name}</div>
            <div class="pmeta">${playerMeta(p)}</div>
          </div>
          ${drafted ? '<span class="drafted-tag">DRAFTED</span>' : ""}
        </div>
      `;
    }).join("");
    return `
      <div class="flight-block">
        <div class="flight-title ${flight}">Flight ${flight} (${list.length})</div>
        ${rows}
      </div>
    `;
  }).join("");
  return blocks;
}

function render() {
  const app = document.getElementById("app");
  if (activeView === "draft") app.innerHTML = renderDraft();
  else if (activeView === "teams") app.innerHTML = renderTeams();
  else app.innerHTML = renderPlayers();

  document.querySelectorAll(".pick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      makePick(btn.dataset.captain, btn.dataset.player);
    });
  });
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
  if (confirm("Reset the entire draft? This clears all picks.")) {
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    render();
  }
});

render();
