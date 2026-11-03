import { describe, expect, it } from 'vitest'
import { createCityTileFace, tileUpgradeMappings } from '@tabletop/18xx'
import { TwoCrownsTiles } from './tiles.js'
import { TwoCrownsTrackRules, preservesTwoCrownsStops } from './trackRules.js'

const tile = (id: string) => TwoCrownsTiles.find((item) => item.id === `two-crowns:${id}`)!.face
// A green junction city: one two-slot city on four edges.
const greenJunction = createCityTileFace('green', [0, 1, 3, 4], 20, 2)

describe('1874 junction and gray tiles', () => {
    it('splits a green junction into the brown J tile’s two cities', () => {
        const brown = tile('J1')
        expect(preservesTwoCrownsStops(greenJunction, brown)).toBe(true)
        // Either city may take the old city's first station, so the upgrader has a choice.
        expect(tileUpgradeMappings(greenJunction, brown)).toHaveLength(2)
    })
    it('offers the three ways to pair the green tile’s four edges', () => {
        const split = TwoCrownsTiles.filter((item) => item.face.labels?.includes('J'))
        const fitting = split.filter(
            (item) => tileUpgradeMappings(greenJunction, item.face).length > 0
        )
        expect(fitting.map((item) => item.printedNumber)).toEqual(['J1', 'J6', 'J7'])
    })
    it('joins a brown junction back into one gray city', () => {
        const gray = tile('G1')
        expect(preservesTwoCrownsStops(tile('J1'), gray)).toBe(true)
        expect(tileUpgradeMappings(tile('J1'), gray).length).toBeGreaterThan(0)
    })
    it('lets J and S hexes take plain tiles before their label applies', () => {
        const relabels = TwoCrownsTrackRules.relabels!
        // Ogulin (J) and Senj (S): plain yellow; Ogulin plain green; Senj's green must be S.
        expect(relabels('H12', '18xx:6')).toBe(true)
        expect(relabels('H12', 'two-crowns:C1')).toBe(true)
        expect(relabels('K23', '18xx:5')).toBe(true)
        expect(relabels('K23', 'two-crowns:C1')).toBe(false)
        expect(relabels('H12', 'two-crowns:5X')).toBe(false)
    })
})
