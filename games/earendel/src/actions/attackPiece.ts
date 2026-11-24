import * as Type from 'typebox'
import { payBounty } from '../util/routePowers.js'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { refreshStanding } from '../util/standing.js'
import { ActionType } from '../definition/actions.js'

import { Piece } from '../model/pieces.js'
import { AttackOutcome, attackOutcomeAt, isTorpedoAt, resolveShot } from '../util/attack.js'
import { canUseCooldownEffect, startCooldown } from '../util/cooldowns.js'
import { TechnologyEffectKind } from '../model/technology.js'
import {
    snapshotStanding,
    standingChanges,
    StandingChangeMetadata
} from '../util/standingChanges.js'
import { salvageDestroyed } from '../util/elevated.js'

export type AttackPieceMetadata = Type.Static<typeof AttackPieceMetadata>
export const AttackPieceMetadata = Type.Object({
    ...StandingChangeMetadata,
    target: Type.Optional(Piece),
    damaged: Type.Optional(Type.Boolean()),
    railgun: Type.Optional(Type.Boolean()),
    // The strike was a Gamma Torpedo's: the fighter that fired is gone too.
    torpedo: Type.Optional(Piece),
    // Salvage Operations: destroyed ships a drone's owner took into their bag.
    salvaged: Type.Optional(
        Type.Array(
            Type.Object({
                piece: Piece,
                playerId: Type.String(),
                reclaimed: Type.Optional(Type.Boolean())
            })
        )
    ),
    levelAfter: Type.Optional(Type.Number()),
    // Bounty, the violet power: points for the enemy pieces destroyed.
    bounty: Type.Optional(Type.Number()),
    declined: Type.Optional(Type.Boolean())
})

export type AttackPiece = Type.Static<typeof AttackPiece>
export const AttackPiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AttackPiece),
            playerId: Type.String(),
            coords: Type.Optional(AxialCoordinates),
            useRailgun: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(AttackPieceMetadata)
        })
    ])
)

export const AttackPieceValidator = Compile(AttackPiece)

export function isAttackPiece(action?: GameAction): action is AttackPiece {
    return action?.type === ActionType.AttackPiece
}

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

        const claims = snapshotStanding(state)

        const pending = state.pendingAttack
        assertExists(pending, 'AttackPiece requires a pending attack')

        if (!this.coords) {
            state.pendingAttack = undefined
            this.metadata = { declined: true }
            return
        }

        const railgun = this.useRailgun === true
        if (railgun) {
            startCooldown(state, this.playerId, TechnologyEffectKind.Railgun)
        }

        const result = resolveShot(state.board, pending.fighterCoords, this.coords, railgun)
        assertExists(result, 'Validated targets hold a piece')

        const salvaged = salvageDestroyed(
            state,
            [
                ...(result.damaged ? [] : [{ piece: result.target, at: this.coords }]),
                ...(result.spent ? [{ piece: result.spent, at: pending.fighterCoords }] : [])
            ],
            this.playerId
        )
        const bounty = payBounty(state, this.playerId, result.damaged ? [] : [result.target])
        refreshStanding(state)

        state.pendingAttack = undefined
        this.metadata = {
            target: result.target,
            ...(bounty > 0 ? { bounty } : {}),
            ...(result.damaged ? { damaged: true, levelAfter: result.levelAfter } : {}),
            ...(railgun ? { railgun: true } : {}),
            ...(result.spent ? { torpedo: result.spent } : {}),
            ...(salvaged.length > 0 ? { salvaged } : {})
        }
        this.metadata = { ...this.metadata, ...standingChanges(claims, state) }
    }

    isValidAttackPiece(state: HydratedEarendelGameState): boolean {
        return this.invalidAttackPieceReason(state) === undefined
    }

    invalidAttackPieceReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingAttack
        if (!pending) return 'No fighter of yours is waiting to fire.'
        if (pending.playerId !== this.playerId) return "That fighter isn't yours."

        if (!this.coords) {
            return isTorpedoAt(state.board, pending.fighterCoords)
                ? 'A torpedo cannot hold fire: choose the station it strikes.'
                : undefined
        }

        if (!pending.targets.some((target) => sameCoordinates(target, this.coords))) {
            return 'That piece is out of reach, or too strong for this fighter to touch.'
        }

        if (this.useRailgun) {
            if (!canUseCooldownEffect(state, this.playerId, TechnologyEffectKind.Railgun)) {
                return 'Your Railgun is not ready.'
            }

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
