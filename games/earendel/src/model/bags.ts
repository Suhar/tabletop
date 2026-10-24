import { DrawBag, HydratedDrawBag, type RandomFunction } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Piece } from './pieces.js'
import { Tile } from './tile.js'

export type PieceBag = Type.Static<typeof PieceBag>
export const PieceBag = DrawBag(Piece)
const PieceBagValidator = Compile(PieceBag)

export class HydratedPieceBag extends HydratedDrawBag<Piece, typeof PieceBag> implements PieceBag {
    constructor(data: PieceBag) {
        super(data, PieceBagValidator)
    }
}

export type TechnologyDeck = Type.Static<typeof TechnologyDeck>
export const TechnologyDeck = DrawBag(Type.String())
const TechnologyDeckValidator = Compile(TechnologyDeck)

export class HydratedTechnologyDeck
    extends HydratedDrawBag<string, typeof TechnologyDeck>
    implements TechnologyDeck
{
    constructor(data: TechnologyDeck) {
        super(data, TechnologyDeckValidator)
    }
}

export type TileSupply = Type.Static<typeof TileSupply>
export const TileSupply = DrawBag(Tile)
const TileSupplyValidator = Compile(TileSupply)

export class HydratedTileSupply
    extends HydratedDrawBag<Tile, typeof TileSupply>
    implements TileSupply
{
    constructor(data: TileSupply) {
        super(data, TileSupplyValidator)
    }
}

export function drawIfAny<T, U extends Type.TSchema>(bag: HydratedDrawBag<T, U>): T | undefined {
    return bag.isEmpty() ? undefined : bag.draw()
}

// Returned items are reshuffled so none can be tracked to where it went. One at a time because
// the shared addItems counts a batch as a single item.
export function returnToBag<T, U extends Type.TSchema>(
    bag: HydratedDrawBag<T, U>,
    items: T[],
    random: RandomFunction
) {
    for (const item of items) bag.addItem(item)
    bag.shuffle(random)
}
