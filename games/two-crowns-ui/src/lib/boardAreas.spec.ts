import { describe, expect, it } from 'vitest'
import { assertExists, calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { TwoCrownsMarket } from '@tabletop/two-crowns'
import { MarketScenePadding, marketGeometry } from '@tabletop/18xx-ui'
import { TwoCrownsMapView } from './mapView.js'
import { TwoCrownsPresentation } from './presentation.js'

describe('1874 board', () => {
    it('keeps the market, its tranche corner and the depot clear of every hex and each other', () => {
        const areas = TwoCrownsMapView.boardAreas
        // A flat hex of radius 50 reaches 50 across and 43.3 up and down from its centre.
        const hexes = TwoCrownsMapView.map.definition.locations.map(
            (location) =>
                calculateHexGeometry(
                    { orientation: HexOrientation.Flat, dimensions: { radius: 50 } },
                    location.coordinates
                ).center
        )
        const clear = (x: number, y: number, width: number, height: number) =>
            hexes.every(
                (hex) =>
                    x + width < hex.x - 62 ||
                    x > hex.x + 62 ||
                    y + height < hex.y - 55.3 ||
                    y > hex.y + 55.3
            )
        const geometry = marketGeometry(
            TwoCrownsMarket,
            TwoCrownsPresentation.marketCell,
            TwoCrownsPresentation.marketZones
        )
        const width = 2 * MarketScenePadding + geometry.width
        const height = 2 * MarketScenePadding + geometry.height
        const area = areas?.market
        const depot = areas?.depot
        assertExists(area, 'The board has a market area')
        assertExists(depot, 'The board has a depot area')
        const scale = Math.min(area.width / width, area.height / height)
        const left = area.x + (area.width - width * scale) / 2
        // The whole market area below its margin, as the tranches fill its empty lower right.
        expect(clear(area.x, area.y + 20, area.width, area.height - 20)).toBe(true)
        for (const space of TwoCrownsMarket.spaces) {
            const x = left + (MarketScenePadding + geometry.columnLefts[space.column]) * scale
            const y = area.y + (MarketScenePadding + space.row * geometry.cell.height) * scale
            const cellWidth = geometry.cell.width * scale
            const cellHeight = geometry.cell.height * scale
            expect(
                x + cellWidth < depot.x ||
                    x > depot.x + depot.width ||
                    y + cellHeight < depot.y ||
                    y > depot.y + depot.height
            ).toBe(true)
        }
        expect(clear(depot.x, depot.y + 20, depot.width, depot.height - 20)).toBe(true)
    })
})
