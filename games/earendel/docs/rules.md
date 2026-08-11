# Earendel — rules in progress

A turn-based game of space exploration for 2–5 players. This document is the design source
of truth: it describes the game as intended, not as implemented. Where the code lags behind
or ahead, this file wins and the code is wrong.

Sections marked **OPEN** are undecided. Nothing should be built on an OPEN item without
settling it first.

---

## Components

**Tiles** — four hexes in a diamond (an axial rhombus). Each tile has one planet hex and
three hexes of open space; *which* hex is the planet varies from tile to tile.

**Planets** — every planet hex has one of **five colors**. A planet is either unexplored or
explored; once explored it can never be explored again.

**Pieces (ships)** — each occupies a single hex of open space. Ships are never placed on
planets. Each contributes *power* toward controlling adjacent planets:

| Piece | Power | Notes |
| --- | --- | --- |
| Probe | 0 | An explorer, not a claim. Its **level** (2 or 3) is how many technology cards it reveals. |
| Station | 1 | |
| Fighter (level 2) | 2 | Destroys an enemy probe on arrival. |
| Fighter (level 3) | 3 | Destroys an enemy probe or level 2 fighter on arrival. |

Probes and fighters come in two **levels**, 2 and 3, visually distinct and known to the
player the moment the piece is drawn. The number means something different for each: a
probe's level is how many cards it reveals, while a **fighter's level is its power** — so a
level 3 fighter both holds planets harder and kills more.

Further piece types are expected to arrive as rewards from exploration; each will declare
its own power.

**Bags** — each player has their own bag containing **8 probes, 6 stations, 8 fighters** —
22 pieces. The probes are four of level 2 and four of level 3, and the fighters likewise. Bag contents are hidden from
everyone, including the owner. Pieces are drawn blind.

**Technology deck** — a shared deck. Each card is associated with **one, two, or three
planet colors**, and can only be housed on a planet of a color it lists.

Every technology is either **standard** or **elevated**. An elevated technology can't be
passed over: see *Exploration* below.

**Special pieces** — kept face-up in front of their owner, and playable instead of drawing
from the bag. They come *from technologies*: a technology may grant one or more special
pieces, or instead a continuous power. Technology is the reward; a special piece is one form
it takes.

---

## Setup

The board starts as **7 tiles per player**, arranged so the map is compact at every player
count. Each player's bag is shuffled. Scores start at 0.

**OPEN:** how planet colors are distributed across the starting tiles.

**Sizing, settled by simulation rather than by feel.** The open space on the board has to be
matched against the size of the bags, or the game cannot reach its own ending. Two tiles per
player with two planets each gave 4 open hexes per player against a bag of 18: games jammed
solid after about 4 placements each.

One planet per tile matters for a second reason beyond making room. With two, planets are so
dense that chains fire constantly and swamp everything else — 30 to 67 a game on a large
board — and barely a third of planets get explored, because there is no need to reach for
them. With one, chains stay an achievement.

At **7 tiles per player and 22-piece bags** — 21 open hexes each — 31 of 32 simulated games
end on an empty bag, with every player placing at least 21 of their 22 pieces. Enlarging the
board further only lowers the share of planets explored, since the probes per player stay
fixed.

**PROVISIONAL: 7 tiles per player, 1 planet per tile.** If board growth lands, the opening
map should start smaller and let growth make up the difference.

---

## A turn

A turn is **exactly one placement**, plus resolving whatever that placement triggered. There
is no action phase, no second placement, and nothing to do between turns.

A turn opens with a **draw**: the player takes a ship blind from their own bag and turns it
face up. Knowing what they have is what makes the placement a decision, so the draw always
comes first.

They then either:

1. **Place the ship they drew**, or
2. **Put it back in the bag** — which is reshuffled — and **place a special piece** from the
   face-up pieces in front of them instead.

Putting a draw back costs nothing but the turn's placement, and leaves the bag one turn
further from running out. Note the drawn ship is **public**: everyone sees what was drawn,
including what was put back.

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

**Elevated technologies override the choice.** If any matching card is elevated, the planet
must take an elevated one: the standard matches are out of reach, however attractive. Reveal
two or more elevated cards and the choice is between *those*. Reveal none and every match is
on the table as normal.

So an elevated card is both a stronger prize and a loss of control — the more of them in the
deck, the more exploring becomes a lottery rather than a decision. Where only one card can be
taken there is no decision to present, so the engine houses it without asking.

### Immediate effects

A technology may be **immediate**: its effect happens the moment the player chooses it for the
planet they have just explored, inside that same turn. The turn does not end until it is
resolved.

The first one is: **move any friendly piece into any adjacent empty space.**

- The piece must be the player's **own**, and the destination adjacent, open space, and empty.
- **A step is not a placement.** Nothing that a placement triggers happens: no chain scores,
  no station group pays out, no probe explores the planet it lands beside, no fighter fires.
  What does change is position, and so who holds the planets at either end of the step —
  which can hand a technology to a player who had nothing to do with it.
- A probe still cannot step into a space closed by an enemy station blockade. That rule closes
  the space itself, not the act of placing.
- The move is **not optional** — it is the technology's whole effect, not a bonus alongside
  it. If no friendly piece can step anywhere, it simply fizzles.

The second is: **draw a tile from the supply and lay it, then draw a ship and place it on
that tile.**

