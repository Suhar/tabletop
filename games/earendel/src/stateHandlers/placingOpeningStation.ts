import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { earendelConfig } from '../definition/config.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { turnStartState } from '../util/turn.js'

type PlacingOpeningStationAction = HydratedPlacePiece

// The opening (rules.md, Setup): before the first turn, each player places one free station,
// the last in turn order first. The station comes from no bag and scores nothing on arrival.
export class PlacingOpeningStationStateHandler implements MachineStateHandler<
    PlacingOpeningStationAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is PlacingOpeningStationAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.PlacePiece].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState
        const playerId = nextToOpen(gameState)
        if (!playerId) return
        gameState.activePlayerIds = [playerId]
        // Held like a drawn ship, so the one placement action serves the opening too.
        gameState.heldPieces = [openingStation(playerId)]
    }

    onAction(
        action: PlacingOpeningStationAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        switch (true) {
            case isPlacePiece(action): {
                const gameState = context.gameState
                gameState.shipPlacedThisTurn = undefined
                if (nextToOpen(gameState)) return MachineState.StowingShip
                return turnStartState(earendelConfig(context.gameConfig))
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
        if (!gameState.activePlayerIds.includes(playerId)) return false
        return actionType === ActionType.PlacePiece && gameState.heldPieces.length > 0
    }
}

export function openingStationId(playerId: string): string {
    return `${playerId}-opening-station`
}

function openingStation(playerId: string): Piece {
    return { id: openingStationId(playerId), playerId, type: PieceType.Station, founding: true }
}

// The last player in turn order opens, then the next-to-last, and so on: whoever has yet to
// place, reading the order backwards.
export function nextToOpen(state: HydratedEarendelGameState): string | undefined {
    const placed = new Set(
        Object.values(state.board.hexes).flatMap((hex) =>
            hex.piece?.founding ? [hex.piece.playerId] : []
        )
    )
    return [...state.turnManager.turnOrder].reverse().find((playerId) => !placed.has(playerId))
}
