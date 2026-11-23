# Earendel — rules

A turn-based game of space exploration for 2–5 players. This document is the design source
of truth: it describes the game as intended, not as implemented. Where the code lags behind
or ahead, this file wins and the code is wrong.

Every rule here is settled. A question that comes up in play is added as **OPEN** and decided
before anything is built on it.

---

## Components

**Tiles** — four hexes in a diamond (an axial rhombus). Each tile has one planet hex and
three hexes of open space; _which_ hex is the planet varies from tile to tile. A **blank tile**
is four hexes of open space and no planet.

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
associated with **planet colors**; it can only be housed on a planet of a color it lists.

Every technology belongs to a **category**, and each category owns a planet color:

| Category     | Color      | Kind of planet                     | Technologies                                                                                                    |
| ------------ | ---------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Belligerence | Violet     | Techs that improve combat ability. | Railgun, Full Torpedo Spread, Gamma Torpedo, Updated Logistics, Interdiction, Bastion Works                     |
| Mobility     | Aqua       | Techs that allow movement.         | Tactical Shift, Warp Drive, Dimensional Rift, Tactical Feint, Trade Route Wormhole, Gate Network                |
| Acquisitions | Mint       | Techs that expand and control.     | Logistics Upgrade, Beyond the Frontier, Colony Ship, Carrier Doctrine, Deep Scan, Salvage Operations            |
| Espionage    | Periwinkle | Techs that mimic and steal.        | Immediate Download, Spoofed Orders, Security Breach, Relay Network, Quarantine, Jammer Array                    |
| Expansion    | Teal       | Techs that grow the fleet.         | Station Upgrade, Terraforming, Asteroid Field, Conscription, Factory Override, Artificial World, Nebula Seeding |

The deck has **62 standard cards**, **two of every technology**, plus one **elevated card per
color** (see _Elevated technologies_). **A card carries its category's color alone**, so a
planet offers the technologies of its own theme.

The exception is a technology that also belongs to a second theme: both copies of it carry
that theme's color too, and turn up on planets of either color. **Two technologies of each
category** do, and **each color is lent to two technologies** from other categories.

| Technology           | Its category | Also                                                    |
| -------------------- | ------------ | ------------------------------------------------------- |
| Interdiction         | Belligerence | Mobility: it closes hexes to movement.                  |
| Bastion Works        | Belligerence | Expansion: a fortification, standing as a station does. |
| Tactical Feint       | Mobility     | Espionage: a swap is a deception.                       |
| Trade Route Wormhole | Mobility     | Acquisitions: it runs between planets a player holds.   |
| Logistics Upgrade    | Acquisitions | Expansion: an extra ship placed grows the fleet.        |
| Salvage Operations   | Acquisitions | Espionage: it takes what was a rival's for its own.     |
| Spoofed Orders       | Espionage    | Belligerence: it turns a rival's piece against them.    |
| Jammer Array         | Espionage    | Belligerence: it strips the cover from what it reaches. |
| Artificial World     | Expansion    | Acquisitions: a new planet is a new one to hold.        |
| Nebula Seeding       | Expansion    | Mobility: nebula closes space to movement.              |

So a color is on its own category's cards and four more: mint, aqua, violet and periwinkle on 16,
and teal on 18.

Not all of those cards are in any one game. Each game has **five special units in play**, one
per category (see _Granted pieces_), and the cards of the other units' technologies are left
out. A unit in play has both its cards in the deck, so two of it may come into play, though
never both from one card. The deck in a game is therefore 46 cards: 36 of one-shots and
cooldowns, and 10 for the five units in play.

Every technology is either **standard** or **elevated**. An elevated technology is offered
like any other card and may be passed over: see _Elevated technologies_ below.

**Special pieces** — kept face-up in front of their owner, and playable instead of drawing
from the bag. They come _from technologies_: a technology may grant one or more special
pieces, or instead a power. Technology is the reward; a special piece is one form it takes.

The first is the **Station Hub**, from _Station Upgrade_. It is a **station in every respect** —
power 1, immune to fighters, links complexes by touch and by sight line, projects a blockade —
with one addition: it **doubles the score of its complex**, when placed and every time that
complex is scored afterwards.

The second is the **Terraformer**, from _Terraforming_. It is never in a bag. It counts **1
toward control** of the planets beside it, like a station, and fighters cannot attack it.
When it is placed beside a planet that **no other terraformer touches**, its owner **may change
that planet to another color**; beside several such planets, they choose one. Otherwise it
has no effect. The change is permanent and applies to every rule that reads a planet's color
from then on: which technologies an exploration can turn up, trade routes, a Trade Route
Wormhole's reach. An explored planet keeps its technology. Placed as a special piece, it
returns the drawn ships to the bag like any other. A Tactical Shift, Tactical Feint or Trade
Route Wormhole that moves it counts as placing it, so it may terraform again; a Free Drift
step does not.

