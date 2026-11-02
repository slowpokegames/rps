// Every player against every other, in every game, written to matrix.json.
//   node matrix.mjs [scale]   (scale multiplies the default sample sizes)
// Two-player cells: row's win rate head-to-head, seats alternated, draws count half (fair = 50%).
// Table cells: row's win share when it sits with copies of the column player, seats cycled (fair = 1 / table size).
import { writeFileSync } from "node:fs";
import { reseed, showdown, flank, roundRobin, streak, classic } from "./engine.mjs";
import { SHOWDOWN, FLANK, ROUND_ROBIN, STREAK, CLASSIC } from "./players.mjs";

const scale = +(process.argv[2] || 1);
const topShares = score => { const hi = Math.max(...score), w = score.map(x => x === hi ? 1 : 0), t = w.reduce((a, b) => a + b, 0); return w.map(x => x / t); };

// shares(policies) → each seat's share of the win.
function matrix(POL, size, shares, N) {
  const names = Object.keys(POL), M = {};
  for (const a of names) {
    M[a] = {};
    for (const b of names) {
      if (a === b) { M[a][b] = 1 / size; continue; }
      let s = 0;
      for (let g = 0; g < N; g++) {
        const seat = g % size, seats = Array(size).fill(POL[b]); seats[seat] = POL[a];
        s += shares(seats)[seat];
      }
      M[a][b] = s / N;
    }
  }
  return { names, size, N, M };
}

const two = r => [(r + 1) / 2, (1 - r) / 2];
const GAMES = [
  ["showdown", "Showdown", 2, SHOWDOWN, P => two(showdown(P).result), 4000],
  ["flank", "Flank", 2, FLANK, P => two(flank(P).result), 1000],
  ["rr", "Round Robin", 4, ROUND_ROBIN, P => topShares(roundRobin(P).score), 800],
  ["streak2", "Streak, 1 bot", 2, STREAK, P => topShares(streak(P).score), 4000],
  ["streak4", "Streak, 3 bots", 4, STREAK, P => topShares(streak(P).score), 2000],
  ["classic2", "Classic, 1 bot", 2, CLASSIC, P => { const w = classic(P).winner; return w < 0 ? [0.5, 0.5] : P.map((_, i) => +(i === w)); }, 4000],
  ["classic4", "Classic, 3 bots", 4, CLASSIC, P => { const w = classic(P).winner; return w < 0 ? P.map(() => 1 / P.length) : P.map((_, i) => +(i === w)); }, 2000],
];

const out = {};
for (const [key, title, size, POL, shares, N] of GAMES) {
  reseed(4242); const t = Date.now();
  out[key] = { title, ...matrix(POL, size, shares, Math.round(N * scale)) };
  console.error(`${key}: ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
writeFileSync(new URL("./matrix.json", import.meta.url), JSON.stringify(out, null, 1));
