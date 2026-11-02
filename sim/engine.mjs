// Headless ports of the five games in play.html, with pluggable player policies.
// Rules match play.html exactly; only rendering, timers and the log are stripped.

// ── Deck ────────────────────────────────────────────────────────────────────
export const B = [[0,0,1,1,0],[1,0,0,0,1],[0,1,0,1,0],[0,1,0,0,1],[1,0,1,0,0]];
export const rel = (x, y) => x === y ? 0 : B[x][y] ? 1 : -1;
export const FULL = [];
for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) for (let c = 0; c < 5; c++)
  if (a !== b && a !== c && b !== c) FULL.push([a, b, c]);
export const IDS = FULL.map((_, i) => i);
export const KEY = FULL.map(c => c.map(s => "RPSLI"[s]).join(""));
export const lex = (a, b) => { for (let i = 0; i < 3; i++) if (FULL[a][i] !== FULL[b][i]) return rel(FULL[a][i], FULL[b][i]); return 0; };
export const STR = IDS.map(a => IDS.filter(b => lex(a, b) > 0).length);

// Seeded RNG so runs are reproducible. Every game draws from the same stream.
let seed = 1;
export const reseed = s => { seed = s >>> 0 || 1; };
export const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pick = a => a[rand() * a.length | 0];
export const argmax = (xs, f) => { let b = null, bs = -Infinity; for (const x of xs) { const s = f(x) + rand() * 1e-6; if (s > bs) { bs = s; b = x; } } return b; };
export const without = (a, x) => a.filter(y => y !== x);
export const sum = a => a.reduce((s, x) => s + x, 0);

// ── 1. Showdown ─────────────────────────────────────────────────────────────
// policy(me, opp, s) → card id. s = { pot, won:[mine,theirs], deckLeft, round }
export const SD_W = [3, 2, 1];
export const sdVal = (a, b) => SD_W[0] * rel(FULL[a][0], FULL[b][0]) + SD_W[1] * rel(FULL[a][1], FULL[b][1]) + SD_W[2] * rel(FULL[a][2], FULL[b][2]);
export function showdown([P0, P1]) {
  const d = shuffle(IDS);
  const hands = [d.slice(0, 5), d.slice(5, 10)], deck = d.slice(10), won = [0, 0];
  let pot = 0, round = 1, ties = 0;
  while (hands[0].length) {
    const c0 = P0(hands[0], hands[1], { pot, won: [won[0], won[1]], deckLeft: deck.length, round });
    const c1 = P1(hands[1], hands[0], { pot, won: [won[1], won[0]], deckLeft: deck.length, round });
    hands[0] = without(hands[0], c0); hands[1] = without(hands[1], c1);
    const v = sdVal(c0, c1), stake = 2 + pot;
    if (v > 0) { won[0] += stake; pot = 0; } else if (v < 0) { won[1] += stake; pot = 0; } else { pot += 2; ties++; }
    round++;
    if (deck.length >= 2) { hands[0].push(deck.shift()); hands[1].push(deck.shift()); }
  }
  return { result: Math.sign(won[0] - won[1]), score: won, ties };
}

// ── 2. Flank ────────────────────────────────────────────────────────────────
// policy(s) → [card, square]. s = { board, hand, p, unseen, oppHand: count }
export const FL_N = 4;
const NB = Array.from({ length: 16 }, (_, i) => { const r = i / 4 | 0, c = i % 4, o = [];
  if (c > 0) o.push([i - 1, 0]); if (c < 3) o.push([i + 1, 0]); if (r > 0) o.push([i - 4, 1]); if (r < 3) o.push([i + 4, 2]); return o; });
