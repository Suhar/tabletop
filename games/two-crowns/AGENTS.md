# The Two Crowns 1874

The rules and data come from the design repo, `Suhar/two-crowns-1874`, cloned at
`/workspace/design/two-crowns-1874`. Its `1874design.md` is the authority for rules and numbers,
and `TwoCrowns1874.json` for the map, tiles, companies, privates, market, trains and phases.

Before changing any rule, number, map hex or tile, read and follow the checklist in that repo's
`README.md`, section "Changing the game". In short:

- Make the change in the design repo first, bump its `VERSION` and `CHANGELOG.md`, then commit,
  tag and push it. Pushing the design repo needs no confirmation.
- Then `pnpm --filter @tabletop/two-crowns run sync --build`. Never edit `design/` or
  `src/generated/` here, because the next sync overwrites them.
- Rule changes also need code and tests in `src/`. Update the UI's phase notes, run the checks,
  restart the lab's bot server and run the smoke test, all as the checklist says.
- Commit engine changes on `two-crowns-harness-bots`, but never push this branch or any
  `two-crowns` branch: the `fork` remote is public.

Engine work that leaves the design unchanged (a bug fix, a UI change) skips the design steps but
still runs the checks.
