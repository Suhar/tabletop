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
| Probe | 0 | An explorer, not a claim. Has a **level** (2 or 3). |
| Station | 1 | |
| Fighter | 2 | |

Further piece types are expected to arrive as rewards from exploration; each will declare
its own power.

**Bags** — each player has their own bag containing **6 probes, 6 stations, 6 fighters**.
The six probes are three of level 2 and three of level 3. Bag contents are hidden from
everyone, including the owner. Pieces are drawn blind.

**Technology deck** — a shared deck. Each card is associated with **one, two, or three
planet colors**, and can only be housed on a planet of a color it lists.

**Special pieces** — earned through exploration, kept face-up in front of their owner.
**OPEN:** how these relate to technology cards — are they one reward type among several, or
is "technology" itself the thing that grants them?

---

## Setup

The board starts as **2 tiles per player**, arranged so the map is compact at every player
count. Each player's bag is shuffled. Scores start at 0.

**OPEN:** how planet colors are distributed across the starting tiles.

---

## A turn

A player either:

1. **Draws a ship** blind from their own bag and places it, or
2. **Places a special piece** from the face-up pieces in front of them, instead of drawing.

A ship may be placed on **any open hex** — never on a planet, never on an occupied hex.

**OPEN:** whether placement is otherwise unrestricted, or must relate to pieces the player
already has on the board.

### Exploration

Placing a **probe** adjacent to an unexplored planet explores it. This is not a separate
decision — it happens because the probe landed there. One probe can explore several planets
at once, since a hex touches six.

Exploring reveals the planet's nature:

1. Cards are flipped from the technology deck **until the number of revealed cards showing
   the planet's color equals the probe's level** (2 or 3).
2. The exploring player **selects one** to become that planet's technology.
3. The rest are discarded.

**OPEN:** whether the choice is among the matching cards only, or among everything flipped.
**OPEN:** what happens to non-matching flipped cards, and whether the deck reshuffles when
exhausted.
**OPEN:** what happens if the deck cannot produce enough matching cards.

A planet's technology is permanent. A player who **controls** the planet can access its
technology; losing control loses access.

---

## Control and scoring

A planet is controlled by whoever has the most **power** in the six hexes touching it.
**Ties are not broken** — every tied player controls the planet and receives the full
reward. A planet touched only by probes (0 power) is controlled by nobody.

Scores are **public** and are a **running total that never decreases**: points scored for
control during the game are kept even if control is later lost.

**OPEN:** which acts score during play, and how much. Taking control of a planet from
another player is a candidate.

**OPEN:** end-of-game scoring for controlled planets — how much a planet is worth, and
whether it varies by color, technology, or size of the surrounding presence.

---

## Board growth

Certain actions let a player add a tile to the board. A new tile must be placed so that **at
least two of its hexes touch existing hexes**.

**OPEN:** what triggers a tile placement, where the tiles come from, and whether the placing
player chooses the tile's rotation.

---

## End of the game

The moment **any player has played the last piece from their bag**, the game ends
immediately. Every player has the same number of pieces, so everyone has had the same number
of placements.

**OPEN:** whether the game finishes the current round rather than stopping mid-round, and
final scoring beyond planet control.
