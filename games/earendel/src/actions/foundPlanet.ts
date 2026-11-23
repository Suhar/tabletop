import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HexKind, hexKey, PlanetColor } from '../model/board.js'
import { refreshStanding } from '../util/standing.js'
import { RouteChangeMetadata } from '../model/chains.js'
import { routeChanges } from '../util/tradeRoutes.js'

export type FoundPlanetMetadata = Type.Static<typeof FoundPlanetMetadata>
export const FoundPlanetMetadata = Type.Object({ ...RouteChangeMetadata })

// An artificial planet just placed becomes an unexplored planet of the color chosen (rules.md,
// Granted pieces).
export type FoundPlanet = Type.Static<typeof FoundPlanet>
export const FoundPlanet = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FoundPlanet),
            playerId: Type.String(),
            color: Type.Enum(PlanetColor),
            metadata: Type.Optional(FoundPlanetMetadata)
        })
    ])
)

export const FoundPlanetValidator = Compile(FoundPlanet)

export function isFoundPlanet(action?: GameAction): action is FoundPlanet {
    return action?.type === ActionType.FoundPlanet
}

export class HydratedFoundPlanet
    extends HydratableAction<typeof FoundPlanet>
    implements FoundPlanet
{
    declare type: ActionType.FoundPlanet
    declare playerId: string
    declare color: PlanetColor
    declare metadata?: FoundPlanetMetadata

    constructor(data: FoundPlanet) {
        super(data, FoundPlanetValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidFoundPlanetReason(state)
        if (invalidReason) {
            throw Error(`Invalid FoundPlanet action: ${invalidReason}`)
        }
        const pending = state.pendingFounding
        assertExists(pending, 'Validated: a planet is being founded')

        const hex = state.board.hexes[hexKey(pending.coords)]
        hex.kind = HexKind.Planet
        hex.color = this.color
        hex.explored = false
        hex.piece = undefined
        const routes = [...state.tradeRoutes]
        state.pendingFounding = undefined
        refreshStanding(state)
        this.metadata = routeChanges(routes, state)
    }

    isValidFoundPlanet(state: HydratedEarendelGameState): boolean {
        return this.invalidFoundPlanetReason(state) === undefined
    }

    invalidFoundPlanetReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingFounding
        if (!pending || pending.playerId !== this.playerId) {
            return 'No artificial planet of yours is waiting for its color.'
        }
        return undefined
    }
}
