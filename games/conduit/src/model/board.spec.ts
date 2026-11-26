import { describe, expect, it } from 'vitest'
import type { OffsetCoordinates } from '@tabletop/common'
import {
    BaseLetters,
    Side,
    StationLetter,
    stationTile,
    StationTiles,
    terminalAt,
    Terminal
} from '../components/tiles.js'
import { Grid, type PlacedStation } from './board.js'
import { revenueFor, stationEarnings } from './gameState.js'

const LetterIndex: Record<StationLetter, number> = { A: 0, B: 1, C: 2, D: 3 }

// The printed tile of a letter whose listed sides are positive and the rest negative.
function tileId(letter: StationLetter, positive: Side[] = []): number {
    const bits: Record<Side, number> = { north: 8, east: 4, south: 2, west: 1 }
    const combination = positive.reduce((total, side) => total + bits[side], 0)
    return LetterIndex[letter] * 16 + combination + 1
}

function station(
    letter: StationLetter,
    cell: OffsetCoordinates,
    options: Partial<PlacedStation> & { positive?: Side[] } = {}
): PlacedStation {
    const { positive, ...rest } = options
    return {
        cell,
        tileId: tileId(letter, positive),
        rotation: 0,
        faceUp: true,
        cubes: 0,
        ...rest
    }
}

// The setup cross around the Central Station, every terminal negative.
function negativeCross(): PlacedStation[] {
    return [
        station(StationLetter.A, { col: 0, row: -1 }),
        station(StationLetter.B, { col: 1, row: 0 }),
        station(StationLetter.C, { col: 0, row: 1 }),
        station(StationLetter.D, { col: -1, row: 0 })
    ]
}

const cells = (placements: { cell: OffsetCoordinates }[]) =>
    placements.map(({ cell }) => `${cell.col},${cell.row}`).sort()

describe('station tiles', () => {
    it('prints every terminal combination once per letter', () => {
        for (const letter of BaseLetters) {
            const combos = StationTiles.filter((tile) => tile.letter === letter).map((tile) =>
                [Side.North, Side.East, Side.South, Side.West]
                    .map((side) => tile.terminals[side])
                    .join()
            )
            expect(new Set(combos).size).toBe(16)
        }
    })

    it('numbers tiles as the art does', () => {
        expect(stationTile(1).terminals).toEqual({
            north: Terminal.Negative,
            east: Terminal.Negative,
            south: Terminal.Negative,
            west: Terminal.Negative
        })
        expect(stationTile(2).terminals.west).toBe(Terminal.Positive)
        expect(stationTile(9).terminals.north).toBe(Terminal.Positive)
        expect(stationTile(17).letter).toBe(StationLetter.B)
        expect(stationTile(64).letter).toBe(StationLetter.D)
    })

    it('turns terminals clockwise with the tile', () => {
        const westOnly = stationTile(2)
        expect(terminalAt(westOnly, 1, Side.North)).toBe(Terminal.Positive)
        expect(terminalAt(westOnly, 1, Side.West)).toBe(Terminal.Negative)
        expect(terminalAt(westOnly, 2, Side.East)).toBe(Terminal.Positive)
        expect(terminalAt(westOnly, 3, Side.South)).toBe(Terminal.Positive)
    })
})

describe('connections', () => {
    it('closes every edge of the Central Station', () => {
        const grid = new Grid({ stations: negativeCross() })
        expect(grid.closedConnections()).toHaveLength(4)
    })

    it('closes opposite terminals and opens matching ones or a face-down tile', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.A, { col: 1, row: -1 }, { positive: [Side.West] }),
            station(StationLetter.B, { col: -1, row: -1 }, { positive: [Side.East], faceUp: false })
        ]
        const closed = new Grid({ stations }).closedConnections()
        expect(closed).toContainEqual({ cell: { col: 0, row: -1 }, side: Side.East })
        expect(closed).not.toContainEqual({ cell: { col: -1, row: -1 }, side: Side.East })
        expect(closed).toHaveLength(5)
    })
})

