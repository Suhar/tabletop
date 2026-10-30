# Earendel — rules

A turn-based game of space exploration for 2–5 players. This document is the design source
of truth: it describes the game as intended, not as implemented. Where the code lags behind
or ahead, this file wins and the code is wrong.

Every rule here is settled. A question that comes up in play is added as **OPEN** and decided
before anything is built on it.

---

## Components

**Tiles** — four hexes in a diamond (an axial rhombus). Each tile has one planet hex and
three hexes of open space; _which_ hex is the planet varies from tile to tile.

**Planets** — every planet hex has one of **five colors**. A planet is either unexplored or
explored; once explored, the technology it holds never changes.

**Pieces (ships)** — each occupies a single hex of open space. Ships are never placed on
planets. Each contributes _power_ toward controlling adjacent planets:

| Piece             | Power | Notes                                                                                                           |
| ----------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| Probe             | 1     | An explorer. Its **level** (2 or 3) is how many technology cards it reveals, and its weight in probe influence. |
| Station           | 1     |                                                                                                                 |
| Fighter (level 1) | 1     | Only reached by damage. Destroys an enemy probe on arrival, unless relayed.                                     |
| Fighter (level 2) | 2     | Destroys an unrelayed enemy probe; damages a level 1 fighter to destruction.                                    |
| Fighter (level 3) | 3     | Destroys an unrelayed enemy probe; damages a level 2 fighter, or finishes a level 1.                            |

Probes and fighters come in two **levels**, 2 and 3, visually distinct and known to the
player the moment the piece is drawn. The number means something different for each: a
probe's level is how many cards it reveals, while a **fighter's level is its power** — so a
level 3 fighter both holds planets harder and kills more.

Further piece types are expected to arrive as rewards from exploration; each will declare
its own power.

**Bags** — each player has their own bag containing **8 probes, 6 stations, 8 fighters** —
22 pieces. The probes are four of level 2 and four of level 3, and the fighters likewise. Bag contents are hidden from
everyone, including the owner. Pieces are drawn blind.

**Technology deck** — a shared deck. Each card has a **name**, an **ability**, and is
associated with **one, two, or three planet colors**; it can only be housed on a planet of a
color it lists.

The deck has **25 cards**, one for every combination of one, two or three of the five planet
colours: 5 single-colour, 10 two-colour and 10 three-colour cards. The ten technologies are dealt
across those cards in turn, in this order: Tactical Shift, Beyond the Frontier, Logistics
Upgrade, Railgun, Station Upgrade, Updated Logistics, Full Torpedo Spread, Tactical Feint, Trade
Route Wormhole, Immediate Download. The first five appear three times each and the rest twice.
Which colours a technology carries follows from that order rather than from design; the real
card list is still to be designed.

Every technology is either **standard** or **elevated**. An elevated technology can't be
passed over: see _Exploration_ below.

**Special pieces** — kept face-up in front of their owner, and playable instead of drawing
from the bag. They come _from technologies_: a technology may grant one or more special
pieces, or instead a power. Technology is the reward; a special piece is one form it takes.

The first is the **Station Hub**, from _Station Upgrade_. It is a **station in every respect** —
power 1, immune to fighters, links complexes by touch and by sight line, projects a blockade —
with one addition: it **doubles the score of its complex**, when placed and every time that
complex is scored afterwards.

---

## Setup

The board starts as **3 tiles per player**, arranged so the map is compact at every player
count. Each player's bag is shuffled. Scores start at 0.

At this size the board is small for the bags: 9 open hexes per player against 22 pieces. Games
are short, and usually end when a player cannot place the piece they drew (see _End of the
game_) rather than when a bag empties — every one of 32 simulated games ended that way. A board
of 7 tiles per player is where games end on an empty bag instead; the sizing notes below were
measured there.

Each planet's colour is chosen at random, independently, so a board can hold several planets of
one colour and none of another.

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

One planet per tile is settled by the sizing above.

---

## A turn

A turn is a **draft and two placements**, each placement resolving whatever it triggered
before the next. There is no separate action phase and nothing to do between turns, though a
technology may still be used once the ships are down (see Ending a turn).

