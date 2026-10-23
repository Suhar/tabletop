import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { AttackPiece } from './attackPiece.js'
import { isUseTacticalFeint, UseTacticalFeint } from './useTacticalFeint.js'
import { ChoosePlanet } from './choosePlanet.js'
import { TestGame } from '../util/testHarness.js'
import { controllerKey } from '../util/control.js'
import { bagOf } from '../util/drawBags.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// Two long rows of open space, far enough apart that nothing in one row touches the other - so a
// scenario can put an unrelated arrangement in row 3 without it interfering with row 0.
function openRow(length = 14): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < length; q++) {
        for (const r of [0, 3]) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    return board
}

// The mover holds Tactical Feint, with one of their ships beside an enemy ship.
function scenario(mine: PieceType, theirs: PieceType, level?: PieceLevel) {
    const game = new TestGame()
    const mover = game.activePlayerId
    const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board = openRow()
    board.hexes[hexKey(at(0, 0))].piece = ship(mover, mine, level)
    board.hexes[hexKey(at(1, 0))].piece = ship(other, theirs)
    game.state.board = board
    game.state.technologyDeck = bagOf([])
    game.state.tileSupply = bagOf([])
    game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = [
        TechnologyEffectKind.TacticalFeint
    ]
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])

    return { game, mover, other }
}

const feint = (playerId: string, from: AxialCoordinates, to: AxialCoordinates) => ({
    type: ActionType.UseTacticalFeint as const,
    playerId,
    from,
    to
})

