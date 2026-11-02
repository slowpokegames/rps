// Tournaments between the personalities in players.mjs.
//   node tourney.mjs <showdown|flank|rr|streak|classic|all> [games per pairing]
// Two-player games: every pairing, seats alternated, draws count half.
// Four-player games: every lineup of four different players, seating orders cycled, plus each player against a field of three Adas.
import { reseed, showdown, flank, roundRobin, streak, classic } from "./engine.mjs";
import { SHOWDOWN, FLANK, ROUND_ROBIN, STREAK, CLASSIC } from "./players.mjs";

const pct = x => (100 * x).toFixed(0).padStart(4);
const perms = xs => xs.length < 2 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(r => [x, ...r]));
const PERMS = { 3: perms([0, 1, 2]), 4: perms([0, 1, 2, 3]) };
const combos = (xs, k) => k === 0 ? [[]] : xs.flatMap((x, i) => combos(xs.slice(i + 1), k - 1).map(r => [x, ...r]));

function headToHead(title, POL, game, N) {
  const names = Object.keys(POL), M = {};
  for (const a of names) M[a] = {};
  for (const [a, b] of combos(names, 2)) {
    let s = 0;
    for (let g = 0; g < N; g++) {
      const swap = g & 1, r = game(swap ? [POL[b], POL[a]] : [POL[a], POL[b]]);
      s += ((swap ? -r : r) + 1) / 2;
    }
    M[a][b] = s / N; M[b][a] = 1 - s / N;
  }
  const avg = a => names.filter(b => b !== a).reduce((t, b) => t + M[a][b], 0) / (names.length - 1);
  const order = names.slice().sort((x, y) => avg(y) - avg(x));
  console.log(`\n## ${title} — row's win % against column (${N} games per pairing)\n`);
  console.log("| | " + order.join(" | ") + " | **avg** |");
  console.log("|---" + "|---:".repeat(order.length + 1) + "|");
  for (const a of order) console.log(`| **${a}** | ` + order.map(b => a === b ? "—" : pct(M[a][b])).join(" | ") + ` | **${pct(avg(a))}** |`);
  return M;
}

// winnerShares: result → array of each seat's share of the win (ties split).
function fourPlayer(title, POL, game, winnerShares, N, size = 4) {
  const names = Object.keys(POL), share = {}, games = {};
  for (const n of names) { share[n] = 0; games[n] = 0; }
  const lineups = combos(names, size);
  for (const lu of lineups) for (let g = 0; g < N; g++) {
    const seats = PERMS[size][g % PERMS[size].length].map(k => lu[k]);   // every seating order, so nobody always sits after the same neighbour
    const w = winnerShares(game(seats.map(n => POL[n])));
    seats.forEach((n, k) => { share[n] += w[k]; games[n]++; });
  }
  const field = {};
  for (const n of names) {
    let s = 0;
    for (let g = 0; g < N * 3; g++) {
      const seat = g % size, seats = Array(size).fill("Ada"); seats[seat] = n;
      s += winnerShares(game(seats.map(x => POL[x])))[seat];
    }
    field[n] = s / (N * 3);
  }
  const order = names.slice().sort((a, b) => share[b] / games[b] - share[a] / games[a]);
  console.log(`\n## ${title} — win share, fair = ${pct(1 / size).trim()}% (${lineups.length} lineups × ${N} games; field games: ${N * 3})\n`);
  console.log("| player | mixed lineups | vs 3 × Ada |\n|---|---:|---:|");
  for (const n of order) console.log(`| **${n}** | ${pct(share[n] / games[n])} | ${pct(field[n])} |`);
}

const topShares = score => { const hi = Math.max(...score), w = score.map(x => x === hi ? 1 : 0), t = w.reduce((a, b) => a + b, 0); return w.map(x => x / t); };

const which = process.argv[2] || "all", N = +(process.argv[3] || 0);
const run = (k, f) => { if (which === "all" || which === k) { reseed(1234); const t = Date.now(); f(); console.error(`${k}: ${((Date.now() - t) / 1000).toFixed(1)}s`); } };

run("showdown", () => headToHead("Showdown", SHOWDOWN, P => showdown(P).result, N || 4000));
run("flank", () => headToHead("Flank", FLANK, P => flank(P).result, N || 300));
run("rr", () => fourPlayer("Round Robin", ROUND_ROBIN, P => roundRobin(P).score, topShares, N || 60));
run("streak", () => {
  headToHead("Streak (2 players)", STREAK, P => { const s = streak(P).score; return Math.sign(s[0] - s[1]); }, N || 3000);
  fourPlayer("Streak (4 players)", STREAK, P => streak(P).score, topShares, N || 200);
});
run("classic", () => {
  headToHead("Classic (2 players)", CLASSIC, P => { const r = classic(P); return r.winner === 0 ? 1 : r.winner === 1 ? -1 : 0; }, N || 3000);
  fourPlayer("Classic (4 players)", CLASSIC, P => { const r = classic(P); return P.map((_, i) => r.winner === i ? 1 : r.winner < 0 ? 1 / P.length : 0); }, x => x, N || 300);
});
