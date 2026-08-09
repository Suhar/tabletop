# Earendel — rules in progress

A turn-based game of space exploration for 2–5 players. This document is the design source
of truth: it describes the game as intended, not as implemented. Where the code lags behind
or ahead, this file wins and the code is wrong.

Sections marked **OPEN** are undecided. Nothing should be built on an OPEN item without
settling it first.

---

## Components

**Tiles** — four hexes in a diamond (an axial rhombus). Each tile has two planet hexes and
two hexes of open space; *which* two are planets varies from tile to tile.

**Planets** — every planet hex has one of **five colors**. A planet is either unexplored or
explored; once explored it can never be explored again.

**Pieces (ships)** — each occupies a single hex of open space. Ships are never placed on
planets. Each contributes *power* toward controlling adjacent planets:

| Piece | Power | Notes |
| --- | --- | --- |
| Probe | 0 | An explorer, not a claim. Its **level** (2 or 3) is how many technology cards it reveals. |
| Station | 1 | |
| Fighter (level 2) | 2 | Destroys a probe or station on arrival. |
| Fighter (level 3) | 3 | Destroys a probe, station, or level 2 fighter on arrival. |

Probes and fighters come in two **levels**, 2 and 3, visually distinct and known to the
player the moment the piece is drawn. The number means something different for each: a
probe's level is how many cards it reveals, while a **fighter's level is its power** — so a
level 3 fighter both holds planets harder and kills more.

Further piece types are expected to arrive as rewards from exploration; each will declare
its own power.

**Bags** — each player has their own bag containing **6 probes, 6 stations, 6 fighters**.
The six probes are three of level 2 and three of level 3, and the six fighters likewise. Bag contents are hidden from
everyone, including the owner. Pieces are drawn blind.

**Technology deck** — a shared deck. Each card is associated with **one, two, or three
planet colors**, and can only be housed on a planet of a color it lists.

**Special pieces** — kept face-up in front of their owner, and playable instead of drawing
from the bag. They come *from technologies*: a technology may grant one or more special
pieces, or instead a continuous power. Technology is the reward; a special piece is one form
it takes.

---

## Setup

The board starts as **2 tiles per player**, arranged so the map is compact at every player
count. Each player's bag is shuffled. Scores start at 0.

**OPEN:** how planet colors are distributed across the starting tiles.

---

## A turn

A turn is **exactly one placement**, plus resolving whatever that placement triggered. There
is no action phase, no second placement, and nothing to do between turns.

A player either:

1. **Draws a ship** blind from their own bag and places it, or
2. **Places a special piece** from the face-up pieces in front of them, instead of drawing.

A ship may be placed on **any open hex** — never on a planet, never on an occupied hex.

Placement is otherwise **unrestricted**: a ship need not connect to, or sit near, anything
its owner has already placed. The whole board is in play on every turn. Individual rules may
carve out exceptions later, but there is no general adjacency requirement to build on.

### Exploration

Placing a **probe** adjacent to an unexplored planet explores it. Landing there is what
triggers exploration — the player doesn't decide *whether* to explore.

A hex touches six others, so a probe may land beside **several** unexplored planets. It
still explores only **one**: the player chooses which. The others remain unexplored and can
be reached later by another probe.

Exploring reveals the chosen planet's nature:

1. Cards are flipped from the technology deck **until the number of revealed cards showing
   the planet's color equals the probe's level** (2 or 3).
2. The exploring player **selects one of the matching cards** to become that planet's
   technology. Cards that were flipped without the planet's color are never candidates -
   they are simply turned over on the way.
3. Every other flipped card is discarded, matching or not.

If the deck runs out mid-reveal, the discard pile is shuffled to form a new deck. If even
that cannot produce enough matching cards, the planet is explored with **fewer** candidates
than the probe's level - down to one, or to none at all, in which case it is explored but
receives no technology. The deck is intended to carry enough variety that this never comes
up in practice.

### Gaining a technology

A planet's technology is permanent, and so is holding it. A technology is **gained** at two
moments:

1. The player who **explores** the planet gains it immediately, on choosing it. They need no
   power there at all, then or ever.
2. Any player who later holds the planet **outright** gains it too.

Outright means **strictly more power than any other player** — not merely tied for the most.
This is stricter than control for scoring purposes (see below): matching an opponent's
presence beside a planet is *not* a way to copy what they hold.

A gained technology is **never lost** — not when the planet is, not ever. Whatever it grants
(a special piece, a continuous power) stays with the player who gained it. Several players
can therefore hold the same planet's technology, and over a game technologies only
accumulate.

A planet pays each player **once and once only**. Losing a planet and taking it back again
gains nothing the second time, so a planet can't be farmed by control passing back and
forth.

**Exploring pays no points, deliberately.** Its rewards are that the explorer *decides* what
the planet will hold — picking a technology that suits their position, from cards nobody
else has seen — and that they know what is coming while everyone else must react to it.

