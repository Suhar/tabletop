import type { GameScoring } from '@tabletop/common'
import type { EarendelProjectedState } from '../model/gameState.js'

// A player's score is what the end of the game ranks by: points from stations, chains and the
// planets they control at the end, all already added in by the time the game is over.
export class EarendelScoring implements GameScoring<EarendelProjectedState> {
    finalScores(state: EarendelProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