The third is the **Relay**, from _Relay Network_. It is never in a bag. It counts **1 toward
control**, like a station, and fighters cannot attack it. For every rule that reads a line of
sight it acts as one of its owner's stations: a probe that sees it cannot be attacked, it links
the stations it sees (and touches) into one complex, and an empty hex on a line between it and
another of its owner's stations or relays is closed to rival probes. Unlike a station, its sight
is blocked only by planets and the board's edge, never by ships. It is not a station otherwise:
it scores nothing in a complex, is not linked by girders, and placing it scores nothing.

---

## Setup

The board starts as **4 planet tiles and 1 blank tile per player**, the blank tiles falling at
random among the rest, grown outward from a single tile: each further tile
is laid, at any rotation, where it touches the board most and strays least from its middle,
with a little chance mixed in, so the map is one compact, irregular cluster with no enclosed
gaps, leaning wider than tall, and different every game. Each player's bag is shuffled. Scores
start at 0.

**The opening.** Before the first turn, each player places **one free station** on any open
hex, the **last player in turn order first** and the first player last, so that going last
is paid for with first choice of ground. The station comes from no bag and **scores nothing
when placed**: it pays no complex point and completes no chain.
From then on it is a station in every respect — it counts toward control of the planets
beside it, links by touch and by sight, blockades, and is paid for by every later station
that joins its complex. On the board it is marked by a faint dotted orbit, so the seed of each
player's first complex can be told from the rest. A game option turns the opening off.

**The stowed ship.** Just before placing that station, each player **stows one extra ship** in
their bag: a level 3 probe, a level 3 fighter or a station. The choice is secret, so every bag
holds 23 and nobody can be sure what a rival's still holds. The ship is shuffled in with the
rest and drawn like any other. Neither the stowed ship nor the station can be skipped.

At this size the board is a little small for the bags: 12 open hexes per player, 11 once the
opening stations are down, against 23 pieces. Most games still run to an empty bag — 116 of 159
simulated games, measured with bags of 22 before the stowed ship was added, with players
placing 19 or 20 of those 22 — and the rest end when a player cannot place the piece they drew
(see _End of the game_). The board was 3 tiles per
player before the opening was added; at that size the opening station cost each player about
two placements and nearly every game ended jammed. A board of 7 tiles per player is where
almost every game ends on an empty bag; the sizing notes below were measured there.

Planet colors are **dealt evenly**: each color is on the board equally often, give or take
one, and every color appears once there are five planets or more. They land at random, then
any two planets of one color within two hexes of each other are pulled apart (by trading
colors with another planet, or moving within their tile), so partners are always at least
three hexes apart.

The gap is a minimum, not a maximum, on purpose. Spreading partners as far apart as possible
made chains rare: in simulation, under one a game. Breaking up only the tight clumps keeps
chains an achievement that still happens, about 1 to 2 a game at 3 players.

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

The discarded ship is gone for good — not back to the bag (unless Global Recycling is in
force). So a drafted turn spends three
pieces to make two placements, and a player's own ending arrives half again as fast. That is
the price of choosing.

If the bag cannot fill the draft, the player takes what is left and discards nothing.

Instead of placing a drafted ship, a player may **put the whole hand back in the bag** — which
is reshuffled — and **place a special piece** from the face-up pieces in front of them.

The whole hand, not one of it: playing a special **costs the rest of the turn**, and it is only
open **before any drafted ship is placed**. Once one is down, the turn finishes with drafted
ships; the special waits for a later turn. Settled deliberately, so that a special piece is a
real decision rather than a free extra — and the better the special, the more that matters.

> **The simpler turn — one draw, one placement — is no longer offered at setup.** It stays in
> the engine as the style its rule tests run on, so that a test about chains or blockades
> exercises one mechanic rather than two.

A ship may be placed on **any open hex** — never on a planet, never on an occupied hex.

Placement is otherwise **unrestricted**: a ship need not connect to, or sit near, anything
its owner has already placed. The whole board is in play on every turn. Individual rules may
carve out exceptions later, but there is no general adjacency requirement to build on.

### Ending a turn

Once the turn's ships are placed and everything they triggered is resolved, the turn **ends at
once** — unless the player holds a technology they could still use and that has something to
act on: a ready **Updated Logistics** with a fighter in reach of a target, a ready **Tactical
Feint** with an enemy beside one of their ships, a ready **Trade Route Wormhole** with a ship that
has a route, an unspent **Immediate Download** with a technology in reach to take, an unspent
**Tactical Shift** with a piece that can step, an unspent **Spoofed Orders** with a rival piece
to send, or an unspent **Beyond the Frontier** with a tile left to draw and room to lay it.

