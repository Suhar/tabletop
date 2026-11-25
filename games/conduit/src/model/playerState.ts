import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

export const StartingCash = 5
export const StartingSupply = 5
export const StartingReserve = 10

export type ConduitPlayerState = Type.Static<typeof ConduitPlayerState>
export const ConduitPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            cash: Type.Integer({ minimum: 0 }),
            supply: Type.Integer({ minimum: 0 }),
            reserve: Type.Integer({ minimum: 0 })
        })
    ])
)

const ConduitPlayerStateValidator = Compile(ConduitPlayerState)

export function newPlayerState(playerId: string, color: Color): ConduitPlayerState {
    return {
        playerId,
        color,
        cash: StartingCash,
        supply: StartingSupply,
        reserve: StartingReserve
    }
}

export class HydratedConduitPlayerState
    extends Hydratable<typeof ConduitPlayerState>
    implements ConduitPlayerState
{
    declare playerId: string
    declare color: Color
    declare cash: number
    declare supply: number
    declare reserve: number

    constructor(data: ConduitPlayerState) {
        super(data, ConduitPlayerStateValidator)
    }

    pay(amount: number) {
        if (amount > this.cash) {
            throw Error(`Player ${this.playerId} cannot pay $${amount}`)
        }
        this.cash -= amount
    }

    earn(amount: number) {
        this.cash += amount
    }

    takeFromSupply(count: number) {
        if (count > this.supply) {
            throw Error(`Player ${this.playerId} has only ${this.supply} cubes in supply`)
        }
        this.supply -= count
    }

    returnToSupply(count: number) {
        this.supply += count
    }

    // A station's revenue costs it a cube, which goes to its owner's reserve.
    retireCube() {
        this.reserve += 1
    }

    refillSupply(count: number): number {
        const moved = Math.min(count, this.reserve)
        this.reserve -= moved
        this.supply += moved
        return moved
    }
}
