import type { GameExploration } from '@tabletop/common'
import { shuffle } from '@tabletop/common'
import { type EarendelProjectedState, HydratedEarendelGameState } from '../model/gameState.js'

// Reshuffles every hidden order from the protected stream, so a branch can neither read nor
// reconstruct the real one. The discard is face up.
export class EarendelGameExploration implements GameExploration<EarendelProjectedState> {
    createFromCanonicalState(state: EarendelProjectedState): EarendelProjectedState {
        const hydrated = new HydratedEarendelGameState(state)
        const random = hydrated.getProtectedPrng().random

        shuffle(hydrated.technologyDeck.items, random)
        shuffle(hydrated.tileSupply.items, random)
        for (const player of hydrated.players) {
            shuffle(player.bag.items, random)
        }

        return hydrated.dehydrate()
    }
}
