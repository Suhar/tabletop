import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { attackableTargets } from '../util/attack.js'
import { canUseCooldownEffect, startCooldown } from '../util/cooldowns.js'
import { canWakeFighter } from '../util/legality.js'

export type UseUpdatedLogisticsMetadata = Type.Static<typeof UseUpdatedLogisticsMetadata>
export const UseUpdatedLogisticsMetadata = Type.Object({
    // How many targets the woken fighter turned out to have, so history can say what the power
    // opened up rather than only that it was spent.
    targetCount: Type.Optional(Type.Number())
})

export type UseUpdatedLogistics = Type.Static<typeof UseUpdatedLogistics>
export const UseUpdatedLogistics = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseUpdatedLogistics),
            playerId: Type.String(),
            // Which of the player's fighters is being woken up.
            coords: AxialCoordinates,
            metadata: Type.Optional(UseUpdatedLogisticsMetadata)
        })
    ])
)

export const UseUpdatedLogisticsValidator = Compile(UseUpdatedLogistics)

export function isUseUpdatedLogistics(action?: GameAction): action is UseUpdatedLogistics {
    return action?.type === ActionType.UseUpdatedLogistics
}

// Wakes a fighter that is already on the board and lets it fire, which is the one thing a
// fighter otherwise never gets to do: shooting is normally something that happens on arrival and
// never again, so a fighter that has landed is a threat only in the sense that enemies avoid its
// neighbours.
//
// It sets up exactly the same pendingAttack a freshly placed fighter does, so everything
// downstream - the target list, the escort rule, the Railgun, declining, the missile arc - is the
// existing shot rather than a second implementation of one. All this action does is decide WHICH
// fighter is shooting and charge the cooldown for the privilege.
export class HydratedUseUpdatedLogistics
    extends HydratableAction<typeof UseUpdatedLogistics>
    implements UseUpdatedLogistics
{
    declare type: ActionType.UseUpdatedLogistics
    declare playerId: string
    declare coords: AxialCoordinates
    declare metadata?: UseUpdatedLogisticsMetadata

    constructor(data: UseUpdatedLogistics) {
        super(data, UseUpdatedLogisticsValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseUpdatedLogisticsReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseUpdatedLogistics action: ${invalidReason}`)
        }

        const targets = attackableTargets(state.board, this.coords, this.playerId)

        startCooldown(state, this.playerId, TechnologyEffectKind.UpdatedLogistics)
        state.pendingAttack = {
            playerId: this.playerId,
            fighterCoords: this.coords,
            targets
        }

        this.metadata = { targetCount: targets.length }
    }

    isValidUseUpdatedLogistics(state: HydratedEarendelGameState): boolean {
        return this.invalidUseUpdatedLogisticsReason(state) === undefined
    }

    invalidUseUpdatedLogisticsReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."
        if (state.pendingAttack) return 'A shot of yours is already waiting.'

        if (!canUseCooldownEffect(state, this.playerId, TechnologyEffectKind.UpdatedLogistics)) {
            return 'Your Updated Logistics is not ready.'
        }

        const piece = getHex(state.board, this.coords)?.piece
        if (!piece) return 'There is no ship there.'
        if (piece.playerId !== this.playerId) return "That fighter isn't yours."
        if (piece.type !== PieceType.Fighter) return 'Only a fighter can be sent to attack.'

        // Refused rather than wasted: waking a fighter with nothing in reach would spend three
        // turns of the power for a shot that cannot be taken.
        if (!canWakeFighter(state.board, this.coords, this.playerId)) {
            return 'That fighter has nothing it could hit.'
        }

        return undefined
    }
}
