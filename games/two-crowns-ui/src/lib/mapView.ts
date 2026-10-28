import type { TileDefinition } from '@tabletop/18xx'
import {
    TwoCrownsBranchCompanies,
    TwoCrownsLukaCompanies,
    TwoCrownsMap,
    TwoCrownsTileSet
} from '@tabletop/two-crowns'
import {
    StandardTileLayouts,
    towardTileEdge,
    type MapViewDefinition,
    type StationAppearance,
    type TileLayout
} from '@tabletop/18xx-ui'

const LukaColor = '#f08fb5'

function station(id: string, label: string, color: string): [string, StationAppearance] {
    return [id, { color, label }]
}

function cityEdges(tile: TileDefinition, nodeId: string): number[] {
    return tile.face.paths.flatMap((path) =>
        path.endpoints.some((end) => end.kind === 'node' && end.nodeId === nodeId)
            ? path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
            : []
    )
}

// A junction city sits on its own branch: at the bend of a curve, or off-centre along a straight.
function branchPosition(edges: readonly number[]) {
    const [a, b] = edges
    const gap = (b - a + 6) % 6
    if (gap === 3) return towardTileEdge(a, 18)
    const shorter = gap < 3 ? gap : 6 - gap
    const middle = gap < 3 ? a + gap / 2 : b + shorter / 2
    return towardTileEdge(middle % 6, shorter === 1 ? 30 : 18)
}

const JunctionLayouts: Readonly<Record<string, TileLayout>> = Object.fromEntries(
    TwoCrownsTileSet.definitions
        .filter((tile) => tile.face.nodes.filter((node) => node.kind === 'city').length > 1)
        .map((tile) => [
            tile.id,
            {
                nodePositions: Object.fromEntries(
                    tile.face.nodes.map((node) => [
                        node.id,
                        branchPosition(cityEdges(tile, node.id))
                    ])
                )
            }
        ])
)

export const TwoCrownsTileLayouts: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    ...JunctionLayouts
}

export const TwoCrownsMapView: MapViewDefinition = {
    map: TwoCrownsMap,
    tileSet: TwoCrownsTileSet,
    layouts: TwoCrownsTileLayouts,
    stations: Object.fromEntries([
        ...TwoCrownsLukaCompanies.map((company) =>
            station(company.companyId, company.companyId, company.color)
        ),
        ...TwoCrownsBranchCompanies.map((branch) => station(branch.id, branch.label, branch.color)),
        station('LUKA', 'Luka', LukaColor)
    ])
}