describe('legal placements', () => {
    it('may border a single tile', () => {
        const grid = new Grid({ stations: negativeCross() })
        const placements = grid.legalPlacements(tileId(StationLetter.A), true)
        expect(cells(placements)).toEqual([
            '-1,-1',
            '-1,1',
            '-2,0',
            '0,-2',
            '0,2',
            '1,-1',
            '1,1',
            '2,0'
        ])
        expect(placements[0].rotations).toEqual([0, 1, 2, 3])
    })

    it('must make an open connection when it can', () => {
        const grid = new Grid({ stations: negativeCross() })
        const threePositive = tileId(StationLetter.A, [Side.North, Side.East, Side.South])
        const placements = grid.legalPlacements(threePositive, true)
        const rotationsAt = (col: number, row: number) =>
            placements.find(({ cell }) => cell.col === col && cell.row === row)?.rotations
        // At the north-east corner the one negative terminal must face A to the west or B below.
        expect(rotationsAt(1, -1)).toEqual([0, 3])
        // North of A it must face down.
        expect(rotationsAt(0, -2)).toEqual([3])
    })

    it('keeps the whole grid within 6x6', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.B, { col: 0, row: -2 }),
            station(StationLetter.C, { col: 0, row: -3 }),
            station(StationLetter.D, { col: 0, row: -4 })
        ]
        const placements = cells(
            new Grid({ stations }).legalPlacements(tileId(StationLetter.A), true)
        )
        // Rows -4 to 1 already span six tiles, so the grid cannot grow up or down.
        expect(placements).not.toContain('0,-5')
        expect(placements).not.toContain('0,2')
        expect(placements).toContain('1,-4')
        expect(placements).toContain('2,0')
    })

    it('places a face-down tile in one orientation', () => {
        const grid = new Grid({ stations: negativeCross() })
        const placements = grid.legalPlacements(tileId(StationLetter.A), false)
        expect(placements.every((placement) => placement.rotations.length === 1)).toBe(true)
    })
})

describe('routes', () => {
    it('runs to an adjacent station of the next letter, D to A, counting both ends', () => {
        const stations = [...negativeCross(), station(StationLetter.D, { col: 1, row: -1 })]
        const route = new Grid({ stations }).bestRoute({ col: 1, row: -1 })
        expect(route?.cells).toEqual([
            { col: 1, row: -1 },
            { col: 0, row: -1 }
        ])
        expect(revenueFor(route)).toBe(3)
    })

    it('never passes through the Central Station', () => {
        const route = new Grid({ stations: negativeCross() }).bestRoute({ col: 0, row: -1 })
        expect(route).toBeUndefined()
        expect(revenueFor(route)).toBe(0)
    })

    it('takes the better-paying of two equally short routes', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.D, { col: 10, row: 10 }),
            station(StationLetter.C, { col: 11, row: 10 }),
            station(StationLetter.C, { col: 10, row: 11 }, { faceUp: false }),
            station(StationLetter.A, { col: 11, row: 11 })
        ]
        const route = new Grid({ stations }).bestRoute({ col: 10, row: 10 })
        expect(route?.cells[1]).toEqual({ col: 11, row: 10 })
        expect(route?.stations).toBe(3)
    })

    it('takes the shortest route even when a longer one pays more', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.D, { col: 10, row: 10 }),
            station(StationLetter.C, { col: 11, row: 10 }, { faceUp: false }),
            station(StationLetter.A, { col: 12, row: 10 }),
            station(StationLetter.C, { col: 10, row: 11 }),
            station(StationLetter.C, { col: 10, row: 12 }),
            station(StationLetter.C, { col: 11, row: 12 }),
            station(StationLetter.C, { col: 12, row: 12 }),
            station(StationLetter.C, { col: 12, row: 11 })
        ]
        const route = new Grid({ stations }).bestRoute({ col: 10, row: 10 })
        expect(route?.cells).toHaveLength(3)
        expect(route?.stations).toBe(2)
    })

    it('passes as few of the owner’s own stations as it can among the best routes', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.D, { col: 10, row: 10 }, { ownerId: 'cal', cubes: 1 }),
            station(StationLetter.C, { col: 11, row: 10 }, { ownerId: 'cal', cubes: 1 }),
            station(StationLetter.C, { col: 10, row: 11 }, { ownerId: 'bea', cubes: 1 }),
            station(StationLetter.A, { col: 11, row: 11 })
        ]
        const route = new Grid({ stations }).bestRoute({ col: 10, row: 10 })
        expect(route?.cells[1]).toEqual({ col: 10, row: 11 })
        expect(route?.stations).toBe(3)
    })

    it('stops at a closed connection', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.D, { col: 10, row: 10 }),
            station(StationLetter.A, { col: 11, row: 10 }, { positive: [Side.West] })
        ]
        expect(new Grid({ stations }).bestRoute({ col: 10, row: 10 })).toBeUndefined()
    })

    it('ends only at a face-up station', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.D, { col: 10, row: 10 }),
            station(StationLetter.A, { col: 11, row: 10 }, { faceUp: false })
        ]
        expect(new Grid({ stations }).bestRoute({ col: 10, row: 10 })).toBeUndefined()
    })
})

