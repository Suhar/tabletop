import { Prng, shuffle } from '@tabletop/common'
import {
    LEVELLED_TYPES,
    type Piece,
    PieceLevel,
    PieceType,
    STARTING_BAG
} from '../model/pieces.js'

// One player's starting bag, shuffled. Piece ids are stable and unique so the UI can key on
// them and history can name a specific ship.
//
// perType is a parameter rather than a constant because bag size is one of the numbers being
// tuned against the size of the board - see simulate.ts.
export function buildBag(
    playerId: string,
    prng: Prng,
    perType: Record<PieceType, number> = STARTING_BAG
): Piece[] {
    const bag: Piece[] = []

    for (const [type, count] of Object.entries(perType) as [PieceType, number][]) {
        // Levelled types are split evenly between the two levels: a level 3 probe reveals
        // more technology, a level 3 fighter is simply stronger, so which one you draw
        // shapes the turn. Halving keeps the split even at whatever count is set.
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