A turn opens when the player **chooses to draw**. Nothing is revealed until they do — which is
what leaves the player before them time to take their own turn back, since undo cannot reach
past a reveal.

They then take **three** ships blind from their own bag, turn them face up, and **throw one out
of the game**. They then place the remaining **two**,
one at a time, each resolving everything it triggers before the next is placed.

Knowing what you hold is what makes a placement a decision, so the draw always comes first.
The hand is **public**: everyone sees what was drawn and what was thrown away.

The discarded ship is gone for good — not back to the bag. So a drafted turn spends three
pieces to make two placements, and a player's own ending arrives half again as fast. That is
the price of choosing.

If the bag cannot fill the draft, the player takes what is left and discards nothing.

Instead of placing a drafted ship, a player may **put the whole hand back in the bag** — which
is reshuffled — and **place a special piece** from the face-up pieces in front of them.

The whole hand, not one of it: playing a special **costs the rest of the turn**. Settled
deliberately, so that a special piece is a real decision rather than a free extra — and the
better the special, the more that matters.

> **The simpler turn — one draw, one placement — is available as a setup option.** It is the
> style the engine's rule tests run on, so that a test about chains or blockades exercises one
> mechanic rather than two.

A ship may be placed on **any open hex** — never on a planet, never on an occupied hex.

Placement is otherwise **unrestricted**: a ship need not connect to, or sit near, anything
its owner has already placed. The whole board is in play on every turn. Individual rules may
carve out exceptions later, but there is no general adjacency requirement to build on.

### Ending a turn

Once the turn's ships are placed and everything they triggered is resolved, the turn **ends at
once** — unless the player holds a technology they could still use and that has something to
act on: a ready **Updated Logistics** with a fighter in reach of a target, a ready **Tactical
Feint** with an enemy beside one of their ships, a ready **Trade Route Wormhole** with a ship that
has a route, or an unspent **Immediate Download** with a technology in sight to take.

Then the turn waits: the player may **use one of them**, or **end the turn**. After a
technology is used and resolved, the same test is made again, so the turn stays open for as
long as something could still be done and the player wants to do it.

A technology with nothing to act on does not hold the turn open — there is no point asking.

### Exploration

**Probe influence** is how strongly a player is surveying a planet: the sum of the **levels** of
their probes adjacent to it. A level 3 probe counts 3 and a level 2 counts 2; stations and
fighters count nothing. It is separate from control, which decides who scores a planet.

A **probe** placed adjacent to a planet may **survey** it — but only a planet where its player
now has **strictly the most probe influence**, counting the probe just placed. A planet where
they are behind or tied is not offered at all. Surveying is always optional, and the probe stays
where it was placed either way.

A hex touches six others, so a probe may land beside **several** planets it leads on. It
surveys **one** at most: the player chooses which.

Surveying an **unexplored** planet explores it, as below. Surveying a planet that is **already
explored** turns nothing over: the technology at stake is the one the planet already holds. Such
a planet is only offered for a technology the player doesn't already have, and a planet the
player already has a claim on is not offered again.

Exploring reveals the chosen planet's nature:

1. Cards are flipped from the technology deck **until the number of revealed cards showing
   the planet's color equals the probe's level** (2 or 3).
2. The exploring player **selects one of the matching cards** to become that planet's
   technology. Cards that were flipped without the planet's color are never candidates -
   they are simply turned over on the way.
3. Every other flipped card is discarded, matching or not.

**Elevated technologies override the choice.** If any matching card is elevated, the planet
must take an elevated one: the standard matches are out of reach, however attractive. Reveal
two or more elevated cards and the choice is between _those_. Reveal none and every match is
on the table as normal.

So an elevated card is both a stronger prize and a loss of control — the more of them in the
deck, the more exploring becomes a lottery rather than a decision. Where only one card can be
taken there is no decision to present, so the engine houses it without asking.

### Immediate effects

A technology may be **immediate**: its effect happens the moment the player chooses it for the
planet they have just explored, inside that same turn. The turn does not end until it is
resolved.

The first one is **Tactical Shift**: _move any friendly piece into any adjacent empty space._

