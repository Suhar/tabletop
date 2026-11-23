import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { returnToBag } from '../model/bags.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { freshBagPieceId } from '../util/bag.js'

// What a player stows at the opening (rules.md, Setup): one more of these.
export enum StowChoice {
    Probe = 'probe',
    Fighter = 'fighter',
    Station = 'station'
}

const STOWED_TYPE: Record<StowChoice, PieceType> = {
    [StowChoice.Probe]: PieceType.Probe,
    [StowChoice.Fighter]: PieceType.Fighter,
    [StowChoice.Station]: PieceType.Station
}

// What ship a choice stows: its kind and level, before it is given a place in the bag.
export function stowedShipKind(choice: StowChoice): Pick<Piece, 'type' | 'level'> {
    const type = STOWED_TYPE[choice]
    return { type, ...(type === PieceType.Station ? {} : { level: PieceLevel.Three }) }
}

export type StowShip = Type.Static<typeof StowShip>
export const StowShip = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.StowShip),
            playerId: Type.String(),
            choice: Visibility.protect(Type.Enum(StowChoice), {
                policy: Visibility.Policy.Actor
            })
        })
    ])
)

export const StowShipValidator = Compile(StowShip)

export function isStowShip(action?: GameAction): action is StowShip {
    return action?.type === ActionType.StowShip
}

export class HydratedStowShip extends HydratableAction<typeof StowShip> implements StowShip {
    declare type: ActionType.StowShip
    declare playerId: string
    declare choice: StowChoice

    constructor(data: StowShip) {
        super(data, StowShipValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        if (!state.activePlayerIds.includes(this.playerId)) {
            throw Error("Invalid StowShip action: It isn't your turn.")
        }

        const bag = state.getPlayerState(this.playerId).bag
        const random = state.getProtectedPrng().random
        const ship: Piece = {
            id: freshBagPieceId(this.playerId, new Set(bag.items.map((piece) => piece.id)), random),
            playerId: this.playerId,
            ...stowedShipKind(this.choice)
        }
        returnToBag(bag, [ship], random)
    }
}