Then the turn waits: the player may **use one of them**, or **end the turn**. After a
technology is used and resolved, the same test is made again, so the turn stays open for as
long as something could still be done and the player wants to do it.

A technology with nothing to act on does not hold the turn open — there is no point asking.

### Exploration

**Probe influence** is how strongly a player is surveying a planet: the sum of the **levels** of
their probes adjacent to it. A level 3 probe counts 3 and a level 2 counts 2; stations and
fighters count nothing. It is separate from control, which decides who scores a planet.

A probe that has **surveyed** a planet is committed to it: for as long as it stands where it
surveyed, its level counts on that planet **alone**, not on the others it touches. A probe that
surveyed nothing counts on every planet beside it. A probe that moves (a technology move, a
Trade Route Wormhole, a Tactical Feint) sheds its commitment and counts everywhere again until
it surveys afresh.

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
   the planet's color equals the probe's level** (2 or 3), each of them a **different
   technology**. A matching card that repeats a technology already revealed for this planet
   is turned over on the way like a card of the wrong color; if the deck and discard hold no
   further matching technology that is new, the reveal stops short with what it has.
2. The exploring player **selects one of the matching cards** to become that planet's
   technology. Cards that were flipped without the planet's color are never candidates -
   they are simply turned over on the way.
3. The matching cards that were **offered and not chosen are discarded**. Every other flipped
   card (the wrong color or a repeat) is **shuffled and put back under the deck**, so the
   discard holds only technologies somebody chose to pass over.

**An elevated technology is a choice like any other.** A matching elevated card is offered
beside the standard matches, and the explorer may take it or any of them. Offered and not
taken, it is discarded like any other card. Where the reveal turns up only one matching card
there is no decision to present, so the engine houses it without asking.

### One-shot technologies

Some technologies are **used once, now or later**. Gaining one hands the player a single use
of it, kept until they choose to spend it: on the turn it arrives or any turn after, at any
point a technology may be used (before, between or after the turn's ships, once the draft
discard is made, or at the end of the turn). Nothing forces it out, and a use that has nothing
to act on cannot be spent and is simply kept.

The first is **Tactical Shift**: _once, now or later: move any friendly piece into any adjacent
empty space._

- The piece must be the player's **own**, and the destination adjacent, open space, and empty.
- **The piece counts as newly placed where it lands.** Everything a placement triggers
  happens: a station pays its group, a chain it completes scores, a probe may survey a planet
  it now leads beside, a fighter fires, a terraformer may terraform. Position changes too, and
  so who holds the planets at either end of the step — which can hand a technology to a player
  who had nothing to do with it.
- A probe still cannot step into a space closed by an enemy station blockade. That rule closes
  the space itself, not the act of placing.
- It is never owed. While no friendly piece can step anywhere it cannot be used, and it waits.

The second is **Beyond the Frontier**: _once, now or later: draw a tile from the supply and lay
it, then draw a ship and place it on that tile._

- Using it draws the tile and the ship that will follow it, both face up, there and then: the
  player knows the ship before deciding where the tile goes. They then lay the tile and place
  the ship on it before the turn carries on. The draw cannot be undone.

- The tile must be laid so that **at least two of its own hexes border hexes already on the
  board**. Two of them may border the _same_ hex — the rule is about the tile's contact, not
  the board's. This is what stops the map growing a thin tail.
- The ship that follows is a **real placement**: it explores, it shoots, it scores its station
  group, all as normal. It just has to land on the tile that
  was just laid.
- The ship is a fresh draw from the player's own bag, so this technology **spends a piece and
  brings that player's own ending closer** — the bag is the clock.
- While the supply is empty, or there is nowhere legal to lay a tile, it cannot be used, and
  it waits. If the bag is empty, no ship is drawn: the tile is laid and none follows. If no hex of the new tile
  is open to the ship drawn (rival interdictors or a blockade close them all), the ship goes
  back in the bag and none follows; this does not end the game.

Because the placed ship can be a probe, growing the board can trigger another exploration and
so another technology, though one that pays only when its claim does.

The player may **turn the tile** to any of six rotations before laying it. The tile is a
rhombus, so it covers the same four hexes every half turn — but the planet swaps corners, so
turning is worth doing even when the outline doesn't move. Rotation also reaches placements a
fixed orientation cannot.

The tile supply holds **two tiles per player**, each with a random planet position and color.
It is **face-down**: nobody sees a tile until it is drawn.

