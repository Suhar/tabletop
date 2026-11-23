import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { AttackPiece, HydratedAttackPiece, isAttackPiece } from './attackPiece.js'
import { HydratedPlacePiece, PieceSource, PlacePiece } from './placePiece.js'
import { attackOutcome, AttackOutcome, torpedoTargets } from '../util/attack.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// Open space around (0, 0), with the pieces given.
function openField(pieces: Array<[AxialCoordinates, Piece]>): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = -3; q <= 3; q++) {
        for (let r = -3; r <= 3; r++) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    for (const [coords, piece] of pieces) board.hexes[hexKey(coords)].piece = piece
    return board
}

// The mover holds a ready Gamma Torpedo and has drawn a fighter.
function scenario(place: (mover: string, rival: string) => Array<[AxialCoordinates, Piece]>) {
    const game = new TestGame()
    const mover = game.activePlayerId
    const rival = game.state.players.find((p) => p.playerId !== mover)!.playerId

    game.state.board = openField(place(mover, rival))
    game.state.technologyDeck = stackedBag([])
    game.state.tileSupply = stackedBag([])
    game.giveTechnology(mover, TechnologyEffectKind.GammaTorpedo)
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Fighter, PieceLevel.Two),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])
    return { game, mover, rival }
}

const torpedoAt = (playerId: string, coords: AxialCoordinates) => ({
    type: ActionType.PlacePiece as const,
    playerId,
    coords,
    pieceSource: PieceSource.Bag,
    torpedo: true
})

describe('Gamma Torpedo', () => {
    it('goes down only beside a station, only as a fighter, and only when ready', () => {
        const { game, mover, rival } = scenario((_mover, rival) => [
            [at(1, 0), ship(rival, PieceType.Station)]
        ])

        const placement = (coords: AxialCoordinates) =>
            new HydratedPlacePiece({
                id: 'a',
                gameId: game.game.id,
                source: 'user',
                ...torpedoAt(mover, coords)
            } as never)

        expect(placement(at(0, 0)).invalidPlacePieceReason(game.hydrated)).toBeUndefined()
        expect(placement(at(-2, 0)).invalidPlacePieceReason(game.hydrated)).toBe(
            'A torpedo must go down beside a station to strike.'
        )

        const unready = game.hydrated
        unready.getPlayerState(mover).cooldowns[TechnologyEffectKind.GammaTorpedo] = 0
        expect(placement(at(0, 0)).invalidPlacePieceReason(unready)).toBe(
            'Your Gamma Torpedo is not ready.'
        )

        const probeInHand = game.hydrated
        probeInHand.heldPieces = [ship(mover, PieceType.Probe, PieceLevel.Two)]
        expect(placement(at(0, 0)).invalidPlacePieceReason(probeInHand)).toBe(
            'Only a fighter can become a torpedo.'
        )
        void rival
    })

    it('strikes the one station beside it at once, taking itself with it', () => {
        const { game, mover, rival } = scenario((_mover, rival) => [
            [at(1, 0), ship(rival, PieceType.Station)],
            // Escorting the station, which stops a shot but not a blast.
            [at(2, 0), ship(rival, PieceType.Fighter, PieceLevel.Three)]
        ])

        const actions = game.run(PlacePiece, torpedoAt(mover, at(0, 0)))

        const strike = actions.find(isAttackPiece) as AttackPiece | undefined
        expect(strike?.coords).toEqual(at(1, 0))
        expect(strike?.metadata?.target?.type).toBe(PieceType.Station)
        expect(strike?.metadata?.torpedo?.torpedo).toBe(true)
        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(0, 0))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(2, 0))].piece?.playerId).toBe(rival)
        expect(game.state.machineState).not.toBe(MachineState.Attacking)
        // Spent: the cooldown runs from this turn.
        expect(game.state.players.find((p) => p.playerId === mover)!.cooldowns).toEqual({
            [TechnologyEffectKind.GammaTorpedo]: 0
        })
    })

    it('lets the player choose among several stations, their own included, but never hold fire', () => {
        const { game, mover, rival } = scenario((mover, rival) => [
            [at(1, 0), ship(rival, PieceType.Station)],
            [at(0, 1), ship(mover, PieceType.Station)]
        ])

        game.run(PlacePiece, torpedoAt(mover, at(0, 0)))

        expect(game.state.machineState).toBe(MachineState.Attacking)
        expect(game.state.pendingAttack?.targets).toEqual(
            expect.arrayContaining([at(1, 0), at(0, 1)])
        )
        expect(game.validActionsFor(mover)).toEqual([ActionType.AttackPiece])
        expect(game.state.board.hexes[hexKey(at(0, 0))].piece?.torpedo).toBe(true)

        const holdFire = new HydratedAttackPiece({
            id: 'a',
            gameId: game.game.id,
            source: 'user',
            type: ActionType.AttackPiece,
            playerId: mover
        } as never)
        expect(holdFire.invalidAttackPieceReason(game.hydrated)).toBe(
            'A torpedo cannot hold fire: choose the station it strikes.'
        )

        game.run(AttackPiece, { type: ActionType.AttackPiece, playerId: mover, coords: at(0, 1) })

        expect(game.state.board.hexes[hexKey(at(0, 1))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(0, 0))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(1, 0))].piece?.playerId).toBe(rival)
    })

    it('takes a hub, and nothing but stations', () => {
        const torpedo: Piece = { ...ship('p1', PieceType.Fighter, PieceLevel.Two), torpedo: true }
        expect(attackOutcome(torpedo, { ...ship('p2', PieceType.Station), hub: true })).toBe(
            AttackOutcome.Destroyed
        )
        expect(attackOutcome(torpedo, ship('p1', PieceType.Station))).toBe(AttackOutcome.Destroyed)
        expect(attackOutcome(torpedo, ship('p2', PieceType.Probe, PieceLevel.Two))).toBeUndefined()
        expect(attackOutcome(torpedo, ship('p2', PieceType.Relay))).toBeUndefined()

        const board = openField([
            [at(1, 0), ship('p2', PieceType.Station)],
            [at(-1, 0), ship('p2', PieceType.Relay)],
            [at(0, 1), ship('p1', PieceType.Station)]
        ])
        expect(torpedoTargets(board, at(0, 0))).toEqual(
            expect.arrayContaining([at(1, 0), at(0, 1)])
        )
        expect(torpedoTargets(board, at(0, 0))).toHaveLength(2)
    })
})
