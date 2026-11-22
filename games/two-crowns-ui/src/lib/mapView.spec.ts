import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { LukaHomes } from './lukaHomes.js'
import { TwoCrownsMapView, TwoCrownsTileLayouts } from './mapView.js'

describe('1874 map view', () => {
    it('labels each Luka station with the company whose home it holds', () => {
        const printed = TwoCrownsMapView.locationStations?.LUKA
        expect(LukaHomes.map(({ locationId }) => printed?.[locationId]?.label)).toEqual(
            LukaHomes.map((home) => home.companyId)
        )
    })

    it('keeps J9’s curve city off the straight line', () => {
        const positions = TwoCrownsTileLayouts['two-crowns:J9']?.nodePositions
        assertExists(positions, 'J9 places its cities')
        expect(positions['city-0']?.x).toBe(0)
        expect(Math.abs(positions['city-1']?.x ?? 0)).toBeGreaterThan(18.8)
    })
})
