import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '@tabletop/18xx'
import { TwoCrownsTitle } from './generated/data.js'
import { TwoCrownsLocationNames, twoCrownsLocations } from './generated/map.js'

// Rude Mines (1874design.md, Map) works as 1871's Malpeque Shipyard: a city on routes that takes
// no stations. The importer gives it no station slots; the marker says why.
const RudeMinesId = Object.entries(TwoCrownsLocationNames).find(
    ([, name]) => name === 'Rude Mines'
)?.[0]

export const TwoCrownsMap = new RailwayMap({
    id: 'two-crowns:prototype',
    name: TwoCrownsTitle.name,
    orientation: HexOrientation.Flat,
    locations: twoCrownsLocations(
        RudeMinesId
            ? {
                  [RudeMinesId]: [
                      {
                          id: 'rude-mines',
                          label: 'Mines',
                          description:
                              'Counts as a city for routes; station tokens cannot be placed here.'
                      }
                  ]
              }
            : {}
    )
})
