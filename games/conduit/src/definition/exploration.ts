import { assert, type ExplorationPopulation, type GameExploration, shuffle } from '@tabletop/common'
import {
    ConduitGameStateValidator,
    type ConduitProjectedState,
    HydratedConduitGameState
} from '../model/gameState.js'
import { BaseLetters, tileIdsOfLetter } from '../components/tiles.js'

export class ConduitGameExploration implements GameExploration<ConduitProjectedState> {
    createFromCanonicalState(state: ConduitProjectedState): ConduitProjectedState {
        return new HydratedConduitGameState(structuredClone(state)).dehydrate()
    }

    // Every tile not on the board or in the market is still in the stack, in an order nobody has
    // seen.
    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<ConduitProjectedState>): ConduitProjectedState {
        const sample = structuredClone(state)
        const seen = new Set([
            ...sample.board.stations.map((station) => station.tileId),
            ...sample.market.flatMap((slot) => (slot.tileId === undefined ? [] : [slot.tileId]))
        ])
        const unseen = BaseLetters.flatMap((letter) => tileIdsOfLetter(letter)).filter(
            (tileId) => !seen.has(tileId)
        )
        assert(unseen.length === sample.deck.remaining, 'The stack holds every unseen tile')
        shuffle(unseen, random)
        sample.deck.items = unseen

        const result = new HydratedConduitGameState(sample).dehydrate()
        assert(
            ConduitGameStateValidator.Check(result),
            'Exploration must produce a complete Conduit state'
        )
        return result
    }
}
