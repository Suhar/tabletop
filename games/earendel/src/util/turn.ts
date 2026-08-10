import { MachineState } from '../definition/states.js'
import { HydratedEarendelGameState } from '../model/gameState.js'

// Whether the game is over on the bag count: the moment ANY player has played the last piece
// from theirs.
//
// This is only half the ending. The other half can't be judged here, because it depends on
// what the next player draws: a player who cannot legally place the piece they drew, and has
// no special piece they could place instead, ends the game too. That is settled in
// PlacingPieceStateHandler.enter, once the draw has actually happened.
// It ends there and then, mid-round - players later in the order simply don't get a final
// turn. Everyone starts with the same 18 pieces, so the player who runs out is the one who
// has taken the most turns, not the one who was luckiest with the order.
export function isEndOfGame(state: HydratedEarendelGameState): boolean {
    return state.players.some((player) => player.bag.length === 0)
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
