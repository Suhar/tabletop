import type { Point } from '@tabletop/common'

// Shared by the station node and the truss girders between stations: the girder has to start
// exactly where the core it plugs into ends, so both read the core's size from here.

export function stationCoreRadius(hub: boolean): number {
    return hub ? 19 : 16
}

// Where a girder between two linked stations meets each core. The core is an octagon, so the
// girder is tucked a little inside its circumradius to land on a face rather than float off it.
export function trussEnds(
    from: Point,
    to: Point,
    fromHub: boolean,
    toHub: boolean
): { start: Point; end: Point } {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    const startInset = stationCoreRadius(fromHub) - 2
    const endInset = stationCoreRadius(toHub) - 2

    return {
        start: { x: from.x + ux * startInset, y: from.y + uy * startInset },
        end: { x: to.x - ux * endInset, y: to.y - uy * endInset }
    }
}

// A girder: two rails either side of the line, with lacing zig-zagging between them. Returned as
// SVG path data - rails first, lacing second - so the caller can stroke them differently.
export function trussPaths(start: Point, end: Point): { rails: string; lacing: string } {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    // The normal, for offsetting the rails to either side.
    const nx = -uy
    const ny = ux
    const half = 4

    const at = (t: number, side: number) =>
        `${start.x + ux * t + nx * side},${start.y + uy * t + ny * side}`

    const rails = `M${at(0, half)} L${at(length, half)} M${at(0, -half)} L${at(length, -half)}`

    const steps = Math.max(2, Math.round(length / 7))
    let lacing = `M${at(0, half)}`
    for (let i = 1; i <= steps; i++) {
        lacing += ` L${at((length * i) / steps, i % 2 === 0 ? half : -half)}`
    }

    return { rails, lacing }
}
