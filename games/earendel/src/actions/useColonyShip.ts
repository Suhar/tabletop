import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, hexKey, HexKind, planetCoordinates } from '../model/board.js'
import { StationComplexSummary } from '../model/stationComplex.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { controllerOf } from '../util/control.js'
import { stationComplexSummary, stationGroupPoints } from '../util/stations.js'

export type UseColonyShipMetadata = Type.Static<typeof UseColonyShipMetadata>
export const UseColonyShipMetadata = Type.Object({
    stationGroupPoints: Type.Optional(Type.Number()),
    stationComplex: Type.Optional(StationComplexSummary)
})

export type UseColonyShip = Type.Static<typeof UseColonyShip>
export const UseColonyShip = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseColonyShip),
            playerId: Type.String(),
            planet: AxialCoordinates,
            metadata: Type.Optional(UseColonyShipMetadata)
        })
    ])
)

export const UseColonyShipValidator = Compile(UseColonyShip)

export function isUseColonyShip(action?: GameAction): action is UseColonyShip {
    return action?.type === ActionType.UseColonyShip
}

// The planets a player could settle: those they control that nobody has settled.
export function settleablePlanets(
    state: HydratedEarendelGameState,
    playerId: string
): AxialCoordinates[] {
    return planetCoordinates(state.board).filter(
        (coords) =>
            controllerOf(state, coords) === playerId &&
            getHex(state.board, coords)?.colony === undefined
    )
}

// Colony Ship (rules.md, One-shot technologies): once, when its holder chooses, a planet they
// control is settled. From then on it counts as one of their stations for the complexes beside
// it, and it scores at once as a station placed there would.
export class HydratedUseColonyShip
    extends HydratableAction<typeof UseColonyShip>
    implements UseColonyShip
{
    declare type: ActionType.UseColonyShip
    declare playerId: string
    declare planet: AxialCoordinates
    declare metadata?: UseColonyShipMetadata

    constructor(data: UseColonyShip) {
        super(data, UseColonyShipValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseColonyShipReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseColonyShip action: ${invalidReason}`)
        }

        state.board.hexes[hexKey(this.planet)].colony = this.playerId
        const playerState = state.getPlayerState(this.playerId)
        playerState.spendStoredEffect(TechnologyEffectKind.ColonyShip)

        const points = stationGroupPoints(state.board, this.playerId, this.planet)
        playerState.score += points

        this.metadata = {
            stationGroupPoints: points,
            stationComplex: stationComplexSummary(state.board, this.playerId, this.planet)
        }
    }

    isValidUseColonyShip(state: HydratedEarendelGameState): boolean {
        return this.invalidUseColonyShipReason(state) === undefined
    }

    invalidUseColonyShipReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        if (!state.getPlayerState(this.playerId).hasStoredEffect(TechnologyEffectKind.ColonyShip)) {
            return 'You have no Colony Ship to use.'
        }

        const hex = getHex(state.board, this.planet)
        if (hex?.kind !== HexKind.Planet) return 'A Colony Ship settles a planet.'
        if (hex.colony !== undefined) return 'That planet is already settled.'
        if (
            !settleablePlanets(state, this.playerId).some((coords) =>
                sameCoordinates(coords, this.planet)
            )
        ) {
            return 'A Colony Ship settles a planet you control.'
        }

        return undefined
    }
}
