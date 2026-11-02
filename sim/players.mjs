// Player personalities for each game. Shared archetypes across games:
//   Rando     — any legal move, uniformly.
//   Grabby    — maximises what it gets this turn, ignores what comes next.
//   Ada       — the bot shipped in play.html, copied verbatim.
//   Turtle    — cautious: minimises what it can lose.
//   Daredevil — loves risk: chases the big result.
//   Sage      — the strongest thing I could build: models the other players.
// Plus a few game-specific characters (Nash, Saver, Cornerist, Trumper, Spender, Hoarder, Dumper, Blocker).
import { FULL, IDS, STR, rel, lex, sum, pick, argmax, shuffle, rand, without,
  sdVal, flPlace, flFlips, flOwned, flEmpties, flNeighbours, rrJudge, rrLegal, stOk, clCan, clPosWon, FOLLOWERS } from "./engine.mjs";

const sgn = Math.sign;

// ── Showdown ────────────────────────────────────────────────────────────────
const sdEv = (c, opp) => sum(opp.map(o => sgn(sdVal(c, o)))) / opp.length;
const adaDist = (mine, yours) => { const w = mine.map(c => Math.exp(2.5 * sdEv(c, yours))), t = sum(w); return w.map(x => x / t); };
const sample = (xs, w) => { let r = rand(); for (let i = 0; i < xs.length; i++) { r -= w[i]; if (r <= 0) return xs[i]; } return xs[xs.length - 1]; };
// Equilibrium of the one-round matrix game (payoff = who wins the round), by fictitious play.
function nashMix(mine, opp) {
  const M = mine.map(a => opp.map(b => sgn(sdVal(a, b)))), m = mine.length, n = opp.length;
  const ca = new Array(m).fill(0), ua = new Array(m).fill(0), ub = new Array(n).fill(0);
  let ia = 0, ib = 0;
  for (let t = 0; t < 400; t++) {
    ca[ia]++;
    for (let i = 0; i < m; i++) ua[i] += M[i][ib];
    for (let j = 0; j < n; j++) ub[j] -= M[ia][j];
    ia = 0; for (let i = 1; i < m; i++) if (ua[i] > ua[ia]) ia = i;
    ib = 0; for (let j = 1; j < n; j++) if (ub[j] > ub[ib]) ib = j;
  }
  return ca.map(x => x / 400);
}
// How useful a card is in general: average round result against the whole deck.
const SD_GENERIC = IDS.map(c => sum(IDS.map(o => sgn(sdVal(c, o)))) / 60);
export const SHOWDOWN = {
  Rando: me => pick(me),
  Grabby: (me, opp) => argmax(me, c => sdEv(c, opp)),
  Ada: (me, opp) => sample(me, adaDist(me, opp)),
  // Picks the card whose worst case against her open hand is least bad.
  Turtle: (me, opp) => argmax(me, c => 10 * Math.min(...opp.map(o => sgn(sdVal(c, o)))) + sdEv(c, opp)),
  // Goes for the biggest point margin, not just the win.
  Daredevil: (me, opp) => argmax(me, c => sum(opp.map(o => sdVal(c, o)))),
  // Unexploitable: plays the round's equilibrium mix.
  Nash: (me, opp) => sample(me, nashMix(me, opp)),
  // Hand manager: keeps generally strong cards for big pots, spends weak ones on small stakes.
  Saver: (me, opp, s) => argmax(me, c => sdEv(c, opp) - (s.pot ? 0 : 0.6 * SD_GENERIC[c])),
  // Predicts what an Ada-style opponent will play against its hand, and best-responds.
  Sage: (me, opp) => { const q = adaDist(opp, me); return argmax(me, c => sum(opp.map((o, j) => q[j] * sgn(sdVal(c, o))))); },
};