The third is **Spoofed Orders**: _once, now or later: move a rival's piece that stands beside
one of yours into an adjacent empty space._

- The piece must be a **rival's**, of any kind, and must stand **beside one of the player's own
  pieces**. The destination must be adjacent to it, open space, and empty.
- Where it may go is judged for **its owner**: a probe cannot be sent into a space an enemy
  blockade closes to it, and no piece into a space an interdictor closes to its owner.
- **It is moved, not placed.** Nothing scores, explores or fires for its owner. What changes is
  position, and everything that reads position: a station complex or a sight link broken, a
  blockade opened, a probe pulled off the planet it was surveying, control of the planets at
  either end, and so which claims still stand.
- While no rival piece beside one of the player's own has anywhere to step, it cannot be used,
  and it waits.

### Stored effects

A technology may instead be **stored**: it goes in front of its owner unused, and is spent
later, **once**. A player can hold several, including two of the same kind gained from two
different planets. Like every technology, it is gained by the explorer and by anyone who later
holds the planet outright from one turn to the next — so the same card can hand a charge to
several players over a game.

**Warp Drive**: _once, now or later: move any friendly piece through any number of empty space
hexes; where it lands, it counts as newly placed._

- The piece travels from hex to adjacent hex through **empty open space only**: a piece, a
  planet, nebula or the edge of the board stops it, so it reaches what a path of empty hexes
  reaches and nothing beyond.
- It may stop on any hex along the way that is open to it. Passing a hex needs only that it be
  empty; **landing** follows the rules of a step: not a hex an enemy Interdictor closes, and
  for a probe not one a station blockade closes.
- **It counts as newly placed where it lands**, exactly as with Tactical Shift: a station
  scores, a chain it completes scores, a probe may survey, a fighter fires.
- It is never owed. While no friendly piece has anywhere to go it cannot be used, and it waits.

**Colony Ship**: _once, now or later: settle a planet you control. For the rest of the game it
counts as one of your stations._

- The planet must be one the player **controls** when the ship lands, and one nobody has
  settled. It stays settled, and stays that player's, **even if control of the planet is later
  lost**; a settled planet cannot be settled again by anyone.
- A settled planet is a station **for station complexes, by touch**: it joins every complex of
  its owner's with a station, relay or gate beside it, and so can bridge several clusters round
  the planet into one. It counts as one more station in that complex each time the complex
  scores.
- **It scores at once**, as a station placed there would: the complex it has just joined pays
  its size, hubs doubling as usual. With no station beside it, it is a complex of one.
- That is all it is. It is not a piece: it has no line of sight, so it links nothing at a
  distance and closes no hex to probes; it adds nothing toward control; nothing can attack,
  move, salvage or torpedo it; and the planet is surveyed, held and terraformed as before.

**Factory Override**: _once, now or later: draw two extra ships this turn and place them
both._

- The two ships come from the player's own bag, face up, and join the hand. There is no
  discard for them: every ship in hand is placed, in any order with the turn's others.
- A bag with one ship gives one; an empty bag gives none, and the Override cannot be used.
- The draw shows what was in the bag, so it cannot be undone.
- Used before the turn's ships are down or after, the turn carries on until the hand is empty.
- Two more ships placed is two fewer in the bag, so the player's own ending comes sooner.

**Dimensional Rift**: _once, now or later: move any friendly piece from a hex on the outer
border of the map to an empty hex that is also on the border; it counts as newly placed
there._

- A hex is **on the outer border** when a side of it faces off the map. A gap wholly enclosed
  by tiles is not the border: only the map's outside edge is.
- The piece must be the player's own and stand on a border hex. It comes out on any empty open
  border hex, however far round and whatever lies between. Landing follows the rules of a
  step: not a hex an enemy Interdictor closes, and for a probe not one a station blockade
  closes.
- **It counts as newly placed where it comes out**, exactly as with Tactical Shift.
- The border moves as tiles are laid: a hex that was on it may be enclosed by a new tile.
- It is never owed. With no friendly piece on the border, or nowhere for one to come out, it
  cannot be used, and it waits.

**Asteroid Field**: _once, now or later: choose level 3 probe, level 3 fighter or station, and
put three copies of the choice into your bag._

- The three ships are shuffled into the bag. **The choice is secret**, as the ship stowed at
  the opening is: the other players see that three ships went in, and learn what they were
  only as they are drawn.
- It needs nothing on the board, so it can always be used; it is still never owed.
- Three more ships is three more draws before that bag runs out, and so a later ending if it
  was this player's bag that would have ended the game.

**Security Breach**: _once, now or later: put a piece of Scrap into the bag of an opponent you
choose._

