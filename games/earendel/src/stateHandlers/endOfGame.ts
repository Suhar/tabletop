import {
    type HydratedAction,
    type MachineStateHandler,
    GameResult,
    MachineContext
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { planetPointsByPlayer } from '../util/scoring.js'

// Terminal state. The game ends the instant a player empties their bag - mid-round, with no
// final go-around - so this is reached straight from a turn ending.
export class EndOfGameStateHandler
    implements MachineStateHandler<HydratedAction, HydratedEarendelGameState>
{
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

        // Planets pay out only now, and only here: control can change hands all game without
        // anyone banking anything, so the board's final shape is what counts. Everything
        // else a player scored was banked when it happened and never came back off.
        const planetPoints = planetPointsByPlayer(gameState.board)
        for (const [playerId, points] of Object.entries(planetPoints)) {
            gameState.getPlayerState(playerId).score += points
        }

        const highScore = Math.max(...gameState.players.map((player) => player.score))
        const winningIds = gameState.players
            .filter((player) => player.score === highScore)
            .map((player) => player.playerId)

        // OPEN: ties are unbroken for now, matching the rule that tied planet control pays
        // everyone in full. A tiebreaker may still be wanted for the game as a whole.
        gameState.result = winningIds.length > 1 ? GameResult.Draw : GameResult.Win
        gameState.winningPlayerIds = winningIds
        gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedEarendelGameState>
    ): string {
        throw Error('No actions are valid at the end of the game')
    }
}