// ── Flank ───────────────────────────────────────────────────────────────────
const moves = s => s.hand.flatMap(c => flEmpties(s.board).map(i => [c, i]));
const CORNER = new Set([0, 3, 12, 15]);
const EDGE_POS = i => CORNER.has(i) ? 2 : (i < 4 || i > 11 || i % 4 === 0 || i % 4 === 3) ? 1 : 0;
// Expected cards lost to a reply, averaged over sampled opponent cards; the reply is either averaged over squares (Ada) or the best square (Sage/Turtle).
function replyLoss(bd, p, pool, mode) {
  const emp = flEmpties(bd); if (!emp.length) return 0;
  let tot = 0;
  for (const oc of pool) {
    let best = 0, avg = 0;
    for (const j of emp) { const f = flFlips(bd, oc, j, 1 - p).length; avg += f; if (f > best) best = f; }
    tot += mode === "avg" ? avg / emp.length * 1 : best;
  }
  return tot / pool.length;
}
export const FLANK = {
  Rando: s => pick(moves(s)),
  Grabby: s => argmax(moves(s), ([c, i]) => flFlips(s.board, c, i, s.p).length),
  // Verbatim play.html Ada: sum over an 8-card pool × every square of the reply's damage, ×0.6 / pool size.
  Ada: s => {
    const pool = shuffle(s.unseen).slice(0, 8);
    return argmax(moves(s), ([c, i]) => {
      const bd = flPlace(s.board, c, i, s.p), mine = flOwned(bd, s.p), emp = flEmpties(bd);
      if (!emp.length) return mine;
      let worst = 0;
      for (const oc of pool) for (const j of emp) worst += mine - flOwned(flPlace(bd, oc, j, 1 - s.p), s.p);
      return mine - 0.6 * worst / pool.length;
    });
  },
  // Captures, but counts the full damage of the opponent's best reply and prefers sheltered squares.
  Turtle: s => {
    const pool = shuffle(s.unseen).slice(0, 8);
    return argmax(moves(s), ([c, i]) => { const bd = flPlace(s.board, c, i, s.p);
      return flFlips(s.board, c, i, s.p).length - 1.2 * replyLoss(bd, s.p, pool, "best") + 0.3 * EDGE_POS(i); });
  },
  // Grabby plus a love of corners and edges.
  Cornerist: s => argmax(moves(s), ([c, i]) => flFlips(s.board, c, i, s.p).length + 0.6 * EDGE_POS(i)),
  // Net swing after the opponent's best reply, using a sample the size of the opponent's real hand.
  Sage: s => {
    const pools = [0, 1, 2].map(() => shuffle(s.unseen).slice(0, s.oppHand));
    return argmax(moves(s), ([c, i]) => { const bd = flPlace(s.board, c, i, s.p);
      // The opponent will take the single best (card, square) from its hand, so take the max over the hand, not an average.
      let loss = 0;
      for (const pool of pools) { let m = 0; for (const oc of pool) for (const j of flEmpties(bd)) { const f = flFlips(bd, oc, j, 1 - s.p).length; if (f > m) m = f; } loss += m; }
      return flFlips(s.board, c, i, s.p).length - loss / pools.length; });
  },
};

// ── Round Robin ─────────────────────────────────────────────────────────────
const takes = (trick, c) => rrJudge([...trick, { p: -1, id: c }]) === -1;
const adaRR = s => {
  if (!s.trick.length) return argmax(s.legal, c => STR[c]);
  const w = s.legal.filter(c => takes(s.trick, c));
  if (w.length) return argmax(w, c => s.trick.length === 3 ? -STR[c] : STR[c]);
  return argmax(s.legal, c => -STR[c]);
};
const suitLen = (hand, c) => hand.filter(x => FULL[x][0] === FULL[c][0]).length;
export const ROUND_ROBIN = {
  Rando: s => pick(s.legal),
  Grabby: s => argmax(s.legal, c => STR[c]),
  Ada: adaRR,
  // Never wastes a card: only commits when it's last and can win cheaply; otherwise sheds its weakest.
  Turtle: s => {
    if (s.trick.length === 3) { const w = s.legal.filter(c => takes(s.trick, c)); if (w.length) return argmax(w, c => -STR[c]); }
    return argmax(s.legal, c => -STR[c]);
  },
  // Plays like Ada but shapes its hand: leads and discards from its shortest top glyph to go void and trump later.
  Trumper: s => {
    if (!s.trick.length) return argmax(s.legal, c => 100 * -suitLen(s.hand, c) + STR[c]);
    const w = s.legal.filter(c => takes(s.trick, c));
    if (w.length) return argmax(w, c => s.trick.length === 3 ? -STR[c] : STR[c]);
    const following = s.legal.length < s.hand.length || FULL[s.legal[0]][0] === FULL[s.trick[0].id][0];
    return following ? argmax(s.legal, c => -STR[c]) : argmax(s.legal, c => 100 * -suitLen(s.hand, c) - STR[c]);
  },
  // Monte Carlo: deals the unseen cards to the players still to act, lets them play like Ada, and estimates each card's chance of taking the trick.
  Sage: s => {
    if (s.legal.length === 1) return s.legal[0];
    const left = 3 - s.trick.length;
    if (!left) { const w = s.legal.filter(c => takes(s.trick, c)); return w.length ? argmax(w, c => -STR[c]) : argmax(s.legal, c => -STR[c]); }
    const seen = new Set([...s.hand, ...s.played, ...s.trick.map(x => x.id)]);
    const unseen = IDS.filter(c => !seen.has(c)), n = s.hand.length, T = 40;
    const deals = Array.from({ length: T }, () => { const u = shuffle(unseen); return Array.from({ length: left }, (_, k) => u.slice(k * n, k * n + n)); });
    return argmax(s.legal, c => {
      let wins = 0;
      for (const deal of deals) {
        const tr = [...s.trick, { p: -1, id: c }];
        deal.forEach((h, k) => tr.push({ p: k, id: adaRR({ trick: tr.slice(), legal: rrLegal(h, tr), hand: h }) }));
        if (rrJudge(tr) === -1) wins++;
      }
      return wins / T - 0.2 * STR[c] / 59;
    });
  },
};

