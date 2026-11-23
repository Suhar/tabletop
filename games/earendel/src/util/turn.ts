import type { MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import {
    DRAFT_DISCARDS,
    drawCountFor,
    earendelConfig,
    type EarendelGameConfig,
    hasOpeningStations,
    isDraftThree
} from '../definition/config.js'
import { scannerBonus, seedersReady } from './specials.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { usableTechnologies } from './usableTechnology.js'
import { ruleInForce } from './rules.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { elevatedCardId } from '../model/technologyCards.js'
import { legalMovesFor } from './movement.js'

export function turnStartState(_config?: EarendelGameConfig): MachineState {
    return MachineState.StartOfTurn
}

// Where a game begins: with the opening when the option is on, else the first turn.
export function openingState(config?: EarendelGameConfig): MachineState {
    return hasOpeningStations(config) ? MachineState.StowingShip : turnStartState(config)
}

// Deep Scan adds a ship to the draw and one to the discard, so what is kept is unchanged.
export function drawCountForPlayer(
    state: HydratedEarendelGameState,
    playerId: string,
    config?: EarendelGameConfig
): number {
    return drawCountFor(config) + scannerBonus(state.board, playerId)
}

// How many drawn ships the player places: the draw less the draft's discard, or all of a plain
// draw under Overdrive (rules.md, Elevated technologies).
export function keepCountForPlayer(
    state: HydratedEarendelGameState,
    _playerId: string,
    config?: EarendelGameConfig
): number {
    const base = drawCountFor(config)
    if (ruleInForce(state.board, TechnologyEffectKind.Overdrive)) return base
    return isDraftThree(config) ? base - DRAFT_DISCARDS : base
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
    context?: MachineContext<HydratedEarendelGameState>
): MachineState {
    const effect = pendingTechnologyEffectState(state)
    if (effect) return effect
    const drift = freeDriftState(state)
    if (drift) return drift
    const seeding = seedingState(state)
    if (seeding) return seeding
    if (state.draftPending) return MachineState.DraftingPieces

    return endPlacement(state, context)
}

// Nebula Seeding (rules.md, Granted pieces): once a turn, before the draft, each of the player's
// seeders with laying left may turn an empty hex beside it into nebula.
function seedingState(state: HydratedEarendelGameState): MachineState | undefined {
    if (state.seededThisTurn) return undefined
    const playerId = state.turnManager.currentTurn()?.playerId
    if (!playerId) return undefined
    const seeders = seedersReady(state.board, playerId)
    if (seeders.length === 0) return undefined
    state.seededThisTurn = true
    state.pendingSeeding = { playerId, seeders }
    return MachineState.Seeding
}

// Free Drift (rules.md, Elevated technologies): once a turn, before the draft, the player may
// step one piece. Offered as a technology move so the same action and screen serve it.
function freeDriftState(state: HydratedEarendelGameState): MachineState | undefined {
    if (state.driftedThisTurn) return undefined
    if (!ruleInForce(state.board, TechnologyEffectKind.FreeDrift)) return undefined
    const playerId = state.turnManager.currentTurn()?.playerId
    if (!playerId || legalMovesFor(state.board, playerId).length === 0) return undefined
    state.driftedThisTurn = true
    state.pendingTechnology = {
        playerId,
        technologyId: elevatedCardId(TechnologyEffectKind.FreeDrift)
    }
    return MachineState.ResolvingTechnology
}

// Where the turn goes once a tile is laid or a drift step taken: back to wherever it was.
export function afterTechnologyEffect(
    state: HydratedEarendelGameState,
    context?: MachineContext<HydratedEarendelGameState>
): MachineState {
    return afterDraw(state, context)
}

export function endPlacement(
    state: HydratedEarendelGameState,
    context?: MachineContext<HydratedEarendelGameState>
): MachineState {
    if (state.heldPieces.length > 0) {
        return MachineState.PlacingPiece
    }

    const playerId = state.turnManager.currentTurn()?.playerId
    if (playerId && usableTechnologies(state, playerId).length > 0) {
        return MachineState.EndingTurn
    }

    return finishTurn(state, context)
}

export function finishTurn(
    state: HydratedEarendelGameState,
    context?: MachineContext<HydratedEarendelGameState>
): MachineState {
    state.turnManager.endTurn(state.actionCount)

    if (isEndOfGame(state)) {
        return MachineState.EndOfGame
    }

    return turnStartState(earendelConfig(context?.gameConfig))
}