- Whose bag it went into is public. The Scrap is shuffled in, and is drawn like any ship.
- **Scrap has no function.** It is never on the board. Drawn, it is one of the turn's ships in
  hand and leaves the hand one of two ways.
- **Discarded, it goes back into the bag** it came from, reshuffled, so it will be drawn again.
- **Played, it is gone.** In place of placing a ship, the player may play the Scrap: it turns
  over and does nothing (nothing scores, explores or fires), but it is out of the bag for
  good. It counts as the drawn ship it replaces: no special piece can replace the draw after
  it.
- So a drawn Scrap costs its owner either their choice among three (throw it out, keep the
  other two, and meet it again) or one of the turn's placements (play it, and be rid of it).
- A hand that holds only Scrap, as a short last draw can be, is played: the game does not end
  for want of a placement while a Scrap can be played.

**Immediate Download**: _once: gain the technology of any explored planet within three hexes of
this one. That technology is theirs to use now or later, with no wait._

Reach is distance alone: count hexes from the planet holding the Download to the other planet,
in any direction, three at most. Nothing between them matters (ships, planets, nebula, a gap in
the board), and a **Jammer does not interrupt it**.

What this really buys is **time**. Every other route to a technology runs through the claim rule:
take a planet outright, then hold it until your next turn begins — a full round in which anyone can
break the hold. A Download skips all of it. The planet it reads from may be an opponent's, deep in
their space, with a claim of their own ripening on it; **reach is the only requirement, and reach
does not care who owns what.**

It does not take the technology _away_. A technology gained is a record, not a token: the card stays
on its planet and its owner keeps it. Two players holding the same technology was already possible —
a planet that changes hands after its claim has ripened does exactly that — so this needs no new
rule to make sense of.

Whatever is downloaded arrives ready: a cooldown power, a granted piece, or a one-shot
technology such as Tactical Shift or Beyond the Frontier, which may be spent the same turn or
kept.

It is spent **from the planet holding it**, and that planet is where the three hexes are counted
from. A player holding two Downloads on two planets has two different reaches, and spends each
from its own.

A Download **cannot** take a technology that is itself an Immediate Download, so reach cannot be
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

**One special unit per category.** Every special unit, the hub, terraformer and relay included,
belongs to one technology. Each game has five units in play, one per category; the other units'
technology cards are out of the game. By default these are the **basic five**: the Interdictor,
the Gate, the Carrier, the Relay and the Station Hub. A game option instead draws one of each
category's units at setup (Mobility has only Gate Network, so it is always in), and another
keeps every unit in the deck. The five in play are shown from the start.

**The special pieces.** Each is won from its technology like a hub, placed instead of a draw
like a terraformer, and counts 1 toward control where it stands. They are meant to change how the
game flows rather than what it scores, and each has an answer: most are ships that a fighter of
level 1 or more can destroy, so a piece that is winning a region is a target.

| Technology (category)             | Piece                 | What it does                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Interdiction (Belligerence)       | **Interdictor**       | No enemy ship may be placed on, or moved, stormed or wormholed onto, a hex beside it. A feint swap still lands there.                                                                                                                                                                                              |
| Bastion Works (Belligerence)      | **Bastion**           | Every friendly piece beside it is escorted, even under No Quarter. Fighters cannot touch the bastion itself; only a torpedo can.                                                                                                                                                                                   |
| Gate Network (Mobility)           | **Gate** (a pair)     | Both gates come from one card and are placed on separate turns. Once both stand they are one place: what stands beside one stands beside the other for chains, station links by touch, escorts and probe influence. Not for attacks, torpedoes or control.                                                         |
| Carrier Doctrine (Acquisitions)   | **Carrier**           | Counts as a level 3 probe for influence on every planet beside it; it never surveys. Only a level 3 fighter can touch it.                                                                                                                                                                                          |
| Deep Scan (Acquisitions)          | **Deep Scanner**      | While it stands its owner draws one more ship each turn and throws one more out: draw four, keep two; under Overdrive, draw four, place three. Two scanners are no better than one.                                                                                                                                |
| Quarantine (Espionage)            | **Quarantine Beacon** | No planet beside it can be surveyed by anyone while it stands, and pending claims on those planets wait, neither paying nor lapsing.                                                                                                                                                                               |
| Jammer Array (Espionage)          | **Jammer**            | Every station and relay within two hexes, its owner's included, has no sight: no links, no blockades, no relay protection. It does not interrupt an Immediate Download.                                                                                                                                            |
| Artificial World (Expansion)      | **Artificial Planet** | Placed on an empty hex, it becomes an unexplored planet of a color its owner chooses at once; the piece is gone. It is a planet for every rule from then on.                                                                                                                                                       |
| Nebula Seeding (Expansion)        | **Nebula Seeder**     | At the start of each of its owner's turns, after the draw, it may turn one empty hex into **nebula**, up to four in all: a hex beside it, or beside any nebula joined to it through nebula (whoever laid it). Nothing is placed on nebula, moves through it, or sees past it: it blocks sight lines like a planet. |
| Salvage Operations (Acquisitions) | **Salvage Drone**     | Any probe or fighter destroyed within two hexes goes into the drone owner's bag, as drawn, instead of out of the game. The nearest drone claims it; among equally near drones the destroyer's own first.                                                                                                           |

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

