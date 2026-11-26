import type { GameScoring } from '@tabletop/common'
import type { ConduitProjectedState } from '../model/gameState.js'

export class ConduitScoring implements GameScoring<ConduitProjectedState> {
    finalScores(state: ConduitProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.cash]))
    }
}
