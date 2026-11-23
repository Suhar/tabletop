import { Prng, type RandomFunction, shuffle } from '@tabletop/common'
import { LEVELED_TYPES, type Piece, PieceLevel, PieceType, STARTING_BAG } from '../model/pieces.js'

// A bag piece's id is the player and a random token that says nothing of the piece or of when it
// joined the bag: a ship stowed at the opening (rules.md, Setup) or added by an Asteroid Field
// is given one the same way, so a drawn ship's id never tells an added ship from the rest.
const TOKENS = 36 ** 6

export function freshBagPieceId(
    playerId: string,
    taken: ReadonlySet<string>,
    random: RandomFunction
): string {
    for (;;) {
        const id = `${playerId}-ship-${Math.floor(random() * TOKENS).toString(36)}`
        if (!taken.has(id)) return id
    }
}

export function buildBag(
    playerId: string,
    prng: Prng,
    perType: Record<PieceType, number> = STARTING_BAG
): Piece[] {
    const ships: Omit<Piece, 'id'>[] = []

    for (const type of Object.values(PieceType)) {
        const count = perType[type]
        const perLevel = Math.ceil(count / 2)

        for (let index = 0; index < count; index++) {
            const level = LEVELED_TYPES.includes(type)
                ? index < perLevel
                    ? PieceLevel.Two
                    : PieceLevel.Three
                : undefined

            ships.push({ playerId, type, ...(level ? { level } : {}) })
        }
    }

    const taken = new Set<string>()
    const bag: Piece[] = ships.map((ship) => {
        const id = freshBagPieceId(playerId, taken, prng.random)
        taken.add(id)
        return { id, ...ship }
    })

    shuffle(bag, prng.random)
    return bag
}
