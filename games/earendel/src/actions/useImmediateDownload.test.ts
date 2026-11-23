import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { focusedCardId } from '../model/technologyCards.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { UseImmediateDownload } from './useImmediateDownload.js'
import { downloadTargetsFrom } from '../util/download.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type
})

const card = (effect: TechnologyEffectKind, copy = 0) =>
    focusedCardId(effect, PlanetColor.Periwinkle, copy)

const DOWNLOAD = card(TechnologyEffectKind.ImmediateDownload)
const FAR_RAILGUN = card(TechnologyEffectKind.Railgun, 1)

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
    technologyId?: string,
    explored = true
) => {
    board.hexes[hexKey(coords)] = {
        coords,
        tileId: 't1',
        kind: HexKind.Planet,
        color: PlanetColor.Periwinkle,
        ...(explored ? { explored } : {}),
        ...(technologyId ? { technologyId } : {})
    }
}

// The anchor planet at (2,0) holds the mover's Download. A far planet at (5,0), three hexes off
// and so just within reach, holds a Railgun. Row 3 is spare.
function scenario(farEffect = TechnologyEffectKind.Railgun) {
    const game = new TestGame()
    const mover = game.activePlayerId
    const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board = openRow()
    planet(board, at(2, 0), DOWNLOAD)
    planet(board, at(5, 0), card(farEffect, 1))

    game.state.board = board
    game.state.technologyDeck = stackedBag([])
    game.state.tileSupply = stackedBag([])
    const playerState = game.state.players.find((p) => p.playerId === mover)!
    // Gained the hard way already: they hold the Download card and its stored effect.
    playerState.technologies = [DOWNLOAD]
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

describe('reach', () => {
    const reachable = (game: TestGame, mover: string) =>
        downloadTargetsFrom(game.hydrated, mover, at(2, 0)).map(hexKey)

    it('takes in every explored planet within three hexes, in any direction', () => {
        const { game, mover } = scenario()
        // Three away along the row (the scenario's own), and three away off every axis.
        planet(game.state.board, at(3, 2), card(TechnologyEffectKind.TacticalFeint, 0))

        expect(reachable(game, mover).sort()).toEqual([hexKey(at(5, 0)), hexKey(at(3, 2))].sort())
    })

    it('stops at three hexes', () => {
        const { game, mover } = scenario()
        planet(game.state.board, at(6, 0), card(TechnologyEffectKind.TacticalFeint, 0))

        expect(reachable(game, mover)).toEqual([hexKey(at(5, 0))])
    })

    it('is not blocked by anything between: a ship, a planet, or a gap in the board', () => {
        const { game, mover, other } = scenario()
        game.state.board.hexes[hexKey(at(3, 0))].piece = ship(other, PieceType.Fighter)
        planet(game.state.board, at(4, 0))
        expect(reachable(game, mover)).toEqual([hexKey(at(5, 0))])

        delete game.state.board.hexes[hexKey(at(3, 0))]
        expect(reachable(game, mover)).toEqual([hexKey(at(5, 0))])
    })

    it('is not interrupted by a jammer', () => {
        const { game, mover, other } = scenario()
        game.state.board.hexes[hexKey(at(3, 0))].piece = ship(other, PieceType.Jammer)

        expect(reachable(game, mover)).toEqual([hexKey(at(5, 0))])
        game.run(UseImmediateDownload, download(mover, at(2, 0), at(5, 0)))
        expect(game.state.players.find((p) => p.playerId === mover)!.technologies).toContain(
            FAR_RAILGUN
        )
    })
})

describe('Immediate Download', () => {
    it('takes the technology of a planet within reach, with no wait', () => {
        const { game, mover } = scenario()

        expect(game.validActionsFor(mover)).toContain(ActionType.UseImmediateDownload)

        game.run(UseImmediateDownload, download(mover, at(2, 0), at(5, 0)))

        const playerState = game.state.players.find((p) => p.playerId === mover)!
        expect(playerState.technologies).toContain(FAR_RAILGUN)
        // A Railgun is a cooldown power, so "now or later, with no wait" means it is simply usable.
        expect(
            game.hydrated.getPlayerState(mover).hasCooldownEffect(TechnologyEffectKind.Railgun)
        ).toBe(true)
        // Spent: one time use.
        expect(playerState.storedEffects).not.toContain(TechnologyEffectKind.ImmediateDownload)
        // The turn carries on - this costs a power, not the placement.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('leaves the card on its planet, and its owner holding it too', () => {
        const { game, mover, other } = scenario()
        game.state.players.find((p) => p.playerId === other)!.technologies = [FAR_RAILGUN]

        game.run(UseImmediateDownload, download(mover, at(2, 0), at(5, 0)))

        // A technology gained is a record, not a token: nobody is robbed.
        expect(game.state.board.hexes[hexKey(at(5, 0))].technologyId).toBe(FAR_RAILGUN)
        expect(game.state.players.find((p) => p.playerId === other)!.technologies).toContain(
            FAR_RAILGUN
        )
    })

    it('hands over a downloaded one-shot technology unspent, to use now or later', () => {
        const { game, mover } = scenario(TechnologyEffectKind.MoveFriendlyPiece)
        game.state.board.hexes[hexKey(at(0, 3))].piece = ship(mover, PieceType.Station)

        game.run(UseImmediateDownload, download(mover, at(2, 0), at(5, 0)))

        // Tactical Shift arrives as a use to keep: nothing is owed, the turn carries on, and it
        // may be spent this turn or held.
        expect(game.state.pendingTechnology).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.state.players.find((p) => p.playerId === mover)!.storedEffects).toContain(
            TechnologyEffectKind.MoveFriendlyPiece
        )
        expect(game.validActionsFor(mover)).toContain(ActionType.UseTacticalShift)
    })

    it('refuses a planet out of reach, one already held, and an unexplored one', () => {
        const { game, mover } = scenario()

        // Four hexes off: one too far.
        planet(game.state.board, at(6, 0), card(TechnologyEffectKind.TacticalFeint, 0))
        expect(() => game.run(UseImmediateDownload, download(mover, at(2, 0), at(6, 0)))).toThrow()

        // Already theirs - nothing to download, and a one-shot power would be wasted.
        game.state.players.find((p) => p.playerId === mover)!.technologies = [DOWNLOAD, FAR_RAILGUN]
        expect(() => game.run(UseImmediateDownload, download(mover, at(2, 0), at(5, 0)))).toThrow()
        game.state.players.find((p) => p.playerId === mover)!.technologies = [DOWNLOAD]

        // Unexplored, so it holds no technology to read.
        delete game.state.board.hexes[hexKey(at(5, 0))].technologyId
        game.state.board.hexes[hexKey(at(5, 0))].explored = false
        expect(() => game.run(UseImmediateDownload, download(mover, at(2, 0), at(5, 0)))).toThrow()
    })

    it('refuses a planet holding another Download, so reach cannot chain', () => {
        const { game, mover } = scenario(TechnologyEffectKind.ImmediateDownload)

        expect(downloadTargetsFrom(game.hydrated, mover, at(2, 0))).toEqual([])
        expect(() => game.run(UseImmediateDownload, download(mover, at(2, 0), at(5, 0)))).toThrow()
    })

    it('must be spent from a planet actually holding the player’s Download', () => {
        const { game, mover } = scenario()
        // The far planet is within reach and holds a technology, but it isn't the anchor.
        expect(() => game.run(UseImmediateDownload, download(mover, at(5, 0), at(2, 0)))).toThrow()
    })

    it('is not offered without the stored effect', () => {
        const { game, mover } = scenario()
        game.state.players.find((p) => p.playerId === mover)!.storedEffects = []

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseImmediateDownload)
    })
})
