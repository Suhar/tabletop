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
    // The player was offered the move and chose to stay put.
    declined: Type.Optional(Type.Boolean()),
    // The effect could not be carried out at all - no friendly piece had anywhere to step.
    // Recorded so history says the technology fizzled rather than going silent.
    noMoveAvailable: Type.Optional(Type.Boolean()),
    // Stepping out of a hex, or into one, can change who holds a neighbouring planet outright.
})

export type MovePiece = Type.Static<typeof MovePiece>
export const MovePiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MovePiece),
            playerId: Type.String(),
            // Both absent when the move is passed up, or when there was none to make.
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

// Carries out a technology's immediate move: one friendly piece steps into an adjacent empty
// space, or declines it. Optional, because a forced step could only hurt.
//
// A step is NOT a placement. Nothing that a placement triggers happens here - no chain scores,
// no station group pays out, no probe explores, no fighter shoots. What does change is
// position, and therefore who holds the planets either end of the step.
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
            // Distinguished for history's sake: a player holding position reads differently
            // from a technology that had nothing to work with.
            const hadOptions = legalMovesFor(state.board, this.playerId).length > 0
            state.pendingTechnology = undefined
            this.metadata = hadOptions ? { declined: true } : { noMoveAvailable: true }
            return
        }

        const origin = state.board.hexes[hexKey(this.from)]
        const piece = origin.piece!
        origin.piece = undefined
        state.board.hexes[hexKey(this.to)].piece = piece

        // Both ends of the move can change who holds a planet outright - leaving one behind
        // as much as arriving - but neither hands a technology over now. That is settled at
        // the start of a turn, for whoever is holding on then.

        state.pendingTechnology = undefined
        // Control is recomputed once the board is settled: a tie now leaves whoever held
        // the planet holding it, so this cannot be read off the board later.
        refreshPlanetControl(state)

        this.metadata = {
            piece,
        }
    }

    isValidMovePiece(state: HydratedEarendelGameState): boolean {
        return this.invalidMovePieceReason(state) === undefined
    }

    invalidMovePieceReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingTechnology
        if (!pending) return 'No technology is waiting to be resolved.'
        if (pending.playerId !== this.playerId) return "That technology isn't yours."

        // Always allowed to pass. A forced move can only hurt - breaking your own blockade, or
        // stepping out of a planet you hold - so making it compulsory would turn a reward into
        // a penalty.
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