**Logistics Upgrade**: _place the ship you would otherwise discard._

Used at the opening of a drafted turn, in place of the discard, so that turn places all
**three** drawn ships instead of two. It needs no other rule: a turn runs until its hand is
empty. Using it starts its timer, so it is unavailable on the owner's next two turns and ready
again on the third.

- It can only be used while a discard is owed. On a turn with none (a short last draw,
  Overdrive) it cannot be used, so its timer does not start.
- With a Deep Scanner's extra ship in hand it keeps every ship still held when it is used.

Note it does nothing in the engine's test-only one-draw turn style, where there is no discard to
save.

**Conscription**: _take back the ship you discarded this turn and put it in your bag._

- It reaches only what **this turn's draft** threw out of the game. With a Deep Scanner the
  draft throws out two ships, and Conscription takes back both.
- The ships are shuffled into the bag, to be drawn again like any other.
- It may be used at any point a technology may be, once the discard is made, until the turn
  ends. On a turn with no discard (a short last draw, Overdrive, a Logistics Upgrade used)
  there is nothing to take and it cannot be used, so its timer does not start.
- Under Global Recycling a discard is already back in the bag, and Scrap always is; neither
  leaves anything for Conscription.
- Each use puts back a ship the bag had lost, so a player who uses it whenever it is ready
  draws from a bag that empties more slowly.

**Gamma Torpedo**: _place a fighter as a torpedo: it destroys itself and an adjacent station,
yours or anyone's._

Armed before a fighter is placed, it turns that fighter into a one-shot weapon. The torpedo goes
down on an empty hex beside at least one station, then strikes one station beside it: both the
station and the torpedo leave the game. With a single station beside it the strike is immediate;
with several, the player chooses which.

- It is the **only way a station is removed**. A hub is a station and goes the same way; a relay
  or a terraformer is not and cannot be struck.
- The torpedo is a blast, not a shot: an **escort does not turn it**, nor does a relay's cover,
  and it may take the owner's own station.
- It is not a fighter arriving. It completes no chain, scores nothing, surveys nothing, and once
  placed it cannot hold fire: the only way back is to undo the placement.
- Placing it starts the cooldown; the fighter is spent whatever it struck.

A step triggers nothing. A move that explored, or scored a chain, would be a far stronger
effect.

### Elevated technologies

Every planet color has a pair of **elevated cards**: one an **event** that fires once, one a
**global** that lasts. At setup the game draws one of each color's pair (or the game options
name it), and the five chosen cards lie **face up** beside the deck for the whole game. Each is
also shuffled into the deck as a single-color card, so a probe surveying a planet of that
color may turn it up among the matching cards. It is a choice like any other: the explorer may
take it or an ordinary card. Offered and not taken, it goes to the discard like any card.

Elevated cards belong to the alien worlds that hold them, not to the explorer: **they give
something to everyone**, and the discoverer's prize is going first.

Taking one **spends the planet for everyone**. It fires at once, on the survey: every player
counts as holding the card from then on, so the planet is never surveyed again and nobody
researches it; the surveying probe goes into orbit, and a marker of every other color joins it,
as if everyone had explored the planet together.

An **event** is resolved once, one pick each: the discoverer picks first, then **sets the order
the others follow** (with two players there is nothing to set). Picks are exclusive, so going
first matters. A player with nothing to pick is passed over. The discoverer's turn carries on
once the last pick is made.

A **global** changes the game for everyone from that survey on. Its discoverer also gets **one
pick of the color's event**, alone, so every discovery carries a prize.

