# South African Railroads UI interaction visual contract

## Table layout

- **Action area.** The turn header and the action panel come first. The four action boxes sit in a strip directly below the panel, above the map. Directions for the current decision appear only in the action panel, never on the map or the boxes. Each box shows its name, its action-track advance and its player slots. A player in a slot shows as their initial in a box of their colour.
- **Map.** The map carries no controls other than its targets: links, external connections and developable settlements. The legend stands in a single column on the map's left edge, below the round indicator. The indicator reads "Round X of 6", and "Final Round" in red once the final payoff is next. A developed settlement is surrounded by a gray ring, and a developed metro area rings its current income cell.
- **Player tickets.** Each investor is an Edmondson railway ticket. A band in the player's colour carries their name and cash. Below it, one line per railroad held shows a certificate per share and what those shares would pay at the next dividend. A DIVIDEND DUE total follows, at the same size as the cash in the band. When the sixth payout is next, the lines show the final payoff and the total reads FINAL PAYOFF DUE. The total is followed by fine print with the player's score if the game ended now. The acting player's ticket has a border in their colour and a guard's punch hole.
- **Investors sidebar.** The player tickets come first, then one card for each railroad. A card is a ledger page: the treasury sits in the railroad's band, a stack of the shares still for sale shrinks as they sell ("N left") and is stamped ALL SOLD once empty, and income, value, dividend per share and endgame payout per share share one money column. A closed ZASM card reads "Opens when track reaches Johannesburg". The other closed railroads read "Opens in the initial offering".
- **Auctions.** Every player sees the auction in the action area: the share as a certificate, then a seat card per bidder in bidding order with their bid. The bidder to act lifts with a gold border, and a pass is stamped PASSED. During the initial offering the railroads still to come follow under "Up next". The bidder gets a stepper whose amount can also be typed, and Pass. On phones the certificate shrinks and the seat cards drop to their own row.

## Visual intents

- **Choose an action.** On the acting player's Choosing Action turn, the boxes they may take get a gold border and a pale gold fill and become buttons. A player appears in a box only once they have chosen a first action. Every locomotive starts in Construct Track, but the boxes stay empty until each player's first choice.
- **Choose a building railroad.** When the builder must pick among railroads, those railroad cards get a dashed gold border and become clickable. The action panel offers the same railroads as buttons, so the choice works when the sidebar is out of view. When a player who controls no buildable railroad must hand the build over, the cards and buttons are shown even when only one railroad can build. A lone railroad of the builder's own is chosen automatically and nothing is highlighted.
- **Build track.** Buildable links and external connections are highlighted on the map. The action panel states the costs, and each buildable link shows the income it would add to the railroad. After the first link of a possible double build is chosen, a cube in the builder's colour sits on it until the second link or a single build is chosen, and the railroad cards and player tickets show incomes and dividends as if it were built. A free first link with only one option is laid automatically.
- **Develop a settlement.** Developable settlements get a ring on the map. The action panel states the cost of a second development. Under each developable settlement a chip per serving railroad, in its colour, shows the income the development would add to that railroad.
- **Offer stock.** Railroads with an unsold share are highlighted in the sidebar. The action panel offers them as share certificates, and the player's own shares as certificates under "Yours".

Targets are static. No target animates, because an endless animation over the board made WebKit redraw it every frame and reload the page on phones. Board pieces cast unblurred offset shadows rather than filtered ones for the same reason.

## Coexistence and precedence

Only one intent is live at a time, because each belongs to exactly one machine state. During any auction, the railroad being bid on keeps the selected border.

## Shared visual state

The session owns the build selection (railroad and first link), the railroad choices, and the players placed on the boxes. The boxes, the cards, the map and the action panel only read them.

- **Lifetime:** the build selection clears in `beforeNewState`. Undo pops the most recent manual stage first, and an automatic railroad choice is never popped.
- **Validity:** a stored railroad applies only while it is still among the current options and a construction state is active. History View shows no targets, because `canAct` is false there.

## Render ownership

Settlement names are placed once from static map data (`utils/mapLabels.ts`). Each keeps its printed board position when that is clear. Otherwise it takes the nearest clear spot around its icon. A clear spot avoids every icon, link box, track line, external connection, base name, legend, score track and other name. The two metro areas carry their names on a plate attached to their development grid. Track converges on the grids from every side, so the plates sit above the track like the grids do.

## Verification scenarios

- Start a game and finish the initial offering: the action boxes show no players. After the first player chooses Construct Track, only their initial appears there.
- As a player who controls no buildable railroad, choose Construct Track: every buildable railroad is highlighted in the sidebar and offered as a button, even when only one can build.
- `src/lib/model/session.spec.ts` checks the build selection and Undo order and the auction view against a real session.
- `src/lib/utils/mapLabels.spec.ts` checks that every name stays clear of icons, link boxes, track lines and other names.
