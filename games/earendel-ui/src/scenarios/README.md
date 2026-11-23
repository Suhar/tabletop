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
  line between Player 2's station and relay, at the right, are closed to it (red dashed outlines), even
  beyond Player 1's own fighter.
- **A planet blocks a relay.** Hover Player 1's probe above their relay: no relay line, because
  a planet stands between them.

## Terraformers

Player 1 has drawn three ships (a station, a level 2 probe and a level 3 fighter) on a board laid
out to show what a terraformer does. Both players hold Terraforming, one per terraformer on the
board, and Player 1's second has a terraformer still to place; Player 1 also holds a Tactical
Feint, ready to use. Throw out the station, then choose the terraformer instead of the drawn
ships to place it.

- **A terraformer may recolor the planet it lands beside.** Place it beside the explored violet
  planet at the left: the turn asks for a new color, or to leave the planet be. Recolor it:
  the planet wipes to its new color behind a scan line and keeps its Railgun, and the terraformer
  now controls it (power 1), like a station.
- **Beside several planets, it chooses one.** Place it on the open hex between the mint and aqua
  planets: the prompt offers both, and only the chosen one changes.
- **A planet another terraformer touches is safe.** Place it beside the teal planet at the top
  right, which Player 2's terraformer already touches: nothing is asked, and the planet keeps its
  color.
- **A Tactical Feint counts as placing it.** Instead, use the feint on Player 1's terraformer at
  the right, trading places with Player 2's station: it arrives beside the periwinkle planet and
  may recolor it, and the drawn ships are still to place afterwards.

## Gamma Torpedo

Player 1 has drawn three ships (a level 3 fighter, a station and a level 2 probe) and holds a
ready Gamma Torpedo. Throw out the station or the probe, then choose the fighter: the panel
offers **Arm Gamma Torpedo**.

- **A torpedo goes down beside a station.** Arm it: only the empty hexes beside a station carry
  the turning ring, and the ghost is a single red-tipped dart whose chevrons point at the
  stations it could strike. The hexes beside Player 2's relay at the lower left are not offered:
  a relay is not a station.
- **An escort does not stop it.** Place it at the hex left of Player 2's station in the upper
  row, beside the fighter escorting it. The strike is immediate: the torpedo turns to face the
  station, runs into it, and both go up in one blast; the fighter stays.
- **Several stations, your own included, are a choice.** Undo, and place it instead on the empty
  hex between Player 2's station and Player 1's own at the right. Both stations carry the red
  chevrons and Hold fire is not offered; click either, Player 1's own included, and the torpedo
  takes it.
- **It is spent.** After the strike, Gamma Torpedo in Player 1's panel shows the three-turn
  cooldown, and history reads "placed a fighter as a Gamma Torpedo" then "set off the
  torpedo, destroying a station".

## Elevated events

Three players; Player 1 has drawn three level 2 probes, and the setup draw gave every color its
**event** card, shown face up in the row above the deck. The deck is stacked so that surveying
a color turns up its elevated card beside an ordinary one: violet, aqua, mint, periwinkle, teal,
in that order from the top, so survey the earlier colors first or their cards are discarded on
the way to the later ones. Throw out one probe, then place the others beside the planets.

- **Discovering spends the planet.** Survey the violet planet and choose Orbital Targeting:
  the probe and a marker of each rival's color go into orbit, the card dims in the row, and
  Player 1 is asked to line up the others.
- **The discoverer picks first and sets the order.** Click Player 3 then Player 2, Undo, click
  them again, confirm. Player 1 clicks Player 2's fighter or Player 3's probe to destroy; the
  next player has the one that is left; the last has nothing and is passed over.
- **Each event has its own pick.** Aqua: Wormhole Storm, click Player 1's station at the right
  then an empty hex beside any planet. Mint: Salvage Rights, two discarded cards are offered
  and each goes once. Periwinkle: Signal Intercept, the explored violet planet at the far right
  is the one to click, and only the first picker gets it. Teal: Shipyard World, one of each
  unit in play for three players, so each unit goes once and the last picker takes what is left.

## Elevated globals

The same position, with every color's **global** card dealt instead.

- **A global holds for everyone and gives the discoverer one pick.** Survey violet and choose No
  Quarter: Player 1 gets a single Orbital Targeting pick, then escorts protect nobody for
  the rest of the game.
- **Free Drift.** Survey aqua: Player 1 gets one Wormhole Storm move; every later turn then
  opens with the drift step after the draw, on the technology-move screen.
- **Overdrive, Shared Science, Global Recycling.** Mint stops the discard from the next turn on;
  periwinkle hands every technology a probe orbits for to rivals' probes beside the planet; teal sends every
  destroyed probe or fighter back to its bag, which the history says.

## Special pieces: map and planets

Player 1 has drawn a station, a level 2 probe and a level 3 fighter, and holds a Gate and an
Artificial Planet still to place; their Nebula Seeder at the lower left has laid once already.

- **A seeder lays at the turn's start.** The turn opens with the seeder's empty neighbors
  ringed: click one to turn it to nebula, or leave the nebula be. Nothing can be placed on it
  afterwards.
- **An interdictor closes its neighbors.** Choose the probe or the fighter: the hexes around
  Player 2's interdictor at the center are outlined red and refuse the placement.
- **Gates are one place.** Place the Gate from hand beside Player 1's station at the far left:
  the station at the far right, beside the standing gate, is now in the same complex, and a
  station placed by either gate links to both.
- **An artificial planet founds a world.** Place the Artificial Planet on any empty hex: the
  panel offers five colors and the hex becomes an unexplored planet of that color.
- **A beacon quarantines.** Player 1's probe has a claim on the mint planet beside Player 2's
  beacon: the claim waits at Player 1's next turn, and no probe is offered that planet.

## Special pieces: combat and the bag

Player 1 holds a Deep Scanner on the board, so they have drawn four ships and must throw out
two. Player 2 holds a Bastion, a Jammer and a Salvage Drone; Player 1 a Carrier.

- **A bastion shields.** Place the level 3 fighter beside Player 2's probe at the violet planet:
  it has no shot, because the bastion beside the probe escorts it; the bastion itself is a
  torpedo's target only.
- **A carrier weighs 3.** Player 1's carrier beside the periwinkle planet outweighs Player 2's
  level 2 probe, so a probe of Player 1's placed there is offered the survey.
- **A jammer blinds.** Player 2's two stations at the lower right would close the hex between
  them to Player 1's probes, but the jammer beside them leaves it open.
- **A drone salvages.** Destroy Player 2's probe beside the drone in the lower middle with a
  fighter: the history says it was salvaged, and Player 2's bag grows by one.
- **Deep Scan draws four.** Throw out one ship, then a second: only then does placing begin.
