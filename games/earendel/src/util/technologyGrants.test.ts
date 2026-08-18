import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { TechnologyTier } from '../model/technology.js'
import { technologiesRipeFor } from './technologyGrants.js'
import { controllerKey, refreshPlanetControl } from './control.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { TestGame } from './testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

type Spec = { planet?: PlanetColor; technologyId?: string; ship?: [string, PieceType] }

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
                                    type: ship[1]
                                }
                            }
                          : {})
                  })
        }
    }
    return board
}

describe('technologiesRipeFor', () => {
    // Control is recorded rather than derived, so a board on its own is not enough: it has to be
    // settled into a state first. refreshPlanetControl does that, and with no incumbent recorded a
    // tie resolves to nobody - which is what these cases expect.
    const stateFor = (board: EarendelBoard, controllers: Record<string, string> = {}) => {
        const state = {
            board,
            planetControllers: controllers
        } as unknown as HydratedEarendelGameState
        refreshPlanetControl(state)
        return state
    }

    const ripeIds = (
        board: EarendelBoard,
        playerId: string,
        held: string[] = [],
        controllers: Record<string, string> = {}
    ) =>
        technologiesRipeFor(stateFor(board, controllers), playerId, held)
            .map((card) => card.id)
            .sort()

    it('is ripe for the player holding the planet outright', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }]
        ])

        expect(ripeIds(board, 'p1')).toEqual(['tech-a'])
    })

    it('is ripe for a lone probe, which is the point of a probe counting 1', () => {
        // A probe explores a planet and can now hold what it found. This is the case the whole
        // power change was for, so it is worth its own test rather than being implied by the
        // fighter above.
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Probe] }]
        ])

        expect(ripeIds(board, 'p1')).toEqual(['tech-a'])
    })

    it('is not ripe for a player who is merely present', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Station] }],
            [at(0, 1), { ship: ['p2', PieceType.Fighter] }]
        ])

        // p2's fighter outweighs the station, so p1 is beside the planet without holding it.
        expect(ripeIds(board, 'p1')).toEqual([])
        expect(ripeIds(board, 'p2')).toEqual(['tech-a'])
    })

    it('is ripe for nobody while the strongest presence is tied', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Station] }],
            [at(0, 1), { ship: ['p2', PieceType.Station] }]
        ])

        // A tie is enough to share the planet's point at the end, but not to take what it
        // holds - otherwise matching an opponent would copy their technology for one piece.
        expect(ripeIds(board, 'p1')).toEqual([])
        expect(ripeIds(board, 'p2')).toEqual([])
    })

    it('stays ripe for an incumbent who has only been DRAWN level with', () => {
        // The reported case. A player held a planet outright, a rival then matched their power
        // exactly, and the timer vanished - because a tie read as nobody holding it. Control is
        // sticky: matching someone takes nothing off them.
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Station] }],
            [at(0, 1), { ship: ['p2', PieceType.Station] }]
        ])

        expect(ripeIds(board, 'p1', [], { [controllerKey(at(0, 0))]: 'p1' })).toEqual(['tech-a'])
        // And the challenger gains nothing by drawing level.
        expect(ripeIds(board, 'p2', [], { [controllerKey(at(0, 0))]: 'p1' })).toEqual([])
    })

    it('is never ripe again once the player holds it', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }]
        ])

        expect(ripeIds(board, 'p1', ['tech-a'])).toEqual([])
    })

    it('is never ripe on a planet nobody has explored', () => {
        const board = boardOf([
            // Unexplored, so nothing is housed there yet.
            [at(0, 0), { planet: PlanetColor.Azure }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }]
        ])

        expect(ripeIds(board, 'p1')).toEqual([])
    })

    it('ripens every planet the player holds at once', () => {
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }],
            [at(2, 0), { planet: PlanetColor.Gold, technologyId: 'tech-b' }]
        ])

        expect(ripeIds(board, 'p1')).toEqual(['tech-a', 'tech-b'])
    })

    it('looks across the whole board, not just around one ship', () => {
        // Two of this player's ships, each holding a different planet, nowhere near each
        // other. The old rule asked what a single move had just won and would have seen only
        // one of these; the claim is settled per player per turn, so both come due together.
        const board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), { ship: ['p1', PieceType.Fighter] }],
            [at(8, 8), { planet: PlanetColor.Gold, technologyId: 'tech-b' }],
            [at(9, 8), { ship: ['p1', PieceType.Fighter] }]
        ])

        expect(ripeIds(board, 'p1')).toEqual(['tech-a', 'tech-b'])
    })
})

describe('claiming a technology by holding a planet', () => {
    const bagOf = (playerId: string, types: PieceType[]) =>
        types.map((type, index) => ({ id: `${playerId}-${index}`, playerId, type }))

    function scenario() {
        const game = new TestGame()
        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            [at(1, 0), {}],
            [at(0, 1), {}],
            [at(8, 8), {}],
            [at(9, 8), {}],
            [at(8, 9), {}]
        ])
        game.state.technologyDeck = []
        game.state.tileSupply = []

        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        // stackBags, not a bare assignment: the turn's draw has already happened, so setting
        // the bag alone would leave a piece from the generated bag face up and place that.
        game.stackBags((playerId) =>
            playerId === mover
                ? bagOf(mover, [PieceType.Station, PieceType.Station, PieceType.Station])
                : bagOf(other, [PieceType.Fighter, PieceType.Fighter, PieceType.Fighter])
        )

        const held = (playerId: string) =>
            game.state.players.find((p) => p.playerId === playerId)!.technologies

        return { game, mover, other, held }
    }

    it('gives nothing at the moment control is taken', () => {
        const { game, mover, held } = scenario()

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        // The planet is theirs and nobody contests it - but taking it wins nothing yet. This
        // is the whole point of the timing rule: it has to survive until their next turn.
        expect(held(mover)).toEqual([])
    })

    it('gives it at the start of the next turn, control having survived', () => {
        const { game, mover, other, held } = scenario()

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        // The other player goes elsewhere, leaving the planet alone.
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: other,
            coords: at(8, 8),
            pieceSource: PieceSource.Bag
        })
        expect(held(mover)).toEqual([])

        // The mover's turn comes round and the claim falls due as they draw.
        const [draw] = game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(8, 9),
            pieceSource: PieceSource.Bag
        })
        expect(held(mover)).toEqual(['tech-a'])
        expect(draw).toBeDefined()
    })

    it('passes the claim to whoever breaks the hold, and keeps what was already won', () => {
        const { game, mover, other, held } = scenario()

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        // A fighter outweighs the station, so the planet changes hands before the mover's
        // turn comes round - and the mover's wait comes to nothing.
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: other,
            coords: at(0, 1),
            pieceSource: PieceSource.Bag
        })

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(8, 8),
            pieceSource: PieceSource.Bag
        })
        expect(held(mover)).toEqual([])

        // The other player held it through a full round, so it is theirs.
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: other,
            coords: at(8, 9),
            pieceSource: PieceSource.Bag
        })
        expect(held(other)).toEqual(['tech-a'])
        expect(held(mover)).toEqual([])
    })
})
