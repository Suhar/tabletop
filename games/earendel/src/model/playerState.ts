import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'
import { Piece } from './pieces.js'

export type EarendelPlayerState = Type.Static<typeof EarendelPlayerState>
export const EarendelPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            // The player's own bag of ships, in draw order - shuffled at setup, drawn from
            // the front. Contents are hidden from everyone (including its owner), so
            // anything that exposes state to a player has to keep it that way, and
            // EarendelGameInitializer.initializeExplorationState reshuffles it.
            bag: Type.Array(Piece),
            // Rewards from exploring planets, kept face-up in front of the player. A turn
            // may spend one of these INSTEAD of drawing from the bag.
            specialPieces: Type.Array(Piece),
            // Technologies this player has gained, by card id. Gained by exploring the
            // planet, or by coming into control of it later - and never lost afterwards,
            // even when the planet is. Ids are unique across the deck, so a card id names
            // the planet it came from.
            technologies: Type.Array(Type.String()),
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
    declare bag: Piece[]
    declare specialPieces: Piece[]
    declare technologies: string[]
    declare score: number

    // The game ends the moment any player's bag runs out (see EndOfGame), so this is the
    // clock everything else is measured against.
    get bagIsEmpty(): boolean {
        return this.bag.length === 0
    }

    drawFromBag(): Piece | undefined {
        return this.bag.shift()
    }

    constructor(data: EarendelPlayerState) {
        super(data, EarendelPlayerStateValidator)
    }
}
