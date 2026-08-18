import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { refreshPlanetControl } from '../util/control.js'
import { ActionType } from '../definition/actions.js'
import { getHex, hexKey, sameHex } from '../model/board.js'
import { Piece, PieceLevel } from '../model/pieces.js'
import { AttackOutcome, attackOutcomeAt, resolveShot } from '../util/attack.js'
import { canUseCooldownEffect, startCooldown } from '../util/cooldowns.js'
import { TechnologyEffectKind } from '../model/technology.js'

export type AttackPieceMetadata = Type.Static<typeof AttackPieceMetadata>
export const AttackPieceMetadata = Type.Object({
    // The piece that was hit, so history can name it - whether it left the board for good or
    // was only worn down a level.
    target: Type.Optional(Piece),
    // True when the shot only cost the target a level rather than removing it.
    damaged: Type.Optional(Type.Boolean()),
    // A Railgun turned what would have been damage into a kill.
    railgun: Type.Optional(Type.Boolean()),
    // The level it was left on, when damaged.
    levelAfter: Type.Optional(Type.Number()),
    // The fighter's owner passed up the shot.
    declined: Type.Optional(Type.Boolean()),
    // Removing a piece can change who holds a nearby planet outright - including handing it
    // to a player who had nothing to do with the attack.
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
            // Spend a Railgun on this shot, destroying the target outright rather than wearing
            // it down. Starts the Railgun's timer.
            useRailgun: Type.Optional(Type.Boolean()),
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
    declare useRailgun?: boolean
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

        const railgun = this.useRailgun === true
        if (railgun) {
            // A Railgun turns damage into destruction. It does not extend a fighter's reach:
            // what it could not touch, it still cannot.
            startCooldown(state, this.playerId, TechnologyEffectKind.Railgun)
        }

        const result = resolveShot(state.board, pending.fighterCoords, this.coords, railgun)!

        // Clearing a blocker can leave someone else holding a neighbouring planet outright,
        // but nothing is handed over here: whoever holds it when their own turn begins is the
        // one who claims it. A shot can therefore start someone ELSE's wait - including a
        // bystander who had nothing to do with the attack.

        // The board has changed, so who holds the planets around it may have too - and a tie
        // now leaves the incumbent in place rather than clearing the planet.
        refreshPlanetControl(state)

        state.pendingAttack = undefined
        this.metadata = {
            target: result.target,
            ...(result.damaged ? { damaged: true, levelAfter: result.levelAfter } : {}),
            ...(railgun ? { railgun: true } : {})
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

        if (this.useRailgun) {
            if (!canUseCooldownEffect(state, this.playerId, TechnologyEffectKind.Railgun)) {
                return 'Your Railgun is not ready.'
            }

            // Refused rather than wasted: a Railgun on a shot that already kills would start the
            // timer for nothing.
            if (
                attackOutcomeAt(state.board, pending.fighterCoords, this.coords) !==
                AttackOutcome.Damaged
            ) {
                return 'That shot already destroys its target - save the Railgun.'
            }
        }

        return undefined
    }
}
