import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { planetPointsByPlayer } from '../util/scoring.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedEarendelGameState
> {
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedEarendelGameState>
    ): boolean {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedEarendelGameState>
    ): string[] {
        return []
    }

    enter(context: MachineContext<HydratedEarendelGameState>): void {
        const gameState = context.gameState

        const planetPoints = planetPointsByPlayer(gameState.board)
        for (const [playerId, points] of Object.entries(planetPoints)) {
            gameState.getPlayerState(playerId).score += points
        }

        const highScore = Math.max(...gameState.players.map((player) => player.score))
        const winningIds = gameState.players
            .filter((player) => player.score === highScore)
            .map((player) => player.playerId)

        gameState.result = winningIds.length > 1 ? GameResult.Draw : GameResult.Win
        gameState.winningPlayerIds = winningIds
        gameState.activePlayerIds = []
    }

    onAction(_action: HydratedAction, _context: MachineContext<HydratedEarendelGameState>): string {
        throw Error('No actions are valid at the end of the game')
    }
}
