import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { canUseCooldownEffect } from '../util/cooldowns.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedPass, isPass, Pass } from '../actions/pass.js'
import { HydratedPlayScrap, isPlayScrap } from '../actions/playScrap.js'
import { canConscript } from '../actions/useConscription.js'
import { canOverrideFactory } from '../actions/useFactoryOverride.js'
import { settleablePlanets } from '../actions/useColonyShip.js'
import { PieceType } from '../model/pieces.js'
import { endPlacement } from '../util/turn.js'
import { isTechnologyUse, stateAfterTechnologyUse, type TechnologyUse } from './technologyUse.js'
import { canGrowBoard } from '../actions/useBeyondTheFrontier.js'
import { legalMovesFor, legalRiftsFor, legalWarpsFor } from '../util/movement.js'
import { spoofablePieces } from '../util/spoofing.js'
import { hasAnyPlacement, playableSpecials } from '../util/placement.js'

type PlacingPieceAction = HydratedPlacePiece | HydratedPlayScrap | HydratedPass | TechnologyUse

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
            ActionType.PlayScrap,
            ActionType.UseUpdatedLogistics,
            ActionType.UseTacticalFeint,
            ActionType.UseTradeRouteWormhole,
            ActionType.UseImmediateDownload,
            ActionType.UseTacticalShift,
            ActionType.UseWarpDrive,
            ActionType.UseConscription,
            ActionType.UseFactoryOverride,
            ActionType.UseColonyShip,
            ActionType.UseDimensionalRift,
            ActionType.UseBeyondTheFrontier,
            ActionType.UseSpoofedOrders,
            ActionType.UseAsteroidField,
            ActionType.UseSecurityBreach,
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
            playableSpecials(gameState, playerId)
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
            case isTechnologyUse(action): {
                return stateAfterTechnologyUse(action, gameState, context)
            }
            case isPlacePiece(action): {
                if (gameState.pendingFounding) return MachineState.FoundingPlanet
                if (gameState.pendingTerraform) return MachineState.Terraforming
                if (gameState.pendingExploration) {
                    return MachineState.Exploring
                }
                if (gameState.pendingAttack) {
                    return MachineState.Attacking
                }
                return endPlacement(gameState, context)
            }
            case isPlayScrap(action): {
                return endPlacement(gameState, context)
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
            playableSpecials(gameState, playerId)
        )

        switch (actionType) {
            case ActionType.PlacePiece: {
                return hasAnyPlacement(
                    gameState.board,
                    playerId,
                    gameState.heldPieces.filter((piece) => piece.type !== PieceType.Scrap),
                    playableSpecials(gameState, playerId)
                )
            }
            case ActionType.PlayScrap: {
                return gameState.heldPieces.some((piece) => piece.type === PieceType.Scrap)
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
            case ActionType.UseDimensionalRift: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    playerState.hasStoredEffect(TechnologyEffectKind.DimensionalRift) &&
                    legalRiftsFor(gameState.board, playerId).length > 0
                )
            }
            case ActionType.UseColonyShip: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    playerState.hasStoredEffect(TechnologyEffectKind.ColonyShip) &&
                    settleablePlanets(gameState, playerId).length > 0
                )
            }
            case ActionType.UseFactoryOverride: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    canOverrideFactory(gameState, playerId)
                )
            }
            case ActionType.UseConscription: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    canConscript(gameState, playerId)
                )
            }
            case ActionType.UseWarpDrive: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    playerState.hasStoredEffect(TechnologyEffectKind.WarpDrive) &&
                    legalWarpsFor(gameState.board, playerId).length > 0
                )
            }
            case ActionType.UseTacticalShift: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    playerState.hasStoredEffect(TechnologyEffectKind.MoveFriendlyPiece) &&
                    legalMovesFor(gameState.board, playerId).length > 0
                )
            }
            case ActionType.UseSecurityBreach: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    playerState.hasStoredEffect(TechnologyEffectKind.SecurityBreach)
                )
            }
            case ActionType.UseAsteroidField: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    playerState.hasStoredEffect(TechnologyEffectKind.AsteroidField)
                )
            }
            case ActionType.UseSpoofedOrders: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    playerState.hasStoredEffect(TechnologyEffectKind.SpoofedOrders) &&
                    spoofablePieces(gameState.board, playerId).length > 0
                )
            }
            case ActionType.UseBeyondTheFrontier: {
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    gameState.pendingTechnology === undefined &&
                    gameState.pendingTile === undefined &&
                    playerState.hasStoredEffect(TechnologyEffectKind.GrowBoard) &&
                    canGrowBoard(gameState)
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
