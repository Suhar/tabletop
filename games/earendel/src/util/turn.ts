import { MachineState } from '../definition/states.js'
import { hasOpenHex } from '../model/board.js'
import { HydratedEarendelGameState } from '../model/gameState.js'

// Whether the game is over: the moment ANY player has played the last piece from their bag.
// It ends there and then, mid-round - players later in the order simply don't get a final
// turn. Everyone starts with the same 18 pieces, so the player who runs out is the one who
// has taken the most turns, not the one who was luckiest with the order.
export function isEndOfGame(state: HydratedEarendelGameState): boolean {
    if (state.players.some((player) => player.bag.length === 0)) return true

    // A gridlocked board is a finished game. Without this the turn order would go round
    // handing out pieces nobody can place - and since only a placement can free a hex, a
    // full board never unjams itself.
    //
    // PROVISIONAL: this exists so the game always terminates. It should almost never be the
    // condition that actually ends a game, and if it fires in play the board is too small
    // for the bags rather than the rule being right (see docs/rules.md).
    return !hasOpenHex(state.board)
}

// Closes out a turn: hand the turn on, or end the game. Every path that finishes a placement
// goes through here, so the end condition is checked in exactly one place.
export function endTurn(state: HydratedEarendelGameState): MachineState {
    state.turnManager.endTurn(state.actionCount)

    if (isEndOfGame(state)) {
        return MachineState.EndOfGame
    }

    return MachineState.PlacingPiece
}
