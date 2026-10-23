import type { GameScoring } from '@tabletop/common'
import type { EarendelProjectedState } from '../model/gameState.js'

export class EarendelScoring implements GameScoring<EarendelProjectedState> {
    finalScores(state: EarendelProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.score]))
    }
}
