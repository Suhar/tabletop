# The Two Crowns 1874

`@tabletop/two-crowns` is the deterministic logic package for The Two Crowns 1874, a 3–5 player
18xx prototype set in Croatia. Its companion Game Client is `@tabletop/two-crowns-ui`.

## Sources

- `design/TwoCrowns1874.json`: the 18xx Maker prototype (map, tiles, companies, privates, market,
  trains, phases, player counts).
- `design/1874design.md`: the design document and source of truth for rules and numbers.

Both are copied in from the designer's working folder. `scripts/import-maker.mjs` turns the JSON
into `src/generated/`; never edit those files by hand.

```
pnpm --filter @tabletop/two-crowns import        # regenerate src/generated
pnpm --filter @tabletop/two-crowns import:watch  # regenerate and rebuild on every design change
```

## Current scope

The rules are a copy of The Old Prince 1871's title rules (`games/the-old-prince`) running on the
1874 data. The Two Crowns will change most of those procedures, so it owns its copy rather than
parameterising TOP. Shared mechanisms stay in `@tabletop/18xx`.

Implemented on 1871 rules, with 1874 data:

- Map, terrain, offboards (multi-hex offboards share a stop group), labels X, CX, P, J, S, Z, R.
- Tile manifest from 18xx Maker, plus unlimited yellow 5X/6X for X cities.
- 8 Luka companies, 5 Branch companies, the Luka, the Austrian Bank.
- Starting cash and certificate limits by player count; Mainline at 92, Shortline at 86.
- Three Luka companies drawn; the third is the Narodna Line, which cannot start yet.
- Privates P1–P17 with their 1871 counterparts' powers: Shortline exchanges (P1, P2, P7),
  Station Rights blocking (P3, P4; one removed at random at 4 players), Lika Survey straight
  tile (P8), Mainline shares (P9, P11), Wiener Neustadt (P10), Austrian Bank (P12), concessions
  (P15, P16), k.u.k. Post.
- Tranches: Mainline and Shortline, then rows of 2, 2 and 3.

Not yet implemented: 5 players, Narodna Line and Bonds, trade-ins, Lazarettos (P5, P6), Berths
and sea offboards, Hungarian Bank (P14), Ancona Steamship Line (P17), the Late space,
companies buying Station Rights, junction (J) upgrades, the gray-tile endgame. P5, P6, P13, P14
and P17 pay revenue only.

## Development

`pnpm --filter @tabletop/two-crowns build` emits `esm`; `check` type-checks; `test` runs the
data checks. Complete games run in `apps/18xx-playground/src/demo/twoCrownsGame.spec.ts`.
