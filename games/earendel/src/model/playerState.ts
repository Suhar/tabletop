import { DrawBag, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'
import { Piece } from './pieces.js'
import { type Bag, drawFrom } from '../util/drawBags.js'
import { TechnologyEffectKind } from './technology.js'

export type EarendelPlayerState = Type.Static<typeof EarendelPlayerState>
export const EarendelPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            bag: DrawBag(Piece),
            specialPieces: Type.Array(Piece),
            technologies: Type.Array(Type.String()),
            storedEffects: Type.Array(Type.Enum(TechnologyEffectKind)),
            cooldownEffects: Type.Array(Type.Enum(TechnologyEffectKind)),
            cooldowns: Type.Record(Type.String(), Type.Number()),
            score: Type.Number()
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
    declare bag: Bag<Piece>
    declare specialPieces: Piece[]
    declare technologies: string[]
    declare storedEffects: TechnologyEffectKind[]
    declare cooldownEffects: TechnologyEffectKind[]
    declare cooldowns: Record<string, number>
    declare score: number

    get bagIsEmpty(): boolean {
        return this.bag.remaining === 0
    }

    hasCooldownEffect(kind: TechnologyEffectKind): boolean {
        return this.cooldownEffects.includes(kind)
    }

    hasStoredEffect(kind: TechnologyEffectKind): boolean {
        return this.storedEffects.includes(kind)
    }

    spendStoredEffect(kind: TechnologyEffectKind) {
        const index = this.storedEffects.indexOf(kind)
        if (index >= 0) this.storedEffects.splice(index, 1)
    }

    drawFromBag(): Piece | undefined {
        return drawFrom(this.bag)
    }

    constructor(data: EarendelPlayerState) {
        super(data, EarendelPlayerStateValidator)
    }
}