- The piece must be the player's **own**, and the destination adjacent, open space, and empty.
- **A step is not a placement.** Nothing that a placement triggers happens: no chain scores,
  no station group pays out, no probe explores the planet it lands beside, no fighter fires.
  What does change is position, and so who holds the planets at either end of the step —
  which can hand a technology to a player who had nothing to do with it.
- A probe still cannot step into a space closed by an enemy station blockade. That rule closes
  the space itself, not the act of placing.
- The move is **optional**: the player may hold position. A forced step could only hurt —
  breaking your own blockade, or stepping off a planet you hold — so compelling it would turn a
  reward into a penalty. If no friendly piece can step anywhere, it simply fizzles.

The second is **Beyond the Frontier**: _draw a tile from the supply and lay it, then draw a
ship and place it on that tile._

- The tile must be laid so that **at least two of its own hexes border hexes already on the
  board**. Two of them may border the _same_ hex — the rule is about the tile's contact, not
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

The tile supply holds **two tiles per player**, each with a random planet position and colour.
It is **face-down**: nobody sees a tile until it is drawn.

### Stored effects

A technology may instead be **stored**: it goes in front of its owner unused, and is spent
later, **once**. A player can hold several, including two of the same kind gained from two
different planets. Like every technology, it is gained by the explorer and by anyone who later
holds the planet outright from one turn to the next — so the same card can hand a charge to
several players over a game.

The first is **Logistics Upgrade**: _once, on a later turn, place the ship you would otherwise
discard._

Spent at the opening of a drafted turn, in place of the discard, so that turn places all
**three** drawn ships instead of two. It needs no other rule: a turn runs until its hand is
empty.

Note it does nothing in the simpler one-draw turn style, where there is no discard to save.

**Immediate Download**: _once: gain the technology of any explored planet with a clear line of
sight to this one. It is available at once._

What this really buys is **time**. Every other route to a technology runs through the claim rule:
take a planet outright, then hold it until your next turn begins — a full round in which anyone can
break the hold. A Download skips all of it. The planet it reads from may be an opponent's, deep in
their space, with a claim of their own ripening on it; **sight is the only requirement, and sight
does not care who owns what.**

It does not take the technology _away_. A technology gained is a record, not a token: the card stays
on its planet and its owner keeps it. Two players holding the same technology was already possible —
a planet that changes hands after its claim has ripened does exactly that — so this needs no new
rule to make sense of.

"Available at once" matters for one kind of card. A downloaded **immediate** effect fires on the
spot rather than being remembered; everything else — a cooldown power, a granted piece, another
stored effect — is usable the moment it arrives anyway.

It is spent **from the planet holding it**, and that planet is where the line of sight is measured.
A player holding two Downloads on two planets has two different views of the board, and spends each
from its own.

A Download **cannot** take a technology that is itself an Immediate Download, so sight cannot be
chained across the board.

### Granted pieces

A technology may hand over a **piece** the moment it is gained, rather than an effect to resolve
or a power to spend. There is nothing to decide: the reward is the piece, and what it does is the
piece's business.

**Station Upgrade** grants a **Station Hub** (see _Components_). Like every technology it is
claimed by holding the planet outright from one turn to the next, so one card can hand a hub to
several players over a game — each getting their own.

**Hubs multiply.** Two in one complex make it fourfold, which is what "doubles the score of its
cluster" says of each hub taken on its own. It climbs fast, deliberately: a hub is won from a
technology rather than drawn from the bag, so a player who has collected several has already
spent a great deal of the game earning them, and a second one landing in the same complex as
the first should be worth more than spreading them thin.

### Cooldown effects

A technology may be **repeatable but rationed**: kept for good, usable again and again, but only
so often. Using it starts a timer counted in the **owner's own turns**, so the wait is the same
stretch of their game whatever the player count and whatever anyone else does in between.

Holding two copies of the same cooldown technology confers nothing extra — the timer belongs to
the power, not to the card.

**Every cooldown is 3 turns.** One figure for all of them, so a player never has to remember
which of their powers is on which clock. A power that genuinely wants a different rhythm should
have a different _timing_ rather than its own number.