// WIN[dir][a][b]: card a, placed so b sits in direction dir from it, captures b.
const WIN = [0, 1, 2].map(dir => IDS.map(a => IDS.map(b => {
  const x = FULL[a], y = FULL[b];
  if (dir === 0) return rel(x[0], y[0]) + rel(x[1], y[1]) + rel(x[2], y[2]) > 0;
  if (dir === 1) return rel(x[0], y[2]) > 0;
  return rel(x[2], y[0]) > 0;
})));
export const flNeighbours = NB;
// Board cells are -1 (empty) or id*2+owner.
export const flFlips = (bd, id, i, p) => { const out = []; for (const [j, d] of NB[i]) { const t = bd[j]; if (t >= 0 && (t & 1) !== p && WIN[d][id][t >> 1]) out.push(j); } return out; };
export const flPlace = (bd, id, i, p) => { const nb = bd.slice(); nb[i] = id * 2 + p; for (const j of flFlips(bd, id, i, p)) nb[j] = (nb[j] >> 1) * 2 + p; return nb; };
export const flOwned = (bd, p) => { let n = 0; for (const t of bd) if (t >= 0 && (t & 1) === p) n++; return n; };
export const flEmpties = bd => { const o = []; for (let i = 0; i < 16; i++) if (bd[i] < 0) o.push(i); return o; };
function flBoard(P, first) {
  const d = shuffle(IDS);
  let bd = Array(16).fill(-1);
  const hands = [d.slice(0, 5), d.slice(5, 10)], deck = d.slice(10);
  let turn = first;
  while (flEmpties(bd).length) {
    const p = turn;
    const seen = new Set([...hands[p], ...bd.filter(t => t >= 0).map(t => t >> 1)]);
    const [c, i] = P[p]({ board: bd, hand: hands[p], p, unseen: IDS.filter(x => !seen.has(x)), oppHand: hands[1 - p].length });
    bd = flPlace(bd, c, i, p);
    hands[p] = without(hands[p], c);
    if (deck.length) hands[p].push(deck.shift());
    turn ^= 1;
  }
  return [flOwned(bd, 0), flOwned(bd, 1)];
}
export function flank([P0, P1]) {
  const b1 = flBoard([P0, P1], 0), b2 = flBoard([P0, P1], 1);
  const t0 = b1[0] + b2[0], t1 = b1[1] + b2[1];
  const result = t0 !== t1 ? Math.sign(t0 - t1) : Math.sign(b2[0] - b2[1]);
  return { result, score: [t0, t1] };
}

// ── 3. Round Robin ──────────────────────────────────────────────────────────
// policy(s) → card. s = { hand, legal, trick:[{p,id}], p, played:Set, tricks, total }
export function rrJudge(trick) {
  const wins = trick.map(x => trick.filter(y => y !== x && lex(x.id, y.id) > 0).length);
  let best = 0; wins.forEach((w, k) => { if (w > wins[best]) best = k; });
  return trick[best].p;
}
export const rrLegal = (hand, trick) => {
  if (!trick.length) return hand;
  const f = hand.filter(id => FULL[id][0] === FULL[trick[0].id][0]);
  return f.length ? f : hand;
};
export function roundRobin(P) {
  const total = [0, 0, 0, 0];
  for (let handNo = 1; handNo <= 4; handNo++) {
    const d = shuffle(IDS), hands = [0, 1, 2, 3].map(p => d.slice(p * 12, p * 12 + 12));
    const played = new Set(), tricks = [0, 0, 0, 0];
    let lead = (handNo - 1) % 4;
    while (hands[0].length) {
      const trick = [];
      for (let k = 0; k < 4; k++) {
        const p = (lead + k) % 4;
        const c = P[p]({ hand: hands[p], legal: rrLegal(hands[p], trick), trick: trick.slice(), p, played, tricks, total, voids: null });
        hands[p] = without(hands[p], c); trick.push({ p, id: c });
      }
      for (const x of trick) played.add(x.id);
      lead = rrJudge(trick); tricks[lead]++;
    }
    for (let p = 0; p < 4; p++) total[p] += tricks[p];
  }
  return { score: total };
}

