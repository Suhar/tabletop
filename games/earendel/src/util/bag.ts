import { Prng, shuffle } from '@tabletop/common'
import { LEVELLED_TYPES, type Piece, PieceLevel, PieceType, STARTING_BAG } from '../model/pieces.js'

export function buildBag(
    playerId: string,
    prng: Prng,
    perType: Record<PieceType, number> = STARTING_BAG
): Piece[] {
    const bag: Piece[] = []

    for (const type of Object.values(PieceType)) {
        const count = perType[type]
        const perLevel = Math.ceil(count / 2)

        for (let index = 0; index < count; index++) {
            const level = LEVELLED_TYPES.includes(type)
                ? index < perLevel
                    ? PieceLevel.Two
                    : PieceLevel.Three
                : undefined

            bag.push({
                id: `${playerId}-${type}-${index}`,
                playerId,
                type,
                ...(level ? { level } : {})
            })
        }
    }

    shuffle(bag, prng.random)
    return bag
}
