# Personality tournaments

Headless copies of the five games in `play.html` (`engine.mjs`), a cast of players with different strategies (`players.mjs`), and tournaments between them (`tourney.mjs`).

```
node tourney.mjs all          # every game, default sample sizes (~2 min)
node tourney.mjs flank 1000   # one game, N games per pairing
```

`results.md` holds the latest run. The RNG is seeded, so results are reproducible.

`node matrix.mjs` plays every player against every other in every game, including each player at a table of three copies of every other in the four-player games, and writes `matrix.json`. `node export.mjs` turns that into `matchups.csv` and `cast.csv`, the data behind the matchup dashboard.

## The cast

| Archetype | Trait |
|---|---|
| Rando | Any legal move. |
| Grabby | Best result this turn, no thought for the next. |
| Ada | The bot shipped in `play.html`. |
| Turtle | Cautious: minimises what it can lose. |
| Daredevil | Chases the big result, takes risks. |
| Sage | Models the other players (best response, Monte Carlo, or game-state aware). |

Game-specific characters:
- **Showdown:** Nash (plays each round's equilibrium mix) and Saver (keeps strong cards for big pots).
- **Flank:** Cornerist (greedy, but loves corners and edges).
- **Round Robin:** Trumper (shapes its hand to run out of a glyph, then trumps).
- **Streak:** Spender (always plays safe hand cards) and Hoarder (never does).
- **Classic:** Dumper (sheds hard-to-play cards first) and Blocker (leaves the next player little to follow).

## Findings

- **Showdown** is the most skill-sensitive game. Sage best-responds to an Ada-like opponent and beats Ada 96% of the time. Nash can't be exploited and beats Sage 63%. Ada's random mixing makes her the weakest of the thinking players (36% on average): the deterministic bots beat her, but Sage can't read them.
- **Flank:** Ada is the strongest. She penalises every square a reply could hit, which effectively counts how much of her position is exposed. That works better than Sage, which plans against the opponent's single best reply and peaks at 25% against Ada whatever weight it gives that reply. Rando never wins.
- **Round Robin:** Sage, Trumper and Ada are close: against three Adas, Sage takes 26.5% ±0.9 where 25% is fair. The skill floor is very high, though. Grabby (always plays its strongest card) and Turtle (never contests a trick early) take only 1–7%.
- **Streak:** playing hand cards matters most. Hoarder uses Ada's flip rule but never plays from its hand, and wins only 14% against Ada. Spender plays every safe hand card first and wins 64%. Sage adds score awareness late in the game, a small further edge (53% against Spender). Daredevil (flips while the odds are above 60%) is worse than random.
- **Classic:** only one thing matters, beating positions so the next player is skipped or draws two. Ada and Grabby are dead even. Every strategy that ignores this loses about 90% of games against them.
- Four-player tables cycle all 24 seating orders. In Classic, a fixed rotation biased results badly, because skip and draw-2 always hit the same neighbour.
