import { describe, expect, it } from 'vitest'
import { ActionSource, type AxialCoordinates, Color } from '@tabletop/common'
import { EarendelGameState, HydratedEarendelGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { EarendelBoard, HexKind, hexKey, neighborsOf } from '../model/board.js'
import { type Piece, PieceType, PieceLevel } from '../model/pieces.js'
import { HydratedPlacePiece, PieceSource } from './placePiece.js'
import { stackedBag } from '../util/testHarness.js'

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
            bag: stackedBag([{ id: `${playerId}-fighter`, playerId, type: PieceType.Fighter }]),
            specialPieces: [],
            technologies: [],
            storedEffects: [],
            cooldownEffects: [],
            cooldowns: {},
            score: 0
        })),
        activePlayerIds: ['p1'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.PlacingPiece,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: boardWithPlanetAtOrigin(),
        technologyDeck: stackedBag([]),
        technologyDiscard: [],
        queuedTechnologyEffects: [],
        planetControllers: {},
        tradeRoutes: [],
        probeClaims: [],
        tileSupply: stackedBag([]),
        // The turn's draw happens when the turn opens, so a placement always arrives with
        // something already in hand.
        heldPieces: [
            { id: 'p1-probe', playerId: 'p1', type: PieceType.Probe, level: PieceLevel.Two }
        ],
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
    it('stands the ship drawn at the start of the turn on the hex', () => {
        const state = buildState()
        const target = neighborsOf(ORIGIN)[0]

        const action = makePlacePiece('p1', target)
        expect(action.invalidPlacePieceReason(state)).toBeUndefined()
        action.apply(state)

        // The piece was already face up: the player chose this hex knowing what they had.
        expect(state.board.hexes[hexKey(target)].piece?.id).toBe('p1-probe')
        expect(state.heldPieces).toEqual([])
        expect(state.getPlayerState('p1').bag.items.map((p) => p.id)).toEqual(['p1-fighter'])
        expect(action.metadata?.pieceType).toBe(PieceType.Probe)
    })

    it('refuses a bag placement when nothing has been drawn', () => {
        const state = buildState({ heldPieces: [] })

        expect(makePlacePiece('p1', neighborsOf(ORIGIN)[0]).invalidPlacePieceReason(state)).toBe(
            'Nothing has been drawn to place.'
        )
    })

    it('offers every planet in reach as a destination, exploring none of them yet', () => {
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

        // A probe goes to ONE planet at most - whether and which is the player's choice, so
        // nothing is explored and no cards are flipped until they make it.
        expect(action.metadata?.probeDestinations).toHaveLength(2)
        expect(state.board.hexes[hexKey(ORIGIN)].explored).toBeUndefined()
        expect(state.board.hexes[hexKey(secondPlanet)].explored).toBeUndefined()
        expect(state.pendingExploration?.candidatePlanets).toHaveLength(2)
        expect(state.pendingExploration?.playerId).toBe('p1')
    })

    it('does not explore when the ship drawn is not a probe', () => {
        const state = buildState({
            heldPieces: [{ id: 'p1-fighter', playerId: 'p1', type: PieceType.Fighter }]
        })
        const target = neighborsOf(ORIGIN)[0]

        const action = makePlacePiece('p1', target)
        action.apply(state)

        expect(action.metadata?.pieceType).toBe(PieceType.Fighter)
        expect(state.board.hexes[hexKey(ORIGIN)].explored).toBeUndefined()
        expect(action.metadata?.probeDestinations).toBeUndefined()
        expect(state.pendingExploration).toBeUndefined()
    })

    it('offers an explored planet only for a technology the player lacks', () => {
        const state = buildState()
        state.board.hexes[hexKey(ORIGIN)].explored = true
        state.board.hexes[hexKey(ORIGIN)].technologyId = 'tech-0'

        const action = makePlacePiece('p1', neighborsOf(ORIGIN)[0])
        action.apply(state)

        // Surveying it explores nothing new, but stakes a claim on what it holds.
        expect(action.metadata?.probeDestinations).toEqual([ORIGIN])
        expect(state.pendingExploration?.candidatePlanets).toEqual([ORIGIN])
    })

    it('offers no explored planet with nothing on it to win', () => {
        const held = buildState()
        held.board.hexes[hexKey(ORIGIN)].explored = true
        held.board.hexes[hexKey(ORIGIN)].technologyId = 'tech-0'
        held.getPlayerState('p1').technologies = ['tech-0']
        // Explored, but the deck had nothing for it.
        const empty = buildState()
        empty.board.hexes[hexKey(ORIGIN)].explored = true

        for (const state of [held, empty]) {
            const action = makePlacePiece('p1', neighborsOf(ORIGIN)[0])
            action.apply(state)

            expect(action.metadata?.probeDestinations).toBeUndefined()
            expect(state.pendingExploration).toBeUndefined()
        }
    })

    it('does not offer a planet the player already has a claim waiting on', () => {
        const state = buildState()
        state.board.hexes[hexKey(ORIGIN)].explored = true
        state.board.hexes[hexKey(ORIGIN)].technologyId = 'tech-0'
        state.board.hexes[hexKey(neighborsOf(ORIGIN)[3])].piece = {
            id: 'p1-old-probe',
            playerId: 'p1',
            type: PieceType.Probe,
            level: PieceLevel.Two
        }
        state.probeClaims = [{ playerId: 'p1', coords: ORIGIN, technologyId: 'tech-a' }]

        const action = makePlacePiece('p1', neighborsOf(ORIGIN)[0])
        action.apply(state)

        expect(action.metadata?.probeDestinations).toBeUndefined()
        expect(state.pendingExploration).toBeUndefined()
    })

    it('offers a planet only where the player strictly leads on probe influence', () => {
        const probe = (id: string, playerId: string, level: PieceLevel): Piece => ({
            id,
            playerId,
            type: PieceType.Probe,
            level
        })
        const target = neighborsOf(ORIGIN)[0]
        const destinationsWith = (others: Piece[]) => {
            const state = buildState()
            others.forEach((piece, index) => {
                state.board.hexes[hexKey(neighborsOf(ORIGIN)[index + 2])].piece = piece
            })
            const action = makePlacePiece('p1', target)
            action.apply(state)
            return action.metadata?.probeDestinations
        }

        // A level 2 against a level 2 is a tie, and a tie stakes out nothing.
        expect(destinationsWith([probe('p2-a', 'p2', PieceLevel.Two)])).toBeUndefined()
        // A single level 3 outweighs the level 2 being placed.
        expect(destinationsWith([probe('p2-a', 'p2', PieceLevel.Three)])).toBeUndefined()
        // Levels add up: the placed level 2 and another level 2 make 4, beating one level 3.
        expect(
            destinationsWith([
                probe('p2-a', 'p2', PieceLevel.Three),
                probe('p1-b', 'p1', PieceLevel.Two)
            ])
        ).toEqual([ORIGIN])
        // Stations and fighters weigh nothing here, however strong.
        expect(
            destinationsWith([
                { id: 'p2-s', playerId: 'p2', type: PieceType.Station },
                probe('p2-a', 'p2', PieceLevel.One)
            ])
        ).toEqual([ORIGIN])
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
        // The drawn ship goes back in the bag - a player who doesn't like what they drew can
        // spend a special instead and lose nothing by it.
        expect(
            state
                .getPlayerState('p1')
                .bag.items.map((p) => p.id)
                .sort()
        ).toEqual(['p1-fighter', 'p1-probe'])
        expect(state.heldPieces).toEqual([])
        expect(action.metadata?.returnedToBag?.id).toBe('p1-probe')
    })

    it('refuses a special piece the player does not have in front of them', () => {
        const state = buildState()
        const target = neighborsOf(ORIGIN)[0]

        expect(
            makePlacePiece('p1', target, PieceSource.Special, 'nope').invalidPlacePieceReason(state)
        ).toBe("That special piece isn't in front of you.")
        expect(
            makePlacePiece('p1', target, PieceSource.Special).invalidPlacePieceReason(state)
        ).toBe('No special piece was chosen.')
    })
})
