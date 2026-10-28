import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace,
    type TileDefinition,
    type TileManifestEntry,
    type TileEdge
} from '@tabletop/18xx'
import {
    TwoCrownsSharedTileCounts,
    TwoCrownsSpecialTileCounts,
    TwoCrownsSpecialTiles
} from './generated/tiles.js'

// 18xx Maker lays plain 5 and 6 on X cities; here a yellow X city needs an X-labelled curve.
const YellowXTiles = [yellowCity('5X', [0, 1]), yellowCity('6X', [0, 2])]
const YellowXTileCounts: Readonly<Record<string, TileManifestEntry['count']>> = {
    '5X': 'unlimited',
    '6X': 'unlimited'
}

export const TwoCrownsTileSet = new TileSet(
    {
        id: 'two-crowns:prototype',
        entries: [
            ...Object.entries(TwoCrownsSharedTileCounts).map<TileManifestEntry>(
                ([number, count]) => ({ id: number, faceDefinitionIds: [`18xx:${number}`], count })
            ),
            ...Object.entries({ ...YellowXTileCounts, ...TwoCrownsSpecialTileCounts }).map(
                ([number, count]) => ({
                    id: number,
                    faceDefinitionIds: [`two-crowns:${number}`],
                    count
                })
            )
        ]
    },
    [StandardTileCatalog, new TileCatalog([...YellowXTiles, ...TwoCrownsSpecialTiles])]
)

export const TwoCrownsTiles = TwoCrownsTileSet.definitions

function yellowCity(printedNumber: string, edges: readonly TileEdge[]): TileDefinition {
    return {
        id: `two-crowns:${printedNumber}`,
        printedNumber,
        aliases: [],
        scope: 'The Two Crowns 1874',
        face: createCityTileFace('yellow', edges, 20, 1, ['X'])
    }
}