| Color      | Event                                                                                                                                     | Global                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Violet     | **Orbital Targeting**: each player destroys one enemy probe or fighter anywhere on the board.                                             | **No Quarter**: escorts protect nobody; every ship beside a fighter can be attacked.                                                                                           |
| Aqua       | **Wormhole Storm**: each player moves one of their pieces to any empty hex beside any planet (a probe cannot land on a hex closed to it). | **Free Drift**: at the start of every turn, after the draw, the player may step one of their pieces one hex. A plain step, not a placement: nothing scores, explores or fires. |
| Mint       | **Salvage Rights**: each player gains one technology from the discard pile; each card goes once.                                          | **Overdrive**: nobody discards; every drawn ship is placed.                                                                                                                    |
| Periwinkle | **Signal Intercept**: each player gains the technology of any explored planet; each planet is intercepted once.                           | **Shared Science**: the moment a player's probes go into orbit around a planet, every other player with a probe beside it gains the technology too.                            |
| Teal       | **Shipyard World**: each player takes one of the special units in play from a stock of one of each, as its technology would grant it.     | **Global Recycling**: a ship discarded from the draft goes back into its owner's bag instead of out of the game. Destroyed ships are still lost.                               |

A technology gained by an event is gained as a claim pays it. A storm move,
a drift or a bombardment is not a placement: nothing arrives, so nothing scores, surveys or
fires. Global Recycling returns only discards: a ship destroyed by a fighter, a torpedo or a
bombardment is out of the game as usual, unless a Salvage Drone takes it.

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

When a claim pays, **every one of the claimant's probes counting on the planet leaves the board**
and goes into orbit around it (a probe beside it but committed to another planet stays): it is out of the game, its hex reopens, and it no longer counts for
control, chains, relays or probe influence. The probes in orbit stay as a record of who
researched the planet and count for nothing else.

So a technology is won by surveying a planet and **keeping the probe lead for a round**. Rivals
have one round of turns to answer: placing probes beside the planet to match or outweigh yours
stops your claim, and a rival who now leads may survey it themselves and stake a claim of their
own. A rival probe that lands beside your planet but surveys a different one leaves your claim
alone: it is committed elsewhere. Several players can have claims on the same planet at once; each is settled on its own
claimant's turn.

**Holding a planet does not win its technology.** Stations and fighters control planets for
points, chains and the rest, but only probes stake out what a planet holds. A fighter can still
stop a claim the blunt way, by destroying the probes that carry it.

A claimed technology is **never lost** — not when the planet is, not ever. Whatever it grants (a
special piece, a continuous power) stays with the player who claimed it. Several players can
therefore hold the same planet's technology, and over a game technologies only accumulate.

A planet's technology pays each player **once and once only**: a player who already has it is
never offered it again.

**A claim pays at the very top of the claiming player's turn**, _before_ the draft discard as
well as before the placement. A tile to lay, a Station Hub or a move in reserve all change what
the hand is worth, and being asked to throw a ship away before seeing what the turn has brought
is choosing blind. Nothing a claim pays has to be used then: a one-shot technology waits until
its holder spends it.

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
whatever its level. Removing a station takes a **Gamma Torpedo** (see _Cooldown effects_): a
fighter placed as a torpedo, which goes with the station it strikes.

### Escort

**A piece standing next to a fighter of its own side cannot be attacked at all** — not damaged,
not destroyed, by any shot, at any time. The one thing that pierces an escort is a **Gamma
Torpedo**: a blast rather than a shot, which takes a station whoever stands beside it.

This is what makes a fighter more than a gun. A lone fighter threatens its six neighbors. Two
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

A **relay piece** (from _Relay Network_, below) serves as one of its owner's stations for this
rule, and for station links and blockades, but **only planets, and the board's edge, block its
sight**: a line with a relay at either end runs past any ships in between.

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
  A joined pair becomes a **trade route**, shown on the board as a pip in the joining player's
  color along the bottom of each of the two planets; hovering one shows the route. Two
  same-colored planets
  with no route between them can still be joined.
- One placement can complete **several pairs at once** (a ship touching three planets of one
  color joins three pairs); each is measured and paid separately.

### Station groups

Placing a **station** scores **1 for itself and 1 for every other friendly station in a
contiguous group with it**. The opening station is the one exception: placed before the
first turn, it scores nothing itself, though it counts as a station for every station that
joins it later (see _Setup_).

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
joins a complex _and_ completes a run between two planets of one color collects under both. A
third station joining a pair, on a hex that also bridges two same-colored planets, is 3 for
the complex plus 3 for the chain.

