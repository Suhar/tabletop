import type { AxialCoordinates } from '@tabletop/common'
import { hexGeometry } from './hexDefinition.js'

// The edges of a region of hexes, as two SVG paths: the edges two of its hexes share, and the
// edges on its outside. Drawn as lines above the tiles, no hex's own outline can cover another's.
export function regionEdges(region: readonly AxialCoordinates[]): { inner: string; outer: string } {
    const edges = new Map<string, { d: string; count: number }>()
    const seen = new Set<string>()
    const at = (point: { x: number; y: number }) => `${Math.round(point.x)},${Math.round(point.y)}`

    for (const coords of region) {
        const hex = `${coords.q},${coords.r}`
        if (seen.has(hex)) continue
        seen.add(hex)
        const { vertices } = hexGeometry(coords)
        vertices.forEach((start, index) => {
            const end = vertices[(index + 1) % vertices.length]
            const key = [at(start), at(end)].sort().join(' ')
            const edge = edges.get(key)
            if (edge) edge.count += 1
            else edges.set(key, { d: `M${start.x},${start.y} L${end.x},${end.y}`, count: 1 })
        })
    }

    const all = [...edges.values()]
    return {
        inner: all
            .filter((edge) => edge.count > 1)
            .map((edge) => edge.d)
            .join(' '),
        outer: all
            .filter((edge) => edge.count === 1)
            .map((edge) => edge.d)
            .join(' ')
    }
}
