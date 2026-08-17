import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType, powerOf } from '../model/pieces.js'
import { TechnologyTier } from '../model/technology.js'
import { attackableTargets } from '../util/attack.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { DrawPieces } from '../actions/drawPieces.js'
import { AttackPiece } from '../actions/attackPiece.js'
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
        // A probe counts 1 whatever its level: level decides how many cards it turns over, not
        // how hard it holds a planet. So a level 3 probe is a better explorer than a level 2 one
        // and no better a claim.
        expect(powerOf(ship('p1', PieceType.Probe, PieceLevel.Three))).toBe(1)
        expect(powerOf(ship('p1', PieceType.Probe, PieceLevel.Two))).toBe(1)
        expect(powerOf(ship('p1', PieceType.Station))).toBe(1)
        // A fighter won from a technology, carrying no level of its own.
        expect(powerOf(ship('p1', PieceType.Fighter))).toBe(2)
    })
})

describe('attackableTargets', () => {
    it('offers everything adjacent it can remove that belongs to someone else', () => {
        const board = boardOf([
            [at(0, 0), { ship: ship('p1', PieceType.Fighter, PieceLevel.Three) }],
            [at(0, 1), { ship: ship('p2', PieceType.Probe, PieceLevel.Two) }],
            [at(1, -1), { ship: ship('p2', PieceType.Fighter, PieceLevel.Two) }]
        ])

        expect(attackableTargets(board, at(0, 0), 'p1')).toHaveLength(2)
    })

    it('never offers a station, whatever the fighter’s level', () => {
        // A station is a structure, not a ship. Removing one is meant to take a special
        // piece won from a technology, not a fighter.
        const board = boardOf([
            [at(0, 0), { ship: ship('p1', PieceType.Fighter, PieceLevel.Three) }],
            [at(1, 0), { ship: ship('p2', PieceType.Station) }]
        ])

        expect(attackableTargets(board, at(0, 0), 'p1')).toEqual([])
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

        expect(attackableTargets(board, at(0, 0), 'p1')).toEqual([])
    })

    it('offers nothing to a piece that isn’t a fighter', () => {
        const board = boardOf([
            [at(0, 0), { ship: ship('p1', PieceType.Probe, PieceLevel.Three) }],
            [at(1, 0), { ship: ship('p2', PieceType.Station) }]
        ])

        expect(attackableTargets(board, at(0, 0), 'p1')).toEqual([])
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
        expect(game.validActionsFor(mover)).toEqual([ActionType.AttackPiece])

        const [shot] = game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(1, 0)
        })

        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeUndefined()
        expect((shot as AttackPiece).metadata?.target?.playerId).toBe(other)
        // Out of the game entirely, not back into its owner's bag - which still holds exactly
        // the two it started with, since that player has not opened their turn yet.
        expect(game.state.players.find((p) => p.playerId === other)!.bag).toHaveLength(2)
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('wears an enemy fighter down a level instead of removing it', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        game.state.board = boardOf([
            [at(0, 0), {}],
            [at(1, 0), { ship: ship(other, PieceType.Fighter, PieceLevel.Two) }],
            [at(5, 5), {}]
        ])
        game.state.technologyDeck = []
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Three),
            ship(playerId, PieceType.Station)
        ])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })

        const [shot] = game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(1, 0)
        })

        // Still standing, but at level 1 - and since a fighter's level is its power, it now
        // holds the planets around it no harder than a station would.
        const hit = game.state.board.hexes[hexKey(at(1, 0))].piece!
        expect(hit.level).toBe(PieceLevel.One)
        expect(powerOf(hit)).toBe(1)
        expect((shot as AttackPiece).metadata?.damaged).toBe(true)
        expect((shot as AttackPiece).metadata?.levelAfter).toBe(1)
    })

    it('destroys a fighter already worn down to level 1', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        game.state.board = boardOf([
            [at(0, 0), {}],
            [at(1, 0), { ship: ship(other, PieceType.Fighter, PieceLevel.One) }],
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

        const [shot] = game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(1, 0)
        })

        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeUndefined()
        expect((shot as AttackPiece).metadata?.damaged).toBeUndefined()
    })

    it('still needs a bigger fighter to touch one at all', () => {
        // A level 1 fighter has power 1, so a level 2 can reach it but an equal cannot.
        const board = boardOf([
            [at(0, 0), { ship: ship('p1', PieceType.Fighter, PieceLevel.One) }],
            [at(1, 0), { ship: ship('p2', PieceType.Fighter, PieceLevel.One) }],
            [at(0, 1), { ship: ship('p2', PieceType.Station) }]
        ])

        // Equal levels: nothing happens either way. And a station out-powers it but is not a
        // fighter, so it never fires at all.
        expect(attackableTargets(board, at(0, 0), 'p1')).toEqual([])
        expect(attackableTargets(board, at(1, 0), 'p2')).toEqual([])
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

        const [declined] = game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover
        })

        expect((declined as AttackPiece).metadata?.declined).toBe(true)
        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeDefined()
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
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

        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.state.pendingAttack).toBeUndefined()
    })

    it('leaves a bystander holding a planet, to claim on their own next turn', () => {
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
            [at(5, 5), {}],
            [at(6, 5), {}]
        ])
        game.state.technologyDeck = []
        game.state.tileSupply = []
        // A level 3 fighter, since only a bigger fighter can remove the level 2 blocker.
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Three),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station)
        ])

        const held = (playerId: string) =>
            game.state.players.find((p) => p.playerId === playerId)!.technologies

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(2, 0),
            pieceSource: PieceSource.Bag
        })
        game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(1, 0)
        })

        // The tie is broken and the bystander now holds the planet outright - but a shot hands
        // nothing over. It has started someone else's wait, which is the strange and rather
        // good part: the attacker has given a third party a technology they must now defend.
        expect(held(bystander)).toEqual([])
        expect(held(mover)).toEqual([])

        // The blocker's turn passes without touching the planet.
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: blocker,
            coords: at(5, 5),
            pieceSource: PieceSource.Bag
        })

        // And now it is the bystander's turn, so the hold pays.
        game.run(DrawPieces, { type: ActionType.DrawPieces, playerId: bystander })
        expect(held(bystander)).toEqual(['tech-a'])
        expect(held(mover)).toEqual([])
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
            game.run(AttackPiece, {
                type: ActionType.AttackPiece,
                playerId: mover,
                coords: at(4, 4)
            })
        ).toThrow()
        expect(() =>
            game.run(AttackPiece, {
                type: ActionType.AttackPiece,
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
