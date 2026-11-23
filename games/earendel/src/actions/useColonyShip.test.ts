import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { controllerKey } from '../util/control.js'
import { stationComplex, stationGroupPoints } from '../util/stations.js'
import { PieceSource, PlacePiece, isPlacePiece } from './placePiece.js'
import { isUseColonyShip, settleablePlanets, UseColonyShip } from './useColonyShip.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })
const PLANET = at(0, 0)
const FAR_PLANET = at(4, -2)

let ids = 0
const ship = (playerId: string, type: PieceType): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type
})

// Open space round a planet at the center, with a second planet further off. The mover has a
// station either side of the center planet: two complexes of one, the planet between them.
function scenario(controller: 'mover' | 'rival' = 'mover') {
    const game = new TestGame()
    const mover = game.activePlayerId
    const rival = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board: EarendelBoard = { hexes: {} }
    for (let q = -5; q <= 5; q++) {
        for (let r = -5; r <= 5; r++) {
            if (Math.abs(q + r) > 5) continue
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    for (const planet of [PLANET, FAR_PLANET]) {
        board.hexes[hexKey(planet)] = {
            coords: planet,
            tileId: 't1',
            kind: HexKind.Planet,
            color: PlanetColor.Mint
        }
    }
    // Whoever's stations stand beside the planet controls it.
    const holder = controller === 'mover' ? mover : rival
    board.hexes[hexKey(at(1, 0))].piece = ship(holder, PieceType.Station)
    board.hexes[hexKey(at(-1, 0))].piece = ship(holder, PieceType.Station)
    game.state.board = board
    game.state.planetControllers = { [controllerKey(PLANET)]: holder }
    game.state.technologyDeck = stackedBag([])
    game.state.technologyDiscard = []
    game.state.tileSupply = stackedBag([])
    game.giveTechnology(mover, TechnologyEffectKind.ColonyShip)
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])
    return { game, mover, rival }
}

const settle = (playerId: string, planet: AxialCoordinates) => ({
    type: ActionType.UseColonyShip as const,
    playerId,
    planet
})
const scoreOf = (game: TestGame, playerId: string) =>
    game.state.players.find((p) => p.playerId === playerId)!.score

describe('Colony Ship', () => {
    it('settles a controlled planet, which bridges the stations beside it and scores', () => {
        const { game, mover } = scenario()
        // The planet stands between the two stations: each is a complex of one.
        expect(stationComplex(game.state.board, mover, at(1, 0))).toHaveLength(1)
        expect(settleablePlanets(game.hydrated, mover)).toEqual([PLANET])
        const before = scoreOf(game, mover)

        const used = game.run(UseColonyShip, settle(mover, PLANET)).find(isUseColonyShip)

        expect(game.state.board.hexes[hexKey(PLANET)].colony).toBe(mover)
        expect(stationComplex(game.state.board, mover, at(1, 0))).toHaveLength(3)
        expect(used?.metadata?.stationGroupPoints).toBe(3)
        expect(scoreOf(game, mover)).toBe(before + 3)
        expect(game.state.players.find((p) => p.playerId === mover)!.storedEffects).toEqual([])
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseColonyShip)
    })

    it('counts as a station whenever its complex scores afterwards', () => {
        const { game, mover } = scenario()
        game.run(UseColonyShip, settle(mover, PLANET))
        const before = scoreOf(game, mover)

        const placed = game
            .run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId: mover,
                coords: at(2, 0),
                pieceSource: PieceSource.Bag
            })
            .find(isPlacePiece)

        // Two stations and the planet, and now a fourth.
        expect(placed?.metadata?.stationGroupPoints).toBe(4)
        expect(scoreOf(game, mover)).toBe(before + 4)
    })

    it("stays settled when control is lost, and is nobody else's station", () => {
        const { game, mover, rival } = scenario()
        game.run(UseColonyShip, settle(mover, PLANET))
        game.state.planetControllers = { [controllerKey(PLANET)]: rival }
        game.state.board.hexes[hexKey(at(0, 1))].piece = ship(rival, PieceType.Station)

        expect(game.state.board.hexes[hexKey(PLANET)].colony).toBe(mover)
        expect(stationGroupPoints(game.state.board, mover, at(1, 0))).toBe(3)
        // The rival's station beside the planet is a complex of one: the colony is not theirs.
        expect(stationGroupPoints(game.state.board, rival, at(0, 1))).toBe(1)
        expect(settleablePlanets(game.hydrated, rival)).toEqual([])
    })

    it('needs a planet the player controls', () => {
        const uncontrolled = scenario()
        expect(() =>
            uncontrolled.game.run(UseColonyShip, settle(uncontrolled.mover, FAR_PLANET))
        ).toThrow()
        expect(() =>
            uncontrolled.game.run(UseColonyShip, settle(uncontrolled.mover, at(2, 0)))
        ).toThrow()

        const theirs = scenario('rival')
        expect(theirs.game.validActionsFor(theirs.mover)).not.toContain(ActionType.UseColonyShip)
        expect(() => theirs.game.run(UseColonyShip, settle(theirs.mover, PLANET))).toThrow()
    })
})
