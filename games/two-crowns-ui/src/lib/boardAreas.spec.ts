import { describe, expect, it } from 'vitest'
import {
    assertExists,
    calculateHexGeometry,
    HexOrientation,
    type BoundingBox
} from '@tabletop/common'
import { TwoCrownsMarket } from '@tabletop/two-crowns'
import { MarketScenePadding, marketGeometry } from '@tabletop/18xx-ui'
import { TwoCrownsMapView } from './mapView.js'
import { TwoCrownsPresentation } from './presentation.js'

describe('1874 board', () => {
    it('keeps every drawn market cell, the tranches and the depot clear of every hex and each other', () => {
        const areas = TwoCrownsMapView.boardAreas
        // A flat hex of radius 50 reaches 50 across and 43.3 up and down from its centre.
        const hexes = TwoCrownsMapView.map.definition.locations.map(
            (location) =>
                calculateHexGeometry(
                    { orientation: HexOrientation.Flat, dimensions: { radius: 50 } },
                    location.coordinates
                ).center
        )
        const clear = ({ x, y, width, height }: BoundingBox) =>
            hexes.every(
                (hex) =>
                    x + width < hex.x - 62 ||
                    x > hex.x + 62 ||
                    y + height < hex.y - 55.3 ||
                    y > hex.y + 55.3
            )
        const apart = (first: BoundingBox, second: BoundingBox) =>
            first.x + first.width < second.x ||
            first.x > second.x + second.width ||
            first.y + first.height < second.y ||
            first.y > second.y + second.height
        const geometry = marketGeometry(
            TwoCrownsMarket,
            TwoCrownsPresentation.marketCell,
            TwoCrownsPresentation.marketZones
        )
        const width = 2 * MarketScenePadding + geometry.width
        const height = 2 * MarketScenePadding + geometry.height
        const area = areas?.market
        const depot = areas?.depot
        const tranches = areas?.panel
        assertExists(area, 'The board has a market area')
        assertExists(depot, 'The board has a depot area')
        assertExists(tranches, 'The board has a tranche panel')
        const scale = Math.min(area.width / width, area.height / height)
        const left = area.x + (area.width - width * scale) / 2
        for (const space of TwoCrownsMarket.spaces) {
            const cell = {
                x: left + (MarketScenePadding + geometry.columnLefts[space.column]) * scale,
                y: area.y + (MarketScenePadding + space.row * geometry.cell.height) * scale,
                width: geometry.cell.width * scale,
                height: geometry.cell.height * scale
            }
            expect(clear(cell)).toBe(true)
            expect(apart(cell, depot)).toBe(true)
            expect(apart(cell, tranches)).toBe(true)
        }
        expect(clear(depot)).toBe(true)
        expect(clear(tranches)).toBe(true)
        expect(apart(depot, tranches)).toBe(true)
    })
})