**The overlap stands.** It rewards a placement that does two jobs, and making
station-and-planet geometry the most valuable thing on the board to spot is a fair thing for
the game to ask players to look for. The surprise jump is a real cost, which the score float
over the board is there to explain (see the UI's per-action popups) - the points arrive
labeled, not silently.

**Updated Logistics**: _a fighter already on the board may attack one of its neighbors._

This is the only way a fighter fires twice. Shooting is otherwise something that happens on
arrival and never again, so a landed fighter threatens its neighbors only in the sense that
enemies keep away from them — Updated Logistics makes that threat real, once every three turns.

The shot is an ordinary one in every other respect: the escort rule applies, a Railgun can be
spent on it, and it may be declined. It is refused outright on a fighter with nothing in reach,
rather than spending three turns of the power on a shot that cannot be taken.

**Full Torpedo Spread**: _when a fighter attacks, it may hit any or all of its neighbors._

**Any**, not merely all. Sparing a neighbor is a real decision: clearing a piece can hand a
planet to a third party, or open a blockade of your own, so a player choosing two of three
targets is playing the rule rather than under-using it. A spread of one is refused — that is an
ordinary shot, and it should not cost three turns of a power.

Each hit is resolved exactly as a single shot is, so an escorted neighbor is untouched, a fighter
of equal or lower level is worn down rather than removed, and a station is immune. What makes it a
spread is only that it happens more than once, from one attack, for one cooldown.

The hits land **in the order chosen**, and that can matter: if one target was escorting another,
shooting the guard first opens up its neighbor. The volley is not simultaneous.

**Tactical Feint**: _swap one of your ships with an adjacent enemy ship. Your ship counts as newly
placed._

The swap is the small half. "Newly placed" is the large one: the ship arrives as though it had
just been played out of hand, which means **everything** an arrival sets off. A station scores its
complex again. A run of ships between two same-colored planets pays if the swap completes one. A
fighter fires — and the enemy ship it just displaced has been set down right beside it, so the
displaced ship is usually a legal target. A probe explores an unexplored planet it now touches.
Control is recomputed, so a planet can change hands without a shot.

**Only your ship arrives.** The enemy ship is moved, not placed: it lands on the hex yours left
and sets nothing off, however inviting that hex might have been. One player's power should not
hand another player a free arrival.

Two consequences worth stating, because both are deliberate:

- **A feint reaches an escorted ship.** The escort rule protects against _attacks_, and a swap is
  not an attack. So this is the answer to a cluster that cannot be shot into — and note that
  displacing the escorting fighter can open its neighbors up to the shot that follows.
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
planet of the same color. Your ship counts as newly placed._

The **color is the route**. Two planets of one color are the two ends of a wormhole, and a ship
standing beside one can be standing beside the other — however far apart they are, and with no
regard for what lies between. Same promise as a Tactical Feint at the far end: the ship arrives as
though newly played, so a station pays for the complex it joins, a chain the arrival completes
pays, a fighter fires, a probe explores, and control is recomputed.

**The pair of planets is not part of the move.** A ship beside two planets has two colors to
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

- **Any piece**, of any color, **including your own**. Nothing about seeing cares who owns the
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

- The line must be **clear**. Any piece standing between the two stations, of any color,
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

Board growth is a **technology effect** — see _One-shot technologies_ above. Tiles come from a
supply held back at setup, and the technology that draws one also places a ship on it.

---

## End of the game

The moment **any player has played the last piece from their bag**, the game ends
immediately — **mid-round**, with no final go-around.

The game also ends the moment a player **cannot legally place the piece they drew**, and has
no special piece they could place instead. A full board is one way that happens; a probe
drawn while every open hex is closed by enemy station blockades is another.

This can only be judged after the draw, since a hex shut to a probe is wide open to the
fighter behind it in the same bag. At 4 tiles per player it is the less common ending, about one game in four. Players later
in the turn order simply don't get another turn.

A tie for the highest score is a **shared win**, just as tied control of a planet pays every
tied player in full.

Everyone starts with the same number of pieces (22, and one more stowed at the opening), so
the player who empties their bag first is the one who has spent the fewest turns on special
pieces, not the one who was luckiest with the order: a draw that goes back in the bag doesn't
advance that player's clock.

An exploration owed by the final placement is still resolved — the game ends after it, not
instead of it.

Final scores are the points scored during play plus planet control at the end; there is no
other final scoring.

---

## Game options

**Opening stations.** On by default: before the first turn each player, last player first,
stows an extra ship and then places one free station (see _Setup_). Off, the game begins with
the first player's draw and nothing is stowed.

**Technology deck.** The full deck is the normal game. Alternatively the deck can be filled
with a single technology: 60 single-color cards, twelve in each planet color, so that
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
- **Using Beyond the Frontier**, which draws a tile from the face-down supply and a ship from
  the bag to follow it.

Each of those claims a reveal only when something _actually_ became public. If the technology
deck and its discard are both spent, an exploration turns nothing over — so there is no
knowledge to protect, and the placement that triggered it can still be taken back.

Everything else is undoable: a placement that revealed nothing, a shot, a technology's move.
Note that undo restores the bag order and the random seed exactly, so taking back a turn and
replaying it identically produces the same draw — the point of the restriction is the
_knowledge_ gained, not a chance to re-roll.
