import {
    type AxialCoordinates,
    calculateHexGeometry,
    type HexDefinition,
    type HexGeometry,
    HexOrientation
} from '@tabletop/common'

// Must match the engine's BOARD_ORIENTATION, which its neighbor math depends on.
export const EarendelHexDefinition: HexDefinition = {
    orientation: HexOrientation.Flat,
    dimensions: { width: 100, height: 87 }
}

export function hexGeometry(coords: AxialCoordinates): HexGeometry {
    return calculateHexGeometry(EarendelHexDefinition, coords)
}

export function verticesToPoints(geometry: HexGeometry): string {
    return geometry.vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(' ')
}

// The hex's outline drawn a little inside it, so a neighbor drawn later cannot paint over half
// of the line.
export function insetPoints(coords: AxialCoordinates, inset: number): string {
    const { center, vertices } = hexGeometry(coords)
    return vertices
        .map((vertex) => {
            const dx = vertex.x - center.x
            const dy = vertex.y - center.y
            const scale = (Math.hypot(dx, dy) - inset) / Math.hypot(dx, dy)
            return `${center.x + dx * scale},${center.y + dy * scale}`
        })
        .join(' ')
}
