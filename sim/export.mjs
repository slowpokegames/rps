// Turns matrix.json into two CSVs for the matchup dashboard:
//   matchups.csv — one row per (table, player, opponent): win share, fair share, games played.
//   cast.csv     — one row per (game, player): difficulty level and trait, read from play.html.
import { readFileSync, writeFileSync } from "node:fs";

const M = JSON.parse(readFileSync(new URL("./matrix.json", import.meta.url)));
const page = readFileSync(new URL("../play.html", import.meta.url), "utf8");
const csv = rows => [Object.keys(rows[0]).join(","), ...rows.map(r => Object.values(r).map(v => /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(","))].join("\n") + "\n";

const GAME_OF = { showdown: "showdown", flank: "flank", rr: "rr", streak2: "streak", streak4: "streak", classic2: "classic", classic4: "classic" };
const matchups = [];
for (const [table, t] of Object.entries(M)) for (const a of t.names) for (const b of t.names) {
  if (a === b) continue;
  matchups.push({ table, table_title: t.title, game: GAME_OF[table], players: t.size, player: a, opponent: b,
    win_share: +t.M[a][b].toFixed(4), fair_share: +(1 / t.size).toFixed(4), games: t.N });
}

// Each game's cast in play.html sits between its "══ n. Name" banner and the next one.
const LEVELS = ["Easy", "Medium", "Hard"];
const blocks = { showdown: "1. Showdown", flank: "2. Flank", rr: "3. Round Robin", streak: "4. Streak", classic: "5. Classic" };
const cast = [];
for (const [game, banner] of Object.entries(blocks)) {
  const start = page.indexOf(banner), end = page.indexOf("// ══", start + 10);
  const body = page.slice(start, end < 0 ? undefined : end);
  for (const m of body.matchAll(/^\s+(\w+): \{ level: (\d), trait: "([^"]+)"/gm))
    cast.push({ game, player: m[1], level: LEVELS[+m[2]], trait: m[3] });
}
writeFileSync(new URL("./matchups.csv", import.meta.url), csv(matchups));
writeFileSync(new URL("./cast.csv", import.meta.url), csv(cast));
console.log(`${matchups.length} matchups, ${cast.length} cast rows`);
