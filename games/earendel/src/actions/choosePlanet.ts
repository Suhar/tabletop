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
    candidates: Type.Optional(Type.Array(TechnologyCard)),
    // The planet had already been explored, so nothing was turned over: the technology staked
    // out is the one it already holds.
    alreadyExplored: Type.Optional(Type.Boolean()),
    // The player chose not to survey any planet.
    declined: Type.Optional(Type.Boolean())
})

export type ChoosePlanet = Type.Static<typeof ChoosePlanet>
export const ChoosePlanet = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChoosePlanet),
            playerId: Type.String(),
            // Set when the flip actually turned something over, which is what undo must not
            // reach back past: a player who could look and then choose differently would be
            // reading the deck. When both piles are spent nothing becomes public, so there is
            // nothing to protect and the placement stays takeable back.
            revealsInfo: Type.Optional(Type.Boolean()),
            // Absent means surveying nothing - it is always optional.
            coords: Type.Optional(AxialCoordinates),
            metadata: Type.Optional(ChoosePlanetMetadata)
        })
    ])
)

export const ChoosePlanetValidator = Compile(ChoosePlanet)

export function isChoosePlanet(action?: GameAction): action is ChoosePlanet {
    return action?.type === ActionType.ChoosePlanet
}

// Settles whether a just-placed probe surveys a planet beside it, and which. It may only survey a
// planet where its player has strictly the most probe influence (see probeDestinations). The
// probe stays where it is either way; its level sets how many cards the reveal looks for.
// Deciding the planet is also what makes the reveal possible - the planet's colour is what the
// flip is looking for - so the cards come off the deck here, and choosing among them is the next
// action, which also stakes the player's claim on the technology.
//
// Surveying a planet that is already explored turns nothing over: the one technology on offer is
// the one the planet already holds.
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
        // Only a real flip reveals anything; set below when one happens.
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

        // Narrowed here rather than at the moment of choosing, so that everything downstream
        // - validation, and the auto-resolve when only one card is takeable - sees the same
        // set the player does. `revealed` still holds every flip, so nothing is lost.
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
