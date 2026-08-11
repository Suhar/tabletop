import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { hexKey, sameHex } from '../model/board.js'
import { Piece, PieceLevel } from '../model/pieces.js'
import { AttackOutcome, attackOutcome } from '../util/attack.js'
import { applyTechnologyGains } from '../util/technologyGrants.js'

export type AttackPieceMetadata = Type.Static<typeof AttackPieceMetadata>
export const AttackPieceMetadata = Type.Object({
    // The piece that was hit, so history can name it - whether it left the board for good or
    // was only worn down a level.
    target: Type.Optional(Piece),
    // True when the shot only cost the target a level rather than removing it.
    damaged: Type.Optional(Type.Boolean()),
    // The level it was left on, when damaged.
    levelAfter: Type.Optional(Type.Number()),
    // The fighter's owner passed up the shot.
    declined: Type.Optional(Type.Boolean()),
    // Removing a piece can change who holds a nearby planet outright - including handing it
    // to a player who had nothing to do with the attack.
    technologiesGained: Type.Optional(Type.Record(Type.String(), Type.Array(Type.String())))
})

export type AttackPiece = Type.Static<typeof AttackPiece>
export const AttackPiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AttackPiece),
            playerId: Type.String(),
            // Absent means declining - firing is always optional.
            coords: Type.Optional(AxialCoordinates),
            metadata: Type.Optional(AttackPieceMetadata)
        })
    ])
)

export const AttackPieceValidator = Compile(AttackPiece)

export function isAttackPiece(action?: GameAction): action is AttackPiece {
    return action?.type === ActionType.AttackPiece
}

// Resolves the shot a newly placed fighter is entitled to.
//
// An enemy fighter is worn down a level rather than removed; anything else in reach is
// destroyed, and leaves the game entirely rather than going back to its owner's bag - which
// makes this the only way a hex is ever freed once occupied.
export class HydratedAttackPiece
    extends HydratableAction<typeof AttackPiece>
    implements AttackPiece
{
    declare type: ActionType.AttackPiece
    declare playerId: string
    declare coords?: AxialCoordinates
    declare metadata?: AttackPieceMetadata

    constructor(data: AttackPiece) {
        super(data, AttackPieceValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidAttackPieceReason(state)
        if (invalidReason) {
            throw Error(`Invalid AttackPiece action: ${invalidReason}`)
        }

        const pending = state.pendingAttack!

        if (!this.coords) {
            state.pendingAttack = undefined
            this.metadata = { declined: true }
            return
        }

        const hex = state.board.hexes[hexKey(this.coords)]
        const target = hex.piece!
        const attacker = state.board.hexes[hexKey(pending.fighterCoords)].piece!
        const outcome = attackOutcome(attacker, target)

        const damaged = outcome === AttackOutcome.Damaged
        if (damaged) {
            // A level is a fighter's power as well as its staying power, so this weakens its
            // hold on the planets around it at the same time as it wears it down.
            hex.piece = { ...target, level: (target.level ?? PieceLevel.Two) - 1 }
        } else {
            hex.piece = undefined
        }

        // The target is gone or weaker, so whoever is left may hold the neighbouring planets
        // outright where they didn't before - and that need not be the attacker. Clearing the
        // player who was blocking a planet can hand its technology to a bystander.
        const technologiesGained = applyTechnologyGains(state, this.coords)

        state.pendingAttack = undefined
        this.metadata = {
            target,
            ...(damaged
                ? { damaged: true, levelAfter: (target.level ?? PieceLevel.Two) - 1 }
                : {}),
            ...(Object.keys(technologiesGained).length > 0 ? { technologiesGained } : {})
        }
    }

    isValidAttackPiece(state: HydratedEarendelGameState): boolean {
        return this.invalidAttackPieceReason(state) === undefined
    }

    invalidAttackPieceReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingAttack
        if (!pending) return 'No fighter of yours is waiting to fire.'
        if (pending.playerId !== this.playerId) return "That fighter isn't yours."

        // Declining is always available - the shot is an option, not an obligation.
        if (!this.coords) return undefined

        if (!pending.targets.some((target) => sameHex(target, this.coords!))) {
            return "That piece is out of reach, or too strong for this fighter to touch."
        }
        return undefined
    }
}
