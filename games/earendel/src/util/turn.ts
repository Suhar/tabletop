import type { MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { isDraftThree, type EarendelGameConfig } from '../definition/config.js'
import { HydratedEarendelGameState } from '../model/gameState.js'

// Where a turn begins: the draft, or straight to a placement. Both then run through
// PlacingPiece until the hand is empty, which is what lets the two styles share a path.
export function turnStartState(config?: EarendelGameConfig): MachineState {
    return isDraftThree(config) ? MachineState.DraftingPieces : MachineState.PlacingPiece
}

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

// Closes out one placement.
//
// The turn only ends when the player has nothing left in hand: a drafted turn has two
// placements in it, three with a Logistics Upgrade, and any of them can detour through an
// exploration, a shot, a technology or a new tile before coming back. Every one of those paths
// finishes here, which is why the question "is the turn over?" is answered in exactly one
// place - answering it per path is how a held ship gets silently dropped.
export function endPlacement(
    state: HydratedEarendelGameState,
    context?: MachineContext<HydratedEarendelGameState>
): MachineState {
    if (state.heldPieces.length > 0) {
        return MachineState.PlacingPiece
    }

    state.turnManager.endTurn(state.actionCount)

    if (isEndOfGame(state)) {
        return MachineState.EndOfGame
    }

    return turnStartState(context?.gameConfig as EarendelGameConfig)
}
