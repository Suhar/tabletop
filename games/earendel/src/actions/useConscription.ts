import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { returnToBag } from '../model/bags.js'
import { Piece } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { canUseCooldownEffect, startCooldown } from '../util/cooldowns.js'

export type UseConscriptionMetadata = Type.Static<typeof UseConscriptionMetadata>
export const UseConscriptionMetadata = Type.Object({
    // The ships taken back into the bag.
    conscripted: Type.Optional(Type.Array(Piece))
})

export type UseConscription = Type.Static<typeof UseConscription>
export const UseConscription = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseConscription),
            playerId: Type.String(),
            metadata: Type.Optional(UseConscriptionMetadata)
        })
    ])
)

export const UseConscriptionValidator = Compile(UseConscription)

export function isUseConscription(action?: GameAction): action is UseConscription {
    return action?.type === ActionType.UseConscription
}

export function canConscript(state: HydratedEarendelGameState, playerId: string): boolean {
    return (
        canUseCooldownEffect(state, playerId, TechnologyEffectKind.Conscription) &&
        (state.discardedThisTurn ?? []).length > 0
    )
}

// Conscription (rules.md, Cooldown effects): what the player threw out of the game in this
// turn's draft goes back into their bag instead.
export class HydratedUseConscription
    extends HydratableAction<typeof UseConscription>
    implements UseConscription
{
    declare type: ActionType.UseConscription
    declare playerId: string
    declare metadata?: UseConscriptionMetadata

    constructor(data: UseConscription) {
        super(data, UseConscriptionValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseConscriptionReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseConscription action: ${invalidReason}`)
        }

        const conscripted = state.discardedThisTurn ?? []
        returnToBag(
            state.getPlayerState(this.playerId).bag,
            conscripted,
            state.getProtectedPrng().random
        )
        state.discardedThisTurn = undefined
        startCooldown(state, this.playerId, TechnologyEffectKind.Conscription)

        this.metadata = { conscripted }
    }

    isValidUseConscription(state: HydratedEarendelGameState): boolean {
        return this.invalidUseConscriptionReason(state) === undefined
    }

    invalidUseConscriptionReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        if (!canUseCooldownEffect(state, this.playerId, TechnologyEffectKind.Conscription)) {
            return 'Conscription is not ready to use.'
        }
        if ((state.discardedThisTurn ?? []).length === 0) {
            return 'You have thrown no ship out of the game this turn.'
        }

        return undefined
    }
}