**OPEN:** whether a technology may carry an extra reward for the explorer specifically — for
example granting the explorer two copies of a special piece where a later controller gets
one. This is a reason for a probe's *level* to matter beyond the size of the reveal: a level
3 probe sees more cards, so it is likelier to find a technology worth exploring for.

Both exploration decisions — which planet, then which card — belong to the placing player
and happen inside their own turn. Neither is ever *presented* when it has only one answer: a
probe beside a single unexplored planet explores it without asking, and a reveal that turns
up one matching card (or none) houses it without asking. Only genuine choices interrupt.

Other piece types resolve their own effects on placement; only probes explore.

### Fighters destroy

A fighter arrives shooting. On being placed, it **may destroy one adjacent piece with
strictly less power than itself** — so a level 2 fighter clears probes and stations, and a
level 3 fighter also kills level 2 fighters. Nothing destroys its equal, which makes a level
3 fighter untouchable.

- It is **optional**. Even with a single target, the choice is the player's and is never
  taken for them.
- Only **one** piece, and only an **opponent's** — a fighter never fires on its own side.
- The destroyed piece is **out of the game**. It does not return to its owner's bag, so the
  owner's clock is unaffected; what it frees is the hex.

This is the only way a hex is ever vacated. Nothing else ever leaves the board.

Destroying can change who holds a nearby planet outright, and therefore hand over its
technology — **including to a player who took no part in the attack**, when the removal
breaks a tie they were losing to.

---

## Control and scoring

A planet is controlled by whoever has the most **power** in the six hexes touching it. A
planet touched only by probes (0 power) is controlled by nobody.

Ties are treated differently depending on what is at stake:

| At stake | A tie |
| --- | --- |
| End-game points for the planet | **Pays every tied player in full** |
| The planet's technology | **Pays nobody** — it takes strictly more power than anyone else |

So sharing a planet's points is fine; sharing what it holds is not. One consequence worth
knowing: deliberately *tying* a planet freezes its technology out of everyone's reach, since
no one is then holding it outright.

Scores are **public** and are a **running total that never decreases**: points scored for
control during the game are kept even if control is later lost.

### Chains

If a placement creates an unbroken chain of that player's own ships joining **two planets of
the same color**, the player scores **T(n)**, where *n* is the number of ships in the chain
(planets aren't counted) and T(n) is the *n*th triangular number: 1, 3, 6, 10, 15, …

A chain is a run of ships on adjacent hexes; the first touches one planet, the last touches
the other. Ship type is irrelevant — a probe links a chain as well as a fighter does. Only
the player's *own* ships link, and since no ship can stand on a planet, a planet is a wall a
chain must go around.

Because T grows faster than *n*, joining two **distant** planets of a color is worth far more
than joining two that nearly touch — and costs the ships and turns to match, which is also
the game's clock.

**ASSUMED** (settle before playtesting):

- *n* is the length of the **shortest** run through the player's ships. Once ships bunch up
  there are many routes; the shortest is the one that is well defined, and it's the only
  measure that doesn't pay a player for wandering.
- A **pair of planets pays once, ever, to whoever joins it first** — it is then spent for
  everyone. Otherwise the same two planets could be re-joined by a longer route for a bigger
  payout.
- One placement can complete **several pairs at once** (a ship touching three planets of one
  color joins three pairs); each is measured and paid separately.

**OPEN:** which other acts score during play, and how much. Taking control of a planet from
another player is a candidate.

### At the end of the game

Every planet pays **1 point** to each player controlling it, explored or not. Ties pay in
full, so one planet can pay two players a point each.

This is the only scoring that waits until the end: control can change hands all game without
anyone banking anything, so it's the board's final shape that counts.

**OPEN:** whether an explored planet should be worth more than an unexplored one.

**OPEN:** whether each technology carries its own end-game point value, so that choosing
which technology to house on a planet is also a scoring decision. Note that the player who
explores a planet often isn't the player who ends up controlling it — probes have no power —
so a technology's value would be points offered to *whoever holds the planet at the end*,
which makes housing a low-value technology on a planet you don't expect to hold a deliberate
denial play.

---

## Board growth

Certain actions let a player add a tile to the board. A new tile must be placed so that **at
least two of its hexes touch existing hexes**.

**OPEN:** what triggers a tile placement, where the tiles come from, and whether the placing
player chooses the tile's rotation.

---

## End of the game

The moment **any player has played the last piece from their bag**, the game ends
immediately — **mid-round**, with no final go-around. Players later in the turn order simply
don't get another turn.

Everyone starts with the same 18 pieces, so the player who empties their bag first is the
one who has spent the fewest pieces on special-piece turns, not the one who was luckiest
with the order: playing a special piece instead of drawing leaves the bag untouched and buys
an extra turn.

An exploration owed by the final placement is still resolved — the game ends after it, not
instead of it.

**OPEN:** final scoring beyond planet control.
