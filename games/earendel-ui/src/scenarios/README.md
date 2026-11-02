# Earendel harness scenarios

Each file here is a position the dev harness opens from its **Scenarios** menu. They are written
by `scripts/build-scenarios.mjs`: build the logic package, then run `node scripts/build-scenarios.mjs`.

## Relays

Player 1 (always the player to move, whichever seat the game gives them) has drawn three ships (a station, a level 2 probe and a level 3 fighter) on a board laid
out to show what a relay does. Both players hold Relay Network, one per relay, and Player 1's has
one relay still to place: hover Relay Network in their panel to read what a relay does, or
choose the relay instead of the drawn ships to place it. Throw out the station to try the rest.

- **Relays link stations past ships.** Player 1's relay sits on a line between two of their
  stations, with a Player 2 fighter and probe in the way, and sees a third station on a diagonal.
  Sight lines join all three into one complex: place a station beside any of them and it scores
  for the whole complex.
- **Relays protect probes past ships.** Hover Player 2's probe at the left of the lower row: a
  relay line runs to Player 2's relay, straight past Player 1's station. Place Player 1's fighter
  beside that probe: it has nothing to shoot.
- **Relays close hexes to rival probes past ships.** Choose Player 1's probe: the hexes on the
  line between Player 2's station and relay, at the right, are closed to it (wavy lines), even
  beyond Player 1's own fighter.
- **A planet blocks a relay.** Hover Player 1's probe above their relay: no relay line, because
  a planet stands between them.
