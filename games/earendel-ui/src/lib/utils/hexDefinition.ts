import {
    type AxialCoordinates,
    calculateHexGeometry,
    type HexDefinition,
    type HexGeometry,
    HexOrientation
} from '@tabletop/common'

// Must match the engine's BOARD_ORIENTATION, which its neighbour maths depends on.
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
