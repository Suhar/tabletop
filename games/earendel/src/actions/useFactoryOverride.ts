import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Piece } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'

// How many extra ships a Factory Override draws.
export const FACTORY_OVERRIDE_SHIPS = 2

export type UseFactoryOverrideMetadata = Type.Static<typeof UseFactoryOverrideMetadata>
export const UseFactoryOverrideMetadata = Type.Object({
    drawn: Type.Optional(Type.Array(Piece))
})

export type UseFactoryOverride = Type.Static<typeof UseFactoryOverride>
export const UseFactoryOverride = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseFactoryOverride),
            playerId: Type.String(),
            metadata: Type.Optional(UseFactoryOverrideMetadata)
        })
    ])
)

export const UseFactoryOverrideValidator = Compile(UseFactoryOverride)

export function isUseFactoryOverride(action?: GameAction): action is UseFactoryOverride {
    return action?.type === ActionType.UseFactoryOverride
}

export function canOverrideFactory(state: HydratedEarendelGameState, playerId: string): boolean {
    const playerState = state.getPlayerState(playerId)
    return (
        playerState.hasStoredEffect(TechnologyEffectKind.FactoryOverride) && !playerState.bagIsEmpty
    )
}

// Factory Override (rules.md, One-shot technologies): once, when its holder chooses, two more
// ships are drawn from their bag into the hand, to be placed this turn with no discard.
export class HydratedUseFactoryOverride
    extends HydratableAction<typeof UseFactoryOverride>
    implements UseFactoryOverride
{
    declare type: ActionType.UseFactoryOverride
    declare playerId: string
    declare revealsInfo?: boolean
    declare metadata?: UseFactoryOverrideMetadata

    constructor(data: UseFactoryOverride) {
        super(data, UseFactoryOverrideValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseFactoryOverrideReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseFactoryOverride action: ${invalidReason}`)
        }

        const playerState = state.getPlayerState(this.playerId)
        const drawn: Piece[] = []
        for (let count = 0; count < FACTORY_OVERRIDE_SHIPS; count++) {
            const piece = playerState.drawFromBag()
            if (!piece) break
            drawn.push(piece)
        }
        state.heldPieces.push(...drawn)
        playerState.spendStoredEffect(TechnologyEffectKind.FactoryOverride)

        // The draw shows what was in the bag: it cannot be taken back.
        this.revealsInfo = true
        this.metadata = { drawn }
    }

    isValidUseFactoryOverride(state: HydratedEarendelGameState): boolean {
        return this.invalidUseFactoryOverrideReason(state) === undefined
    }

    invalidUseFactoryOverrideReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.hasStoredEffect(TechnologyEffectKind.FactoryOverride)) {
            return 'You have no Factory Override to use.'
        }
        if (playerState.bagIsEmpty) return 'Your bag has no ships left to draw.'

        return undefined
    }
}
