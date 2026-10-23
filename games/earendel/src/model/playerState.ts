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
            // The player's own bag of ships, shuffled at setup and drawn from the front. Its
            // contents are hidden from everyone, including its owner; only `remaining` is public.
            bag: DrawBag(Piece),
            // Rewards from exploring planets, kept face-up in front of the player. A turn
            // may spend one of these INSTEAD of drawing from the bag.
            specialPieces: Type.Array(Piece),
            // Technologies this player has gained, by card id. Gained by exploring the
            // planet, or by coming into control of it later - and never lost afterwards,
            // even when the planet is. Ids are unique across the deck, so a card id names
            // the planet it came from.
            technologies: Type.Array(Type.String()),
            // Effects gained from technologies that are spent later rather than at once, each
            // usable a single time. A player can hold several, including two of the same kind
            // from two different planets.
            storedEffects: Type.Array(Type.Enum(TechnologyEffectKind)),
            // Repeatable powers this player holds, each usable again and again but only so
            // often. Deduplicated: a second copy of the same card adds nothing.
            cooldownEffects: Type.Array(Type.Enum(TechnologyEffectKind)),
            // For each of those, the player's own turn count when it was last used. Absent means
            // never used, so ready.
            cooldowns: Type.Record(Type.String(), Type.Number()),
            // A running total that only ever goes up: control scored during the game is kept
            // even if the planet is later lost.
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

    // The game ends the moment any player's bag runs out (see EndOfGame), so this is the
    // clock everything else is measured against.
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
