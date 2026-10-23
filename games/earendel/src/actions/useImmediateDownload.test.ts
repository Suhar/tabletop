import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { type TechnologyCard, TechnologyEffectKind, TechnologyTier } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { UseImmediateDownload } from './useImmediateDownload.js'
import { planetsInSightOf } from '../util/lineOfSight.js'
import { downloadTargetsFrom } from '../util/download.js'
import { TestGame } from '../util/testHarness.js'
import { bagOf } from '../util/drawBags.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type
})

const card = (id: string, kind?: TechnologyEffectKind): TechnologyCard => ({
    id,
    colors: [PlanetColor.Periwinkle],
    tier: TechnologyTier.Standard,
    ...(kind ? { effect: { kind } } : {})
})

function openRow(length = 16): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < length; q++) {
        for (const r of [0, 3]) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    return board
}

const planet = (
    board: EarendelBoard,
    coords: AxialCoordinates,
    technology?: TechnologyCard,
    explored = true
) => {
    board.hexes[hexKey(coords)] = {
        coords,
        tileId: 't1',
        kind: HexKind.Planet,
        color: PlanetColor.Periwinkle,
        ...(explored ? { explored } : {}),
        ...(technology ? { technology } : {})
    }
}

// The anchor planet at (2,0) holds the mover's Download. A far planet at (8,0) holds a Railgun,
// with clear space between them. Row 3 is spare.
function scenario(farEffect: TechnologyEffectKind | undefined = TechnologyEffectKind.Railgun) {
    const game = new TestGame()
    const mover = game.activePlayerId
    const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board = openRow()
    const download = card('tech-download', TechnologyEffectKind.ImmediateDownload)
    planet(board, at(2, 0), download)
    planet(board, at(8, 0), card('tech-far', farEffect))

    game.state.board = board
    game.state.technologyDeck = bagOf([])
    game.state.tileSupply = bagOf([])
    const playerState = game.state.players.find((p) => p.playerId === mover)!
    // Gained the hard way already: they hold the Download card and its stored effect.
    playerState.technologies = ['tech-download']
    playerState.storedEffects = [TechnologyEffectKind.ImmediateDownload]
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])

    return { game, mover, other }
}

const download = (playerId: string, from: AxialCoordinates, to: AxialCoordinates) => ({
    type: ActionType.UseImmediateDownload as const,
    playerId,
    from,
    to
})

describe('clear line of sight', () => {
    it('reaches an adjacent planet - there is nothing in between to block', () => {
        const board = openRow()
        planet(board, at(2, 0))
        planet(board, at(3, 0))

        // The one deliberate difference from the station sight-link rule, which skips a station
        // standing right next door. Two neighbouring planets must not be the single pair that
        // cannot see each other.
        expect(planetsInSightOf(board, at(2, 0)).map(hexKey)).toContain(hexKey(at(3, 0)))
    })

    it('is blocked by any piece between, including the viewer’s own', () => {
        const board = openRow()
        planet(board, at(2, 0))
        planet(board, at(8, 0))
        expect(planetsInSightOf(board, at(2, 0)).map(hexKey)).toContain(hexKey(at(8, 0)))

        board.hexes[hexKey(at(5, 0))].piece = ship('p1', PieceType.Probe)
        expect(planetsInSightOf(board, at(2, 0)).map(hexKey)).not.toContain(hexKey(at(8, 0)))
    })

    it('is blocked by a planet between, and stops at the nearer one', () => {
        const board = openRow()
        planet(board, at(2, 0))
        planet(board, at(5, 0))
        planet(board, at(8, 0))

        const seen = planetsInSightOf(board, at(2, 0)).map(hexKey)
        expect(seen).toContain(hexKey(at(5, 0)))
        expect(seen).not.toContain(hexKey(at(8, 0)))
    })

    it('only runs along the six axes', () => {
        const board = openRow()
        planet(board, at(2, 0))
        // Row 3 is not on any axis from row 0, so nothing there is ever in sight.
        planet(board, at(8, 3))
        expect(planetsInSightOf(board, at(2, 0))).toEqual([])
    })
})