describe('Tactical Feint', () => {
    it('trades places with the adjacent enemy ship', () => {
        const { game, mover, other } = scenario(PieceType.Station, PieceType.Probe)

        expect(game.validActionsFor(mover)).toContain(ActionType.UseTacticalFeint)

        game.run(UseTacticalFeint, feint(mover, at(0, 0), at(1, 0)))

        expect(game.state.board.hexes[hexKey(at(1, 0))].piece?.playerId).toBe(mover)
        expect(game.state.board.hexes[hexKey(at(0, 0))].piece?.playerId).toBe(other)

        // The placement the turn already owed is still owed: the feint spends a power, not a ship.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).toBe(mover)
    })

    it('arrives shooting, and may shoot the ship it displaced', () => {
        const { game, mover } = scenario(PieceType.Fighter, PieceType.Probe, PieceLevel.Three)

        game.run(UseTacticalFeint, feint(mover, at(0, 0), at(1, 0)))

        // "As if newly placed" includes the shot a fighter takes on landing - and the displaced
        // probe has been put down right next to it, so it is a legal target.
        expect(game.state.machineState).toBe(MachineState.Attacking)
        expect(game.state.pendingAttack?.fighterCoords).toEqual(at(1, 0))

        game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(0, 0)
        })

        expect(game.state.board.hexes[hexKey(at(0, 0))].piece).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('explores from a probe swapped in beside an unexplored planet', () => {
        const { game, mover } = scenario(PieceType.Probe, PieceType.Station)
        // A planet touching (1, 0) but not (0, 0), so only the swap reaches it.
        game.state.board.hexes[hexKey(at(2, 0))] = {
            coords: at(2, 0),
            tileId: 't1',
            kind: HexKind.Planet,
            color: PlanetColor.Periwinkle
        }

        const arrival = game
            .run(UseTacticalFeint, feint(mover, at(0, 0), at(1, 0)))
            .find(isUseTacticalFeint)

        // The swapped-in probe is offered the planet just as a placed one would be, and sending
        // it is the player's call.
        expect(arrival?.metadata?.probeDestinations).toEqual([at(2, 0)])
        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.validActionsFor(mover)).toEqual([ActionType.ChoosePlanet])

        game.run(ChoosePlanet, { type: ActionType.ChoosePlanet, playerId: mover, coords: at(2, 0) })

        // An empty technology deck leaves nothing to choose, so the rest of the exploration is
        // taken on the player's behalf and the turn is back at its placement by the time control
        // returns here.
        expect(game.state.board.hexes[hexKey(at(2, 0))].explored).toBe(true)
        // The probe surveys from where it stands.
        expect(game.state.board.hexes[hexKey(at(1, 0))].piece?.playerId).toBe(mover)
        expect(game.state.pendingExploration).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('lands the displaced ship without giving it an arrival of its own', () => {
        const { game, mover, other } = scenario(PieceType.Probe, PieceType.Station)
        // An unexplored planet beside the hex the enemy station is about to be pushed onto. A
        // station is not a probe, so this would never explore - but a group of the enemy's own
        // stations would score, and being shoved into one must not pay them.
        game.state.board.hexes[hexKey(at(0, 3))].piece = ship(other, PieceType.Station)
        game.state.board.hexes[hexKey(at(1, 3))].piece = ship(other, PieceType.Station)
        const before = game.state.players.find((p) => p.playerId === other)!.score

        // Row 3 is where the enemy's cluster is; put the swap next to it so the displaced station
        // lands adjacent to two of its own.
        game.state.board.hexes[hexKey(at(2, 3))].piece = ship(mover, PieceType.Probe)
        game.state.board.hexes[hexKey(at(3, 3))].piece = ship(other, PieceType.Station)

        game.run(UseTacticalFeint, feint(mover, at(2, 3), at(3, 3)))

        expect(game.state.board.hexes[hexKey(at(2, 3))].piece?.playerId).toBe(other)
        expect(game.state.players.find((p) => p.playerId === other)!.score).toBe(before)
    })

    it('takes control of a planet the swap reaches', () => {
        const { game, mover, other } = scenario(
            PieceType.Fighter,
            PieceType.Probe,
            PieceLevel.Three
        )
        game.state.board.hexes[hexKey(at(2, 0))] = {
            coords: at(2, 0),
            tileId: 't1',
            kind: HexKind.Planet,
            color: PlanetColor.Periwinkle,
            explored: true
        }
        // Read straight out of the recorded controllers, which is where control now lives: it is
        // sticky, so it cannot be recomputed from the board after the fact.
        const controller = () => game.state.planetControllers?.[controllerKey(at(2, 0))]
        // The enemy probe holds the planet at 1 power until it is pushed out of the way.
        game.state.planetControllers = {}
        expect(controller()).toBeUndefined()

        game.run(UseTacticalFeint, feint(mover, at(0, 0), at(1, 0)))

        // A level 3 fighter beside the planet, and the probe now a hex further away: control
        // moves with the swap, which is checked here because resolveArrival is what refreshes it.
        expect(controller()).toBe(mover)
        expect(controller()).not.toBe(other)
    })

    it('goes on cooldown, so it cannot be used twice in a turn', () => {
        const { game, mover } = scenario(PieceType.Station, PieceType.Probe)

        game.run(UseTacticalFeint, feint(mover, at(0, 0), at(1, 0)))

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseTacticalFeint)
    })

    it('refuses a ship that is not adjacent, not the enemy’s, or not there at all', () => {
        const { game, mover, other } = scenario(PieceType.Station, PieceType.Probe)
        game.state.board.hexes[hexKey(at(5, 0))].piece = ship(other, PieceType.Probe)
        game.state.board.hexes[hexKey(at(0, 3))].piece = ship(mover, PieceType.Station)

        // Two hexes apart.
        expect(() => game.run(UseTacticalFeint, feint(mover, at(0, 0), at(5, 0)))).toThrow()
        // A ship of the player's own is not something to feint against.
        expect(() => game.run(UseTacticalFeint, feint(mover, at(0, 0), at(0, 3)))).toThrow()
        // Empty space.
        expect(() => game.run(UseTacticalFeint, feint(mover, at(0, 0), at(1, 3)))).toThrow()
        // And the other way round: nothing of the player's own on the hex they feint from.
        expect(() => game.run(UseTacticalFeint, feint(mover, at(1, 0), at(0, 0)))).toThrow()
    })

    it('is not offered at all without the technology', () => {
        const { game, mover } = scenario(PieceType.Station, PieceType.Probe)
        game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = []

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseTacticalFeint)
    })
})
