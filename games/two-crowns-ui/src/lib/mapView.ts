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
import ISTToken from './images/tokens/IST.svg'
import ZAGToken from './images/tokens/ZAG.svg'
import POSToken from './images/tokens/POS.svg'
import SLAToken from './images/tokens/SLA.svg'
import LIKToken from './images/tokens/LIK.svg'
import PODToken from './images/tokens/POD.svg'
import KARToken from './images/tokens/KAR.svg'
import SPLToken from './images/tokens/SPL.svg'
import KBToken from './images/tokens/KB.svg'
import SBToken from './images/tokens/SB.svg'
import MBToken from './images/tokens/MB.svg'
import PBToken from './images/tokens/PB.svg'
import NBToken from './images/tokens/NB.svg'
import LUKAToken from './images/tokens/LUKA.svg'

// 18xx Maker's pink, as for the companies (see import-maker.mjs).
const LukaColor = '#ec6280'

// The tokens as 18xx Maker draws them, by label; see images/tokens/README.md.
const MakerTokens: Readonly<Record<string, string>> = {
    IST: ISTToken,
    ZAG: ZAGToken,
    POS: POSToken,
    SLA: SLAToken,
    LIK: LIKToken,
    POD: PODToken,
    KAR: KARToken,
    SPL: SPLToken,
    KB: KBToken,
    SB: SBToken,
    MB: MBToken,
    PB: PBToken,
    NB: NBToken,
    LUKA: LUKAToken
}

function station(id: string, label: string, color: string): [string, StationAppearance] {
    const imageUrl = MakerTokens[label === 'Luka' ? 'LUKA' : label]
    return [id, imageUrl ? { color, label, imageUrl } : { color, label }]
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

/**
 * Two stations sharing a junction city's one space (1894 §7.3.8) stand as a two-space city, placed
 * as on the 1894 split tile with the same branches (J8 is X19 with its cities numbered the other
 * way round).
 */
const sharedCity = (nodeId: string, edge: number, distance: number, turn: number) => ({
    [nodeId]: {
        nodePositions: { [nodeId]: towardTileEdge(edge, distance) },
        slotRowTurns: { [nodeId]: turn }
    }
})
export const TwoCrownsSharedCityLayouts: Readonly<
    Record<string, Readonly<Record<string, TileLayout>>>
> = {
    'two-crowns:J1': { ...sharedCity('city-0', 1, 16.5, 60), ...sharedCity('city-1', 3, 16.5, 0) },
    'two-crowns:J2': { ...sharedCity('city-0', 0, 16.5, 0), ...sharedCity('city-1', 3, 16.5, 0) },
    'two-crowns:J3': {
        ...sharedCity('city-0', 5, 13.5, 120),
        ...sharedCity('city-1', 2, 25.5, 120)
    },
    'two-crowns:J4': { ...sharedCity('city-0', 0, 16, 0), ...sharedCity('city-1', 2, 20.5, 120) },
    'two-crowns:J5': { ...sharedCity('city-0', 0, 16, 0), ...sharedCity('city-1', 4, 20.5, 60) },
    'two-crowns:J6': { ...sharedCity('city-0', 0, 25.5, 0), ...sharedCity('city-1', 4, 25.5, 60) },
    'two-crowns:J7': {
        ...sharedCity('city-0', 2, 21.5, 120),
        ...sharedCity('city-1', 5, 21.5, 120)
    },
    'two-crowns:J8': { ...sharedCity('city-0', 5, 20, 120), ...sharedCity('city-1', 4, 20, 60) },
    'two-crowns:J9': { ...sharedCity('city-0', 0, 19.5, 0), ...sharedCity('city-1', 4, 25.5, 60) }
}

/**
 * On junctions whose tracks cross, the branch positions crowd the cities, which then shrink; these
 * stand far enough along their tracks to keep full size, as on the 1894 split tile with the same
 * branches (J6 is X16; J8 is X19 with its cities numbered the other way round).
 */
const CrossingJunctionLayouts: Readonly<Record<string, TileLayout>> = {
    'two-crowns:J6': {
        nodePositions: { 'city-0': { x: 0, y: 26.8 }, 'city-1': { x: 23.2, y: -13.4 } }
    },
    'two-crowns:J8': {
        nodePositions: { 'city-0': { x: -2.2, y: 25.4 }, 'city-1': { x: -2.2, y: -25.4 } }
    }
}

export const TwoCrownsTileLayouts: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    ...JunctionLayouts,
    ...CrossingJunctionLayouts
}

export const TwoCrownsMapView: MapViewDefinition = {
    // The market above Ljubljana, at TOP's market scale, its empty staircase over the map's
    // northern hexes; the tranches below it, west of Trieste; the depot in the empty south-east.
    boardAreas: {
        market: { x: -90, y: -175, width: 817, height: 443 },
        panel: { x: -103, y: 268, width: 115, height: 213 },
        depot: { x: 1260, y: 750, width: 310, height: 330 }
    },
    map: TwoCrownsMap,
    tileSet: TwoCrownsTileSet,
    layouts: TwoCrownsTileLayouts,
    sharedCityLayouts: TwoCrownsSharedCityLayouts,
    stations: Object.fromEntries([
        ...TwoCrownsLukaCompanies.map((company) =>
            station(company.companyId, company.companyId, company.color)
        ),
        ...TwoCrownsBranchCompanies.map((branch) => station(branch.id, branch.label, branch.color)),
        station('LUKA', 'Luka', LukaColor)
    ])
}