The first is **Railgun**: _a fighter's attack destroys its target outright,
whatever its health._

Armed before a shot, it turns what would have been damage into a kill. Used on a turn, it is
unavailable on the owner's next two turns and ready again on the third.

- It changes what a hit **does**, not what can be **hit**. A fighter still needs strictly more
  power to touch anything, so an equal or bigger fighter remains out of reach.
- It cannot be spent on a shot that would destroy the target anyway — that would start the timer
  for nothing, so the game refuses rather than letting it be wasted. Arming it therefore means
  _use it if it helps_: fire on a probe with the Railgun armed and the probe simply dies to the
  ordinary shot, timer untouched.

A step triggers nothing. A move that explored, or scored a chain, would be a far stronger
effect.

**No elevated technology has been designed yet**, so every card in the deck is standard. An
elevated card removes the explorer's choice, so none is dealt until one means something. The
proportion of the deck that is elevated is decided when the first one is designed.

If the deck runs out mid-reveal, the discard pile is shuffled to form a new deck. If even
that cannot produce enough matching cards, the planet is explored with **fewer** candidates
than the probe's level - down to one, or to none at all, in which case it is explored but
receives no technology. The deck is intended to carry enough variety that this never comes
up in practice.

### Gaining a technology

Surveying a planet decides what it **holds** (if it was unexplored) and **stakes a claim** on
that technology for the surveying player. It does not hand the technology over yet.

At the start of the claimant's **next turn**, before anything else, the claim is settled. If they
**still have strictly the most probe influence** on the planet, the technology is theirs. If not
— a rival's probes have drawn level or overtaken theirs — the claim **lapses**: the planet keeps
its technology, and nobody gains it. Either way the claim is spent.

When a claim pays, **every one of the claimant's probes beside the planet leaves the board** and
goes into orbit around it: it is out of the game, its hex reopens, and it no longer counts for
control, chains, relays or probe influence. The probes in orbit stay as a record of who
researched the planet and count for nothing else.

So a technology is won by surveying a planet and **keeping the probe lead for a round**. Rivals
have one round of turns to answer: placing probes beside the planet to match or outweigh yours
stops your claim, and a rival who now leads may survey it themselves and stake a claim of their
own. Several players can have claims on the same planet at once; each is settled on its own
claimant's turn.

**Holding a planet does not win its technology.** Stations and fighters control planets for
points, chains and the rest, but only probes stake out what a planet holds. A fighter can still
stop a claim the blunt way, by destroying the probes that carry it.

A claimed technology is **never lost** — not when the planet is, not ever. Whatever it grants (a
special piece, a continuous power) stays with the player who claimed it. Several players can
therefore hold the same planet's technology, and over a game technologies only accumulate.

A planet's technology pays each player **once and once only**: a player who already has it is
never offered it again.

**A technology that acts at once acts when it is gained**, at the very top of the claiming
player's turn — _before_ the draft discard as well as before the placement. A tile, a Station Hub
or a free move all change what the hand is worth, and being asked to throw a ship away before
seeing what the turn has brought is choosing blind. A turn that claims two such technologies
carries both out, in turn, before anything else happens.

**Exploring pays no points, deliberately.** Its rewards are that the explorer _decides_ what
the planet will hold — picking a technology that suits their position, from cards nobody
else has seen — and gets the first claim on it.

The explorer gets **nothing extra** beyond choosing the technology and the first claim on it.

Both survey decisions — whether and which planet to survey, then which card — belong to the
placing player and happen inside their own turn. The first is always asked, since not surveying
is always an answer. The second is never _presented_ when it has only one answer: a reveal that
turns up one matching card (or none) houses it without asking, and an explored planet offers
only the technology it holds.

Other piece types resolve their own effects on placement; only probes explore.

### Fighters destroy

A fighter arrives shooting. On being placed, it **may fire on one adjacent piece of its own
power or below**. A level 2 fighter can wear down another level 2; only a fighter _above_ it is
out of reach.

Equal fighters used to be safe from each other, which made a level 3 the only piece on the board
worth having and left two level 2s staring at each other indefinitely.

