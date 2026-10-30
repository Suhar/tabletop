import { type AxialCoordinates, Prng, shuffle } from '@tabletop/common'
import {
    EarendelBoard,
    getHex,
    HexKind,
    hexKey,
    neighborsOf,
    PLANET_COLORS
} from '../model/board.js'
import type { PlanetColor } from '../model/planetColor.js'
import { TILE_HEX_OFFSETS } from '../model/tile.js'
import {
    legalTilePlacements,
    TILE_ROTATIONS,
    tileFootprint,
    type TilePlacement
} from './tilePlacement.js'

// One planet per tile, settled by simulation (rules.md, Setup).
export const PLANETS_PER_TILE = 1

export const TILES_PER_PLAYER = 3

export const PLAYTEST_TILES_PER_PLAYER = 7

export type BoardSetupOptions = {
    tilesPerPlayer?: number
    planetsPerTile?: number
}

// Growth weights. Contact keeps the board clustered, spread keeps it growing outward from its
// middle rather than in a line, and an enclosed hole is all but ruled out.
const CONTACT_WEIGHT = 1
const SPREAD_WEIGHT = 2.5
const HOLE_PENALTY = 20
const JITTER = 2.5
// Distance across counts for less than distance down, so boards lean wide like the table.
const WIDTH_BIAS = 1.7

// Hex centres in units of the hex size, flat-topped.
function centreOf({ q, r }: AxialCoordinates): { x: number; y: number } {
    return { x: 1.5 * q, y: Math.sqrt(3) * (r + q / 2) }
}

// The starting tiles, grown one at a time from a single tile: each new tile goes where it
// touches the board most and strays least from its middle, with a seeded nudge so no two boards
// match.
export function startingTilePlacements(tileCount: number, prng: Prng): TilePlacement[] {
    if (tileCount <= 0) return []

    const first: TilePlacement = {
        origin: { q: 0, r: 0 },
        rotation: Math.floor(prng.random() * TILE_ROTATIONS)
    }
    const placements = [first]
    const board: EarendelBoard = { hexes: {} }
    const occupy = (placement: TilePlacement) => {
        for (const coords of tileFootprint(placement.origin, placement.rotation)) {
            board.hexes[hexKey(coords)] = { coords, tileId: '', kind: HexKind.Open }
        }
    }
    occupy(first)

    while (placements.length < tileCount) {
        const hexes = Object.values(board.hexes).map((hex) => centreOf(hex.coords))
        const middle = {
            x: hexes.reduce((sum, c) => sum + c.x, 0) / hexes.length,
            y: hexes.reduce((sum, c) => sum + c.y, 0) / hexes.length
        }
        const distance = (c: { x: number; y: number }) =>
            ((c.x - middle.x) / WIDTH_BIAS) ** 2 + (c.y - middle.y) ** 2
        const radius = hexes.reduce((sum, c) => sum + distance(c), 0) / hexes.length + 1

        let best: { placement: TilePlacement; score: number } | undefined
        for (const placement of legalTilePlacements(board)) {
            const footprint = tileFootprint(placement.origin, placement.rotation)
            const score =
                CONTACT_WEIGHT * contactOf(board, footprint) -
                (SPREAD_WEIGHT * spreadOf(footprint, distance)) / radius -
                HOLE_PENALTY * holesLeftBy(board, footprint) +
                JITTER * prng.random()
            if (!best || score > best.score) best = { placement, score }
        }
        if (!best) break

        placements.push(best.placement)
        occupy(best.placement)
    }

    return placements
}

// Sides the tile would share with the board.
function contactOf(board: EarendelBoard, footprint: AxialCoordinates[]): number {
    return footprint.reduce(
        (sum, coords) =>
            sum + neighborsOf(coords).filter((neighbor) => getHex(board, neighbor)).length,
        0
    )
}

function spreadOf(
    footprint: AxialCoordinates[],
    distance: (c: { x: number; y: number }) => number
): number {
    return footprint.reduce((sum, coords) => sum + distance(centreOf(coords)), 0) / footprint.length
}

// Empty hexes the tile would close in on every side.
function holesLeftBy(board: EarendelBoard, footprint: AxialCoordinates[]): number {
    const filled = new Set(footprint.map(hexKey))
    const isFilled = (coords: AxialCoordinates) =>
        filled.has(hexKey(coords)) || getHex(board, coords) !== undefined

    const around = new Map<number, AxialCoordinates>()
    for (const coords of footprint) {
        for (const neighbor of neighborsOf(coords)) {
            if (!isFilled(neighbor)) around.set(hexKey(neighbor), neighbor)
        }
    }
    return [...around.values()].filter((coords) => neighborsOf(coords).every(isFilled)).length
}

