import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import { HexKind, hexKey, neighborsOf } from '../model/board.js'
import { TILE_HEX_OFFSETS } from '../model/tile.js'
import {
    buildStartingBoard,
    MIN_PARTNER_GAP,
    PLANETS_PER_TILE,
    startingTilePlacements,
    TILES_PER_PLAYER
} from './boardSetup.js'
import { tileFootprint } from './tilePlacement.js'

describe('startingTilePlacements', () => {
    const footprints = (playerCount: number, seed: number) =>
        startingTilePlacements(
            playerCount * TILES_PER_PLAYER,
            new Prng({ seed, invocations: 0 })
        ).map((placement) => tileFootprint(placement.origin, placement.rotation))

    it('lays the right number of tiles per player, without overlapping', () => {
        for (const playerCount of [2, 3, 4, 5]) {
            const tiles = footprints(playerCount, playerCount)
            expect(tiles).toHaveLength(playerCount * TILES_PER_PLAYER)

            const hexes = new Set(tiles.flat().map(hexKey))
            expect(hexes.size).toBe(playerCount * TILES_PER_PLAYER * TILE_HEX_OFFSETS.length)
        }
    })

    it('grows one connected cluster with no hex closed in on every side', () => {
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const hexes = footprints(4, seed).flat()
            const onBoard = new Set(hexes.map(hexKey))

            // Every tile after the first touches the tiles laid before it.
            const tiles = footprints(4, seed)
            const laid = new Set(tiles[0].map(hexKey))
            for (const tile of tiles.slice(1)) {
                expect(
                    tile.some((coords) =>
                        neighborsOf(coords).some((neighbor) => laid.has(hexKey(neighbor)))
                    )
                ).toBe(true)
                for (const coords of tile) laid.add(hexKey(coords))
            }

            const holes = hexes
                .flatMap((coords) => neighborsOf(coords))
                .filter((coords) => !onBoard.has(hexKey(coords)))
                .filter((coords) =>
                    neighborsOf(coords).every((neighbor) => onBoard.has(hexKey(neighbor)))
                )
            expect(holes, `seed ${seed}`).toEqual([])
        }
    })

    it('differs from seed to seed', () => {
        const layout = (seed: number) =>
            footprints(3, seed)
                .flat()
                .map(hexKey)
                .sort((a, b) => a - b)
                .join(',')
        expect(new Set([1, 2, 3, 4].map(layout)).size).toBeGreaterThan(1)
    })
})

describe('planet colours', () => {
    const hexSteps = (a: { q: number; r: number }, b: { q: number; r: number }) =>
        (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2

    const planetsByColour = (playerCount: number, seed: number) => {
        const board = buildStartingBoard(playerCount, new Prng({ seed, invocations: 0 }))
        const byColour = new Map<string, { q: number; r: number }[]>()
        for (const hex of Object.values(board.hexes)) {
            if (hex.kind !== HexKind.Planet || !hex.color) continue
            byColour.set(hex.color, [...(byColour.get(hex.color) ?? []), hex.coords])
        }
        return byColour
    }

    it('deals every colour equally often, give or take one', () => {
        for (const playerCount of [2, 3, 4, 5]) {
            for (const seed of [1, 2, 3]) {
                const counts = [...planetsByColour(playerCount, seed).values()].map(
                    (planets) => planets.length
                )
                const total = playerCount * TILES_PER_PLAYER * PLANETS_PER_TILE
                expect(counts.reduce((sum, count) => sum + count, 0)).toBe(total)
                expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
                // With at least five planets, every colour is on the board.
                expect(counts).toHaveLength(Math.min(5, total))
            }
        }
    })

    it('keeps planets of one colour at least three hexes apart', () => {
        for (const playerCount of [2, 3, 4, 5]) {
            for (const seed of [1, 2, 3, 4, 5]) {
                for (const planets of planetsByColour(playerCount, seed).values()) {
                    for (let i = 0; i < planets.length; i++) {
                        for (let j = i + 1; j < planets.length; j++) {
                            expect(
                                hexSteps(planets[i], planets[j]),
                                `${playerCount} players, seed ${seed}`
                            ).toBeGreaterThanOrEqual(MIN_PARTNER_GAP)
                        }
                    }
                }
            }
        }
    })
})

describe('buildStartingBoard', () => {
    it('gives every tile its planets and fills the rest with open space', () => {
        const board = buildStartingBoard(4, new Prng({ seed: 7, invocations: 0 }))

        const byTile = new Map<string, HexKind[]>()
        for (const hex of Object.values(board.hexes)) {
            byTile.set(hex.tileId, [...(byTile.get(hex.tileId) ?? []), hex.kind])
        }

        expect(byTile.size).toBe(4 * TILES_PER_PLAYER)
        for (const kinds of byTile.values()) {
            expect(kinds).toHaveLength(TILE_HEX_OFFSETS.length)
            expect(kinds.filter((kind) => kind === HexKind.Planet)).toHaveLength(PLANETS_PER_TILE)
        }
    })

    it('varies which hexes are planets from tile to tile', () => {
        // The layout is drawn per tile rather than fixed, so across a whole board at least
        // two different arrangements should show up. (Identical draws are possible, but a
        // run of identical ones across a board this size would mean no shuffle happened.)
        const board = buildStartingBoard(4, new Prng({ seed: 3, invocations: 0 }))

        const layouts = new Set<string>()
        const byTile = new Map<string, string[]>()
        for (const hex of Object.values(board.hexes)) {
            byTile.set(hex.tileId, [
                ...(byTile.get(hex.tileId) ?? []),
                `${hex.coords.q},${hex.coords.r}:${hex.kind}`
            ])
        }
        for (const [tileId, entries] of byTile) {
            const origin = entries
                .map((entry) => entry.split(':')[0].split(',').map(Number))
                .reduce(
                    (min, [q, r]) => [Math.min(min[0], q), Math.min(min[1], r)],
                    [Infinity, Infinity]
                )
            layouts.add(
                entries
                    .map((entry) => {
                        const [coords, kind] = entry.split(':')
                        const [q, r] = coords.split(',').map(Number)
                        return `${q - origin[0]},${r - origin[1]}:${kind}`
                    })
                    .sort()
                    .join('|')
            )
            expect(tileId).toMatch(/^tile-\d+$/)
        }

        expect(layouts.size).toBeGreaterThan(1)
    })

    it('is deterministic for a given seed, so a game can be replayed', () => {
        const first = buildStartingBoard(3, new Prng({ seed: 42, invocations: 0 }))
        const second = buildStartingBoard(3, new Prng({ seed: 42, invocations: 0 }))

        expect(second).toEqual(first)
    })
})
