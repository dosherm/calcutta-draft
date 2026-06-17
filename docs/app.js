// Youche CC Calcutta — live draft tracker
// Single-device, localStorage-persisted. PLAYERS comes from data.js.

const STORAGE_KEY = "calcutta-draft-state-v3";

const flightA = PLAYERS.filter(p => p.flight === "A").sort((a, b) => b.hcp - a.hcp);
const flightB = PLAYERS.filter(p => p.flight === "B");
const flightC = PLAYERS.filter(p => p.flight === "C");

// Pick order is set by the user (drawn randomly) BEFORE the draft starts.
// Round 1 runs in the set order; Round 2 snakes (reverses) it.
// NET best-ball: on each pick a captain may take EITHER a B or a C, and is
// only locked into the remaining flight on their second pick.

function getPickOrder() {
  const order = state.order;
  return [...order, ...[...order].reverse()];
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through */ }
  }
  return {
    orderSet: false,
    order: flightA.map(a => a.name), // default seed; user can shuffle/reorder
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

// ---- Setup: draft order ----

function moveOrder(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= state.order.length) return;
  const arr = state.order;
  [arr[index], arr[target]] = [arr[target], arr[index]];
  saveState();
  render();
}

function shuffleOrder() {
  const arr = state.order;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  saveState();
  render();
}

function startDraft() {
  state.orderSet = true;
  saveState();
  render();
}

function renderSetup() {
  const rows = state.order.map((name, i) => {
    const cap = findPlayer(name);
    return `
      <div class="order-row">
        <span class="order-num">${i + 1}</span>
        <span class="order-name">${cap.name} <span class="order-hcp">HCP ${cap.hcp}</span></span>
        <span class="order-ctrls">
          <button class="ord-btn" data-move="up" data-idx="${i}" ${i === 0 ? "disabled" : ""}>&#9650;</button>
          <button class="ord-btn" data-move="down" data-idx="${i}" ${i === state.order.length - 1 ? "disabled" : ""}>&#9660;</button>
        </span>
      </div>`;
  }).join("");

  return `
    <div class="setup-intro">
      <h2>Set the Draft Order</h2>
      <p>Arrange the ${state.order.length} Flight A captains in pick order, or shuffle to draw randomly.
      Round 1 runs top&#8594;bottom; Round 2 snakes back (bottom picks first).</p>
      <button id="shuffle-btn" class="big-btn shuffle">&#127922; Shuffle / Random Draw</button>
    </div>
    <div class="order-list">${rows}</div>
    <button id="start-btn" class="big-btn start">Lock Order &amp; Start Draft &#8594;</button>
  `;
}

// ---- Draft ----

function neededFlights(captainName) {
  const team = state.teams[captainName];
  const needed = [];
  if (!team.b) needed.push("B");
  if (!team.c) needed.push("C");
  return needed;
}

function makePick(captainName, playerName) {
  const player = findPlayer(playerName);
  const slot = player.flight.toLowerCase();
  state.teams[captainName][slot] = playerName;
  state.pickIndex += 1;
  saveState();
  render();
}

function poolCards(flight, captainName) {
  const pool = (flight === "B" ? flightB : flightC)
    .filter(p => !isDrafted(p.name))
    .sort((a, b) => a.avgDiff - b.avgDiff);
  if (!pool.length) return "";
  const rows = pool.map(p => `
    <div class="player-card flight-${p.flight}">
      <div class="pinfo">
        <div class="pname">${p.name}</div>
        <div class="pmeta">${playerMeta(p)}</div>
      </div>
      <button class="pick-btn" data-captain="${captainName}" data-player="${p.name}">Draft</button>
    </div>
  `).join("");
  return `<div class="section-label">Flight ${flight} available (best true talent first)</div>${rows}`;
}

function renderDraft() {
  if (!state.orderSet) return renderSetup();

  const pickOrder = getPickOrder();
  const total = pickOrder.length;
  const round1Len = state.order.length;

  if (state.pickIndex >= total) {
    return `<div class="draft-complete">
      <h2>Draft Complete</h2>
      <p>All ${round1Len} teams are set. Check the Teams tab for the full rosters.</p>
    </div>`;
  }

  const captainName = pickOrder[state.pickIndex];
  const captain = findPlayer(captainName);
  const round = state.pickIndex < round1Len ? 1 : 2;
  const needed = neededFlights(captainName);

  const choiceText = needed.length === 2
    ? "picking a Flight B or C partner (their choice)"
    : `must pick a Flight ${needed[0]} partner`;

  const sections = needed.map(f => poolCards(f, captainName)).join("");

  return `
    <div class="draft-status">
      <div class="pick-label">Pick ${state.pickIndex + 1} of ${total}</div>
      <div class="on-clock">${captain.name}</div>
      <div class="on-clock-sub">Flight A captain &middot; HCP ${captain.hcp} &middot; ${choiceText}</div>
      <span class="round-pill">Round ${round}</span>
    </div>
    ${sections || "<p>No players left to draft.</p>"}
  `;
}

function renderTeams() {
  const order = state.orderSet ? state.order : flightA.map(a => a.name);
  return order.map(name => {
    const a = findPlayer(name);
    const team = state.teams[name];
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
    btn.addEventListener("click", () => makePick(btn.dataset.captain, btn.dataset.player));
  });

  document.querySelectorAll(".ord-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      moveOrder(parseInt(btn.dataset.idx, 10), btn.dataset.move === "up" ? -1 : 1);
    });
  });

  const shuffleBtn = document.getElementById("shuffle-btn");
  if (shuffleBtn) shuffleBtn.addEventListener("click", shuffleOrder);

  const startBtn = document.getElementById("start-btn");
  if (startBtn) startBtn.addEventListener("click", startDraft);
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
  if (confirm("Reset everything? This clears the draft order and all picks.")) {
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    activeView = "draft";
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.view === "draft"));
    render();
  }
});

render();
