import type { MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { drawCountFor, type EarendelGameConfig } from '../definition/config.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { activateNextTechnologyEffect } from './technologyGrants.js'

// Where a turn begins, in either style: waiting for the player to draw.
export function turnStartState(_config?: EarendelGameConfig): MachineState {
    return MachineState.StartOfTurn
}

// How many ships this player's turn draws. Comes from the turn style today; the player and the
// state are taken so that a technology which draws more has somewhere to be read from without
// every caller changing.
export function drawCountForPlayer(
    _state: HydratedEarendelGameState,
    _playerId: string,
    config?: EarendelGameConfig
): number {
    return drawCountFor(config)
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

// The state an owed technology effect is waiting in, if one is owed at all. Both slots are
// checked because GrowBoard waits on a tile and everything else on pendingTechnology.
export function pendingTechnologyEffectState(
    state: HydratedEarendelGameState
): MachineState | undefined {
    if (state.pendingTile) return MachineState.PlacingTile
    if (state.pendingTechnology) return MachineState.ResolvingTechnology
    return undefined
}

// Where a turn goes once its hand is settled - drawn, and drafted down if the style drafts.
//
// Technologies claimed at the top of the turn are granted during the draw, but an immediate
// effect is not carried out until here, AFTER any discard. Resolving one straight after the
// draw would strand a drafted hand: the effect's own exit runs through endPlacement, which
// sees ships in hand and goes to PlacingPiece - skipping the discard the player still owed.
export function beginPlacement(state: HydratedEarendelGameState): MachineState {
    return pendingTechnologyEffectState(state) ?? MachineState.PlacingPiece
}

// Where a turn goes when an owed technology effect has just been carried out: on to the next
// one if the turn claimed several, otherwise back to the placement it interrupted.
export function afterTechnologyEffect(
    state: HydratedEarendelGameState,
    context?: MachineContext<HydratedEarendelGameState>
): MachineState {
    if (activateNextTechnologyEffect(state)) {
        return pendingTechnologyEffectState(state)!
    }
    return endPlacement(state, context)
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
