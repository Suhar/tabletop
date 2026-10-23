import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { TechnologyEffectKind } from '../model/technology.js'

export type UseLogisticsUpgradeMetadata = Type.Static<typeof UseLogisticsUpgradeMetadata>
export const UseLogisticsUpgradeMetadata = Type.Object({
    piecesKept: Type.Optional(Type.Number())
})

export type UseLogisticsUpgrade = Type.Static<typeof UseLogisticsUpgrade>
export const UseLogisticsUpgrade = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseLogisticsUpgrade),
            playerId: Type.String(),
            metadata: Type.Optional(UseLogisticsUpgradeMetadata)
        })
    ])
)

export const UseLogisticsUpgradeValidator = Compile(UseLogisticsUpgrade)

export function isUseLogisticsUpgrade(action?: GameAction): action is UseLogisticsUpgrade {
    return action?.type === ActionType.UseLogisticsUpgrade
}

export class HydratedUseLogisticsUpgrade
    extends HydratableAction<typeof UseLogisticsUpgrade>
    implements UseLogisticsUpgrade
{
    declare type: ActionType.UseLogisticsUpgrade
    declare playerId: string
    declare metadata?: UseLogisticsUpgradeMetadata

    constructor(data: UseLogisticsUpgrade) {
        super(data, UseLogisticsUpgradeValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseLogisticsUpgradeReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseLogisticsUpgrade action: ${invalidReason}`)
        }

        state.getPlayerState(this.playerId).spendStoredEffect(TechnologyEffectKind.LogisticsUpgrade)

        this.metadata = { piecesKept: state.heldPieces.length }
        state.draftPending = false
    }

    isValidUseLogisticsUpgrade(state: HydratedEarendelGameState): boolean {
        return this.invalidUseLogisticsUpgradeReason(state) === undefined
    }

    invalidUseLogisticsUpgradeReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (
            !state
                .getPlayerState(this.playerId)
                .hasStoredEffect(TechnologyEffectKind.LogisticsUpgrade)
        ) {
            return 'You have no Logistics Upgrade to spend.'
        }

        if (state.heldPieces.length <= 1) {
            return 'There is nothing you would have discarded.'
        }

        return undefined
    }
}