What the shot does depends on the target:

- An enemy **fighter** takes **1 damage**, losing a level. At **level 1** it is destroyed by the
  next hit instead. Since a fighter's level _is_ its power, a damaged fighter is a weaker claim
  on the planets around it as well as being easier to finish — and a level 1 fighter holds a
  planet no harder than a station.
- Anything else in reach is **destroyed** outright.

Fighters are drawn at level 2 or 3; level 1 is only ever reached by damage.

**Stations are immune.** A station is a structure, not a ship, and no fighter shifts one
whatever its level. Removing a station is meant to take a **special piece won from a
technology** — when one exists, it goes in the destroy table as its own piece type rather than
as a change to what fighters can do.

### Escort

**A piece standing next to a fighter of its own side cannot be attacked at all** — not damaged,
not destroyed, by anything, at any time. No technology pierces an escort today; if one ever
should, that is where it would go.

This is what makes a fighter more than a gun. A lone fighter threatens its six neighbours. Two
fighters side by side cover each other and cannot be touched by anything. A fighter parked
beside a station makes that whole hex safe, and a fighter beside a probe lets the probe hold a
planet without fear.

A fighter does **not** escort itself: a lone fighter is as exposed as anything else. So an
escorted line can only be attacked at its ends — and if both ends are themselves escorted, it
cannot be attacked at all, and must be gone around rather than through.

The cost is that escorting spends a fighter on standing still. A fighter guarding a station is
not out threatening anything, and the six hexes it could have been contesting go uncontested.

- It is **optional**. Even with a single target, the choice is the player's and is never
  taken for them.
- Only **one** piece, and only an **opponent's** — a fighter never fires on its own side.
- The destroyed piece is **out of the game**. It does not return to its owner's bag, so the
  owner's clock is unaffected; what it frees is the hex.

This is the only way a hex is ever vacated. Nothing else ever leaves the board.

Destroying can change who holds a nearby planet outright, and so put a technology **within
reach of a player who took no part in the attack** — when the removal breaks a tie they were
losing. They still have to hold it until their own next turn to claim it, which gives everyone
else, the attacker included, a round in which to take it off them. Shooting to break a tie is
therefore a gift with a delay on it, and worth aiming carefully.

---

## Control and scoring

A planet is controlled by whoever has the most **power** in the six hexes touching it. A
planet touched by nothing at all is controlled by nobody.

**A probe counts 1.** It counted 0 until a probe could be left unable to claim the very planet it
had explored — the technology went to whoever first brought a real ship, which made exploring
feel like work done for someone else. A lone unchallenged probe now holds what it found and can
claim it on the following turn.

The other edge of that is worth knowing: one point is enough to **tie a station**, so an enemy
probe parked beside a planet stops a station holding it outright and neither player claims. The
cheapest piece in the game cannot take a planet from a station, but it can stop the station
having it.

**Control is sticky, because the only way to GAIN a planet is to have the most power beside it.**
A tie changes nothing: whoever already held the planet goes on holding it, and a challenger who has
merely drawn level has achieved nothing yet. They must actually get ahead.

An incumbent keeps it only while still tied for the lead. Fall behind, or lose every piece beside
the planet, and it is gone — a controller who is no longer among the strongest is not an incumbent
but a former one. A planet nobody has ever controlled, tied from the start, is controlled by
nobody.

This is why control is _recorded_ rather than worked out from the board: the answer depends on who
held it before.

Ties are treated differently depending on what is at stake:

| At stake                       | A tie                                                           |
| ------------------------------ | --------------------------------------------------------------- |
| End-game points for the planet | **Pays every tied player in full**                              |
| The planet's technology        | **Pays nobody** — it takes strictly more power than anyone else |

So sharing a planet's points is fine; sharing what it holds is not. One consequence worth
knowing: deliberately _tying_ a planet freezes its technology out of everyone's reach, since
no one is then holding it outright.

Scores are **public** and are a **running total that never decreases**: points scored for
control during the game are kept even if control is later lost.

### Relay

**A probe with a clear line of sight to one of its own stations cannot be attacked.** The line
runs straight along one of the six hex directions, at any distance, and must cross only empty
space: any piece in between, of either side, or a planet breaks it. A station right beside the
probe counts.

