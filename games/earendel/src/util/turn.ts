import type { GameAction, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { drawCountFor, earendelConfig, type EarendelGameConfig } from '../definition/config.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { activateNextTechnologyEffect } from './technologyGrants.js'

export function turnStartState(_config?: EarendelGameConfig): MachineState {
    return MachineState.StartOfTurn
}

export function drawCountForPlayer(
    _state: HydratedEarendelGameState,
    _playerId: string,
    config?: EarendelGameConfig
): number {
    return drawCountFor(config)
}

export function isEndOfGame(state: HydratedEarendelGameState): boolean {
    return state.players.some((player) => player.bag.remaining === 0)
}

export function pendingTechnologyEffectState(
    state: HydratedEarendelGameState
): MachineState | undefined {
    if (state.pendingTile) return MachineState.PlacingTile
    if (state.pendingTechnology) return MachineState.ResolvingTechnology
    return undefined
}

export function afterDraw(
    state: HydratedEarendelGameState,
    context?: MachineContext<HydratedEarendelGameState>,
    action?: GameAction
): MachineState {
    const effect = pendingTechnologyEffectState(state) ?? nextOwedEffect(state, action)
    if (effect) return effect
    if (state.draftPending) return MachineState.DraftingPieces

    return endPlacement(state, context, action)
}

function nextOwedEffect(
    state: HydratedEarendelGameState,
    action?: GameAction
): MachineState | undefined {
    if (!activateNextTechnologyEffect(state)) return undefined
    if (state.pendingTile && action) action.revealsInfo = true
    return pendingTechnologyEffectState(state)
}

// A tile drawn from the hidden supply is revealed, so the action that led to it cannot be
// undone.
export function afterTechnologyEffect(
    action: GameAction,
    state: HydratedEarendelGameState,
    context?: MachineContext<HydratedEarendelGameState>
): MachineState {
    return afterDraw(state, context, action)
}

export function endPlacement(
    state: HydratedEarendelGameState,
    context?: MachineContext<HydratedEarendelGameState>,
    action?: GameAction
): MachineState {
    const effect = nextOwedEffect(state, action)
    if (effect) return effect

    if (state.heldPieces.length > 0) {
        return MachineState.PlacingPiece
    }

    state.turnManager.endTurn(state.actionCount)

    if (isEndOfGame(state)) {
        return MachineState.EndOfGame
    }

    return turnStartState(earendelConfig(context?.gameConfig))
}
