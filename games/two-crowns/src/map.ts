import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '@tabletop/18xx'
import { TwoCrownsTitle } from './generated/data.js'
import { TwoCrownsLocationNames, twoCrownsLocations } from './generated/map.js'

const locationNamed = (name: string) =>
    Object.entries(TwoCrownsLocationNames).find(([, value]) => value === name)?.[0]

// Rude Mines (1874design.md, Map) works as 1871's Malpeque Shipyard: a city on routes that takes
// no stations. The importer gives it no station slots; the marker says why.
const RudeMinesId = locationNamed('Rude Mines')

// The Station Rights block their cities while a player owns them (privates.ts); the map marks each
// city, as 1830 marks its privates' hexes, and drops the mark once the block lifts.
const StationRightsMarkers = Object.fromEntries(
    [
        ['P3', 'Zadar'],
        ['P4', 'Virovitica']
    ].flatMap(([privateCompanyId, city]) => {
        const locationId = locationNamed(city)
        return locationId
            ? [
                  [
                      locationId,
                      [
                          {
                              id: `blocks-${privateCompanyId}`,
                              label: privateCompanyId,
                              privateCompanyId,
                              description: `No track while a player owns ${city} Station Rights.`
                          }
                      ]
                  ]
              ]
            : []
    })
)

export const TwoCrownsMap = new RailwayMap({
    id: 'two-crowns:prototype',
    name: TwoCrownsTitle.name,
    orientation: HexOrientation.Flat,
    locations: twoCrownsLocations({
        ...StationRightsMarkers,
        ...(RudeMinesId
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
            : {})
    })
})