// ── 4. Streak ───────────────────────────────────────────────────────────────
// policy(s) → "flip" | "bank" | card id. s = { p, hand, run, scores, deckLeft, odds(), ok(c), unseen() }
export const stOk = (a, prev) => rel(FULL[a][0], FULL[prev][0]) > 0 || rel(FULL[a][1], FULL[prev][1]) > 0 || rel(FULL[a][2], FULL[prev][2]) > 0;
export function streak(P, stats) {
  const n = P.length, d = shuffle(IDS);
  const pl = P.map((_, i) => ({ hand: d.slice(i * 3, i * 3 + 3), score: 0 }));
  let deck = d.slice(n * 3);
  const gone = [];
  let turn = 0;
  for (;;) {
    const me = pl[turn], run = [];
    const top = () => run[run.length - 1];
    const unseen = () => { const ex = new Set([...me.hand, ...gone, ...run]); return IDS.filter(c => !ex.has(c)); };
    const s = { p: turn, get hand() { return me.hand; }, run, scores: pl.map(q => q.score), get deckLeft() { return deck.length; }, players: n,
      odds() { const u = unseen(), t = top(); return t == null ? 1 : u.filter(c => stOk(c, t)).length / u.length; }, unseen };
    for (let guard = 0; guard < 200; guard++) {
      let a = run.length ? P[turn](s) : "flip";
      if (a === "flip" && !deck.length) a = "bank";
      if (a === "flip") {
        const id = deck.shift();
        if (run.length && !stOk(id, top())) { gone.push(id); if (stats) { stats[turn].busts++; stats[turn].lost += run.length; } break; }
        run.push(id);
      } else if (a === "bank") { me.score += run.length; if (stats) { stats[turn].banks++; stats[turn].banked += run.length; } break; }
      else { if (!me.hand.includes(a) || !stOk(a, top())) throw new Error("illegal hand play"); me.hand = without(me.hand, a); run.push(a); if (stats) stats[turn].handPlays++; }
    }
    gone.push(...run);
    while (me.hand.length < 3 && deck.length) me.hand.push(deck.shift());
    if (!deck.length) break;
    turn = (turn + 1) % n;
  }
  return { score: pl.map(q => q.score) };
}

// ── 5. Classic ──────────────────────────────────────────────────────────────
// policy(s) → card or null (draw). s = { hand, legal, active, sizes, i, n }
export const clCan = (c, a) => FULL[c].every((x, i) => rel(x, FULL[a][i]) >= 0);
export const clPosWon = (c, a) => FULL[c].filter((x, i) => rel(x, FULL[a][i]) > 0).length;
export const FOLLOWERS = IDS.map(c => IDS.filter(d => d !== c && clCan(d, c)).length);
export function classic(P) {
  const n = P.length, d = shuffle(IDS);
  const hands = P.map((_, i) => d.slice(i * 7, i * 7 + 7));
  const pile = d.slice(n * 7);
  let deck = pile.slice(1), discard = [pile[0]], cur = rand() * n | 0, nextDraws = 0, nextSkip = false, passes = 0;
  const drawFor = i => {
    if (!deck.length && discard.length > 1) { const t = discard.pop(); deck = shuffle(discard); discard = [t]; }
    if (!deck.length) return false; hands[i].push(deck.shift()); return true;
  };
  const adv = () => { cur = (cur + 1) % n; };
  for (let turns = 0; turns < 5000; turns++) {
    if (passes >= n * 2) { let b = 0; hands.forEach((h, j) => { if (h.length < hands[b].length) b = j; }); return { winner: b, stalemate: true, turns }; }
    const i = cur;
    if (nextSkip) { nextSkip = false; adv(); continue; }
    if (nextDraws) { const k = nextDraws; nextDraws = 0; for (let x = 0; x < k; x++) drawFor(i); adv(); continue; }
    const active = discard[discard.length - 1];
    const legal = hands[i].filter(c => clCan(c, active));
    const c = P[i]({ hand: hands[i], legal, active, sizes: hands.map(h => h.length), i, n });
    if (c != null) {
      if (!legal.includes(c)) throw new Error("illegal classic play");
      const pw = clPosWon(c, active);
      hands[i] = without(hands[i], c); discard.push(c); passes = 0;
      if (pw === 2) nextSkip = true; if (pw === 3) nextDraws = 2;
      if (!hands[i].length) return { winner: i, stalemate: false, turns };
      adv();
    } else { const got = drawFor(i); passes = got ? 0 : passes + 1; adv(); }
  }
  return { winner: -1, stalemate: true, turns: 5000 };
}
