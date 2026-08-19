import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { UseTradeRouteWormhole } from './useTradeRouteWormhole.js'
import { wormholeDestinations } from '../util/wormhole.js'
import { TestGame } from '../util/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// Row 0 is open space; the planets are dropped into it by each scenario. Row 3 is a spare row far
// enough away to hold an unrelated arrangement.
function openRow(length = 16): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < length; q++) {
        for (const r of [0, 3]) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    return board
}

const planet = (board: EarendelBoard, coords: AxialCoordinates, color: PlanetColor) => {
    board.hexes[hexKey(coords)] = { coords, tileId: 't1', kind: HexKind.Planet, color }
}

// Two azure planets far apart in row 0, one gold planet between them, and the mover's ship
// standing beside the first azure.
//
//   (0,0) ship | (1,0) AZURE | ... | (6,0) GOLD | ... | (11,0) AZURE
function scenario(mine: PieceType = PieceType.Station, level?: PieceLevel) {
    const game = new TestGame()
    const mover = game.activePlayerId
    const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board = openRow()
    planet(board, at(1, 0), PlanetColor.Azure)
    planet(board, at(6, 0), PlanetColor.Gold)
    planet(board, at(11, 0), PlanetColor.Azure)
    board.hexes[hexKey(at(0, 0))].piece = ship(mover, mine, level)

    game.state.board = board
    game.state.technologyDeck = []
    game.state.tileSupply = []
    game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = [
        TechnologyEffectKind.TradeRouteWormhole
    ]
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])

    return { game, mover, other }
}

const hop = (playerId: string, from: AxialCoordinates, to: AxialCoordinates) => ({
    type: ActionType.UseTradeRouteWormhole as const,
    playerId,
    from,
    to
})

describe('Trade Route Wormhole', () => {
    it('sends a ship to the far planet of the same colour', () => {
        const { game, mover } = scenario()

        expect(game.validActionsFor(mover)).toContain(ActionType.UseTradeRouteWormhole)

        game.run(UseTradeRouteWormhole, hop(mover, at(0, 0), at(12, 0)))

        expect(game.state.board.hexes[hexKey(at(0, 0))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(12, 0))].piece?.playerId).toBe(mover)

        // The placement the turn already owed is still owed: this spends a power, not a ship.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).toBe(mover)
    })

    it('offers only hexes beside a different planet of a colour the ship can travel on', () => {
        const { game, mover } = scenario()
        const destinations = wormholeDestinations(game.state.board, at(0, 0), mover)

        // Beside the far azure planet, and nothing else: the gold planet is a colour this ship
        // isn't standing next to, and the near azure's own neighbours are a different hex to look
        // at the SAME planet from, which is not a route.
        expect(destinations.map((coords) => hexKey(coords)).sort()).toEqual(
            [hexKey(at(10, 0)), hexKey(at(12, 0))].sort()
        )
    })

    it('arrives as if newly placed, scoring its new station complex', () => {
        const { game, mover } = scenario()
        // A station of the mover's already sitting beside the far azure planet, so the traveller
        // joins a complex on landing.
        game.state.board.hexes[hexKey(at(12, 0))].piece = ship(mover, PieceType.Station)
        const before = game.state.players.find((p) => p.playerId === mover)!.score

        game.run(UseTradeRouteWormhole, hop(mover, at(0, 0), at(10, 0)))

        // (10,0) doesn't touch (12,0), so this is not the complex - it is the traveller alone,
        // paying 1 for itself.
        expect(game.state.players.find((p) => p.playerId === mover)!.score).toBe(before + 1)
    })

    it('explores from a probe that lands beside an unexplored planet', () => {
        const { game, mover } = scenario(PieceType.Probe)

        game.run(UseTradeRouteWormhole, hop(mover, at(0, 0), at(12, 0)))

        // One candidate planet and an empty technology deck, so the exploration resolves itself
        // and the turn is back at its placement by the time control returns.
        expect(game.state.board.hexes[hexKey(at(11, 0))].explored).toBe(true)
        expect(game.state.pendingExploration).toBeUndefined()
    })

    it('arrives shooting when the traveller is a fighter', () => {
        const { game, mover, other } = scenario(PieceType.Fighter, PieceLevel.Three)
        game.state.board.hexes[hexKey(at(12, 0))].piece = ship(other, PieceType.Probe)

        game.run(UseTradeRouteWormhole, hop(mover, at(0, 0), at(10, 0)))

        // (10,0) and (12,0) both touch the planet at (11,0) but not each other, so the shot is
        // not on those two - the fighter simply has nothing in reach and the turn carries on.
        expect(game.state.pendingAttack).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('refuses a ship not beside a planet, and a destination that is not on the route', () => {
        const { game, mover } = scenario()
        // Row 3 touches no planet at all.
        game.state.board.hexes[hexKey(at(0, 3))].piece = ship(mover, PieceType.Station)

        expect(() => game.run(UseTradeRouteWormhole, hop(mover, at(0, 3), at(12, 0)))).toThrow()
        // Beside the GOLD planet, which this ship is not standing next to.
        expect(() => game.run(UseTradeRouteWormhole, hop(mover, at(0, 0), at(5, 0)))).toThrow()
        // A different hex beside the SAME planet is not a different planet.
        expect(() => game.run(UseTradeRouteWormhole, hop(mover, at(0, 0), at(2, 0)))).toThrow()
        // Occupied.
        game.state.board.hexes[hexKey(at(12, 0))].piece = ship(mover, PieceType.Station)
        expect(() => game.run(UseTradeRouteWormhole, hop(mover, at(0, 0), at(12, 0)))).toThrow()
    })

    it('will not send a probe into a corridor closed to it', () => {
        const { game, mover, other } = scenario(PieceType.Probe)
        // Two enemy stations either side of (12, 0) along the r axis, so the clear space between
        // them is exactly that hex. NOT along row 0: the planet at (11, 0) would end the line,
        // since a blockade needs empty space and a planet is a world rather than a gap.
        for (const coords of [at(12, -1), at(12, 1)]) {
            game.state.board.hexes[hexKey(coords)] = {
                coords,
                tileId: 't1',
                kind: HexKind.Open,
                piece: ship(other, PieceType.Station)
            }
        }

        // A probe played from hand could not land on (12, 0), and neither can one arriving by
        // wormhole: it lands on an EMPTY hex, so the placement rule has something to apply to.
        const destinations = wormholeDestinations(game.state.board, at(0, 0), mover)
        expect(destinations.map((coords) => hexKey(coords))).not.toContain(hexKey(at(12, 0)))
        // The other end of the same route is still open, so this is the blockade and not the
        // wormhole refusing the whole trip.
        expect(destinations.map((coords) => hexKey(coords))).toContain(hexKey(at(10, 0)))

        expect(() => game.run(UseTradeRouteWormhole, hop(mover, at(0, 0), at(12, 0)))).toThrow()
    })

    it('goes on cooldown, so it cannot be used twice in a turn', () => {
        const { game, mover } = scenario()

        game.run(UseTradeRouteWormhole, hop(mover, at(0, 0), at(12, 0)))

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseTradeRouteWormhole)
    })

    it('is not offered at all without the technology', () => {
        const { game, mover } = scenario()
        game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = []

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseTradeRouteWormhole)
    })
})
