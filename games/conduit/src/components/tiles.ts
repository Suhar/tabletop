import { assertExists } from '@tabletop/common'

export enum Terminal {
    Positive = 'positive',
    Negative = 'negative'
}

export enum StationLetter {
    A = 'A',
    B = 'B',
    C = 'C',
    D = 'D'
}

export const BaseLetters = [
    StationLetter.A,
    StationLetter.B,
    StationLetter.C,
    StationLetter.D
] as const
export type BaseLetter = (typeof BaseLetters)[number]

export enum Side {
    North = 'north',
    East = 'east',
    South = 'south',
    West = 'west'
}

export const SidesClockwise = [Side.North, Side.East, Side.South, Side.West] as const

export const TilesPerLetter = 16

export interface StationTile {
    id: number
    letter: StationLetter
    terminals: Record<Side, Terminal>
}

// Each letter prints all 16 terminal combinations. Tile numbers follow the printed art: within a
// letter, bits 8, 4, 2 and 1 of (number - 1) mark a positive (red) North, East, South and West.
function printedTile(letterIndex: number, combination: number): StationTile {
    const terminal = (bit: number) => (combination & bit ? Terminal.Positive : Terminal.Negative)
    return {
        id: letterIndex * TilesPerLetter + combination + 1,
        letter: BaseLetters[letterIndex],
        terminals: {
            [Side.North]: terminal(8),
            [Side.East]: terminal(4),
            [Side.South]: terminal(2),
            [Side.West]: terminal(1)
        }
    }
}

export const StationTiles: readonly StationTile[] = BaseLetters.flatMap((_, letterIndex) =>
    Array.from({ length: TilesPerLetter }, (_, combination) =>
        printedTile(letterIndex, combination)
    )
)

const TilesById = new Map(StationTiles.map((tile) => [tile.id, tile]))

export function stationTile(tileId: number): StationTile {
    const tile = TilesById.get(tileId)
    assertExists(tile, `There is no station tile ${tileId}`)
    return tile
}

export function tileIdsOfLetter(letter: StationLetter): number[] {
    return StationTiles.filter((tile) => tile.letter === letter).map((tile) => tile.id)
}

// Rules: A follows D.
export function nextLetter(letter: StationLetter): BaseLetter {
    const index = BaseLetters.findIndex((candidate) => candidate === letter)
    return BaseLetters[(index + 1) % BaseLetters.length]
}

export function oppositeSide(side: Side): Side {
    return SidesClockwise[(SidesClockwise.indexOf(side) + 2) % SidesClockwise.length]
}

// A tile turned clockwise by `rotation` quarter turns shows on `side` what was printed on the side
// `rotation` steps anticlockwise of it.
export function terminalAt(tile: StationTile, rotation: number, side: Side): Terminal {
    const printedIndex = (SidesClockwise.indexOf(side) - rotation + 4 * 4) % 4
    return tile.terminals[SidesClockwise[printedIndex]]
}
