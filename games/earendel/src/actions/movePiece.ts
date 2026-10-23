import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { refreshPlanetControl } from '../util/control.js'
import { ActionType } from '../definition/actions.js'
import { hexKey, sameHex } from '../model/board.js'
import { Piece } from '../model/pieces.js'
import { destinationsFrom, legalMovesFor } from '../util/movement.js'

export type MovePieceMetadata = Type.Static<typeof MovePieceMetadata>
export const MovePieceMetadata = Type.Object({
    piece: Type.Optional(Piece),
    declined: Type.Optional(Type.Boolean()),
    noMoveAvailable: Type.Optional(Type.Boolean())
})

export type MovePiece = Type.Static<typeof MovePiece>
export const MovePiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MovePiece),
            playerId: Type.String(),
            from: Type.Optional(AxialCoordinates),
            to: Type.Optional(AxialCoordinates),
            metadata: Type.Optional(MovePieceMetadata)
        })
    ])
)

export const MovePieceValidator = Compile(MovePiece)

export function isMovePiece(action?: GameAction): action is MovePiece {
    return action?.type === ActionType.MovePiece
}

export class HydratedMovePiece extends HydratableAction<typeof MovePiece> implements MovePiece {
    declare type: ActionType.MovePiece
    declare playerId: string
    declare from?: AxialCoordinates
    declare to?: AxialCoordinates
    declare metadata?: MovePieceMetadata

    constructor(data: MovePiece) {
        super(data, MovePieceValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidMovePieceReason(state)
        if (invalidReason) {
            throw Error(`Invalid MovePiece action: ${invalidReason}`)
        }

        if (!this.from || !this.to) {
            const hadOptions = legalMovesFor(state.board, this.playerId).length > 0
            state.pendingTechnology = undefined
            this.metadata = hadOptions ? { declined: true } : { noMoveAvailable: true }
            return
        }

        const origin = state.board.hexes[hexKey(this.from)]
        const piece = origin.piece!
        origin.piece = undefined
        state.board.hexes[hexKey(this.to)].piece = piece

        state.pendingTechnology = undefined
        refreshPlanetControl(state)

        this.metadata = {
            piece
        }
    }

    isValidMovePiece(state: HydratedEarendelGameState): boolean {
        return this.invalidMovePieceReason(state) === undefined
    }

    invalidMovePieceReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingTechnology
        if (!pending) return 'No technology is waiting to be resolved.'
        if (pending.playerId !== this.playerId) return "That technology isn't yours."

        if (!this.from || !this.to) return undefined

        const piece = state.board.hexes[hexKey(this.from)]?.piece
        if (!piece) return 'There is no piece there to move.'
        if (piece.playerId !== this.playerId) return "That piece isn't yours."

        if (!destinationsFrom(state.board, this.from).some((option) => sameHex(option, this.to!))) {
            return 'That piece cannot step there: it must be adjacent, empty open space.'
        }

        return undefined
    }
}