describe('Immediate Download', () => {
    it('takes the technology of a planet in sight, with no wait', () => {
        const { game, mover } = scenario()

        expect(game.validActionsFor(mover)).toContain(ActionType.UseImmediateDownload)

        game.run(UseImmediateDownload, download(mover, at(2, 0), at(8, 0)))

        const playerState = game.state.players.find((p) => p.playerId === mover)!
        expect(playerState.technologies).toContain('tech-far')
        // A Railgun is a cooldown power, so "available immediately" means it is simply usable.
        expect(playerState.cooldownEffects).toContain(TechnologyEffectKind.Railgun)
        // Spent: one time use.
        expect(playerState.storedEffects).not.toContain(TechnologyEffectKind.ImmediateDownload)
        // The turn carries on - this costs a power, not the placement.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('leaves the card on its planet, and its owner holding it too', () => {
        const { game, mover, other } = scenario()
        game.state.players.find((p) => p.playerId === other)!.technologies = ['tech-far']

        game.run(UseImmediateDownload, download(mover, at(2, 0), at(8, 0)))

        // A technology gained is a record, not a token: nobody is robbed.
        expect(game.state.board.hexes[hexKey(at(8, 0))].technology?.id).toBe('tech-far')
        expect(game.state.players.find((p) => p.playerId === other)!.technologies).toContain(
            'tech-far'
        )
    })

    it('resolves a downloaded Immediate effect on the spot', () => {
        const { game, mover } = scenario(TechnologyEffectKind.MoveFriendlyPiece)
        // Something for it to move: with an empty board Tactical Shift has no decision to offer
        // and auto-resolves, which would hide the routing this test is about.
        game.state.board.hexes[hexKey(at(0, 3))].piece = ship(mover, PieceType.Station)

        game.run(UseImmediateDownload, download(mover, at(2, 0), at(8, 0)))

        // Tactical Shift acts at once when gained, so downloading it hands the player its
        // decision rather than a card to remember.
        expect(game.state.machineState).toBe(MachineState.ResolvingTechnology)
        expect(game.state.pendingTechnology?.kind).toBe(TechnologyEffectKind.MoveFriendlyPiece)
    })

    it('refuses a planet it cannot see, one already held, and an unexplored one', () => {
        const { game, mover } = scenario()

        // Blocked by a ship standing between the two planets.
        game.state.board.hexes[hexKey(at(5, 0))].piece = ship(mover, PieceType.Probe)
        expect(downloadTargetsFrom(game.hydrated, mover, at(2, 0))).toEqual([])
        expect(() => game.run(UseImmediateDownload, download(mover, at(2, 0), at(8, 0)))).toThrow()
        delete game.state.board.hexes[hexKey(at(5, 0))].piece

        // Already theirs - nothing to download, and a one-shot power would be wasted.
        game.state.players.find((p) => p.playerId === mover)!.technologies = [
            'tech-download',
            'tech-far'
        ]
        expect(() => game.run(UseImmediateDownload, download(mover, at(2, 0), at(8, 0)))).toThrow()
        game.state.players.find((p) => p.playerId === mover)!.technologies = ['tech-download']

        // Unexplored, so it holds no technology to read.
        delete game.state.board.hexes[hexKey(at(8, 0))].technology
        game.state.board.hexes[hexKey(at(8, 0))].explored = false
        expect(() => game.run(UseImmediateDownload, download(mover, at(2, 0), at(8, 0)))).toThrow()
    })

    it('must be spent from a planet actually holding the player’s Download', () => {
        const { game, mover } = scenario()
        // The far planet is in sight and holds a technology, but it isn't the anchor.
        expect(() => game.run(UseImmediateDownload, download(mover, at(8, 0), at(2, 0)))).toThrow()
    })

    it('is not offered without the stored effect', () => {
        const { game, mover } = scenario()
        game.state.players.find((p) => p.playerId === mover)!.storedEffects = []

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseImmediateDownload)
    })
})
