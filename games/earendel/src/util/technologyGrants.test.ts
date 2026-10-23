import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyTier } from '../model/technology.js'
import type { ProbeClaim } from '../model/exploration.js'
import { probeTechnologiesFor } from './technologyGrants.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { ChoosePlanet, isChoosePlanet } from '../actions/choosePlanet.js'
import { DrawPieces, isDrawPieces } from '../actions/drawPieces.js'
import { TestGame } from './testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

type Spec = {
    planet?: PlanetColor
    technologyId?: string
    ship?: [string, PieceType, PieceLevel?]
}

function boardOf(spec: Array<[AxialCoordinates, Spec]>): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (const [coords, { planet, technologyId, ship }] of spec) {
        board.hexes[hexKey(coords)] = {
            coords,
            tileId: 't1',
            ...(planet
                ? {
                      kind: HexKind.Planet,
                      color: planet,
                      ...(technologyId
                          ? {
                                technology: {
                                    id: technologyId,
                                    colors: [planet],
                                    tier: TechnologyTier.Standard
                                },
                                explored: true
                            }
                          : {})
                  }
                : {
                      kind: HexKind.Open,
                      ...(ship
                          ? {
                                piece: {
                                    id: `${ship[0]}-${coords.q},${coords.r}`,
                                    playerId: ship[0],
                                    type: ship[1],
                                    ...(ship[2] ? { level: ship[2] } : {})
                                }
                            }
                          : {})
                  })
        }
    }
    return board
}

describe('probeTechnologiesFor', () => {
    const claim = (playerId: string, coords: AxialCoordinates, technologyId: string): ProbeClaim => ({
        playerId,
        coords,
        technologyId
    })

    // The settling is read straight off the board and the claims, so a real game state with both
    // swapped in is all it needs.
    const settle = (
        board: EarendelBoard,
        claims: ProbeClaim[],
        playerId = 'p1',
        held: string[] = []
    ) => {
        const game = new TestGame()
        game.state.board = board
        game.state.probeClaims = claims
        game.state.players.find((p) => p.playerId === playerId)!.technologies = held
        const { gained, lapsed } = probeTechnologiesFor(game.hydrated, playerId)
        return {
            gained: gained.map((card) => card.id).sort(),
            lapsed: lapsed.map((card) => card.id).sort()
        }
    }

    it('gives a claim to a player whose probes still lead', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Probe] }]
        ])

        expect(settle(board, [claim('p1', at(0, 0), 'tech-a')])).toEqual({
            gained: ['tech-a'],
            lapsed: []
        })
    })

    it('lets a claim lapse once a rival has drawn level', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Probe, PieceLevel.Two] }],
            [at(0, 1), { ship: ['p2', PieceType.Probe, PieceLevel.Two] }]
        ])

        // A tie stakes out nothing - matching a rival's probes is how a claim is blocked.
        expect(settle(board, [claim('p1', at(0, 0), 'tech-a')])).toEqual({
            gained: [],
            lapsed: ['tech-a']
        })
    })

    it('weighs probes by level, so one level 3 outweighs a level 2', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Probe, PieceLevel.Two] }],
            [at(0, 1), { ship: ['p2', PieceType.Probe, PieceLevel.Three] }]
        ])

        expect(settle(board, [claim('p1', at(0, 0), 'tech-a')])).toEqual({
            gained: [],
            lapsed: ['tech-a']
        })
    })

    it('adds probe levels up, so two level 2s beat a level 3', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Probe, PieceLevel.Two] }],
            [at(-1, 0), { ship: ['p1', PieceType.Probe, PieceLevel.Two] }],
            [at(0, 1), { ship: ['p2', PieceType.Probe, PieceLevel.Three] }]
        ])

        expect(settle(board, [claim('p1', at(0, 0), 'tech-a')])).toEqual({
            gained: ['tech-a'],
            lapsed: []
        })
    })

    it('counts only probes, however strongly a rival holds the planet', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Probe, PieceLevel.Two] }],
            [at(0, 1), { ship: ['p2', PieceType.Fighter, PieceLevel.Three] }],
            [at(-1, 0), { ship: ['p2', PieceType.Station] }]
        ])

        // p2 controls the planet for scoring, but that has no bearing on its technology.
        expect(settle(board, [claim('p1', at(0, 0), 'tech-a')])).toEqual({
            gained: ['tech-a'],
            lapsed: []
        })
    })

    it('settles every claim the player has at once, wherever they are', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Probe] }],
            [at(8, 8), { planet: PlanetColor.Teal, technologyId: 'tech-b' }],
            [at(9, 8), { ship: ['p1', PieceType.Probe] }],
            [at(4, 4), { planet: PlanetColor.Teal, technologyId: 'tech-c' }],
            [at(5, 4), { ship: ['p2', PieceType.Probe] }]
        ])

        expect(
            settle(board, [
                claim('p1', at(0, 0), 'tech-a'),
                claim('p1', at(8, 8), 'tech-b'),
                claim('p1', at(4, 4), 'tech-c')
            ])
        ).toEqual({ gained: ['tech-a', 'tech-b'], lapsed: ['tech-c'] })
    })

    it('ignores other players’ claims and technologies already held', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Probe] }],
            [at(8, 8), { planet: PlanetColor.Teal, technologyId: 'tech-b' }],
            [at(9, 8), { ship: ['p1', PieceType.Probe] }]
        ])

        expect(
            settle(
                board,
                [claim('p1', at(0, 0), 'tech-a'), claim('p2', at(8, 8), 'tech-b')],
                'p1',
                ['tech-a']
            )
        ).toEqual({ gained: [], lapsed: [] })
    })
})

