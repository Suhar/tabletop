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

export type DestroyPieceMetadata = Type.Static<typeof DestroyPieceMetadata>
export const DestroyPieceMetadata = Type.Object({
    // What was hit, so history can name it - after it has left the board for good, or been
    // worn down a level.
    destroyed: Type.Optional(Piece),
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

export type DestroyPiece = Type.Static<typeof DestroyPiece>
export const DestroyPiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DestroyPiece),
            playerId: Type.String(),
            // Absent means declining - destroying is always optional.
            coords: Type.Optional(AxialCoordinates),
            metadata: Type.Optional(DestroyPieceMetadata)
        })
    ])
)

export const DestroyPieceValidator = Compile(DestroyPiece)

export function isDestroyPiece(action?: GameAction): action is DestroyPiece {
    return action?.type === ActionType.DestroyPiece
}

// Resolves the shot a newly placed fighter is entitled to.
//
// An enemy fighter is worn down a level rather than removed; anything else in reach is
// destroyed, and leaves the game entirely rather than going back to its owner's bag - which
// makes this the only way a hex is ever freed once occupied.
//
// The action is still called DestroyPiece: renaming it would break games already in progress,
// and it is the same decision either way - which of the pieces in reach to fire on.
export class HydratedDestroyPiece
    extends HydratableAction<typeof DestroyPiece>
    implements DestroyPiece
{
    declare type: ActionType.DestroyPiece
    declare playerId: string
    declare coords?: AxialCoordinates
    declare metadata?: DestroyPieceMetadata

    constructor(data: DestroyPiece) {
        super(data, DestroyPieceValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidDestroyPieceReason(state)
        if (invalidReason) {
            throw Error(`Invalid DestroyPiece action: ${invalidReason}`)
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
            destroyed: target,
            ...(damaged
                ? { damaged: true, levelAfter: (target.level ?? PieceLevel.Two) - 1 }
                : {}),
            ...(Object.keys(technologiesGained).length > 0 ? { technologiesGained } : {})
        }
    }

    isValidDestroyPiece(state: HydratedEarendelGameState): boolean {
        return this.invalidDestroyPieceReason(state) === undefined
    }

    invalidDestroyPieceReason(state: HydratedEarendelGameState): string | undefined {
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
