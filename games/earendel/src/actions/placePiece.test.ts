import { describe, expect, it } from 'vitest'
import { ActionSource, type AxialCoordinates, Color } from '@tabletop/common'
import { EarendelGameState, HydratedEarendelGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { EarendelBoard, HexKind, hexKey, neighborsOf } from '../model/board.js'
import { PieceType, ProbeLevel } from '../model/pieces.js'
import { HydratedPlacePiece, PieceSource } from './placePiece.js'

const ORIGIN: AxialCoordinates = { q: 0, r: 0 }

// A planet at the origin ringed by open space - enough to place a ship next to a planet.
function boardWithPlanetAtOrigin(): EarendelBoard {
    const board: EarendelBoard = {
        hexes: { [hexKey(ORIGIN)]: { coords: ORIGIN, tileId: 't1', kind: HexKind.Planet } }
    }
    for (const coords of neighborsOf(ORIGIN)) {
        board.hexes[hexKey(coords)] = { coords, tileId: 't1', kind: HexKind.Open }
    }
    return board
}

function buildState(overrides: Partial<EarendelGameState> = {}): HydratedEarendelGameState {
    const playerIds = ['p1', 'p2']
    const data: EarendelGameState = {
        id: 'game-1',
        gameId: 'game-1',
        players: playerIds.map((playerId, index) => ({
            playerId,
            color: [Color.Blue, Color.Red][index],
            bag: [
                { id: `${playerId}-probe`, playerId, type: PieceType.Probe, level: ProbeLevel.Two },
                { id: `${playerId}-fighter`, playerId, type: PieceType.Fighter }
            ],
            specialPieces: [],
            score: 0
        })),
        activePlayerIds: ['p1'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.StartOfTurn,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: boardWithPlanetAtOrigin(),
        technologyDeck: [],
        technologyDiscard: [],
        ...overrides
    } as EarendelGameState

    return new HydratedEarendelGameState(data)
}

function makePlacePiece(
    playerId: string,
    coords: AxialCoordinates,
    pieceSource = PieceSource.Bag,
    pieceId?: string
): HydratedPlacePiece {
    return new HydratedPlacePiece({
        id: 'place-1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlacePiece,
        playerId,
        coords,
        pieceSource,
        ...(pieceId ? { pieceId } : {})
    })
}

describe('HydratedPlacePiece', () => {
    it('draws the next ship from the player’s own bag and stands it on the hex', () => {
        const state = buildState()
        const target = neighborsOf(ORIGIN)[0]

        const action = makePlacePiece('p1', target)
        expect(action.invalidPlacePieceReason(state)).toBeUndefined()
        action.apply(state)

        // The draw is resolved by the engine, not the client - the player doesn't choose.
        expect(state.board.hexes[hexKey(target)].piece?.id).toBe('p1-probe')
        expect(state.getPlayerState('p1').bag.map((p) => p.id)).toEqual(['p1-fighter'])
        expect(action.metadata?.pieceType).toBe(PieceType.Probe)
    })

    it('offers every reachable unexplored planet as a candidate, exploring none of them yet', () => {
        const state = buildState()
        const target = neighborsOf(ORIGIN)[0]
        // A second planet touching the same hex, so one probe reaches two.
        const secondPlanet = neighborsOf(target).find(
            (coords) => hexKey(coords) !== hexKey(ORIGIN) && !state.board.hexes[hexKey(coords)]
        )!
        state.board.hexes[hexKey(secondPlanet)] = {
            coords: secondPlanet,
            tileId: 't2',
            kind: HexKind.Planet
        }

        const action = makePlacePiece('p1', target)
        action.apply(state)

        // A probe explores ONE planet - which one is the player's choice, so nothing is
        // explored and no cards are flipped until they make it.
        expect(action.metadata?.explorable).toHaveLength(2)
        expect(state.board.hexes[hexKey(ORIGIN)].explored).toBeUndefined()
        expect(state.board.hexes[hexKey(secondPlanet)].explored).toBeUndefined()
        expect(state.pendingExploration?.candidatePlanets).toHaveLength(2)
        expect(state.pendingExploration?.playerId).toBe('p1')
    })

    it('does not explore when the ship drawn is not a probe', () => {
        const state = buildState()
        // Drop the probe so a fighter comes out instead.
        state.getPlayerState('p1').bag.shift()
        const target = neighborsOf(ORIGIN)[0]

        const action = makePlacePiece('p1', target)
        action.apply(state)

        expect(action.metadata?.pieceType).toBe(PieceType.Fighter)
        expect(state.board.hexes[hexKey(ORIGIN)].explored).toBeUndefined()
        expect(action.metadata?.explorable).toBeUndefined()
        expect(state.pendingExploration).toBeUndefined()
    })

    it('offers nothing when the only planet in reach is already explored', () => {
        const state = buildState()
        state.board.hexes[hexKey(ORIGIN)].explored = true

        const action = makePlacePiece('p1', neighborsOf(ORIGIN)[0])
        action.apply(state)

        // A planet is explored once and never again, so this probe has nothing to do and the
        // turn isn't held open.
        expect(action.metadata?.explorable).toBeUndefined()
        expect(state.pendingExploration).toBeUndefined()
    })

    it('refuses a planet hex, an occupied hex, and a hex off the board', () => {
        const state = buildState()
        const occupied = neighborsOf(ORIGIN)[0]
        state.board.hexes[hexKey(occupied)].piece = {
            id: 'other',
            playerId: 'p2',
            type: PieceType.Station
        }

        const message =
            'A ship can only go on an empty hex of open space - not on a planet, and not on an occupied hex.'
        expect(makePlacePiece('p1', ORIGIN).invalidPlacePieceReason(state)).toBe(message)
        expect(makePlacePiece('p1', occupied).invalidPlacePieceReason(state)).toBe(message)
        expect(makePlacePiece('p1', { q: 9, r: 9 }).invalidPlacePieceReason(state)).toBe(message)
    })

    it('refuses a player who isn’t the active one', () => {
        const state = buildState()
        expect(makePlacePiece('p2', neighborsOf(ORIGIN)[0]).invalidPlacePieceReason(state)).toBe(
            "It isn't your turn."
        )
    })

    it('spends a face-up special piece instead of drawing, when asked', () => {
        const state = buildState()
        const special = { id: 'p1-special', playerId: 'p1', type: PieceType.Station }
        state.getPlayerState('p1').specialPieces = [special]
        const target = neighborsOf(ORIGIN)[0]

        const action = makePlacePiece('p1', target, PieceSource.Special, 'p1-special')
        expect(action.invalidPlacePieceReason(state)).toBeUndefined()
        action.apply(state)

        expect(state.board.hexes[hexKey(target)].piece?.id).toBe('p1-special')
        expect(state.getPlayerState('p1').specialPieces).toEqual([])
        // The bag is untouched - spending a special is INSTEAD of drawing.
        expect(state.getPlayerState('p1').bag).toHaveLength(2)
    })

    it('refuses a special piece the player does not have in front of them', () => {
        const state = buildState()
        const target = neighborsOf(ORIGIN)[0]

        expect(
            makePlacePiece('p1', target, PieceSource.Special, 'nope').invalidPlacePieceReason(state)
        ).toBe("That special piece isn't in front of you.")
        expect(makePlacePiece('p1', target, PieceSource.Special).invalidPlacePieceReason(state)).toBe(
            'No special piece was chosen.'
        )
    })
})
