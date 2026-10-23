import type { GameExploration } from '@tabletop/common'
import { shuffle } from '@tabletop/common'
import { type EarendelProjectedState, HydratedEarendelGameState } from '../model/gameState.js'

// Prepares an Exploration branch from the real game so that exploring cannot hand over what play
// keeps secret. Three things are hidden: the technology deck's order (precisely what a probe
// uncovers), every player's bag order, including the explorer's own, and the tile supply's
// order. Each is reshuffled from the protected random stream, which no client can see, so a
// branch can neither read the real order nor reconstruct it.
//
// The discard is face-up, so it is left as it is.
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