describe('route search', () => {
    it('shows each distance it reached, the destinations it found, and the route it chose', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.D, { col: 10, row: 10 }, { ownerId: 'cal', cubes: 1 }),
            station(StationLetter.C, { col: 11, row: 10 }, { ownerId: 'cal', cubes: 1 }),
            station(StationLetter.C, { col: 10, row: 11 }, { ownerId: 'bea', cubes: 1 }),
            station(StationLetter.A, { col: 11, row: 11 })
        ]
        const grid = new Grid({ stations })
        const search = grid.routeSearch({ col: 10, row: 10 })
        expect(search?.target).toBe(StationLetter.A)
        expect(search?.layers.map((layer) => layer.map((step) => step.cell))).toEqual([
            [
                { col: 11, row: 10 },
                { col: 10, row: 11 }
            ],
            [{ col: 11, row: 11 }]
        ])
        expect(search?.layers[1][0].from).toEqual({ col: 10, row: 11 })
        expect(search?.candidates).toHaveLength(1)
        expect(search?.route).toEqual(grid.bestRoute({ col: 10, row: 10 }))
    })

    it('spreads until it runs out when no destination is in reach', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.D, { col: 10, row: 10 }),
            station(StationLetter.C, { col: 11, row: 10 })
        ]
        const search = new Grid({ stations }).routeSearch({ col: 10, row: 10 })
        expect(search?.layers.map((layer) => layer.length)).toEqual([1])
        expect(search?.candidates).toEqual([])
        expect(search?.route).toBeUndefined()
    })
})

describe('the route target', () => {
    it('runs to a station of the next letter, not the same one', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.A, { col: 10, row: 10 }),
            station(StationLetter.A, { col: 11, row: 10 }),
            station(StationLetter.B, { col: 12, row: 10 })
        ]
        const route = new Grid({ stations }).bestRoute({ col: 10, row: 10 })
        expect(route?.cells.at(-1)).toEqual({ col: 12, row: 10 })
        expect(route?.stations).toBe(3)
    })

    it('runs from D to A', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.D, { col: 10, row: 10 }),
            station(StationLetter.A, { col: 11, row: 10 })
        ]
        const route = new Grid({ stations }).bestRoute({ col: 10, row: 10 })
        expect(route?.cells.at(-1)).toEqual({ col: 11, row: 10 })
    })
})

describe('route bonuses', () => {
    // Cal's A runs through Bea's C and a face-down tile to Dee's B.
    const stations = [
        ...negativeCross(),
        station(StationLetter.A, { col: 10, row: 10 }, { ownerId: 'cal', cubes: 1 }),
        station(StationLetter.C, { col: 11, row: 10 }, { ownerId: 'bea', cubes: 2 }),
        station(StationLetter.C, { col: 12, row: 10 }, { faceUp: false }),
        station(StationLetter.B, { col: 13, row: 10 }, { ownerId: 'dee', cubes: 1 }),
        station(StationLetter.D, { col: 14, row: 10 }, { ownerId: 'dee', cubes: 1 })
    ]
    const earned = (placed: PlacedStation[]) =>
        Object.fromEntries(
            stationEarnings({ stations: placed }).map((earning) => [
                `${earning.ownerId} ${stationTile(earning.station.tileId).letter}`,
                { amount: earning.amount, bonuses: earning.bonuses }
            ])
        )

    it('pays $1 to each other player’s Power Station on the route, the destination included', () => {
        const earnings = earned(stations)
        expect(earnings['cal A']).toEqual({
            amount: 4,
            bonuses: [
                { playerId: 'bea', amount: 1 },
                { playerId: 'dee', amount: 1 }
            ]
        })
        // Bea's C runs to Dee's D through Dee's B: both pay Dee.
        expect(earnings['bea C']).toEqual({
            amount: 4,
            bonuses: [
                { playerId: 'dee', amount: 1 },
                { playerId: 'dee', amount: 1 }
            ]
        })
    })

    it('pays no bonus to a station without a route', () => {
        const earnings = earned([
            ...negativeCross(),
            station(StationLetter.B, { col: 10, row: 10 }, { ownerId: 'cal', cubes: 1 }),
            station(StationLetter.A, { col: 11, row: 10 }, { ownerId: 'bea', cubes: 1 })
        ])
        expect(earnings['cal B']).toEqual({ amount: 0, bonuses: [] })
        expect(earnings['bea A']).toEqual({ amount: 3, bonuses: [{ playerId: 'cal', amount: 1 }] })
    })

    it('pays nothing to the route owner’s own stations or to stations without cubes', () => {
        const own = [
            ...negativeCross(),
            station(StationLetter.A, { col: 10, row: 10 }, { ownerId: 'cal', cubes: 1 }),
            station(StationLetter.C, { col: 11, row: 10 }, { ownerId: 'cal', cubes: 1 }),
            station(StationLetter.D, { col: 12, row: 10 }, { ownerId: 'bea', cubes: 0 }),
            station(StationLetter.B, { col: 13, row: 10 }, { ownerId: 'dee', cubes: 1 })
        ]
        const cal = stationEarnings({ stations: own })[0]
        expect(cal.amount).toBe(5)
        expect(cal.bonuses).toEqual([{ playerId: 'dee', amount: 1 }])
    })
})
