import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

export type EarendelPlayerState = Type.Static<typeof EarendelPlayerState>
export const EarendelPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({

        })
    ])
)

export const EarendelPlayerStateValidator = Compile(EarendelPlayerState)

export class HydratedEarendelPlayerState
    extends Hydratable<typeof EarendelPlayerState>
    implements EarendelPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: EarendelPlayerState) {
        super(data, EarendelPlayerStateValidator)
    }
}
