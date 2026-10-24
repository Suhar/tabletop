import type { GameExploration } from '@tabletop/common'
import { type EarendelProjectedState, HydratedEarendelGameState } from '../model/gameState.js'

// Reshuffles every hidden order from the protected stream, so a branch can neither read nor
// reconstruct the real one. The discard is face up.
//
// No createFromProjectedState: rebuilding plausible bags, deck and tile supply from a player's
// projection is not supported yet, so Exploration from a protected Player or Spectator view is
// disabled and only Host View can explore.
export class EarendelGameExploration implements GameExploration<EarendelProjectedState> {
    createFromCanonicalState(state: EarendelProjectedState): EarendelProjectedState {
        const hydrated = new HydratedEarendelGameState(state)
        const random = hydrated.getProtectedPrng().random

        hydrated.technologyDeck.shuffle(random)
        hydrated.tileSupply.shuffle(random)
        for (const player of hydrated.players) {
            player.bag.shuffle(random)
        }

        return hydrated.dehydrate()
    }
}
