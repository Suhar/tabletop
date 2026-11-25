import { StationLetter } from '@tabletop/conduit'

// The outline of a station tile's central emblem, centred on (0, 0) in the tile's printed
// orientation (tile = 100 units): A a chamfered square, B a chamfered diamond, C a hexagon with a
// point at the top, D an octagon. Measured from the tile art by
// tmp/conduit/scripts/measure-emblems.mjs, which finds how far each emblem reaches toward each of
// its edges and runs the outline's stroke centre 5.25 units outside every edge, so a 4.5-unit
// stroke leaves an even 3-unit gap all round.
const Outlines: Record<string, [number, number][]> = {
    [StationLetter.A]: [
        [26.9, 19.9],
        [19.9, 26.9],
        [-19.9, 26.9],
        [-26.9, 19.9],
        [-26.9, -19.9],
        [-19.9, -26.9],
        [19.9, -26.9],
        [26.9, -19.9]
    ],
    [StationLetter.B]: [
        [33.2, 5.1],
        [5.1, 33.2],
        [-5.1, 33.2],
        [-33.2, 5.1],
        [-33.2, -5.1],
        [-5.1, -33.2],
        [5.1, -33.2],
        [33.2, -5.1]
    ],
    [StationLetter.C]: [
        [29.5, 17.1],
        [0, 34.1],
        [-29.5, 17.1],
        [-29.5, -17.1],
        [0, -34.1],
        [29.5, -17.1]
    ],
    [StationLetter.D]: [
        [32.4, 13.1],
        [13.1, 32.4],
        [-12.9, 32.4],
        [-32.4, 12.9],
        [-32.4, -12.9],
        [-12.9, -32.4],
        [12.9, -32.4],
        [32.4, -12.9]
    ]
}

export const EmblemStroke = 4.5

export function emblemOutline(letter: StationLetter): string {
    const points = Outlines[letter] ?? Outlines[StationLetter.D]
    return points.map(([x, y]) => `${x},${y}`).join(' ')
}
