import { Color } from '@tabletop/common'

// A constellation for a card back: stars in a 66 × 96 card, the lines joining them, and the one
// star lit in the owner's color. Each player color has its own.
export type Constellation = {
    name: string
    stars: [number, number, number][]
    lines: [number, number][]
    lit: number
}

const ORION: Constellation = {
    name: 'Orion',
    stars: [
        [15, 15, 1.1],
        [36, 17, 0.8],
        [22, 40, 0.75],
        [26.5, 42.5, 0.75],
        [31, 45, 0.75],
        [18, 67, 0.8],
        [37, 65, 1.2]
    ],
    lines: [
        [0, 1],
        [0, 2],
        [1, 4],
        [2, 3],
        [3, 4],
        [2, 5],
        [4, 6]
    ],
    lit: 6
}

const CASSIOPEIA: Constellation = {
    name: 'Cassiopeia',
    stars: [
        [9, 56, 0.8],
        [20, 43, 1.05],
        [31, 52, 0.8],
        [42, 37, 0.95],
        [54, 48, 0.7]
    ],
    lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4]
    ],
    lit: 1
}

const PLOW: Constellation = {
    name: 'The Plow',
    stars: [
        [12, 30, 0.75],
        [20, 37, 0.85],
        [27, 42, 0.7],
        [35, 41, 0.7],
        [48, 35, 1.05],
        [52, 51, 0.9],
        [38, 55, 0.85]
    ],
    lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 3]
    ],
    lit: 4
}

const SCORPIUS: Constellation = {
    name: 'Scorpius',
    stars: [
        [12, 22, 0.7],
        [20, 19, 0.75],
        [26, 24, 0.7],
        [24, 33, 1.15],
        [25, 44, 0.7],
        [28, 55, 0.7],
        [33, 65, 0.7],
        [40, 73, 0.75],
        [48, 76, 0.7],
        [54, 70, 0.8],
        [52, 62, 0.7]
    ],
    lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 8],
        [8, 9],
        [9, 10]
    ],
    lit: 3
}

const SERPENT: Constellation = {
    name: 'The Serpent',
    stars: [
        [12, 20, 1.05],
        [22, 26, 0.7],
        [30, 36, 0.65],
        [28, 48, 0.65],
        [22, 58, 0.65],
        [28, 69, 0.65],
        [39, 75, 0.7],
        [52, 73, 0.6]
    ],
    lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7]
    ],
    lit: 0
}

const BY_COLOR: Partial<Record<Color, Constellation>> = {
    [Color.Red]: SCORPIUS,
    [Color.Orange]: ORION,
    [Color.Yellow]: PLOW,
    [Color.Pink]: CASSIOPEIA,
    [Color.White]: SERPENT
}

export function constellationFor(color: Color): Constellation {
    return BY_COLOR[color] ?? SERPENT
}
