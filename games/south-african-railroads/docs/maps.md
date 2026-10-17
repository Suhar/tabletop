# Maps

A game is played on one map, chosen with the **Map** option when the game is created and stored in the game state as `mapId`. Rules that the board prints, and that could differ on another map, live with the map. Rules that the rulebook sets for every map stay as constants in the model.

## What a map defines

Logic (`src/maps/`):

- `types.ts` lists every `MapId` and every `RailroadId`. A new map adds its id and any railroads it introduces. Railroad ids are shared across maps, so a railroad that appears on two maps keeps one id.
- `<map>/data.ts` holds the settlements (id, name, kind and printed position), the links between them (with the position of each building box) and the external connections (price, value and position).
- `<map>/map.ts` is the `MapDefinition`:
    - `railroads`: id, short and full name, colour and home settlement.
    - `initialOffering`: the railroads auctioned at the start, in order. Every other railroad opens, with a share auctioned at once, when track first reaches its home.
    - `startPlayerRailroad`: the buyer of this railroad's initial share takes the first turn and heads the turn order.
    - `hubId`: the metro area developed free, and without a connection, as the second development when the player will not pay, and never passed through by a double build.
    - `settlementIncome` per kind and `metroIncome` per metro area: the income at each development level, base first.
    - `startingCash` and `offerStockSlots` per player count.
- `maps.ts` registers the map in `MAPS`; `gameConfig.ts` adds it to the Map option.
- With South Africa the only map, `SarInfo` has no configurator, so the option is not offered and every game is set up on South Africa. The second map attaches one: a `SarConfigurator` extending `BaseConfigurator` with `SarGameConfig` and `SarGameConfigOptions`, as Railheads does. The configurator brings typebox's schema builder into the catalog entry, about 80 KB, which is why it waits for a real choice.

UI (`south-african-railroads-ui/src/lib/`):

- `utils/maps/<map>.ts` is the `BoardLayoutSpec`: board size and crop, where the action track, round indicator, legend, Final Payoff panel and logo sit, each metro area's development grid, the base railroads' printed names, the printed position of each settlement name and the region labels. Register it in `BOARD_LAYOUTS` in `utils/boardLayout.ts`.
- `components/board/terrain/<Map>Terrain.svelte` draws artwork that is not data, such as the sea. Register it in `TERRAIN` in `components/board/MapBackground.svelte`.
- `utils/railroadStyle.ts` needs a style for every new railroad id.

Settlement names are placed automatically from the printed positions. A name whose printed spot is not clear moves to the nearest clear spot around its icon, so a map without printed positions still gets names. `mapLabels.spec.ts` and the logic's map checks in `rules.spec.ts` run for every registered map, so a new map is checked as soon as it is registered.

## Shared across maps

These are the same on every map: five shares a railroad, link costs ($5, $15 for two) and value ($5), the four action boxes and their action-track advances, the action track limit of 35, six payouts (the sixth being the final payoff), the $3 second development, and the dividend, special dividend, final payoff and minimum bid formulas. A map that changes one of these needs it moved into `MapDefinition` first.

## Known limits

- One hub per map.
- A free first link never opens a railroad, even if it reaches a closed railroad's home. On South Africa no home is one link from another.
- One railroad opens per build. A double build that reached two closed homes would open only the first railroad in the map's list.
