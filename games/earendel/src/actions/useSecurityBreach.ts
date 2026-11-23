import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { returnToBag } from '../model/bags.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { freshBagPieceId } from '../util/bag.js'

export type UseSecurityBreach = Type.Static<typeof UseSecurityBreach>
export const UseSecurityBreach = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseSecurityBreach),
            playerId: Type.String(),
            // The rival whose bag takes the Scrap. Everyone sees whose it was.
            targetPlayerId: Type.String()
        })
    ])
)

export const UseSecurityBreachValidator = Compile(UseSecurityBreach)

export function isUseSecurityBreach(action?: GameAction): action is UseSecurityBreach {
    return action?.type === ActionType.UseSecurityBreach
}

// Security Breach (rules.md, One-shot technologies): once, when its holder chooses, a piece of
// Scrap goes into a rival's bag. Scrap does nothing: it is drawn like a ship, goes back into
// the bag when it is thrown out, and is gone once it is played in place of a ship.
export class HydratedUseSecurityBreach
    extends HydratableAction<typeof UseSecurityBreach>
    implements UseSecurityBreach
{
    declare type: ActionType.UseSecurityBreach
    declare playerId: string
    declare targetPlayerId: string

    constructor(data: UseSecurityBreach) {
        super(data, UseSecurityBreachValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseSecurityBreachReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseSecurityBreach action: ${invalidReason}`)
        }

        const random = state.getProtectedPrng().random
        const bag = state.getPlayerState(this.targetPlayerId).bag
        const taken = new Set([...bag.items, ...state.heldPieces].map((piece) => piece.id))
        const scrap: Piece = {
            id: freshBagPieceId(this.targetPlayerId, taken, random),
            playerId: this.targetPlayerId,
            type: PieceType.Scrap
        }
        returnToBag(bag, [scrap], random)
        state.getPlayerState(this.playerId).spendStoredEffect(TechnologyEffectKind.SecurityBreach)
    }

    isValidUseSecurityBreach(state: HydratedEarendelGameState): boolean {
        return this.invalidUseSecurityBreachReason(state) === undefined
    }

    invalidUseSecurityBreachReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        if (
            !state
                .getPlayerState(this.playerId)
                .hasStoredEffect(TechnologyEffectKind.SecurityBreach)
        ) {
            return 'You have no Security Breach to use.'
        }

        if (
            this.targetPlayerId === this.playerId ||
            !state.players.some((player) => player.playerId === this.targetPlayerId)
        ) {
            return "A Security Breach puts Scrap in an opponent's bag."
        }

        return undefined
    }
}
