import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex } from '../model/board.js'
import { choosableFrom } from '../model/technology.js'
import { technologyCard } from '../model/technologyCards.js'
import { markExplored } from '../util/exploration.js'
import { revealForExploration } from '../util/technologyDeck.js'

export type ChoosePlanetMetadata = Type.Static<typeof ChoosePlanetMetadata>
export const ChoosePlanetMetadata = Type.Object({
    flipped: Type.Optional(Type.Array(Type.String())),
    candidates: Type.Optional(Type.Array(Type.String())),
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

        const pending = state.pendingExploration
        assertExists(pending, 'Validated: a probe is waiting to explore')
        this.revealsInfo = false

        if (!this.coords) {
            state.pendingExploration = undefined
            this.metadata = { declined: true }
            return
        }

        pending.exploringPlanet = this.coords

        const planet = getHex(state.board, this.coords)
        assertExists(planet, 'Validated: candidate planets are on the board')
        if (planet.explored) {
            const held = planet.technologyId ? [planet.technologyId] : []
            pending.revealed = held
            pending.candidates = held
            this.metadata = { candidates: held, alreadyExplored: true }
            return
        }

        markExplored(state.board, this.coords)

        assertExists(planet.color, 'Planets have a colour')
        const piles = { deck: state.technologyDeck, discard: state.technologyDiscard }
        const result = revealForExploration(
            piles,
            planet.color,
            pending.probeLevel,
            state.getProtectedPrng()
        )
        state.technologyDeck = piles.deck
        state.technologyDiscard = piles.discard

        const choosable = choosableFrom(result.candidates.map(technologyCard)).map(
            (card) => card.id
        )

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
        if (!pending.candidatePlanets.some((candidate) => sameCoordinates(candidate, coords))) {
            return "Your probes don't lead on that planet, so this probe can't survey it."
        }
        return undefined
    }
}
