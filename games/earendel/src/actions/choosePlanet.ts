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
    // Every card turned over on the way, in order - watching the flips is half the point of
    // exploring, so history keeps them, not just the ones that matched.
    flipped: Type.Optional(Type.Array(TechnologyCard)),
    // The cards the player may actually take. Fewer than the probe's level when the deck and
    // discard couldn't produce enough matches - or when an elevated card turned up, which
    // puts the standard matches out of reach.
    candidates: Type.Optional(Type.Array(TechnologyCard))
})

export type ChoosePlanet = Type.Static<typeof ChoosePlanet>
export const ChoosePlanet = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChoosePlanet),
            playerId: Type.String(),
            // Flips cards off the shared deck, so undo must not reach back past it: a player
            // who could look and then choose differently would be reading the deck.
            revealsInfo: Type.Literal(true),
            coords: AxialCoordinates,
            metadata: Type.Optional(ChoosePlanetMetadata)
        })
    ])
)

export const ChoosePlanetValidator = Compile(ChoosePlanet)

export function isChoosePlanet(action?: GameAction): action is ChoosePlanet {
    return action?.type === ActionType.ChoosePlanet
}

// Settles WHICH planet a just-placed probe explores, when it landed beside more than one.
// The others stay unexplored for a later probe. Deciding the planet is also what makes the
// reveal possible - the planet's colour is what the flip is looking for - so the cards come
// off the deck here, and choosing among them is the next action.
export class HydratedChoosePlanet extends HydratableAction<typeof ChoosePlanet> implements ChoosePlanet {
    declare type: ActionType.ChoosePlanet
    declare playerId: string
    declare revealsInfo: true
    declare coords: AxialCoordinates
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
        const planet = getHex(state.board, this.coords)!

        markExplored(state.board, this.coords)

        const piles = { deck: state.technologyDeck, discard: state.technologyDiscard }
        const result = revealForExploration(piles, planet.color!, pending.probeLevel, state.getPrng())
        state.technologyDeck = piles.deck
        state.technologyDiscard = piles.discard

        // Narrowed here rather than at the moment of choosing, so that everything downstream
        // - validation, and the auto-resolve when only one card is takeable - sees the same
        // set the player does. `revealed` still holds every flip, so nothing is lost.
        const choosable = choosableFrom(result.candidates)

        pending.exploringPlanet = this.coords
        pending.revealed = result.flipped
        pending.candidates = choosable

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
        if (!pending.candidatePlanets.some((candidate) => sameHex(candidate, this.coords))) {
            return "That planet isn't in reach of the probe you just placed."
        }
        return undefined
    }
}
