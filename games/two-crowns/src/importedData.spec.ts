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

    it('counts the tileable hexes of the 0.9.0 map', () => {
        const buildable = TwoCrownsMap.definition.locations.filter((location) => location.buildable)
        expect(buildable).toHaveLength(84)
    })

    it('labels the X and junction cities for their upgrades', () => {
        const labels = (id: string) => TwoCrownsMap.location(id).upgradeLabels
        expect(labels('I11')).toEqual([
            { color: 'yellow', label: 'X' },
            { color: 'gray', label: 'CX' }
        ])
        expect(labels('H12')).toEqual([{ color: 'brown', label: 'J' }])
        // Šibenik and Knin are plain cities since 0.9.0.
        expect(labels('K21')).toBeUndefined()
        expect(labels('L18')).toBeUndefined()
    })

    it('imports the 1871-style map features of 0.9.0', () => {
        const face = (id: string) => TwoCrownsMap.location(id).preprintedTile
        // Rude Mines, as Malpeque Shipyard: a city on routes with no station slots.
        const mines = face('G7').nodes[0]
        expect(mines.kind).toBe('city')
        expect(mines.kind === 'city' && mines.stationSlots).toBe(0)
        // Port stubs are dead-end towns on one edge.
        for (const id of ['M1', 'J20', 'M19', 'P12']) {
            expect(face(id).nodes.map((node) => node.kind)).toEqual(['town'])
            expect(face(id).paths).toHaveLength(1)
        }
        // Gospić is printed yellow with its X label and stays the Lika company's home.
        expect(face('I15').color).toBe('yellow')
        expect(face('I15').labels).toEqual(['X'])
        expect(TwoCrownsMap.reservedLocationIds('LIK')).toEqual(['I15'])
    })

    it('resolves every tile in the manifest', () => {
        expect(TwoCrownsTileSet.definitions.length).toBeGreaterThan(70)
        expect(TwoCrownsTileSet.definitions.map((tile) => tile.id)).toContain('two-crowns:J9')
    })

    it('deals the 1874 privates by player count', () => {
        // All 16 privates at every count; P6 was cut (1874design.md, Private companies).
        for (const count of [3, 4, 5]) {
            expect(privatesForPlayerCount(count)).toHaveLength(17)
            expect(privatesForPlayerCount(count)).toContain('P14')
            expect(privatesForPlayerCount(count)).not.toContain('P6')
        }
    })

    it('reads the market and trains', () => {
        expect(TwoCrownsMarket.space('1:1').price).toBe(92)
        expect(TwoCrownsMarket.space('2:1').price).toBe(86)
        expect(TwoCrownsTrainDepot.trainDefinition('6H').price).toBe(180)
    })
})
