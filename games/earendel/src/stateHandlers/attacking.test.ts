import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType, powerOf } from '../model/pieces.js'
import { TechnologyTier } from '../model/technology.js'
import { destroyableTargets } from '../util/attack.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { DestroyPiece } from '../actions/destroyPiece.js'
import { TestGame } from '../util/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

type Spec = { planet?: PlanetColor; technologyId?: string; ship?: Piece }

const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}${level ?? ''}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

function boardOf(spec: Array<[AxialCoordinates, Spec]>): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (const [coords, { planet, technologyId, ship: piece }] of spec) {
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
                : { kind: HexKind.Open, ...(piece ? { piece } : {}) })
        }
    }
    return board
}

describe('powerOf', () => {
    it('reads a fighter’s level as its power, and leaves the others alone', () => {
        expect(powerOf(ship('p1', PieceType.Fighter, PieceLevel.Two))).toBe(2)
        expect(powerOf(ship('p1', PieceType.Fighter, PieceLevel.Three))).toBe(3)
        // A level 3 probe is still no claim at all - level means reveals, not power.
        expect(powerOf(ship('p1', PieceType.Probe, PieceLevel.Three))).toBe(0)
        expect(powerOf(ship('p1', PieceType.Station))).toBe(1)
        // A fighter won from a technology, carrying no level of its own.
        expect(powerOf(ship('p1', PieceType.Fighter))).toBe(2)
    })
})

describe('destroyableTargets', () => {
    it('offers everything adjacent it can remove that belongs to someone else', () => {
        const board = boardOf([
            [at(0, 0), { ship: ship('p1', PieceType.Fighter, PieceLevel.Three) }],
            [at(0, 1), { ship: ship('p2', PieceType.Probe, PieceLevel.Two) }],
            [at(1, -1), { ship: ship('p2', PieceType.Fighter, PieceLevel.Two) }]
        ])

        expect(destroyableTargets(board, at(0, 0), 'p1')).toHaveLength(2)
    })

    it('never offers a station, whatever the fighter’s level', () => {
        // A station is a structure, not a ship. Removing one is meant to take a special
        // piece won from a technology, not a fighter.
        const board = boardOf([
            [at(0, 0), { ship: ship('p1', PieceType.Fighter, PieceLevel.Three) }],
            [at(1, 0), { ship: ship('p2', PieceType.Station) }]
        ])

        expect(destroyableTargets(board, at(0, 0), 'p1')).toEqual([])
    })

    it('spares an equal, a stronger, and the fighter’s own side', () => {
        const board = boardOf([
            [at(0, 0), { ship: ship('p1', PieceType.Fighter, PieceLevel.Two) }],
            // Equal: nothing kills its own match.
            [at(1, 0), { ship: ship('p2', PieceType.Fighter, PieceLevel.Two) }],
            // Stronger.
            [at(0, 1), { ship: ship('p2', PieceType.Fighter, PieceLevel.Three) }],
            // Weaker, but the attacker's own.
            [at(1, -1), { ship: ship('p1', PieceType.Probe, PieceLevel.Two) }]
        ])

        expect(destroyableTargets(board, at(0, 0), 'p1')).toEqual([])
    })

    it('offers nothing to a piece that isn’t a fighter', () => {
        const board = boardOf([
            [at(0, 0), { ship: ship('p1', PieceType.Probe, PieceLevel.Three) }],
            [at(1, 0), { ship: ship('p2', PieceType.Station) }]
        ])

        expect(destroyableTargets(board, at(0, 0), 'p1')).toEqual([])
    })
})

