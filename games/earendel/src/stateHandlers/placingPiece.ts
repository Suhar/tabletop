import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import {
    HydratedUseUpdatedLogistics,
    isUseUpdatedLogistics
} from '../actions/useUpdatedLogistics.js'
import { HydratedUseTacticalFeint, isUseTacticalFeint } from '../actions/useTacticalFeint.js'
import {
    HydratedUseTradeRouteWormhole,
    isUseTradeRouteWormhole
} from '../actions/useTradeRouteWormhole.js'
import {
    HydratedUseImmediateDownload,
    isUseImmediateDownload
} from '../actions/useImmediateDownload.js'
import { canUseCooldownEffect } from '../util/cooldowns.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedPass, isPass, Pass } from '../actions/pass.js'
import { endPlacement, pendingTechnologyEffectState } from '../util/turn.js'
import { hasAnyPlacement } from '../util/placement.js'

type PlacingPieceAction =
    | HydratedPlacePiece
    | HydratedPass
    | HydratedUseUpdatedLogistics
    | HydratedUseTacticalFeint
    | HydratedUseTradeRouteWormhole
    | HydratedUseImmediateDownload

export class PlacingPieceStateHandler implements MachineStateHandler<
    PlacingPieceAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is PlacingPieceAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [
            ActionType.PlacePiece,
            ActionType.UseUpdatedLogistics,
            ActionType.UseTacticalFeint,
            ActionType.UseTradeRouteWormhole,
            ActionType.UseImmediateDownload,
            ActionType.Pass
        ].filter((actionType) => this.isValidActionType(actionType, playerId, context))
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState
        const current = gameState.turnManager.currentTurn()
        if (current) gameState.activePlayerIds = [current.playerId]

        this.endGameIfStuck(context, gameState.activePlayerIds[0])
    }

    private endGameIfStuck(
        context: MachineContext<HydratedEarendelGameState>,
        playerId: string | undefined
    ) {
        if (!playerId) return
        const gameState = context.gameState

        const stuck = !hasAnyPlacement(
            gameState.board,
            playerId,
            gameState.heldPieces,
            gameState.getPlayerState(playerId).specialPieces
        )

        if (stuck) {
            context.addSystemAction(Pass, { playerId })
        }
    }

    onAction(
        action: PlacingPieceAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isUseUpdatedLogistics(action): {
                return MachineState.Attacking
            }
            case isUseImmediateDownload(action): {
                const owed = pendingTechnologyEffectState(gameState)
                if (owed) return owed
                return endPlacement(gameState, context, action)
            }
            case isUseTradeRouteWormhole(action):
            case isUseTacticalFeint(action): {
                if (gameState.pendingExploration) {
                    return MachineState.Exploring
                }
                if (gameState.pendingAttack) {
                    return MachineState.Attacking
                }
                return endPlacement(gameState, context, action)
            }
            case isPlacePiece(action): {
                if (gameState.pendingExploration) {
                    return MachineState.Exploring
                }
                if (gameState.pendingAttack) {
                    return MachineState.Attacking
                }
                return endPlacement(gameState, context, action)
            }
            case isPass(action): {
                return MachineState.EndOfGame
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): boolean {
        const gameState = context.gameState
        const playerState = gameState.findPlayerState(playerId)
        if (!playerState) return false

        const canPlace = hasAnyPlacement(
            gameState.board,
            playerId,
            gameState.heldPieces,
            playerState.specialPieces
        )

        switch (actionType) {
            case ActionType.PlacePiece: {
                return canPlace
            }
            case ActionType.UseImmediateDownload: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    gameState.pendingTechnology === undefined &&
                    gameState.pendingTile === undefined &&
                    playerState.hasStoredEffect(TechnologyEffectKind.ImmediateDownload)
                )
            }
            case ActionType.UseTradeRouteWormhole: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    canUseCooldownEffect(
                        gameState,
                        playerId,
                        TechnologyEffectKind.TradeRouteWormhole
                    )
                )
            }
            case ActionType.UseTacticalFeint: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    canUseCooldownEffect(gameState, playerId, TechnologyEffectKind.TacticalFeint)
                )
            }
            case ActionType.UseUpdatedLogistics: {
                return (
                    gameState.pendingAttack === undefined &&
                    canUseCooldownEffect(gameState, playerId, TechnologyEffectKind.UpdatedLogistics)
                )
            }
            case ActionType.Pass: {
                return !canPlace
            }
        }
        return false
    }
}
