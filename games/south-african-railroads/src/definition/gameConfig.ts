import * as Type from 'typebox'
import { ConfigOptionType, type GameConfigOptions } from '@tabletop/common'
import { MapId } from '../maps/types.js'

export type SarGameConfig = Type.Static<typeof SarGameConfig>
export const SarGameConfig = Type.Object({
    map: Type.Optional(Type.Enum(MapId))
})

export const SarGameConfigOptions: GameConfigOptions = [
    {
        id: 'map',
        type: ConfigOptionType.List,
        name: 'Map',
        description: 'Which map to play on',
        default: MapId.SouthAfrica,
        options: [
            { name: 'South Africa', value: MapId.SouthAfrica },
            { name: 'Texas Special', value: MapId.TexasSpecial }
        ],
        alwaysShow: true
    }
]
