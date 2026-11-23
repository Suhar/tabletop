import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { returnToBag } from '../model/bags.js'
import type { Piece } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { freshBagPieceId } from '../util/bag.js'
import { StowChoice, stowedShipKind } from './stowShip.js'

// How many copies of the chosen ship an Asteroid Field adds to the bag.
export const ASTEROID_FIELD_SHIPS = 3

export type UseAsteroidField = Type.Static<typeof UseAsteroidField>
export const UseAsteroidField = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseAsteroidField),
            playerId: Type.String(),
            // Which ship was built is the player's own business, as the ship stowed at the
            // opening is: the others see only that three ships went into the bag.
            choice: Visibility.protect(Type.Enum(StowChoice), {
                policy: Visibility.Policy.Actor
            })
        })
    ])
)

export const UseAsteroidFieldValidator = Compile(UseAsteroidField)

export function isUseAsteroidField(action?: GameAction): action is UseAsteroidField {
    return action?.type === ActionType.UseAsteroidField
}

// Asteroid Field (rules.md, One-shot technologies): once, when its holder chooses, three
// copies of a level 3 probe, a level 3 fighter or a station go into their bag.
export class HydratedUseAsteroidField
    extends HydratableAction<typeof UseAsteroidField>
    implements UseAsteroidField
{
    declare type: ActionType.UseAsteroidField
    declare playerId: string
    declare choice: StowChoice

    constructor(data: UseAsteroidField) {
        super(data, UseAsteroidFieldValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseAsteroidFieldReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseAsteroidField action: ${invalidReason}`)
        }

        const playerState = state.getPlayerState(this.playerId)
        const random = state.getProtectedPrng().random
        const taken = new Set(
            [
                ...state.players.flatMap((player) => [
                    ...player.bag.items,
                    ...player.specialPieces
                ]),
                ...state.heldPieces,
                ...Object.values(state.board.hexes).flatMap((hex) => (hex.piece ? [hex.piece] : []))
            ].map((piece) => piece.id)
        )
        const ships: Piece[] = []
        for (let built = 0; built < ASTEROID_FIELD_SHIPS; built++) {
            const id = freshBagPieceId(this.playerId, taken, random)
            taken.add(id)
            ships.push({ id, playerId: this.playerId, ...stowedShipKind(this.choice) })
        }
        returnToBag(playerState.bag, ships, random)
        playerState.spendStoredEffect(TechnologyEffectKind.AsteroidField)
    }

    isValidUseAsteroidField(state: HydratedEarendelGameState): boolean {
        return this.invalidUseAsteroidFieldReason(state) === undefined
    }

    invalidUseAsteroidFieldReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        if (
            !state.getPlayerState(this.playerId).hasStoredEffect(TechnologyEffectKind.AsteroidField)
        ) {
            return 'You have no Asteroid Field to use.'
        }

        return undefined
    }
}
