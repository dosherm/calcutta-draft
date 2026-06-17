/**
 * Calcutta Analysis Tool — Youche CC
 *
 * Pulls last 20 rounds for each player from GHIN, computes:
 *   - Scoring differential trend vs posted handicap index
 *   - Sandbagger score (how often they beat their handicap significantly)
 *   - Volatility (standard deviation of differentials)
 *   - Flight assignment (A / B / C)
 *
 * Usage:
 *   cp .env.example .env && fill in creds
 *   npm install
 *   npm run analyze
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GhinClient } from 'ghin';
import Papa from 'papaparse';

// ── Config ────────────────────────────────────────────────────────────────────

const ROUNDS_TO_FETCH = 20;
const SCORES_CSV = path.resolve('../Men_s League 2026 Golfer Spreadsheet V2.csv');
const OUTPUT_JSON = path.resolve('./analysis-results.json');
const OUTPUT_CSV = path.resolve('./analysis-results.csv');

// Handicap flight thresholds — adjust for your field
const FLIGHT_THRESHOLDS = {
  A_MAX: 9.9,   // 0–9.9 = A flight
  B_MAX: 18.9,  // 10–18.9 = B flight
  // 19+ = C flight
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface RosterPlayer {
  firstName: string;
  lastName: string;
  ghinId: string;
  handicapIndex: number;
  flight: 'A' | 'B' | 'C';
}

interface ScoreRecord {
  playedAt: string;
  adjustedGross: number;
  handicapDifferential: number;
  courseRating: number;
  slopeRating: number;
  holes: number;
}

interface PlayerAnalysis {
  name: string;
  ghinId: string;
  postedHandicap: number;
  flight: 'A' | 'B' | 'C';
  roundsFetched: number;
  avgDifferential: number;
  // Positive = playing BETTER than handicap (potential sandbagger)
  // Negative = playing WORSE than handicap
  diffVsHandicap: number;
  sandbaggerScore: number;   // 0–10, higher = more suspicious
  volatility: number;        // std dev of differentials — high = inconsistent
  trend: 'improving' | 'declining' | 'stable';
  recentDifferentials: number[];
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function trendDirection(differentials: number[]): 'improving' | 'declining' | 'stable' {
  if (differentials.length < 4) return 'stable';
  const firstHalf = mean(differentials.slice(0, Math.floor(differentials.length / 2)));
  const secondHalf = mean(differentials.slice(Math.floor(differentials.length / 2)));
  const delta = firstHalf - secondHalf; // more recent rounds come first in GHIN response
  if (delta > 1.5) return 'improving';   // recent rounds lower = improving
  if (delta < -1.5) return 'declining';
  return 'stable';
}

function sandbaggerScore(diffVsHandicap: number, volatility: number, roundsBelowHandicap: number, totalRounds: number): number {
  if (totalRounds === 0) return 0;
  // How far they play below their index (positive = beating handicap)
  const gapScore = Math.min(Math.max(diffVsHandicap * 1.5, 0), 5);
  // What % of rounds they beat their handicap by 2+ strokes
  const frequencyScore = (roundsBelowHandicap / totalRounds) * 3;
  // High volatility is slightly suspicious (sandbagging often shows volatility)
  const volatilityScore = Math.min(volatility / 5, 2);
  return Math.min(Math.round((gapScore + frequencyScore + volatilityScore) * 10) / 10, 10);
}

function assignFlight(handicap: number): 'A' | 'B' | 'C' {
  if (handicap <= FLIGHT_THRESHOLDS.A_MAX) return 'A';
  if (handicap <= FLIGHT_THRESHOLDS.B_MAX) return 'B';
  return 'C';
}

// ── Load roster ───────────────────────────────────────────────────────────────

function loadRoster(): RosterPlayer[] {
  const raw = fs.readFileSync(SCORES_CSV, 'utf8');
  const { data } = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });

  return data
    .filter(row => row['GHIN Id'] && row['Index'] && row['GHIN Active'] === 'Yes')
    .map(row => {
      const handicap = parseFloat(row['Index']);
      return {
        firstName: row['First Name']?.trim() ?? '',
        lastName: row['Last Name']?.trim() ?? '',
        ghinId: row['GHIN Id'].trim(),
        handicapIndex: handicap,
        flight: assignFlight(handicap),
      };
    });
}

// ── Fetch & analyze one player ────────────────────────────────────────────────

async function analyzePlayer(
  client: GhinClient,
  player: RosterPlayer,
): Promise<PlayerAnalysis> {
  const base: Omit<PlayerAnalysis, 'roundsFetched' | 'avgDifferential' | 'diffVsHandicap' | 'sandbaggerScore' | 'volatility' | 'trend' | 'recentDifferentials'> = {
    name: `${player.firstName} ${player.lastName}`,
    ghinId: player.ghinId,
    postedHandicap: player.handicapIndex,
    flight: player.flight,
  };

  try {
    const scoresResponse = await client.golfers.getScores(player.ghinId, {
      limit: ROUNDS_TO_FETCH,
      offset: 0,
    });

    const scores: ScoreRecord[] = (scoresResponse ?? [])
      .filter((s: any) => s.handicap_differential != null && s.number_of_holes >= 18)
      .map((s: any) => ({
        playedAt: s.played_at,
        adjustedGross: s.adjusted_gross_score,
        handicapDifferential: parseFloat(s.handicap_differential),
        courseRating: parseFloat(s.course_rating),
        slopeRating: parseFloat(s.slope_rating),
        holes: s.number_of_holes,
      }));

    if (!scores.length) {
      return { ...base, roundsFetched: 0, avgDifferential: player.handicapIndex, diffVsHandicap: 0, sandbaggerScore: 0, volatility: 0, trend: 'stable', recentDifferentials: [] };
    }

    const differentials = scores.map(s => s.handicapDifferential);
    const avg = mean(differentials);
    const vol = stdDev(differentials);

    // diffVsHandicap: positive means they're playing BETTER than their posted index
    const diffVsHandicap = parseFloat((player.handicapIndex - avg).toFixed(2));

    // Rounds where differential was 2+ strokes better than handicap
    const roundsBelowHandicap = differentials.filter(d => d <= player.handicapIndex - 2).length;

    return {
      ...base,
      roundsFetched: scores.length,
      avgDifferential: parseFloat(avg.toFixed(2)),
      diffVsHandicap,
      sandbaggerScore: sandbaggerScore(diffVsHandicap, vol, roundsBelowHandicap, scores.length),
      volatility: parseFloat(vol.toFixed(2)),
      trend: trendDirection(differentials),
      recentDifferentials: differentials.slice(0, 10),
    };
  } catch (err: any) {
    return {
      ...base,
      roundsFetched: 0,
      avgDifferential: player.handicapIndex,
      diffVsHandicap: 0,
      sandbaggerScore: 0,
      volatility: 0,
      trend: 'stable',
      recentDifferentials: [],
      error: err?.message ?? 'unknown error',
    };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.GHIN_USERNAME || !process.env.GHIN_PASSWORD) {
    console.error('❌  Set GHIN_USERNAME and GHIN_PASSWORD in .env');
    process.exit(1);
  }

  const client = new GhinClient({
    username: process.env.GHIN_USERNAME,
    password: process.env.GHIN_PASSWORD,
  });

  const roster = loadRoster();
  console.log(`\n📋  Loaded ${roster.length} active players from roster`);
  console.log(`    A flight (0–9.9):   ${roster.filter(p => p.flight === 'A').length} players`);
  console.log(`    B flight (10–18.9): ${roster.filter(p => p.flight === 'B').length} players`);
  console.log(`    C flight (19+):     ${roster.filter(p => p.flight === 'C').length} players\n`);

  const results: PlayerAnalysis[] = [];
  let done = 0;

  for (const player of roster) {
    process.stdout.write(`\r  Fetching ${++done}/${roster.length}: ${player.firstName} ${player.lastName}`.padEnd(60));
    const result = await analyzePlayer(client, player);
    results.push(result);
    await new Promise(r => setTimeout(r, 150)); // be polite to the API
  }

  console.log('\n\n✅  Done fetching. Writing results...\n');

  // Sort by sandbagger score desc within each flight
  results.sort((a, b) => {
    if (a.flight !== b.flight) return a.flight.localeCompare(b.flight);
    return b.sandbaggerScore - a.sandbaggerScore;
  });

  // Write JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));

  // Write CSV
  const csvRows = results.map(r => ({
    Flight: r.flight,
    Name: r.name,
    'GHIN ID': r.ghinId,
    'Posted HCP': r.postedHandicap,
    'Avg Differential': r.avgDifferential,
    'Diff vs HCP (+= beats HCP)': r.diffVsHandicap,
    'Sandbagger Score (0-10)': r.sandbaggerScore,
    Volatility: r.volatility,
    Trend: r.trend,
    'Rounds Fetched': r.roundsFetched,
    'Recent 10 Differentials': r.recentDifferentials.join(', '),
    Error: r.error ?? '',
  }));
  fs.writeFileSync(OUTPUT_CSV, Papa.unparse(csvRows));

  // Print top suspects per flight
  for (const flight of ['A', 'B', 'C'] as const) {
    const flightPlayers = results.filter(r => r.flight === flight && r.roundsFetched >= 5);
    if (!flightPlayers.length) continue;

    console.log(`═══ Flight ${flight} — Top Sandbagger Suspects ═══`);
    flightPlayers.slice(0, 5).forEach((p, i) => {
      const indicator = p.sandbaggerScore >= 7 ? '🚨' : p.sandbaggerScore >= 4 ? '⚠️ ' : '✅';
      console.log(
        `  ${i + 1}. ${indicator} ${p.name.padEnd(25)} HCP: ${String(p.postedHandicap).padEnd(5)} Avg Diff: ${String(p.avgDifferential).padEnd(6)} Delta: ${p.diffVsHandicap > 0 ? '+' : ''}${p.diffVsHandicap} | Score: ${p.sandbaggerScore}/10 | ${p.trend}`
      );
    });
    console.log('');
  }

  console.log(`📁  Full results saved to:`);
  console.log(`    ${OUTPUT_JSON}`);
  console.log(`    ${OUTPUT_CSV}\n`);
}

// Load .env manually (no dotenv dep needed)
const envPath = new URL('.env', import.meta.url).pathname;
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message);
  process.exit(1);
});
