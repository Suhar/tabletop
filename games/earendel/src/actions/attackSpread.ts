import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { sameHex } from '../model/board.js'
import { Piece } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { resolveShot } from '../util/attack.js'
import { canUseCooldownEffect, startCooldown } from '../util/cooldowns.js'

export type AttackSpreadMetadata = Type.Static<typeof AttackSpreadMetadata>
export const AttackSpreadMetadata = Type.Object({
    // One entry per piece hit, so history can name them all rather than reporting a count.
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
            // Which neighbours are being fired on. "Any or all", so this is a subset the player
            // chooses rather than simply everything in reach - sparing one can matter, since
            // clearing a piece may hand a planet to a third party or open your own blockade.
            targets: Type.Array(AxialCoordinates),
            metadata: Type.Optional(AttackSpreadMetadata)
        })
    ])
)

export const AttackSpreadValidator = Compile(AttackSpread)

export function isAttackSpread(action?: GameAction): action is AttackSpread {
    return action?.type === ActionType.AttackSpread
}

// Full Torpedo Spread: one fighter's attack, landing on several of its neighbours at once.
//
// Each hit goes through resolveShot, the same function a single attack uses, so a spread cannot
// wear a fighter down differently or ignore an escort. What makes it a spread is only that it
// does that more than once, from one pendingAttack, for one cooldown.
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

        const pending = state.pendingAttack!
        startCooldown(state, this.playerId, TechnologyEffectKind.FullTorpedoSpread)

        // Resolved in the order given. It matters: a spread can hit a piece that was escorting
        // another, and the escort is judged against the board as it stands when each shot lands -
        // so shooting the guard first can open up its neighbour. Rather than freeze the board and
        // pretend the volley is simultaneous, the targets were all checked as legal at validation
        // time and each is then fired in turn.
        const hits: NonNullable<AttackSpreadMetadata['hits']> = []
        for (const target of this.targets) {
            const result = resolveShot(state.board, pending.fighterCoords, target)
            if (!result) continue
            hits.push({
                target: result.target,
                ...(result.damaged ? { damaged: true, levelAfter: result.levelAfter } : {})
            })
        }

        state.pendingAttack = undefined
        this.metadata = { hits }
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

        // "Any or all" still means at least one: declining is what AttackPiece with no target is
        // for, and it costs no cooldown.
        if (this.targets.length === 0) {
            return 'Choose at least one target, or hold fire instead.'
        }

        for (const target of this.targets) {
            if (!pending.targets.some((candidate) => sameHex(candidate, target))) {
                return 'One of those pieces is out of reach, or too strong for this fighter.'
            }
        }

        // A spread of one is an ordinary shot and should not cost three turns of a power.
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
