import { describe, expect, it } from 'vitest'
import { Prng } from '@tabletop/common'
import { HexKind, hexKey } from '../model/board.js'
import {
    buildStartingBoard,
    PLANETS_PER_TILE,
    startingTileOrigins,
    TILE_HEX_OFFSETS,
    TILES_PER_PLAYER
} from './boardSetup.js'

describe('startingTileOrigins', () => {
    it('lays the right number of tiles per player, without overlapping', () => {
        for (const playerCount of [2, 3, 4, 5]) {
            const origins = startingTileOrigins(playerCount * TILES_PER_PLAYER)
            expect(origins).toHaveLength(playerCount * TILES_PER_PLAYER)

            // Tiles are 2x2 in axial terms, so distinct origins spaced by 2 can't share a hex.
            const hexes = new Set<number>()
            for (const origin of origins) {
                for (const offset of TILE_HEX_OFFSETS) {
                    hexes.add(hexKey({ q: origin.q + offset.q, r: origin.r + offset.r }))
                }
            }
            expect(hexes.size).toBe(playerCount * TILES_PER_PLAYER * TILE_HEX_OFFSETS.length)
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
            byTile.set(hex.tileId, [...(byTile.get(hex.tileId) ?? []), `${hex.coords.q},${hex.coords.r}:${hex.kind}`])
        }
        for (const [tileId, entries] of byTile) {
            const origin = entries
                .map((entry) => entry.split(':')[0].split(',').map(Number))
                .reduce((min, [q, r]) => [Math.min(min[0], q), Math.min(min[1], r)], [Infinity, Infinity])
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
