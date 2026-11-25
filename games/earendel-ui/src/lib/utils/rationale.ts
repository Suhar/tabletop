import { ActionSource, type GameAction } from '@tabletop/common'
import {
    claimChangesOf,
    type ClaimChange,
    isAttackPiece,
    isAttackSpread,
    isChoosePlanet,
    isChooseTechnology,
    isDrawPieces,
    isEndTurn,
    isEventPick,
    isMovePiece,
    isUseTacticalShift,
    isUseWarpDrive,
    isUseDimensionalRift,
    isUseSpoofedOrders,
    isPass,
    isPlacePiece,
    isTerraform,
    isUseImmediateDownload,
    isUseLogisticsUpgrade,
    isUseTacticalFeint,
    isUseTradeRouteWormhole,
    isUseUpdatedLogistics,
    categoryOfColor,
    type PlanetColor,
    TECHNOLOGY_CATEGORY_INFO,
    routeChangesOf,
    type TradeRoute,
    type StationComplexSummary,
    technologyCard,
    technologyName
} from '@tabletop/earendel'

// Why an action came out as it did, in plain sentences for players learning the rules. Read from
// the action's input and metadata only, like the rest of the history.
// A line is words, with a planet's kind marked out so the history can draw its icon: planets are
// told apart by shape, and never named by a color the player may have switched off.
export type RationalePart = string | { planet: PlanetColor }
export type RationaleLine = RationalePart[]

export function rationaleFor(
    action: GameAction,
    nameOf: (playerId: string) => string = () => 'a rival'
): RationaleLine[] {
    return [
        ...plainLines(action).map((line) => [line]),
        ...routeLines(action, nameOf),
        ...claimLines(action, nameOf).map((line) => [line])
    ]
}

// The same lines as plain words, each planet named by the category of technology it holds.
export function rationaleText(
    action: GameAction,
    nameOf: (playerId: string) => string = () => 'a rival'
): string[] {
    return rationaleFor(action, nameOf).map((line) =>
        line
            .map((part) =>
                typeof part === 'string'
                    ? part
                    : TECHNOLOGY_CATEGORY_INFO[categoryOfColor(part.planet)].name
            )
            .join(' ')
    )
}

function plainLines(action: GameAction): string[] {
    const lines: string[] = []

    if (
        isPlacePiece(action) ||
        isUseTacticalFeint(action) ||
        isUseTradeRouteWormhole(action) ||
        isUseTacticalShift(action) ||
        isUseWarpDrive(action) ||
        isUseDimensionalRift(action)
    ) {
        if (isUseDimensionalRift(action)) {
            lines.push(
                'A Dimensional Rift carries a piece from one hex on the outer border of the map to another, and it counts as newly placed where it comes out, so it scores, explores and attacks as if it had just arrived.'
            )
        }
        if (isUseWarpDrive(action)) {
            lines.push(
                'A piece moved by Warp Drive travels through empty space and counts as newly placed where it lands, so it scores, explores and attacks as if it had just arrived.'
            )
        }
        if (isUseTacticalShift(action)) {
            lines.push(
                'A piece moved by Tactical Shift counts as newly placed, so it scores, explores and attacks as if it had just arrived.'
            )
        }
        if (isUseTacticalFeint(action)) {
            lines.push(
                'A feinted ship counts as newly placed, so it scores, explores and attacks as if it had just arrived.'
            )
        }
        if (isUseTradeRouteWormhole(action)) {
            lines.push(
                'A wormhole carries a ship between two planets of the same color, and the ship counts as newly placed.'
            )
        }
        lines.push(
            ...stationLines(action.metadata?.stationGroupPoints, action.metadata?.stationComplex)
        )
        if (isPlacePiece(action) && action.metadata?.torpedo) {
            lines.push(
                'A fighter placed as a Gamma Torpedo is not a ship arriving: it scores and explores nothing, and must strike a station beside it.'
            )
        }
        if ((action.metadata?.probeDestinations?.length ?? 0) > 0) {
            lines.push(
                'The probe gave its player the strict lead beside a planet they could survey, so surveying was offered.'
            )
        }
    }

    if (isAttackPiece(action) && action.metadata?.target) {
        if (action.metadata.torpedo) {
            lines.push(
                'A Gamma Torpedo is the one thing that removes a station: a fighter placed as a torpedo destroys one station beside it and itself, through any escort.'
            )
        } else if (action.metadata.railgun) {
            lines.push('The Railgun made the hit destroy its target outright, whatever its health.')
        } else if (action.metadata.damaged) {
            lines.push(
                'A hit on a fighter above level 1 wears it down a level instead of destroying it; at level 1 the next hit destroys it.'
            )
        } else {
            lines.push(
                'A fighter destroys any other ship of its own power or below with one hit; only an enemy fighter above level 1 is worn down instead.'
            )
        }
    }

    if (isChooseTechnology(action) && action.metadata?.elevated) {
        lines.push(
            "An elevated card belongs to its world, not the explorer: it is spent for everyone at once, and the discoverer's prize is picking first."
        )
    }

    if (isEventPick(action)) {
        lines.push(
            "Each player in the discoverer's chosen order takes one pick; picks are exclusive, and a player with nothing to pick is passed over."
        )
    }

    if (isAttackSpread(action)) {
        lines.push(
            'A Full Torpedo Spread fires at each chosen neighbor in turn, each hit resolved as an ordinary shot.'
        )
    }

    if (isDrawPieces(action)) {
        if ((action.metadata?.technologiesClaimed?.length ?? 0) > 0) {
            lines.push(
                "A claim pays at the start of the claimant's next turn if their probes still strictly lead the planet, and these did."
            )
        }
        if ((action.metadata?.orbited?.length ?? 0) > 0) {
            lines.push(
                "When a claim pays, the claimant's probes beside the planet leave the board for its orbit."
            )
        }
        if ((action.metadata?.technologiesLapsed?.length ?? 0) > 0) {
            lines.push(
                "A claim lapses if, by the claimant's next turn, a rival has drawn level or ahead beside the planet."
            )
        }
    }

    if (isChooseTechnology(action) && action.metadata?.technologyId) {
        lines.push(
            "Surveying stakes a claim: the technology is gained at the start of this player's next turn, if their probes still strictly lead the planet then.",
            'Probes add to the lead according to their level, and friendly probes can stack.'
        )
    }

    if (
        isChooseTechnology(action) &&
        action.metadata?.technologyId &&
        action.source === ActionSource.System
    ) {
        lines.push(
            'The survey offered only one technology, so there was nothing to choose: it was taken automatically.'
        )
    }

    if (isChoosePlanet(action) && action.metadata?.alreadyExplored) {
        lines.push(
            'An explored planet keeps its technology, so surveying it offers only the technology it already holds.'
        )
    }

    if (isUseSpoofedOrders(action)) {
        lines.push(
            "Spoofed Orders moves a rival's piece that stands beside one of the player's own into an adjacent empty hex. The piece is moved, not placed, so it scores, explores and attacks nothing."
        )
    }

    if (isMovePiece(action) && action.metadata?.piece) {
        lines.push(
            'Free Drift steps a friendly piece into an adjacent empty hex. Unlike a Tactical Shift, a feint or a wormhole, the step does not count as placing it.'
        )
    }

    if (isUseUpdatedLogistics(action)) {
        lines.push('Updated Logistics lets a fighter already on the board take one more shot.')
    }

    if (isUseImmediateDownload(action)) {
        lines.push(
            'Immediate Download takes the technology of an explored planet within three hexes of the planet holding the Download, whatever lies between, and it is theirs to use now or later, with no wait.'
        )
    }

    if (isUseLogisticsUpgrade(action)) {
        lines.push(
            'Logistics Upgrade keeps the ship a drafted turn would otherwise discard. It is then out of use for three of its owner’s turns.'
        )
    }

    if (isTerraform(action) && action.metadata?.toColor) {
        lines.push(
            'A terraformer placed beside a planet that no other terraformer touches may change that planet to another color, for good.'
        )
    }

    if (isEndTurn(action)) {
        lines.push(
            'The turn waited because a technology could still act; ending it keeps the technology for later.'
        )
    }

    if (isPass(action)) {
        lines.push('A player who has nowhere to place the ship they drew ends the game.')
    }

    return lines
}

