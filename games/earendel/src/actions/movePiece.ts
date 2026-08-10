import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { hexKey, sameHex } from '../model/board.js'
import { Piece } from '../model/pieces.js'
import { destinationsFrom, legalMovesFor } from '../util/movement.js'
import { applyTechnologyGains } from '../util/technologyGrants.js'

export type MovePieceMetadata = Type.Static<typeof MovePieceMetadata>
export const MovePieceMetadata = Type.Object({
    piece: Type.Optional(Piece),
    // True when the effect could not be carried out at all - no friendly piece had anywhere
    // to step. Recorded so history says the technology fizzled rather than going silent.
    noMoveAvailable: Type.Optional(Type.Boolean()),
    // Stepping out of a hex, or into one, can change who holds a neighbouring planet outright.
    technologiesGained: Type.Optional(Type.Record(Type.String(), Type.Array(Type.String())))
})

export type MovePiece = Type.Static<typeof MovePiece>
export const MovePiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MovePiece),
            playerId: Type.String(),
            // Both absent only when no move exists at all.
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
// space.
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
            state.pendingTechnology = undefined
            this.metadata = { noMoveAvailable: true }
            return
        }

        const origin = state.board.hexes[hexKey(this.from)]
        const piece = origin.piece!
        origin.piece = undefined
        state.board.hexes[hexKey(this.to)].piece = piece

        // Both ends matter: leaving a hex can hand a planet to whoever is left beside it, and
        // arriving can take one. Neither need be the moving player.
        const gained = {
            ...applyTechnologyGains(state, this.from),
            ...applyTechnologyGains(state, this.to)
        }

        state.pendingTechnology = undefined
        this.metadata = {
            piece,
            ...(Object.keys(gained).length > 0 ? { technologiesGained: gained } : {})
        }
    }

    isValidMovePiece(state: HydratedEarendelGameState): boolean {
        return this.invalidMovePieceReason(state) === undefined
    }

    invalidMovePieceReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingTechnology
        if (!pending) return 'No technology is waiting to be resolved.'
        if (pending.playerId !== this.playerId) return "That technology isn't yours."

        // Skipping is legal only when there is genuinely nothing to do - the move is the
        // technology's whole effect, not an option alongside it.
        if (!this.from || !this.to) {
            return legalMovesFor(state.board, this.playerId).length > 0
                ? 'One of your pieces can move, so the technology has to be used.'
                : undefined
        }

        const piece = state.board.hexes[hexKey(this.from)]?.piece
        if (!piece) return 'There is no piece there to move.'
        if (piece.playerId !== this.playerId) return "That piece isn't yours."

        if (!destinationsFrom(state.board, this.from).some((option) => sameHex(option, this.to!))) {
            return 'That piece cannot step there: it must be adjacent, empty open space.'
        }

        return undefined
    }
}
