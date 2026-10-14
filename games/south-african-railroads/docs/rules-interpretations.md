# Rules interpretations

Where the rulebook is silent or ambiguous, the implementation makes the choices below. Each is covered by a test in `src/model/rules.spec.ts`.

## Auctions

- **Players who cannot afford the next bid drop out automatically**, so nobody waits on a forced pass.

## Choosing an action

- **The third Offer Stock slot is open with four and five players.** The redrawn board marks it "4p, 5p", while the rulebook text limits only the three-player game. The board is followed so every slot drawn on it is used.
- **An action with nothing to do still moves the locomotive and ends the turn.** This covers Construct Track when no railroad can build and Offer Stock when no share is unsold and the player holds none.
