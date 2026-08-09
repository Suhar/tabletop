import {
    type AxialCoordinates,
    calculateHexGeometry,
    type HexDefinition,
    type HexGeometry,
    HexOrientation
} from '@tabletop/common'

// Flat-topped hexes, matching BOARD_ORIENTATION in the engine. The engine's neighbour maths
// depends on the orientation, so these two must agree or the board draws in a shape the
// rules don't believe in.
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
