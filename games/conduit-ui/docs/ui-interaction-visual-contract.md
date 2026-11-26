# Conduit UI interaction visual contract

## Visual intents

- **Table layout.** The table is one SVG: the auction board and the grid. On a window at least 5:4 wide (not a phone), the auction board stands at the top left in two columns of three spots, and the grid has room on its right for its full reach (a 6×6 grid and the ring of empty cells around it), so the table keeps its size and the auction never moves as the grid grows. Otherwise the auction spots sit above the grid in one row, or rows of three on a phone.
- **Bid tracks.** Each spot's track is two columns offset by half a space, ten spaces filled from the bottom, beside its tile. Every empty space shows the tile's price if bidding stopped there ($1 plus the cubes).
- **Bid targets.** On the acting player's bidding turn, every spot whose track has room gets a blue frame and becomes a button over the whole spot. Hovering or focusing a spot shows a faint cube in the bidder's colour on the space the bid would take. Spots out of play are dimmed and never interactive.
- **Offer.** While a tile is on offer, its spot has a gold frame, the bottom cube a gold outline and the price shows above the tile. Everyone sees this; only the offered player gets Buy and Pass in the action panel.
- **Placement targets.** On the placing player's turn, every legal cell shows a dashed blue square and is a button. Nothing else on the grid changes.
- **Chosen cell.** Choosing a target turns its outline gold and previews the tile in it, at the chosen turn or else the first legal one. For a face-up tile a popup beside the cell offers round ↺ and ↻ buttons (when more than one turn is legal), which turn the preview through the legal turns in that direction, and the extra cubes 0 to 3 with their prices. A face-down tile, or a single turn with an empty supply, commits on the cell choice and shows no popup.
- **Highlighted route.** Hovering an owned station with a mouse, or clicking it (Enter/Space), draws its current best route as a glowing line in its owner's colour, with dashes flowing from the station to its destination, and dims every station the route does not pass. Clicking the station again clears it.
- **Route choice.** When an owner must choose among tied routes, the action panel names who each route's toll would pay ("Cleo +$1"). The option under the mouse or in focus, else the first, flows on the board with a "+$1" chip on each station it pays; the other options show as faint dashed lines. Other players see the owner's choice as a waiting prompt with the same board display.
- **Paid routes.** In History View on a revenue step, every route that step paid is drawn in its owner's colour, and each station's badge shows what it was paid instead of what it would earn now.
- **Revenue explanation.** A played or replayed revenue step explains each paying station in turn (Step by step) or all at once (Quick), as the Routes setting in the header says: the station's emblem is outlined, the search spreads out a step at a time, the destinations found are outlined, ties are shown with the rule that broke them (or the owner's choice), and the chosen route draws in, then becomes the glowing, flowing route as "+$N" and any "+$1" tolls rise from the stations paid.
- **Table motion.** Bids drop onto their space; a bought tile's bottom cube moves onto it and the other cubes lift away; a passed run of cubes lifts away and the rest slide down; a placed tile flies from its spot to its cell, turning to its rotation, with its cubes dropping onto it; spent cubes lift off stations, emptied stations flip, and the new market deals in.

## Coexistence and precedence

- Bid targets, the offer, placement targets and the route choice belong to different machine states, so they never overlap.
- Placement targets are empty cells and stations are occupied cells, so a highlighted route and placement targets coexist without overlapping hit targets. Placement targets are hidden while the session is busy, so none shows during a tile flight.
- The board shows one set of routes (`shownRoutes`): a route choice's focused option outside History View, else the paid routes in a viewed revenue step, else the clicked station's route, else the hovered one. Badges follow the paid-route switch (`stationBadges`). Stations off a single shown route are dimmed.
- The revenue explanation draws above everything on the grid and clears when the published state arrives.
- The chosen cell's popup and the route-choice buttons hide while the session is busy, so they never show over an animation.

## Shared visual state