Probes are too small to find in open space on their own; a station relays and hides them. So a
station gives research a direct job — build where you want to survey — and fighters hunt the
probes that have strayed out of sight of their stations. Placing a piece across the line is how
to break a relay, exactly as it breaks a blockade.

### Chains

If a placement creates an unbroken chain of that player's own ships joining **two planets of
the same color**, the player scores **T(n)**, where _n_ is the number of ships in the chain
(planets aren't counted) and T(n) is the *n*th triangular number: 1, 3, 6, 10, 15, …

A chain is a run of ships on adjacent hexes; the first touches one planet, the last touches
the other. Ship type is irrelevant — a probe links a chain as well as a fighter does. Only
the player's _own_ ships link, and since no ship can stand on a planet, a planet is a wall a
chain must go around.

Because T grows faster than _n_, joining two **distant** planets of a color is worth far more
than joining two that nearly touch — and costs the ships and turns to match, which is also
the game's clock.

Three further rules:

- _n_ is the length of the **shortest** run through the player's ships. Once ships bunch up
  there are many routes; the shortest is the one that is well defined, and it's the only
  measure that doesn't pay a player for wandering.
- A **pair of planets pays once, ever, to whoever joins it first** — it is then spent for
  everyone. Otherwise the same two planets could be re-joined by a longer route for a bigger
  payout. A spent pair stays spent even when the chain is broken and the ships are gone: the
  record is of the joining, not of a connection still standing.
  A joined pair becomes a **trade route**, shown on the board as small ships in the joining
  player's colour travelling back and forth between the two planets. Two same-coloured planets
  with no route between them can still be joined.
- One placement can complete **several pairs at once** (a ship touching three planets of one
  color joins three pairs); each is measured and paid separately.

### Station groups

Placing a **station** scores **1 for itself and 1 for every other friendly station in a
contiguous group with it**.

Two stations are in the same **complex** if they **touch**, or if there is a **clear line**
between them — the same wavy line that closes that space to enemy probes (see _Station
blockades_). Links are **transitive**: a complex can run board-wide through a chain of
adjacency and sight lines, and a single station bridging two clusters welds them into one.

So a player with three touching stations who lays a fourth across a gap, with a clear line to
the run, scores **4**.

Stations link to **stations only**. A probe or fighter standing between two of them — yours or
anyone else's — breaks _both_ kinds of link at once: adjacency by definition, and the line by
standing in it. So one piece dropped into a gap can split a complex in two, which is the
counter-play, given that stations cannot be destroyed. A planet breaks a line too, since it
cannot be seen past.

Because it pays on every placement, a complex built up one station at a time pays 1, 2, 3, …
— the same triangular total a chain pays, but earned incrementally and with no need for
planets to line up. Placing stations apart and joining them later pays _less_ than building
compactly from the start (1+1+3 = 5 against 1+2+3 = 6), which is the decision the rule
creates. All six stations in one complex is 21 points, the practical ceiling — and sight lines
make reaching that far easier than adjacency alone would.

This gives each piece type a job: probes explore, fighters destroy, stations score.

**A station can be paid twice for one placement.** Station complexes and chains are separate
rules, and a station is a ship like any other where chains are concerned - so a station that
joins a complex _and_ completes a run between two planets of one colour collects under both. A
third station joining a pair, on a hex that also bridges two same-coloured planets, is 3 for
the complex plus 3 for the chain.

**The overlap stands.** It rewards a placement that does two jobs, and making
station-and-planet geometry the most valuable thing on the board to spot is a fair thing for
the game to ask players to look for. The surprise jump is a real cost, which the score float
over the board is there to explain (see the UI's per-action popups) - the points arrive
labelled, not silently.

**Updated Logistics**: _a fighter already on the board may attack one of its neighbours._

This is the only way a fighter fires twice. Shooting is otherwise something that happens on
arrival and never again, so a landed fighter threatens its neighbours only in the sense that
enemies keep away from them — Updated Logistics makes that threat real, once every three turns.

The shot is an ordinary one in every other respect: the escort rule applies, a Railgun can be
spent on it, and it may be declined. It is refused outright on a fighter with nothing in reach,
rather than spending three turns of the power on a shot that cannot be taken.

**Full Torpedo Spread**: _when a fighter attacks, it may hit any or all of its neighbours._

**Any**, not merely all. Sparing a neighbour is a real decision: clearing a piece can hand a
planet to a third party, or open a blockade of your own, so a player choosing two of three
targets is playing the rule rather than under-using it. A spread of one is refused — that is an
ordinary shot, and it should not cost three turns of a power.

Each hit is resolved exactly as a single shot is, so an escorted neighbour is untouched, a fighter
of equal or lower level is worn down rather than removed, and a station is immune. What makes it a
spread is only that it happens more than once, from one attack, for one cooldown.

The hits land **in the order chosen**, and that can matter: if one target was escorting another,
shooting the guard first opens up its neighbour. The volley is not simultaneous.

**Tactical Feint**: _swap one of your ships with an adjacent enemy ship. Your ship counts as newly
placed._

The swap is the small half. "Newly placed" is the large one: the ship arrives as though it had
just been played out of hand, which means **everything** an arrival sets off. A station scores its
complex again. A run of ships between two same-coloured planets pays if the swap completes one. A
fighter fires — and the enemy ship it just displaced has been set down right beside it, so the
displaced ship is usually a legal target. A probe explores an unexplored planet it now touches.
Control is recomputed, so a planet can change hands without a shot.

**Only your ship arrives.** The enemy ship is moved, not placed: it lands on the hex yours left
and sets nothing off, however inviting that hex might have been. One player's power should not
hand another player a free arrival.

Two consequences worth stating, because both are deliberate:

- **A feint reaches an escorted ship.** The escort rule protects against _attacks_, and a swap is
  not an attack. So this is the answer to a cluster that cannot be shot into — and note that
  displacing the escorting fighter can open its neighbours up to the shot that follows.
- **A feint ignores a station blockade.** A hex closed to your probes is closed to _placing_ one
  there; a swap is not a placement, and every swap target hex is occupied anyway, so the blockade
  check never had a hex to apply to. Worth revisiting if blockades turn out to matter more than
  this does.

It is refused when a shot or an exploration of the player's own is already waiting: there is one
slot for each, and the feint's own arrival needs it.

A station **can be rescored by shuffling**: swap it one hex sideways into an enemy and its complex
pays again, every three turns. That follows from "newly placed", and makes Tactical Feint a
scoring card as well as a disruptive one.

**Trade Route Wormhole**: _move one of your ships from beside a planet to beside a different
planet of the same colour. Your ship counts as newly placed._

The **colour is the route**. Two planets of one colour are the two ends of a wormhole, and a ship
standing beside one can be standing beside the other — however far apart they are, and with no
regard for what lies between. Same promise as a Tactical Feint at the far end: the ship arrives as
though newly played, so a station pays for the complex it joins, a chain the arrival completes
pays, a fighter fires, a probe explores, and control is recomputed.

**The pair of planets is not part of the move.** A ship beside two planets has two colours to
travel on, and a destination is legal if _any_ planet it touches pairs with _any_ planet the ship
is leaving. So a player picks a hex, not a route, and nothing has to be said about which planet
they had in mind. A different hex beside the _same_ planet is not a destination — the planet has
to be a different one, or the trade route goes nowhere.

**A blockade still holds against it**, unlike a feint. The difference is not special pleading: a
wormhole lands on an _empty_ hex, so "as if newly placed" has a placement rule to answer to, and
two enemy stations watching that corridor shut a probe out of it exactly as they would if the
probe were being played from hand. A feint's destination is occupied by definition, so the
blockade check never had an empty hex to apply to.

Note what this does to chains: the ship _leaves_ a hex, and a chain it was standing in is broken
by its departure. Since a spent pair stays spent, a player can dismantle their own scored chain
freely — but the ship arriving may complete a **new** pair at the far end, which is the trade the
card is really offering.

### Clear line of sight

Several rules ask whether two things on the board can **see** each other. One definition, used
everywhere:

Two hexes have a **clear line of sight** when they lie on the same straight line of hexes — one of
the six directions, no others — and **every hex between them is empty space**. Anything at all in
between breaks it:

- **Any piece**, of any colour, **including your own**. Nothing about seeing cares who owns the
  ship in the way; a fleet parked between two worlds is in the way either way.
- **Any planet**, which is a world rather than a gap to see past.
- The **edge of the board**, which ends the line without reaching anything.

**Adjacency counts.** Two things standing next to each other have a clear line of sight, because
there are no hexes between them to be blocked. This is worth stating because it is the case people
reach for first and it looks like an exception — it isn't. Nothing in between means nothing in
between, and zero hexes is the easiest way to have nothing in between.

The one rule that reads this differently is the **station blockade** below, and deliberately: two
_touching_ stations close nothing, because a blockade is about shutting a corridor and there is no
corridor to shut. That is a rule about the space between, not about sight.

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

The same line also joins the two stations into one **complex** for scoring — see _Station
groups_ above. A wavy line therefore does two jobs at once, which is why breaking one is worth
a piece to an opponent.

Nothing else scores during play. Taking control of a planet from another player scores nothing
at the time; planets pay at the end.

### At the end of the game

Every planet pays **1 point** to each player controlling it, explored or not. Ties pay in
full, so one planet can pay two players a point each.

This is the only scoring that waits until the end: control can change hands all game without
anyone banking anything, so it's the board's final shape that counts.

An explored planet is worth the same as an unexplored one.

Technologies carry no end-game point value.

---

## Board growth

Certain actions let a player add a tile to the board. A new tile must be placed so that **at
least two of its hexes touch existing hexes**.

Board growth is a **technology effect** — see _Immediate effects_ above. Tiles come from a
supply held back at setup, and the technology that draws one also places a ship on it.

---

## End of the game

The moment **any player has played the last piece from their bag**, the game ends
immediately — **mid-round**, with no final go-around.

The game also ends the moment a player **cannot legally place the piece they drew**, and has
no special piece they could place instead. A full board is one way that happens; a probe
drawn while every open hex is closed by enemy station blockades is another.

This can only be judged after the draw, since a hex shut to a probe is wide open to the
fighter behind it in the same bag. At 3 tiles per player it is the usual ending. Players later
in the turn order simply don't get another turn.

A tie for the highest score is a **shared win**, just as tied control of a planet pays every
tied player in full.

Everyone starts with the same 22 pieces, so the player who empties their bag first is the
one who has spent the fewest turns on special pieces, not the one who was luckiest with the
order: a draw that goes back in the bag doesn't advance that player's clock.

An exploration owed by the final placement is still resolved — the game ends after it, not
instead of it.

Final scores are the points scored during play plus planet control at the end; there is no
other final scoring.

---

## Game options

**Technology deck.** The full deck is the normal game. Alternatively the deck can be filled
with a single technology: 60 single-colour cards, twelve in each planet colour, so that
technology comes up on every exploration and every planet houses it — a way to see one effect
from every angle.

---

## Undo

A player may take back their own last action, up to the point where something was **revealed**.
These actions reveal, and undo cannot reach back past any of them:

- **Drawing at the start of a turn**, which turns that player's ships face up. This is the
  reveal that closes the previous player's window: their turn is theirs to take back until the
  next player draws, and not after.
- **Choosing which planet to explore**, which turns cards off the shared technology deck. A
  player who could look and then place elsewhere would be reading the deck.
- **Laying a tile**, which draws a ship from the bag to go on it.
- **Anything that draws a tile** from the face-down supply: a Beyond the Frontier that comes into
  effect, whichever action set it off.

Each of those claims a reveal only when something _actually_ became public. If the technology
deck and its discard are both spent, an exploration turns nothing over — so there is no
knowledge to protect, and the placement that triggered it can still be taken back.

Everything else is undoable: a placement that revealed nothing, a shot, a technology's move.
Note that undo restores the bag order and the random seed exactly, so taking back a turn and
replaying it identically produces the same draw — the point of the restriction is the
_knowledge_ gained, not a chance to re-roll.
