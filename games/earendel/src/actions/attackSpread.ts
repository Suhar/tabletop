import * as Type from 'typebox'
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
import { refreshPlanetControl } from '../util/control.js'
import { ActionType } from '../definition/actions.js'

import { Piece } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { resolveShot } from '../util/attack.js'
import { canUseCooldownEffect, startCooldown } from '../util/cooldowns.js'
import { claimChanges, ClaimChangeMetadata, snapshotClaims } from '../util/claimChanges.js'

export type AttackSpreadMetadata = Type.Static<typeof AttackSpreadMetadata>
export const AttackSpreadMetadata = Type.Object({
    ...ClaimChangeMetadata,
    hits: Type.Optional(
        Type.Array(
            Type.Object({
                target: Piece,
                damaged: Type.Optional(Type.Boolean()),
                levelAfter: Type.Optional(Type.Number())
            })
        )
    )
})

export type AttackSpread = Type.Static<typeof AttackSpread>
export const AttackSpread = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AttackSpread),
            playerId: Type.String(),
            targets: Type.Array(AxialCoordinates),
            metadata: Type.Optional(AttackSpreadMetadata)
        })
    ])
)

export const AttackSpreadValidator = Compile(AttackSpread)

export function isAttackSpread(action?: GameAction): action is AttackSpread {
    return action?.type === ActionType.AttackSpread
}

export class HydratedAttackSpread
    extends HydratableAction<typeof AttackSpread>
    implements AttackSpread
{
    declare type: ActionType.AttackSpread
    declare playerId: string
    declare targets: AxialCoordinates[]
    declare metadata?: AttackSpreadMetadata

    constructor(data: AttackSpread) {
        super(data, AttackSpreadValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidAttackSpreadReason(state)
        if (invalidReason) {
            throw Error(`Invalid AttackSpread action: ${invalidReason}`)
        }

        const claims = snapshotClaims(state)

        const pending = state.pendingAttack
        assertExists(pending, 'AttackSpread requires a pending attack')
        startCooldown(state, this.playerId, TechnologyEffectKind.FullTorpedoSpread)

        // In the order given: escorts are judged as each shot lands (rules.md, Escort).
        const hits: NonNullable<AttackSpreadMetadata['hits']> = []
        for (const target of this.targets) {
            const result = resolveShot(state.board, pending.fighterCoords, target)
            if (!result) continue
            hits.push({
                target: result.target,
                ...(result.damaged ? { damaged: true, levelAfter: result.levelAfter } : {})
            })
        }

        refreshPlanetControl(state)

        state.pendingAttack = undefined
        this.metadata = { hits }
        this.metadata = { ...this.metadata, ...claimChanges(claims, state) }
    }

    isValidAttackSpread(state: HydratedEarendelGameState): boolean {
        return this.invalidAttackSpreadReason(state) === undefined
    }

    invalidAttackSpreadReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingAttack
        if (!pending) return 'No fighter of yours is waiting to fire.'
        if (pending.playerId !== this.playerId) return "That fighter isn't yours."

        if (!canUseCooldownEffect(state, this.playerId, TechnologyEffectKind.FullTorpedoSpread)) {
            return 'Your Full Torpedo Spread is not ready.'
        }

        if (this.targets.length === 0) {
            return 'Choose at least one target, or hold fire instead.'
        }

        for (const target of this.targets) {
            if (!pending.targets.some((candidate) => sameCoordinates(candidate, target))) {
                return 'One of those pieces is out of reach, or too strong for this fighter.'
            }
        }

        if (this.targets.length < 2) {
            return 'A spread needs more than one target - fire normally instead.'
        }

        const seen = new Set<string>()
        for (const target of this.targets) {
            const key = `${target.q},${target.r}`
            if (seen.has(key)) return 'That piece is named twice.'
            seen.add(key)
        }

        return undefined
    }
}