- The tile must be laid so that **at least two of its own hexes border hexes already on the
  board**. Two of them may border the *same* hex — the rule is about the tile's contact, not
  the board's. This is what stops the map growing a thin tail.
- The ship that follows is a **real placement**, unlike the move above: it explores, it
  shoots, it scores its station group, all as normal. It just has to land on the tile that
  was jut laid.
- The ship is a fresh draw from the player's own bag, so this technology **spends a piece and
  brings that player's own ending closer** — the bag is the clock.
- If the supply is empty, or there is nowhere legal to lay a tile, the technology comes to
  nothing. If the bag is empty, the tile is laid and no ship follows.

Because the placed ship can be a probe, growing the board can trigger another exploration,
another technology, and so another tile. The chain is bounded by the tile supply and the bag.

The player may **turn the tile** to any of six rotations before laying it. The tile is a
rhombus, so it covers the same four hexes every half turn — but the planet swaps corners, so
turning is worth doing even when the outline doesn't move. Rotation also reaches placements a
fixed orientation cannot.

**OPEN:** how large the tile supply should be — provisionally two tiles per player.

**ASSUMED:** that a step triggers nothing. A move that explored, or scored a chain, would be a
far stronger effect; this is the conservative reading.

**OPEN:** what proportion of the deck is elevated. Provisionally one card in three, which is
a placeholder standing in until the real technologies exist, since it depends on how much
stronger an elevated one is.

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
strictly less power than itself**. Nothing destroys its equal, which makes a level 3 fighter
untouchable.

**Stations are immune.** A station is a structure, not a ship, and no fighter shifts one
whatever its level. So a level 2 fighter can only clear probes, and a level 3 fighter clears
probes and level 2 fighters. Removing a station is meant to take a **special piece won from
a technology** — when one exists, it goes in the destroy table as its own piece type rather
than as a change to what fighters can do.

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

### Station groups

Placing a **station** scores **1 for itself and 1 for every other friendly station in a
contiguous group with it**.

Two stations are in the same **complex** if they **touch**, or if there is a **clear line**
between them — the same wavy line that closes that space to enemy probes (see *Station
blockades*). Links are **transitive**: a complex can run board-wide through a chain of
adjacency and sight lines, and a single station bridging two clusters welds them into one.

So a player with three touching stations who lays a fourth across a gap, with a clear line to
the run, scores **4**.

Stations link to **stations only**. A probe or fighter standing between two of them — yours or
anyone else's — breaks *both* kinds of link at once: adjacency by definition, and the line by
standing in it. So one piece dropped into a gap can split a complex in two, which is the
counter-play, given that stations cannot be destroyed. A planet breaks a line too, since it
cannot be seen past.

Because it pays on every placement, a complex built up one station at a time pays 1, 2, 3, …
— the same triangular total a chain pays, but earned incrementally and with no need for
planets to line up. Placing stations apart and joining them later pays *less* than building
compactly from the start (1+1+3 = 5 against 1+2+3 = 6), which is the decision the rule
creates. All six stations in one complex is 21 points, the practical ceiling — and sight lines
make reaching that far easier than adjacency alone would.

This gives each piece type a job: probes explore, fighters destroy, stations score.

### Station blockades

Two of one player's stations with **clear empty space between them along a straight line**
close that space to **every other player's probes**. Nothing else is affected: an opponent
may place a station or a fighter in the corridor, and doing so is exactly what breaks it.

- The line must be **clear**. Any piece standing between the two stations, of any colour,
  ends it — and so does a planet, which is a world rather than a gap to see past.
- Stations that are already **touching** close nothing: there is no space between them.
- The owner's own probes pass freely.

So a station pair is a fence that costs nothing to maintain and can only be broken by
committing a real piece to the gap. Since probes are the only way to explore, a well-placed
pair can shut opponents out of the planets beyond it.

The same line also joins the two stations into one **complex** for scoring — see *Station
groups* above. A wavy line therefore does two jobs at once, which is why breaking one is worth
a piece to an opponent.

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

Board growth is a **technology effect** — see *Immediate effects* above. Tiles come from a
supply held back at setup, and the technology that draws one also places a ship on it.

---

## End of the game

The moment **any player has played the last piece from their bag**, the game ends
immediately — **mid-round**, with no final go-around.

The game also ends the moment a player **cannot legally place the piece they drew**, and has
no special piece they could place instead. A full board is one way that happens; a probe
drawn while every open hex is closed by enemy station blockades is another.

This can only be judged after the draw, since a hex shut to a probe is wide open to the
fighter behind it in the same bag. It is a real ending rather than a safety valve, but a rare
one: roughly one simulated game in thirty ends this way, and if it becomes common the board
has grown too small for the bags. Players later in the turn order simply
don't get another turn.

Everyone starts with the same 18 pieces, so the player who empties their bag first is the
one who has spent the fewest turns on special pieces, not the one who was luckiest with the
order: a draw that goes back in the bag doesn't advance that player's clock.

An exploration owed by the final placement is still resolved — the game ends after it, not
instead of it.

**OPEN:** final scoring beyond planet control.

---

## Testing aids

Not rules. The **Technology deck** setup option can fill the deck with a single technology,
one card in every planet colour, so a newly added effect comes up on every exploration
instead of waiting on the shuffle. Every planet then houses the same technology, which is no
kind of game — it is just the fastest way to see a new effect from every angle. Use the full
deck for anything resembling a real playtest.