- **Placement selection** (`cell`, then `rotation`): produced by board clicks and the popup; consumed by the grid's target and preview, the popup and the action that commits. It is a registered staged selection: Undo pops the manual stages (an auto-picked single turn is skipped), and the session clears it whenever a new state is published. Choosing the chosen cell again clears it; clicking elsewhere leaves the popup open, so a click on Undo is never also a dismissal. It is valid only while the session has a placement for the viewer. The preview turns the way the player turned it, counting past a full circle rather than unwinding.
- **Highlighted cell** (`inspectedCell`, else `hoveredCell`): produced by station clicks and mouse hover; consumed by the grid's route and dimming. It has no lifetime boundary of its own; it is valid only while that cell holds an owned station, since the route comes from `stationRoutes` of the displayed state. In History View it follows the displayed state, and is overridden by paid routes on a revenue step.
- **Previewed option** (`previewOption`): produced by hovering or focusing a route-choice button; consumed by the board's route display and toll chips. It falls back to the first option, and means nothing once the choice is gone.
- **Routes pace** (`routePace`): the viewer's Step by step or Quick setting, kept in browser storage under a Conduit key; consumed by the revenue explanation only.
- **Stepped table, flying tile and flips** (`TableAnimator`): while an action animates, the table shows the state that action reached, so a chain of actions plays one step at a time before the session publishes the last state. The step is keyed to the published state, so it can never outlive it. Presence is written once per animated action; positions are tweened on the elements. Actions without an action record (Undo, state-only history steps) animate nothing.
- **Route shows** (`RouteAnimator`): the revenue explanation's drawings, mounted one station at a time (all at once in Quick) and cleared after the action's animations.

## Render ownership

- The table SVG draws the auction board, then the grid, then the route shows, then the flying tile above both boards.
- Red sticks for closed connections are drawn by the grid above the tiles, except on the Central Station's edges, which the Central Station draws itself.
- A route's glow is blurred by a filter bounded to that route; its flowing dashes sit above the glow, never under an effect, and the revenue explanation shows the glow without fading it. Dashes flow only on a route shown alone (a highlighted route, a route choice's focused option, the step-by-step explanation); where several routes show at once (paid routes in History View, the Quick explanation) they hold still, since every flowing route repaints its whole length each frame.
- The placement popup is rendered in the scaling wrapper's toolbar, outside the board's zoom, and anchored to the chosen cell's frame, which keeps its size while the preview turns.

## Verification scenarios

| Start             | Input                                       | Expected                                                                                                     | Verified         |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------- |
| Mid game grid     | Hover a spot, click it                      | Ghost cube on the next space; the cube drops there and the turn passes                                       | Manual (harness) |
| Stacked offer     | Pass, pass, pass                            | Gold frame stays on spot 1 as the price drops $5, $3, $2; then the Start Player gets face-down targets       | Manual (harness) |
| Placing a station | Click the target, turn with ↻, choose cubes | Gold outline and preview; the preview turns in place; the tile flies in, turning, and the badge appears      | Manual (harness) |
| Placing a station | Choose cell and turn, then Undo twice       | First Undo drops the turn, second drops the cell; no action undone                                           | Manual (harness) |
| Mid game grid     | Hover a station, click it, click it again   | Its route flows in its owner's colour and other stations dim; the click keeps it; the second click clears it | Manual (harness) |
| Mid game grid     | History: click the latest Revenue entry     | Routes in owners' colours, badges show amounts paid; stepping forward restores live badges                   | Manual (harness) |
| Route choice      | Hover each option, choose one               | Each option flows with its "+$1" chip, the other faint; revenue then explains the chosen route as a choice   | Manual (harness) |
| Last tile         | Place the tile                              | Flight, then each payout round's revenue explanation, then the end-of-game panel                             | Manual (harness) |
| Mid game grid     | Widen the window, then narrow it below 5:4  | Auction at the top left with room on the right; then the auction row above the grid                          | Manual (harness) |