describe('a fighter arriving', () => {
    it('holds the turn open to offer the shot, and takes it', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        game.state.board = boardOf([
            [at(0, 0), {}],
            [at(1, 0), { ship: ship(other, PieceType.Probe, PieceLevel.Two) }],
            [at(5, 5), {}]
        ])
        game.state.technologyDeck = []
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Two),
            ship(playerId, PieceType.Station)
        ])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })

        // Firing is optional, so even a single target is a decision the player must make -
        // it is never taken for them the way a lone exploration choice is.
        expect(game.state.machineState).toBe(MachineState.Attacking)
        expect(game.activePlayerId).toBe(mover)
        expect(game.validActionsFor(mover)).toEqual([ActionType.DestroyPiece])

        const [shot] = game.run(DestroyPiece, {
            type: ActionType.DestroyPiece,
            playerId: mover,
            coords: at(1, 0)
        })

        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeUndefined()
        expect((shot as DestroyPiece).metadata?.destroyed?.playerId).toBe(other)
        // Out of the game entirely - not back into its owner's bag.
        // They started with two pieces and have since drawn one for their own turn, so one
        // is left. Had the destroyed station gone back, there would be two.
        expect(game.state.players.find((p) => p.playerId === other)!.bag).toHaveLength(1)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('may decline, and the turn ends just the same', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        game.state.board = boardOf([
            [at(0, 0), {}],
            [at(1, 0), { ship: ship(other, PieceType.Probe, PieceLevel.Two) }],
            [at(5, 5), {}]
        ])
        game.state.technologyDeck = []
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Two),
            ship(playerId, PieceType.Station)
        ])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })

        const [declined] = game.run(DestroyPiece, {
            type: ActionType.DestroyPiece,
            playerId: mover
        })

        expect((declined as DestroyPiece).metadata?.declined).toBe(true)
        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeDefined()
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('never stops the turn when there is nothing it could destroy', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        game.state.board = boardOf([
            [at(0, 0), {}],
            // An equal fighter is safe, so the arrival has no target at all.
            [at(1, 0), { ship: ship(other, PieceType.Fighter, PieceLevel.Two) }],
            [at(5, 5), {}]
        ])
        game.state.technologyDeck = []
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Two),
            ship(playerId, PieceType.Station)
        ])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })

        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.state.pendingAttack).toBeUndefined()
    })

    it('hands a planet’s technology to a bystander when the shot clears the way', () => {
        const game = new TestGame(3)
        const [mover, blocker, bystander] = game.state.turnManager.turnOrder

        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure, technologyId: 'tech-a' }],
            // The blocker's fighter ties the bystander's, so nobody holds the planet outright
            // and the bystander has never been able to take it.
            [at(1, 0), { ship: ship(blocker, PieceType.Fighter, PieceLevel.Two) }],
            [at(0, 1), { ship: ship(bystander, PieceType.Fighter, PieceLevel.Two) }],
            // Where the mover's fighter lands: adjacent to the blocker, not to the planet.
            [at(2, 0), {}],
            [at(5, 5), {}]
        ])
        game.state.technologyDeck = []
        // A level 3 fighter, since only a bigger fighter can remove the level 2 blocker.
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Three),
            ship(playerId, PieceType.Station)
        ])

        expect(game.state.players.find((p) => p.playerId === bystander)!.technologies).toEqual([])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(2, 0),
            pieceSource: PieceSource.Bag
        })

        const [shot] = game.run(DestroyPiece, {
            type: ActionType.DestroyPiece,
            playerId: mover,
            coords: at(1, 0)
        })

        // With the tie broken by the removal, the bystander now holds the planet outright and
        // gains what it holds - without having taken any part in the attack.
        expect(game.state.players.find((p) => p.playerId === bystander)!.technologies).toEqual([
            'tech-a'
        ])
        expect(game.state.players.find((p) => p.playerId === mover)!.technologies).toEqual([])
        expect((shot as DestroyPiece).metadata?.technologiesGained).toEqual({
            [bystander]: ['tech-a']
        })
    })

    it('refuses a target out of reach, and a shot that isn’t yours', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        game.state.board = boardOf([
            [at(0, 0), {}],
            [at(1, 0), { ship: ship(other, PieceType.Probe, PieceLevel.Two) }],
            [at(4, 4), { ship: ship(other, PieceType.Probe, PieceLevel.Two) }],
            [at(5, 5), {}]
        ])
        game.state.technologyDeck = []
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Two),
            ship(playerId, PieceType.Station)
        ])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })

        expect(() =>
            game.run(DestroyPiece, {
                type: ActionType.DestroyPiece,
                playerId: mover,
                coords: at(4, 4)
            })
        ).toThrow()
        expect(() =>
            game.run(DestroyPiece, {
                type: ActionType.DestroyPiece,
                playerId: other,
                coords: at(1, 0)
            })
        ).toThrow()
    })
})

describe('the starting bag', () => {
    it('deals the levelled types evenly between the two levels', () => {
        const game = new TestGame()
        // A player who hasn't taken a turn yet, so their bag is still whole - the player on
        // turn has already drawn.
        const bag = game.state.players.find((p) => p.playerId !== game.activePlayerId)!.bag

        const levelsOf = (type: PieceType) =>
            bag.filter((piece) => piece.type === type).map((piece) => piece.level)

        expect(levelsOf(PieceType.Fighter).sort()).toEqual([2, 2, 2, 2, 3, 3, 3, 3])
        expect(levelsOf(PieceType.Probe).sort()).toEqual([2, 2, 2, 2, 3, 3, 3, 3])
        // Stations have no level: nothing about them varies.
        expect(levelsOf(PieceType.Station).every((level) => level === undefined)).toBe(true)
        expect(levelsOf(PieceType.Station)).toHaveLength(6)
    })
})
