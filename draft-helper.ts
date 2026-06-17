/**
 * Calcutta Draft Helper — Youche CC
 *
 * Reads analysis-results.json and presents a snake-draft order view
 * showing each A player's best available B and C picks, ranked by
 * "true talent" (avg differential) rather than posted handicap.
 *
 * Usage: npm run draft
 */

import fs from 'fs';
import path from 'path';

const INPUT = path.resolve('./analysis-results.json');

interface PlayerAnalysis {
  name: string;
  ghinId: string;
  postedHandicap: number;
  flight: 'A' | 'B' | 'C';
  roundsFetched: number;
  avgDifferential: number;
  diffVsHandicap: number;
  sandbaggerScore: number;
  volatility: number;
  trend: 'improving' | 'declining' | 'stable';
  recentDifferentials: number[];
  error?: string;
}

function trendEmoji(trend: string) {
  if (trend === 'improving') return '📈';
  if (trend === 'declining') return '📉';
  return '➡️ ';
}

function flag(p: PlayerAnalysis): string {
  if (p.error) return '❓';
  if (p.sandbaggerScore >= 7) return '🚨 SANDBAG';
  if (p.sandbaggerScore >= 4) return '⚠️  WATCH  ';
  if (p.trend === 'improving') return '📈 HOT    ';
  if (p.trend === 'declining') return '📉 COLD   ';
  return '✅ CLEAN  ';
}

function printRankedFlight(players: PlayerAnalysis[], flight: string) {
  console.log(`\n${'═'.repeat(75)}`);
  console.log(`  Flight ${flight} — Ranked by True Talent (avg differential, low = better)`);
  console.log('═'.repeat(75));
  console.log(`  ${'#'.padEnd(4)}${'Name'.padEnd(26)}${'HCP'.padEnd(7)}${'Avg Diff'.padEnd(10)}${'Delta'.padEnd(9)}${'Volatility'.padEnd(12)}Status`);
  console.log('  ' + '─'.repeat(73));

  players.forEach((p, i) => {
    const delta = p.diffVsHandicap > 0 ? `+${p.diffVsHandicap}` : `${p.diffVsHandicap}`;
    const rounds = p.roundsFetched < 5 ? ` (${p.roundsFetched}rds)` : '';
    console.log(
      `  ${String(i + 1).padEnd(4)}${p.name.padEnd(26)}${String(p.postedHandicap).padEnd(7)}${String(p.avgDifferential).padEnd(10)}${delta.padEnd(9)}${String(p.volatility).padEnd(12)}${flag(p)}${rounds}`
    );
  });
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`\n❌  Run "npm run analyze" first to generate ${INPUT}`);
    process.exit(1);
  }

  const all: PlayerAnalysis[] = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

  // Sort each flight by avg differential ascending (lower = plays better = picked first)
  const byFlight = (flight: 'A' | 'B' | 'C') =>
    all
      .filter(p => p.flight === flight)
      .sort((a, b) => a.avgDifferential - b.avgDifferential);

  const aPlayers = byFlight('A');
  const bPlayers = byFlight('B');
  const cPlayers = byFlight('C');

  console.log('\n🏌️  CALCUTTA DRAFT HELPER — Youche CC');
  console.log(`    Analysis based on last ${all[0]?.recentDifferentials?.length ?? '?'} rounds per player\n`);

  printRankedFlight(aPlayers, 'A');
  printRankedFlight(bPlayers, 'B');
  printRankedFlight(cPlayers, 'C');

  // Snake draft simulation — A players draft in reverse handicap order (lowest HCP picks last in round 1)
  console.log(`\n${'═'.repeat(75)}`);
  console.log('  SNAKE DRAFT ORDER (A players, highest HCP picks first)');
  console.log('═'.repeat(75));
  console.log('  Each A player\'s top 3 available B and C picks by true talent:\n');

  const aByHandicap = [...all.filter(p => p.flight === 'A')]
    .sort((a, b) => b.postedHandicap - a.postedHandicap); // highest HCP picks first

  const remainingB = [...bPlayers];
  const remainingC = [...cPlayers];

  aByHandicap.forEach((a, i) => {
    const pickNum = i + 1;
    const topB = remainingB.slice(0, 3);
    const topC = remainingC.slice(0, 3);

    console.log(`  Pick ${String(pickNum).padEnd(3)} ${a.name} (HCP ${a.postedHandicap}, Avg Diff ${a.avgDifferential})`);

    if (topB.length) {
      console.log(`         B options: ${topB.map(p => `${p.name} [${p.avgDifferential}${p.sandbaggerScore >= 5 ? ' 🚨' : ''}]`).join('  |  ')}`);
    }
    if (topC.length) {
      console.log(`         C options: ${topC.map(p => `${p.name} [${p.avgDifferential}${p.sandbaggerScore >= 5 ? ' 🚨' : ''}]`).join('  |  ')}`);
    }
    console.log('');
  });

  console.log('\n  🚨 = sandbag score ≥ 5/10 — consider carefully before drafting');
  console.log('  Delta = posted HCP minus avg differential (+= plays BETTER than handicap)\n');
}

main();
