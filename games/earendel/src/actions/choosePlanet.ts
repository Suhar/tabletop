import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, sameHex } from '../model/board.js'
import { choosableFrom, TechnologyCard } from '../model/technology.js'
import { markExplored } from '../util/exploration.js'
import { revealForExploration } from '../util/technologyDeck.js'

export type ChoosePlanetMetadata = Type.Static<typeof ChoosePlanetMetadata>
export const ChoosePlanetMetadata = Type.Object({
    flipped: Type.Optional(Type.Array(TechnologyCard)),
    candidates: Type.Optional(Type.Array(TechnologyCard)),
    alreadyExplored: Type.Optional(Type.Boolean()),
    declined: Type.Optional(Type.Boolean())
})

export type ChoosePlanet = Type.Static<typeof ChoosePlanet>
export const ChoosePlanet = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChoosePlanet),
            playerId: Type.String(),
            // Undo must not reach back past a flip that turned cards face up.
            revealsInfo: Type.Optional(Type.Boolean()),
            coords: Type.Optional(AxialCoordinates),
            metadata: Type.Optional(ChoosePlanetMetadata)
        })
    ])
)

export const ChoosePlanetValidator = Compile(ChoosePlanet)

export function isChoosePlanet(action?: GameAction): action is ChoosePlanet {
    return action?.type === ActionType.ChoosePlanet
}

export class HydratedChoosePlanet
    extends HydratableAction<typeof ChoosePlanet>
    implements ChoosePlanet
{
    declare type: ActionType.ChoosePlanet
    declare playerId: string
    declare revealsInfo?: boolean
    declare coords?: AxialCoordinates
    declare metadata?: ChoosePlanetMetadata

    constructor(data: ChoosePlanet) {
        super(data, ChoosePlanetValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidChoosePlanetReason(state)
        if (invalidReason) {
            throw Error(`Invalid ChoosePlanet action: ${invalidReason}`)
        }

        const pending = state.pendingExploration!
        this.revealsInfo = false

        if (!this.coords) {
            state.pendingExploration = undefined
            this.metadata = { declined: true }
            return
        }

        pending.exploringPlanet = this.coords

        const planet = getHex(state.board, this.coords)!
        if (planet.explored) {
            const held = planet.technology ? [planet.technology] : []
            pending.revealed = held
            pending.candidates = held
            this.metadata = { candidates: held, alreadyExplored: true }
            return
        }

        markExplored(state.board, this.coords)

        const piles = { deck: state.technologyDeck, discard: state.technologyDiscard }
        const result = revealForExploration(
            piles,
            planet.color!,
            pending.probeLevel,
            state.getProtectedPrng()
        )
        state.technologyDeck = piles.deck
        state.technologyDiscard = piles.discard

        const choosable = choosableFrom(result.candidates)

        pending.revealed = result.flipped
        pending.candidates = choosable

        this.revealsInfo = result.flipped.length > 0
        this.metadata = { flipped: result.flipped, candidates: choosable }
    }

    isValidChoosePlanet(state: HydratedEarendelGameState): boolean {
        return this.invalidChoosePlanetReason(state) === undefined
    }

    invalidChoosePlanetReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingExploration
        if (!pending) return 'No probe is waiting to explore.'
        if (pending.playerId !== this.playerId) return "That probe isn't yours."
        if (pending.exploringPlanet) return 'That probe has already chosen its planet.'
        const coords = this.coords
        if (!coords) return undefined
        if (!pending.candidatePlanets.some((candidate) => sameHex(candidate, coords))) {
            return "Your probes don't lead on that planet, so this probe can't survey it."
        }
        return undefined
    }
}
