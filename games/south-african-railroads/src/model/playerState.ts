import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { ActionBox } from './actionBoxes.js'

export const STARTING_CASH: Record<number, number> = { 3: 80, 4: 70, 5: 60, 6: 50 }

export type SarPlayerState = Type.Static<typeof SarPlayerState>
export const SarPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            cash: Type.Number(),
            locomotive: Type.Enum(ActionBox)
        })
    ])
)

export const SarPlayerStateValidator = Compile(SarPlayerState)

export class HydratedSarPlayerState
    extends Hydratable<typeof SarPlayerState>
    implements SarPlayerState
{
    declare playerId: string
    declare color: Color
    declare cash: number
    declare locomotive: ActionBox

    constructor(data: SarPlayerState) {
        super(data, SarPlayerStateValidator)
    }
}