// ── Streak ──────────────────────────────────────────────────────────────────
const playable = s => s.hand.filter(c => stOk(c, s.run[s.run.length - 1]));
const bestFollow = (s, cs) => { const u = s.unseen(); return argmax(cs, c => u.filter(x => stOk(x, c)).length); };
const adaStreak = (s, { minHand = 2, margin = 0 } = {}) => {
  const L = s.run.length;
  if (s.odds() > L / (L + 1) - margin) return "flip";
  const pl = playable(s);
  if (pl.length && L >= minHand) return bestFollow(s, pl);
  return "bank";
};
export const STREAK = {
  Rando: s => rand() < 0.5 ? "flip" : "bank",
  // Banks as soon as it has 2.
  Timid: s => s.run.length < 2 ? "flip" : "bank",
  Ada: s => adaStreak(s),
  // Keeps flipping while it's better than 60/40, whatever the streak.
  Daredevil: s => s.odds() > 0.6 ? "flip" : (playable(s).length ? bestFollow(s, playable(s)) : "bank"),
  // Ada's flip rule, but never touches its hand.
  Hoarder: s => { const L = s.run.length; return s.odds() > L / (L + 1) ? "flip" : "bank"; },
  // Plays every safe hand card first (they refill for free), then follows Ada's flip rule.
  Spender: s => { const pl = playable(s); if (pl.length) return bestFollow(s, pl); const L = s.run.length; return s.odds() > L / (L + 1) ? "flip" : "bank"; },
  // Spender's hand use plus game-state awareness: pushes when behind late, plays safe when ahead.
  Sage: s => {
    const pl = playable(s); if (pl.length) return bestFollow(s, pl);
    const L = s.run.length, me = s.scores[s.p] + L, lead = Math.max(...s.scores.filter((_, i) => i !== s.p));
    const turnsLeft = s.deckLeft / (2.5 * s.players);
    let margin = 0;
    if (turnsLeft < 3 && me <= lead) margin = 0.12;        // late and not ahead: take more risk
    if (me > lead + 6) margin = -0.05;                      // comfortably ahead: bank a bit earlier
    return s.odds() > L / (L + 1) - margin ? "flip" : "bank";
  },
};

// ── Classic ─────────────────────────────────────────────────────────────────
// How many possible active cards a card can be played on: low means hard to shed.
const SHEDDABLE = IDS.map(c => IDS.filter(a => a !== c && clCan(c, a)).length);
export const CLASSIC = {
  Rando: s => s.legal.length ? pick(s.legal) : null,
  Ada: s => {
    if (!s.legal.length) return null;
    const pressure = s.sizes[(s.i + 1) % s.n] <= 2 ? 6 : 0;
    return argmax(s.legal, c => { const pw = clPosWon(c, s.active); return pw * 3 + (pw >= 2 ? pressure : 0) - FOLLOWERS[c] / 5 + rand() * 1.5; });
  },
  // Maximum punishment: most positions beaten.
  Grabby: s => s.legal.length ? argmax(s.legal, c => clPosWon(c, s.active)) : null,
  // Sheds its hardest-to-play cards first.
  Dumper: s => s.legal.length ? argmax(s.legal, c => -SHEDDABLE[c]) : null,
  // Leaves the next player as little as possible to follow.
  Blocker: s => s.legal.length ? argmax(s.legal, c => -FOLLOWERS[c]) : null,
};
