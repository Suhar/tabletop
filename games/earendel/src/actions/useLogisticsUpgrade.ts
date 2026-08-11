import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { TechnologyEffectKind } from '../model/technology.js'

export type UseLogisticsUpgradeMetadata = Type.Static<typeof UseLogisticsUpgradeMetadata>
export const UseLogisticsUpgradeMetadata = Type.Object({
    // How many ships the turn now has to place. Recorded because the whole effect of the
    // technology is that this is three rather than two.
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

// Spends a Logistics Upgrade in place of the draft's discard: nothing is thrown away, so the
// turn places all three drawn ships instead of two.
//
// Nothing else needs to change for that to work - a turn runs until its hand is empty - which
// is why a three-placement turn costs no new machinery.
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

        state.getPlayerState(this.playerId).spendStoredEffect(
            TechnologyEffectKind.LogisticsUpgrade
        )

        this.metadata = { piecesKept: state.heldPieces.length }
    }

    isValidUseLogisticsUpgrade(state: HydratedEarendelGameState): boolean {
        return this.invalidUseLogisticsUpgradeReason(state) === undefined
    }

    invalidUseLogisticsUpgradeReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (!state.getPlayerState(this.playerId).hasStoredEffect(
                TechnologyEffectKind.LogisticsUpgrade
            )) {
            return 'You have no Logistics Upgrade to spend.'
        }

        // Nothing to save when the draft came up short: the ships are all being played anyway.
        if (state.heldPieces.length <= 1) {
            return 'There is nothing you would have discarded.'
        }

        return undefined
    }
}
