# Rules interpretations

Where the rulebook is silent or ambiguous, the implementation makes the choices below. Each is covered by a test in `src/model/rules.spec.ts`.

## Auctions

- **Players who cannot afford the next bid drop out automatically**, so nobody waits on a forced pass.
- **Bidding goes clockwise in seat order**, which is the turn order, starting from the opener.
- **The minimum bid for an offered share is a fifth of the railroad's value, rounded up.** Values are always multiples of $5, so rounding never changes the amount.

- **The start player heads the turn order.** The CMRC's opening shareholder takes the first turn, so the turn order is turned to start with them. Seat order, and so bidding order, is unchanged.

## Choosing an action

- **The third Offer Stock slot is open with four, five and six players.** The rulebook text limits only the three-player game. The redrawn board marks the slot "4p, 5p", but six players get it too.
- **An action with nothing to do still moves the locomotive and ends the turn.** This covers Construct Track when no railroad can build, Offer Stock when no share is unsold and the player holds none, and Develop Settlements when nothing can be developed.

## Construct Track

- **A railroad that cannot build is underfinanced or has no link it may build.** The rulebook defines only the lack of money. A funded railroad with every legal link taken counts as unable to build, so a player may not choose it and must pick another or end the turn.
- **A player who controls a railroad able to build must build with one of their own.** They may not hand the build to another controller or pick a railroad they do not control. Delegation is only for a player with no railroad of their own able to build.

## Develop Settlements

- **Developing Johannesburg first leaves a second, free Johannesburg development as the alternative to paying $3.** The rulebook's "if they choose not to pay $3, Johannesburg is automatically developed" is applied even when the first development was Johannesburg, so the action cannot end after that single development while Johannesburg can still be developed.
- **A metro area may be developed twice in one action.** Johannesburg, taking the free second development, is the common case.

## End of the game

- **Players tied on the most money share the win.** The rulebook names no tiebreak, so a tie is a draw between them.
