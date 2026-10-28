import { describe, expect, it } from 'vitest'
import { TwoCrownsCompanies } from './companies.js'
import { TwoCrownsMap } from './map.js'
import { privatesForPlayerCount } from './privates.js'
import { TwoCrownsMarket } from './stockMarket.js'
import { TwoCrownsTileSet } from './tiles.js'
import { TwoCrownsTrainDepot } from './trains.js'

describe('The Two Crowns imported from 18xx Maker', () => {
    it('gives every Luka company one reserved home', () => {
        for (const company of TwoCrownsCompanies)
            expect(TwoCrownsMap.reservedLocationIds(company.companyId)).toHaveLength(1)
    })

    it('counts the tileable hexes of the trimmed map', () => {
        const buildable = TwoCrownsMap.definition.locations.filter((location) => location.buildable)
        expect(buildable).toHaveLength(99)
    })

    it('labels the X, junction and edge cities for their upgrades', () => {
        const labels = (id: string) => TwoCrownsMap.location(id).upgradeLabels
        expect(labels('I11')).toEqual([
            { color: 'yellow', label: 'X' },
            { color: 'gray', label: 'CX' }
        ])
        expect(labels('H12')).toEqual([{ color: 'brown', label: 'J' }])
        expect(labels('G15')).toEqual([{ color: 'green', label: 'S' }])
    })

    it('resolves every tile in the manifest', () => {
        expect(TwoCrownsTileSet.definitions.length).toBeGreaterThan(70)
        expect(TwoCrownsTileSet.definitions.map((tile) => tile.id)).toContain('two-crowns:J9')
    })

    it('deals the 1874 privates by player count', () => {
        expect(privatesForPlayerCount(3)).not.toContain('P14')
        expect(privatesForPlayerCount(3)).toContain('P6')
        expect(privatesForPlayerCount(4)).toContain('P14')
        expect(privatesForPlayerCount(4)).not.toContain('P6')
    })

    it('reads the market and trains', () => {
        expect(TwoCrownsMarket.space('1:1').price).toBe(92)
        expect(TwoCrownsMarket.space('2:1').price).toBe(86)
        expect(TwoCrownsTrainDepot.trainDefinition('6H').price).toBe(180)
    })
})
