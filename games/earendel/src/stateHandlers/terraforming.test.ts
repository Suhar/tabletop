import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType, powerOf } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { focusedCardId } from '../model/technologyCards.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { isTerraform, Terraform } from '../actions/terraform.js'
import { attackOutcome } from '../util/attack.js'
import { grantTechnology } from '../util/technologyGrants.js'
import { TestGame, stackedBag } from '../util/testHarness.js'

// rules.md, Terraformer: placed beside a planet no other terraformer touches, it may change that
// planet's colour.

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// A Teal planet at (0, 0) with open space round it; the mover holds a Terraformer.
function scenario(pieces: Array<[AxialCoordinates, (mover: string, other: string) => Piece]> = []) {
    const game = new TestGame()
    const mover = game.activePlayerId
    const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board: EarendelBoard = { hexes: {} }
    for (let q = -3; q <= 3; q++) {
        for (let r = -3; r <= 3; r++) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    board.hexes[hexKey(at(0, 0))] = {
        coords: at(0, 0),
        tileId: 't1',
        kind: HexKind.Planet,
        color: PlanetColor.Teal
    }
    for (const [coords, make] of pieces) board.hexes[hexKey(coords)].piece = make(mover, other)
    game.state.board = board
    game.state.technologyDeck = stackedBag([])
    game.state.tileSupply = stackedBag([])
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])
    const terraformer = ship(mover, PieceType.Terraformer)
    game.state.players.find((p) => p.playerId === mover)!.specialPieces = [terraformer]

    const placeTerraformer = (coords: AxialCoordinates) =>
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords,
            pieceSource: PieceSource.Special,
            pieceId: terraformer.id
        })
    const terraform = (planet?: AxialCoordinates, color?: PlanetColor) =>
        game
            .run(Terraform, {
                type: ActionType.Terraform,
                playerId: mover,
                ...(planet ? { planet } : {}),
                ...(color ? { color } : {})
            })
            .find(isTerraform)

    return { game, mover, other, placeTerraformer, terraform }
}

const colourAt = (board: EarendelBoard, coords: AxialCoordinates) =>
    board.hexes[hexKey(coords)].color

describe('Terraformer', () => {
    it('is granted by Terraforming as a special piece', () => {
        const { game, other } = scenario()
        const card = focusedCardId(TechnologyEffectKind.Terraforming, PlanetColor.Teal, 0)

        const hydrated = game.hydrated
        grantTechnology(hydrated, other, card)

        expect(hydrated.getPlayerState(other).specialPieces).toEqual([
            expect.objectContaining({ playerId: other, type: PieceType.Terraformer })
        ])
    })

    it('may recolour a planet beside it that no terraformer touches', () => {
        const { game, mover, placeTerraformer, terraform } = scenario()

        placeTerraformer(at(1, 0))
        expect(game.state.machineState).toBe(MachineState.Terraforming)
        expect(game.state.pendingTerraform?.planets).toEqual([at(0, 0)])
        expect(game.validActionsFor(mover)).toEqual([ActionType.Terraform])

        const done = terraform(at(0, 0), PlanetColor.Violet)

        expect(colourAt(game.state.board, at(0, 0))).toBe(PlanetColor.Violet)
        expect(done?.metadata).toEqual({ fromColor: PlanetColor.Teal, toColor: PlanetColor.Violet })
        expect(game.state.pendingTerraform).toBeUndefined()
        expect(game.state.machineState).not.toBe(MachineState.Terraforming)
    })

    it('may leave the planet as it is', () => {
        const { game, placeTerraformer, terraform } = scenario()

        placeTerraformer(at(1, 0))
        const done = terraform()

        expect(colourAt(game.state.board, at(0, 0))).toBe(PlanetColor.Teal)
        expect(done?.metadata).toEqual({ declined: true })
    })

    it('refuses a planet it is not beside, or its own colour', () => {
        const { placeTerraformer, terraform } = scenario()

        placeTerraformer(at(1, 0))

        expect(() => terraform(at(3, 3), PlanetColor.Violet)).toThrow()
        expect(() => terraform(at(0, 0), PlanetColor.Teal)).toThrow()
    })

    it('has no effect beside a planet another terraformer already touches', () => {
        const { game, placeTerraformer } = scenario([
            [at(-1, 0), (_mover, other) => ship(other, PieceType.Terraformer)]
        ])

        placeTerraformer(at(1, 0))

        expect(game.state.pendingTerraform).toBeUndefined()
        expect(game.state.machineState).not.toBe(MachineState.Terraforming)
        expect(colourAt(game.state.board, at(0, 0))).toBe(PlanetColor.Teal)
    })

    it('counts 1 toward control and cannot be attacked', () => {
        const terraformer = ship('p1', PieceType.Terraformer)
        expect(powerOf(terraformer)).toBe(1)
        expect(
            attackOutcome(ship('p2', PieceType.Fighter, PieceLevel.Three), terraformer)
        ).toBeUndefined()
    })
})