function stationLines(
    points: number | undefined,
    complex: StationComplexSummary | undefined
): string[] {
    if (!points) return []
    const lines = [
        `A station scores 1 for itself and 1 for every other friendly station in its complex${
            complex ? `: ${complex.stations} here` : ''
        }.`,
        'Stations join a complex by touching or by a clear line of sight, and links chain: a station linked to any station already in the complex is in it too.'
    ]
    if (complex && complex.relays > 0) {
        lines.push(
            `A relay links every friendly station it can see, past any ships between them; this complex reaches through ${
                complex.relays === 1 ? 'a relay' : `${complex.relays} relays`
            }.`
        )
    }
    if (complex?.doubled) {
        lines.push(
            'A Station Hub doubles the score of its complex when it is placed. After that it counts as an ordinary station.'
        )
    }
    return lines
}

function routeLines(action: GameAction, nameOf: (playerId: string) => string): RationaleLine[] {
    const { established, broken } = routeChangesOf(
        'metadata' in action ? action.metadata : undefined
    )
    const whose = (route: TradeRoute) =>
        route.playerId === action.playerId ? 'Their own' : `${nameOf(route.playerId)}'s`
    const ships = (route: TradeRoute) => `${route.length} ${route.length === 1 ? 'ship' : 'ships'}`
    return [
        ...broken.map((route): RationaleLine => [
            whose(route),
            { planet: route.color },
            'trade route ended: a route stands only while its owner has an unbroken chain of their own ships joining the two planets.'
        ]),
        ...established.map((route): RationaleLine =>
            route.playerId === action.playerId
                ? [
                      'Joining two',
                      { planet: route.color },
                      `planets with an unbroken run of ${ships(route)} sets up a trade route${
                          route.points > 0
                              ? `, which scores 1 point for each ship: ${route.points}`
                              : ', which scores nothing for the opening station'
                      }. It carries the power of its planets for as long as it stands.`
                  ]
                : [
                      `${nameOf(route.playerId)}'s chain of ${ships(route)} was the only one left joining the two`,
                      { planet: route.color },
                      `planets, so it took the trade route and scored ${route.points}.`
                  ]
        )
    ]
}

function claimLines(action: GameAction, nameOf: (playerId: string) => string): string[] {
    const { broken, restored } = claimChangesOf('metadata' in action ? action.metadata : undefined)
    const whose = (change: ClaimChange) =>
        change.playerId === action.playerId ? 'Their own' : `${nameOf(change.playerId)}'s`
    const technology = (change: ClaimChange) => technologyName(technologyCard(change.technologyId))
    return [
        ...broken.map(
            (change) =>
                `${whose(change)} pending ${technology(change)} broke: a claim pays only if its claimant's probes still strictly lead the planet when their turn comes round.`
        ),
        ...restored.map(
            (change) =>
                `${whose(change)} pending ${technology(change)} is back on: its claimant's probes lead the planet again.`
        )
    ]
}
