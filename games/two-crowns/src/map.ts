import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '@tabletop/18xx'
import { TwoCrownsTitle } from './generated/data.js'
import { twoCrownsLocations } from './generated/map.js'

export const TwoCrownsMap = new RailwayMap({
    id: 'two-crowns:prototype',
    name: TwoCrownsTitle.name,
    orientation: HexOrientation.Flat,
    locations: twoCrownsLocations({})
})
