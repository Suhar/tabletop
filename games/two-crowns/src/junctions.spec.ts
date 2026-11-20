import { describe, expect, it } from 'vitest'
import {
    createCityTileFace,
    keepsExits,
    rotateTileFace,
    tileExits,
    tileUpgradeMappings,
    type TileRotation
} from '@tabletop/18xx'
import { TwoCrownsTiles } from './tiles.js'
import { TwoCrownsTrackRules, preservesTwoCrownsStops } from './trackRules.js'

const tile = (id: string) => TwoCrownsTiles.find((item) => item.id === `two-crowns:${id}`)!.face
// A green junction city: one two-slot city on four edges.
const greenJunction = createCityTileFace('green', [0, 1, 3, 4], 20, 2)

describe('1874 junction and gray tiles', () => {
    it('splits a green junction into the brown J tile’s two cities, rebuilding the hex', () => {
        const brown = tile('J1')
        expect(preservesTwoCrownsStops(greenJunction, brown)).toBe(true)
        // As in 1894, the split keeps the exits but not the track, and sets the stations aside.
        expect(TwoCrownsTrackRules.reconfigures!('H12', greenJunction, brown)).toBe(true)
        expect(tileUpgradeMappings(greenJunction, brown)).toHaveLength(0)
        expect(TwoCrownsTrackRules.sharesFullCities).toBe(true)
    })
    it('offers the three ways to pair the green tile’s four edges', () => {
        const split = TwoCrownsTiles.filter((item) => item.face.labels?.includes('J'))
        const fitting = split.filter((item) => keepsExits(greenJunction, item.face))
        expect(fitting.map((item) => item.printedNumber)).toEqual(['J1', 'J6', 'J7'])
    })
    it('joins a brown junction back into one gray city, keeping its stations', () => {
        const gray = tile('G1')
        expect(preservesTwoCrownsStops(tile('J1'), gray)).toBe(true)
        expect(TwoCrownsTrackRules.reconfigures!('H12', tile('J1'), gray)).toBe(false)
        expect(tileUpgradeMappings(tile('J1'), gray).length).toBeGreaterThan(0)
    })
    it('lets J hexes take plain tiles before their label applies', () => {
        const relabels = TwoCrownsTrackRules.relabels!
        // Ogulin (J): plain yellow and plain green, then a brown J tile.
        expect(relabels('H12', '18xx:6')).toBe(true)
        expect(relabels('H12', 'two-crowns:C1')).toBe(true)
        expect(relabels('H12', 'two-crowns:5X')).toBe(false)
    })
    it('fits Pula’s three open edges in green and brown', () => {
        // Rovinj, D14 and Ancona: Pula's edges in a row (0.12.0 and later).
        const open = [2, 3, 4]
        const fits = (id: string) =>
            ([0, 1, 2, 3, 4, 5] as TileRotation[]).filter((rotation) =>
                [...tileExits(rotateTileFace(tile(id), rotation))].every((edge) =>
                    open.includes(edge)
                )
            )
        expect(fits('X2')).toEqual([])
        const [rotation] = fits('X3')
        expect(rotation).toBeDefined()
        const green = rotateTileFace(tile('X3'), rotation!)
        expect(keepsExits(green, rotateTileFace(tile('P1'), rotation!))).toBe(true)
    })
})
