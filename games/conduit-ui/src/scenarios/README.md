# Conduit harness scenarios

Each file is a position reached by real play from a seeded start, so the history and Undo work.
`node scripts/build-scenarios.mjs` writes them all (build `@tabletop/conduit` first).

## Mid game grid

Four players, round 3, bidding. The grid has owned stations, face-down tiles and a closed
connection.

- Click an owned station: its route to the nearest station of the next letter lights up, matching
  its revenue badge.
- Check the red stick sits on the edge where two opposite terminals meet.
- Bid on any spot: the cube goes on the lowest free space of that track.

## Stacked offer

Three players. Spot 1's track holds, from the bottom, the Start Player, the Start Player again,
the third player and the Start Player.

- The Start Player is offered the tile at $5: $1 plus a dollar for each of the four cubes.
- Pass as the Start Player: both bottom cubes go back to supply for $1, and the third player is
  offered the tile at $3.
- Pass as the third player: the Start Player is offered it again at $2, and passing pays another $1.
- With everyone passed, the Start Player places the tile face down.

## Placing a station

Four players, round 3. A bought tile waits to be placed, and the grid already spans six tiles one
way.

- Every lit cell borders a tile, and none would stretch the grid past 6×6: the cells beyond the
  six-tile side stay dark.
- Choose a cell: the tile shows in its first legal turn. Turn it with the arrows (illegal turns
  are skipped), then choose the extra cubes: the station shows its cubes and revenue badge.
- Undo puts the tile back in its first turn, then clears the cell, before undoing anything played.

## Last tile

Three players, the last tile of round 5.

- Place it: revenue and infrastructure loss repeat until no cubes are left, the history shows
  Final payouts, and the game ends with the most cash winning.

## Route choice

Four players, round 4, before revenue. Ada's D has two equally good routes (same length, same
stations, same number of her own), one paying its $1 toll to Dev and one to Cleo, so she chooses
(designer ruling, 2026-11-25). Her C station has a choice of its own after that.

- Hover each button ("Dev +$1", "Cleo +$1"): the route flows on the board with a +$1 chip on the
  station it pays; the other route shows faint.
- Choose Cleo, then either route for her C station: revenue draws Ada's route to Cleo's station, captioned
  as her choice, and Cleo gets the $1.
- Undo returns to Ada's choice.
