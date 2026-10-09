# South African Railroads UI interaction visual contract

## Table layout

- **Action area.** The turn header and the action panel come first. The four action boxes sit in a strip directly below the panel, above the map. Directions for the current decision appear only in the action panel, never on the map or the boxes. Each box shows its name, its action-track advance and its locomotive slots.
- **Map.** The map carries no controls other than its targets: links, external connections and developable settlements. The legend stands in a single column on the map's left edge, below the dividends track.
- **Player tickets.** Each investor is an Edmondson railway ticket. A band in the player's colour carries their name and cash. Below it, one line per railroad held shows a certificate per share, a star where the player controls the railroad, and what those shares would pay at the next dividend. A DIVIDEND DUE total follows. When the sixth payout is next, the lines show the final payoff and the total reads FINAL PAYOFF DUE. The total is followed by fine print with the player's worth at final payoff. The acting player's ticket has a border in their colour and a guard's punch hole.
- **Investors sidebar.** The player tickets come first, then one card for each railroad. A card shows its treasury, income, value, dividend per share and five share certificates. Each certificate is marked in its owner's colour once sold. A closed ZASM card reads "Opens when track reaches Johannesburg". The other closed railroads read "Opens in the initial offering".

## Visual intents

- **Choose an action.** On the acting player's Choosing Action turn, the boxes they may take get a gold border and a pale gold fill and become buttons. A locomotive appears in a box only once its player has chosen a first action. Every locomotive starts in Construct Track, but the boxes stay empty until each player's first choice.
- **Choose a building railroad.** When the builder must pick among railroads, those railroad cards get a dashed gold border and become clickable. The action panel offers the same railroads as buttons, so the choice works when the sidebar is out of view. When a player who controls no buildable railroad must hand the build over, the cards and buttons are shown even when only one railroad can build. A lone railroad of the builder's own is chosen automatically and nothing is highlighted.
- **Build track.** Buildable links and external connections are highlighted on the map. The action panel states the costs.
- **Develop a settlement.** Developable settlements get a ring on the map. The action panel states the cost of a second development. The map shows no cost.
- **Offer stock.** Railroads with an unsold share are highlighted in the sidebar. The action panel offers them as buttons, together with the player's own shares.

## Coexistence and precedence

Only one intent is live at a time, because each belongs to exactly one machine state. During any auction, the railroad being bid on keeps the selected border.

## Shared visual state

The session owns the build selection (railroad and first link), the railroad choices, and the set of locomotives placed on the boxes. The boxes, the cards, the map and the action panel only read them.

- **Lifetime:** the build selection clears in `beforeNewState`. Undo pops the most recent manual stage first, and an automatic railroad choice is never popped.
- **Validity:** a stored railroad applies only while it is still among the current options and a construction state is active. History View shows no targets, because `canAct` is false there.

## Render ownership

Settlement names are placed once from static map data (`utils/mapLabels.ts`). Each keeps its printed board position when that is clear. Otherwise it takes the nearest clear spot around its icon. A clear spot avoids every icon, link box, track line, external connection, base name, legend, score track and other name. The two metro areas carry their names on a plate attached to their development grid. Track converges on the grids from every side, so the plates sit above the track like the grids do.

## Verification scenarios

- Start a game and finish the initial offering: the action boxes show no locomotives. After the first player chooses Construct Track, only their locomotive appears there.
- As a player who controls no buildable railroad, choose Construct Track: every buildable railroad is highlighted in the sidebar and offered as a button, even when only one can build.
- `src/lib/utils/mapLabels.spec.ts` checks that every name stays clear of icons, link boxes, track lines and other names.