// Planet colours are dealt from an even pool, so each colour turns up equally often, give or
// take one, and land at random; then planets of one colour that sit within two hexes of each
// other are pulled apart, and nothing more, so chains between partners stay within reach.
export const MIN_PARTNER_GAP = 3

function balancedColours(planetCount: number, prng: Prng): PlanetColor[] {
    const order = [...PLANET_COLORS]
    shuffle(order, prng.random)
    const colours = Array.from(
        { length: planetCount },
        (_unused, index) => order[index % order.length]
    )
    shuffle(colours, prng.random)
    return colours
}

export function buildStartingBoard(
    playerCount: number,
    prng: Prng,
    options: BoardSetupOptions = {}
): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    const tilesPerPlayer = options.tilesPerPlayer ?? TILES_PER_PLAYER
    const planetsPerTile = Math.min(
        options.planetsPerTile ?? PLANETS_PER_TILE,
        TILE_HEX_OFFSETS.length
    )

    const tiles = startingTilePlacements(playerCount * tilesPerPlayer, prng).map((placement) =>
        tileFootprint(placement.origin, placement.rotation)
    )
    const colours = balancedColours(tiles.length * planetsPerTile, prng)
    const planets: SeededPlanet[] = tiles.flatMap((footprint, tile) => {
        const hexes = [...footprint]
        shuffle(hexes, prng.random)
        return hexes.slice(0, planetsPerTile).map((coords) => ({
            tile,
            coords,
            colour: colours.pop() ?? PLANET_COLORS[0]
        }))
    })

    separatePartners(planets, tiles)

    const planetAt = new Map(planets.map((planet) => [hexKey(planet.coords), planet.colour]))
    tiles.forEach((footprint, tile) => {
        const tileId = `tile-${tile}`
        for (const coords of footprint) {
            const colour = planetAt.get(hexKey(coords))
            board.hexes[hexKey(coords)] = colour
                ? { coords, tileId, kind: HexKind.Planet, color: colour }
                : { coords, tileId, kind: HexKind.Open }
        }
    })

    return board
}

type SeededPlanet = { tile: number; coords: AxialCoordinates; colour: PlanetColor }

const SEPARATE_ROUNDS = 20

export function hexSteps(a: AxialCoordinates, b: AxialCoordinates): number {
    return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2
}

// How far same-coloured planets fall short of the gap, summed over every such pair.
function shortfall(planets: SeededPlanet[]): number {
    let total = 0
    for (let i = 0; i < planets.length; i++) {
        for (let j = i + 1; j < planets.length; j++) {
            if (planets[i].colour !== planets[j].colour) continue
            total += Math.max(0, MIN_PARTNER_GAP - hexSteps(planets[i].coords, planets[j].coords))
        }
    }
    return total
}

// Swaps two planets' colours, or moves a planet within its tile, whenever that shrinks the
// shortfall, and stops once no partners are too close. Colour counts stay as dealt.
function separatePartners(planets: SeededPlanet[], tiles: AxialCoordinates[][]) {
    let current = shortfall(planets)
    for (let round = 0; round < SEPARATE_ROUNDS && current > 0; round++) {
        let improved = false

        for (let i = 0; i < planets.length && current > 0; i++) {
            for (let j = i + 1; j < planets.length && current > 0; j++) {
                if (planets[i].colour === planets[j].colour) continue
                ;[planets[i].colour, planets[j].colour] = [planets[j].colour, planets[i].colour]
                const next = shortfall(planets)
                if (next < current) {
                    current = next
                    improved = true
                } else {
                    ;[planets[i].colour, planets[j].colour] = [planets[j].colour, planets[i].colour]
                }
            }
        }

        for (const planet of planets) {
            if (current === 0) break
            const taken = new Set(planets.map((other) => hexKey(other.coords)))
            for (const coords of tiles[planet.tile]) {
                if (taken.has(hexKey(coords))) continue
                const before = planet.coords
                planet.coords = coords
                const next = shortfall(planets)
                if (next < current) {
                    current = next
                    improved = true
                    taken.delete(hexKey(before))
                    taken.add(hexKey(coords))
                } else {
                    planet.coords = before
                }
            }
        }

        if (!improved) break
    }
}
