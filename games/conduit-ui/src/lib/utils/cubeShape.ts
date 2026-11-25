// A cube seen from above at an angle: its top face and its two front faces. Coordinates put the
// top face's back corner at (0, 0); the cube is `size` wide and 1.14 × `size` tall.
export interface CubeShape {
    top: string
    left: string
    right: string
    outline: string
    height: number
    // The step from one cube to the next along the top face's right edge, for setting cubes side
    // by side.
    across: { x: number; y: number }
    // How far up the next cube in a stack sits.
    rise: number
}

export function cubeShape(size: number): CubeShape {
    const half = size / 2
    const slope = size * 0.28
    const side = size * 0.58
    const points = (list: [number, number][]) =>
        list.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')
    return {
        top: points([
            [0, 0],
            [half, slope],
            [0, 2 * slope],
            [-half, slope]
        ]),
        left: points([
            [-half, slope],
            [0, 2 * slope],
            [0, 2 * slope + side],
            [-half, slope + side]
        ]),
        right: points([
            [0, 2 * slope],
            [half, slope],
            [half, slope + side],
            [0, 2 * slope + side]
        ]),
        outline: points([
            [0, 0],
            [half, slope],
            [half, slope + side],
            [0, 2 * slope + side],
            [-half, slope + side],
            [-half, slope]
        ]),
        height: 2 * slope + side,
        across: { x: half, y: slope },
        rise: side
    }
}

function round(value: number): number {
    return Math.round(value * 100) / 100
}

// The cubes on a station and on a bid track.
export const PileCubeSize = 21
export const TrackCubeSize = 20

// Where each cube of a station's pile sits, back to front so later cubes draw over earlier ones:
// two high, then a second column in front and to the right.
export function pileOffsets(count: number, size: number): { x: number; y: number }[] {
    const shape = cubeShape(size)
    return Array.from({ length: Math.min(count, 4) }, (_, index) => {
        const column = Math.floor(index / 2)
        const level = index % 2
        return {
            x: column * shape.across.x,
            y: column * shape.across.y - level * shape.rise
        }
    })
}