describe('claiming a technology by surveying with probes', () => {
    const probe = (playerId: string, index: number, level = PieceLevel.Two): Piece => ({
        id: `${playerId}-probe-${index}`,
        playerId,
        type: PieceType.Probe,
        level
    })
    const station = (playerId: string, index: number): Piece => ({
        id: `${playerId}-station-${index}`,
        playerId,
        type: PieceType.Station
    })

    // A lone Periwinkle planet, unexplored unless asked, with a deck holding one card for it - so
    // a survey reveals it and the engine takes the only choice there is.
    function scenario({
        mover: moverBag,
        other: otherBag,
        explored = false
    }: {
        mover: (playerId: string) => Piece[]
        other: (playerId: string) => Piece[]
        explored?: boolean
    }) {
        const game = new TestGame()
        game.state.board = boardOf([
            [
                at(0, 0),
                explored
                    ? { planet: PlanetColor.Periwinkle, technologyId: 'tech-a' }
                    : { planet: PlanetColor.Periwinkle }
            ],
            [at(1, 0), {}],
            [at(0, 1), {}],
            [at(8, 8), {}],
            [at(9, 8), {}],
            [at(8, 9), {}],
            [at(9, 9), {}]
        ])
        game.state.technologyDeck = [
            { id: 'tech-a', colors: [PlanetColor.Periwinkle], tier: TechnologyTier.Standard }
        ]
        game.state.technologyDiscard = []
        game.state.tileSupply = []

        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        // stackBags, not a bare assignment: the turn's draw has already happened, so setting
        // the bag alone would leave a piece from the generated bag face up and place that.
        game.stackBags((playerId) => (playerId === mover ? moverBag(mover) : otherBag(other)))

        const place = (playerId: string, coords: AxialCoordinates) =>
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId,
                coords,
                pieceSource: PieceSource.Bag
            })
        const survey = (playerId: string, coords?: AxialCoordinates) =>
            game.run(ChoosePlanet, {
                type: ActionType.ChoosePlanet,
                playerId,
                ...(coords ? { coords } : {})
            })
        // Opens the player's turn explicitly, so the draw's report can be read.
        const draw = (playerId: string) => {
            const [action] = game.run(DrawPieces, { type: ActionType.DrawPieces, playerId })
            return isDrawPieces(action) ? action : undefined
        }
        const held = (playerId: string) =>
            game.state.players.find((p) => p.playerId === playerId)!.technologies

        return { game, mover, other, place, survey, draw, held }
    }

    const probes = (count: number, level = PieceLevel.Two) => (playerId: string) =>
        Array.from({ length: count }, (_, index) => probe(playerId, index, level))

    it('stakes a claim at the survey, leaving the probe where it is and giving nothing yet', () => {
        const { game, mover, place, survey, held } = scenario({
            mover: probes(4),
            other: probes(4)
        })

        place(mover, at(1, 0))
        expect(game.state.pendingExploration?.candidatePlanets).toEqual([at(0, 0)])
        survey(mover, at(0, 0))

        expect(game.state.board.hexes[hexKey(at(0, 0))].explored).toBe(true)
        expect(game.state.board.hexes[hexKey(at(0, 0))].technology?.id).toBe('tech-a')
        expect(game.state.board.hexes[hexKey(at(1, 0))].piece?.id).toBe(`${mover}-probe-0`)
        expect(game.state.probeClaims).toEqual([
            { playerId: mover, coords: at(0, 0), technologyId: 'tech-a' }
        ])
        // It has to survive a round of other turns first.
        expect(held(mover)).toEqual([])
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('gives it at the start of the next turn, the probe lead having survived', () => {
        const { game, mover, other, place, survey, draw, held } = scenario({
            mover: probes(4),
            other: probes(4)
        })

        place(mover, at(1, 0))
        survey(mover, at(0, 0))

        // The other player goes elsewhere, leaving the planet alone.
        place(other, at(8, 8))
        expect(held(mover)).toEqual([])

        // The mover's turn comes round and the claim falls due as they draw.
        const opening = draw(mover)
        expect(held(mover)).toEqual(['tech-a'])
        expect(opening?.metadata?.technologiesClaimed).toEqual(['tech-a'])
        expect(opening?.metadata?.technologiesLapsed).toBeUndefined()
        expect(game.state.probeClaims).toEqual([])
    })

    it('lets the claim lapse when a rival draws level before the turn comes round', () => {
        const { game, mover, other, place, survey, draw, held } = scenario({
            mover: probes(4),
            other: probes(4)
        })

        place(mover, at(1, 0))
        survey(mover, at(0, 0))

        // A matching probe ties the influence - which gives the other player no survey of
        // their own, but is enough to block the claim.
        place(other, at(0, 1))
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)

        const opening = draw(mover)
        expect(held(mover)).toEqual([])
        expect(opening?.metadata?.technologiesClaimed).toBeUndefined()
        expect(opening?.metadata?.technologiesLapsed).toEqual(['tech-a'])
        expect(game.state.probeClaims).toEqual([])
        // The planet keeps its technology for whoever wins it next.
        expect(game.state.board.hexes[hexKey(at(0, 0))].technology?.id).toBe('tech-a')
    })

    it('passes the claim to a rival who outweighs the probes and surveys it themselves', () => {
        const { game, mover, other, place, survey, draw, held } = scenario({
            mover: probes(4),
            other: probes(4, PieceLevel.Three)
        })

        place(mover, at(1, 0))
        survey(mover, at(0, 0))

        // A level 3 probe outweighs the level 2, so the other player leads now - and the
        // planet, explored and holding a technology they lack, is theirs to survey.
        place(other, at(0, 1))
        expect(game.state.pendingExploration?.candidatePlanets).toEqual([at(0, 0)])
        const processed = survey(other, at(0, 0))
        expect(processed.find(isChoosePlanet)?.metadata?.alreadyExplored).toBe(true)

        // The mover's claim lapses; the other player's waits on their own turn.
        const opening = draw(mover)
        expect(opening?.metadata?.technologiesLapsed).toEqual(['tech-a'])
        expect(game.state.probeClaims).toEqual([
            { playerId: other, coords: at(0, 0), technologyId: 'tech-a' }
        ])
        place(mover, at(8, 8))

        draw(other)
        expect(held(other)).toEqual(['tech-a'])
        expect(held(mover)).toEqual([])
    })

    it('records nothing when the player declines to survey, and ends the placement', () => {
        const { game, mover, other, place, survey, draw, held } = scenario({
            mover: probes(4),
            other: probes(4)
        })

        place(mover, at(1, 0))
        survey(mover)

        expect(game.state.probeClaims).toEqual([])
        expect(game.state.board.hexes[hexKey(at(0, 0))].explored).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(1, 0))].piece?.id).toBe(`${mover}-probe-0`)
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).toBe(other)

        place(other, at(8, 8))
        const opening = draw(mover)
        expect(held(mover)).toEqual([])
        expect(opening?.metadata?.technologiesClaimed).toBeUndefined()
    })

    it('gives nothing for holding a planet outright with stations, however long', () => {
        const { game, mover, other, place, draw, held } = scenario({
            mover: (playerId) => [0, 1, 2, 3].map((index) => station(playerId, index)),
            other: (playerId) => [0, 1, 2, 3].map((index) => station(playerId, index)),
            explored: true
        })

        place(mover, at(1, 0))
        expect(game.state.planetControllers[hexKey(at(0, 0))]).toBe(mover)

        place(other, at(8, 8))
        draw(mover)

        // Still theirs for scoring, but control alone never wins what the planet holds.
        expect(game.state.planetControllers[hexKey(at(0, 0))]).toBe(mover)
        expect(held(mover)).toEqual([])
        expect(game.state.probeClaims).toEqual([])
    })
})
