import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import {
    HydratedUseUpdatedLogistics,
    isUseUpdatedLogistics
} from '../actions/useUpdatedLogistics.js'
import { HydratedUseTacticalFeint, isUseTacticalFeint } from '../actions/useTacticalFeint.js'
import { canUseCooldownEffect } from '../util/cooldowns.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedPass, isPass, Pass } from '../actions/pass.js'
import { endPlacement } from '../util/turn.js'
import { hasAnyPlacement } from '../util/placement.js'

type PlacingPieceAction =
    | HydratedPlacePiece
    | HydratedPass
    | HydratedUseUpdatedLogistics
    | HydratedUseTacticalFeint

// A whole turn is one placement. This state is where every turn begins and, unless the
// placement was a probe that found something, where it ends.
//
// Transitions: PlacingPiece(PlacePiece) -> Exploring | PlacingPiece | EndOfGame
//              PlacingPiece(Pass)       -> PlacingPiece | EndOfGame
export class PlacingPieceStateHandler
    implements MachineStateHandler<PlacingPieceAction, HydratedEarendelGameState>
{
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
            ActionType.Pass
        ].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        // Always mid-turn by the time this runs: the turn was handed on by StartOfTurn and the
        // hand drawn there, so this only has to keep the right player active.
        const gameState = context.gameState
        const current = gameState.turnManager.currentTurn()
        if (current) gameState.activePlayerIds = [current.playerId]

        this.endGameIfStuck(context, gameState.activePlayerIds[0])
    }

    // A player who cannot legally place anything they hold, and has no special piece they could
    // place instead, ends the game. This can only be judged once there is a hand: a hex closed
    // to a probe is wide open to a fighter, so the answer depends on what came out of the bag.
    //
    // Checked on a continuing turn too, not just at the start of one - a drafted turn can place
    // its first ship into the last hex its second ship could have used. The Pass is a system
    // action so the ending is recorded rather than silently arrived at.
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
                // The woken fighter's shot is the ordinary one, so hand straight over to the
                // state that resolves shots. It comes back here afterwards, with the ship in
                // hand still to place.
                return MachineState.Attacking
            }
            case isUseTacticalFeint(action): {
                // The swapped ship arrives as if placed, so it can owe the same decisions a
                // placement owes - a probe's exploration, a fighter's shot. Either way the turn
                // comes back here afterwards: the feint costs a power, not the placement.
                if (gameState.pendingExploration) {
                    return MachineState.Exploring
                }
                if (gameState.pendingAttack) {
                    return MachineState.Attacking
                }
                return endPlacement(gameState, context)
            }
            case isPlacePiece(action): {
                // A placement that owes the player a decision holds the turn open. A piece
                // is one type or the other, so these are never both pending: probes explore,
                // fighters shoot.
                if (gameState.pendingExploration) {
                    return MachineState.Exploring
                }
                if (gameState.pendingAttack) {
                    return MachineState.Attacking
                }
                return endPlacement(gameState, context)
            }
            case isPass(action): {
                // Only ever reached when the player had nothing they could legally place,
                // which is itself the end of the game.
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

        // Asked of the pieces actually in hand, not of the board alone: a station blockade
        // can shut every open hex to a probe while leaving them all open to a fighter.
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
            case ActionType.UseTacticalFeint: {
                // Like Updated Logistics, offered alongside the placement rather than instead of
                // it: the swap concerns ships already standing on the board and has nothing to do
                // with the one in hand. Which pair of ships can actually trade places is the
                // action's own business.
                return (
                    gameState.pendingAttack === undefined &&
                    gameState.pendingExploration === undefined &&
                    canUseCooldownEffect(gameState, playerId, TechnologyEffectKind.TacticalFeint)
                )
            }
            case ActionType.UseUpdatedLogistics: {
                // Offered alongside the placement rather than instead of it: the power wakes a
                // fighter that is already standing somewhere, which has nothing to do with the
                // ship in hand. Whether any particular fighter can actually fire is the action's
                // own business - this only says the power is available to spend.
                return (
                    gameState.pendingAttack === undefined &&
                    canUseCooldownEffect(gameState, playerId, TechnologyEffectKind.UpdatedLogistics)
                )
            }
            case ActionType.Pass: {
                // Only ever a safety valve: a player with something they can place must
                // place it. This covers a full board, and the subtler case of drawing a probe
                // when every open hex is closed to probes - the draw goes back in the bag.
                return !canPlace
            }
        }
        return false
    }
}
