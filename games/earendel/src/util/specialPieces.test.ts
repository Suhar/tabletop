import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { elevatedCardId, focusedCardId } from '../model/technologyCards.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { TurnStyle } from '../definition/config.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { AttackPiece } from '../actions/attackPiece.js'
import { DiscardPiece } from '../actions/discardPiece.js'
import { SeedNebula } from '../actions/seedNebula.js'
import { FoundPlanet } from '../actions/foundPlanet.js'
import { attackOutcomeAt, torpedoTargets } from './attack.js'
import { legalPlacementsFor } from './placement.js'
import { probeInfluence } from './probes.js'
import { probeBlockedBy } from './lineOfSight.js'
import { stationComplex } from './stations.js'
import { probeDestinations } from './exploration.js'
import { probeTechnologiesFor } from './technologyGrants.js'
import { seedableHexes } from './specials.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (
    playerId: string,
    type: PieceType,
    level?: PieceLevel,
    extra: Partial<Piece> = {}
): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {}),
    ...extra
})

type Spec = { planet?: PlanetColor; technologyId?: string; ship?: Piece }

function field(spec: Array<[AxialCoordinates, Spec]>, size = 7): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = -size; q <= size; q++) {
        for (let r = -size; r <= size; r++) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    for (const [coords, { planet, technologyId, ship: piece }] of spec) {
        board.hexes[hexKey(coords)] = planet
            ? {
                  coords,
                  tileId: 't1',
                  kind: HexKind.Planet,
                  color: planet,
                  ...(technologyId ? { technologyId, explored: true } : {})
              }
            : { coords, tileId: 't1', kind: HexKind.Open, ...(piece ? { piece } : {}) }
    }
    return board
}

function game(
    spec: (mover: string, rival: string) => Array<[AxialCoordinates, Spec]>,
    hand: (playerId: string) => Piece[],
    turnStyle = TurnStyle.SinglePiece
) {
    const g = new TestGame(2, 1, { turnStyle })
    const mover = g.activePlayerId
    const rival = g.state.players.find((p) => p.playerId !== mover)!.playerId
    g.state.board = field(spec(mover, rival))
    g.state.technologyDeck = stackedBag([])
    g.state.tileSupply = stackedBag([])
    g.stackBags(hand)
    return { g, mover, rival }
}

describe('Interdictor', () => {
    it('closes the hexes beside it to enemy ships, not its own', () => {
        const board = field([[at(1, 0), { ship: ship('p2', PieceType.Interdictor) }]])
        const probe = ship('p1', PieceType.Probe, PieceLevel.Two)
        const legal = legalPlacementsFor(board, 'p1', probe)
        expect(legal.some((c) => c.q === 0 && c.r === 0)).toBe(false)
        expect(legal.some((c) => c.q === 4 && c.r === 4)).toBe(true)
        const own = legalPlacementsFor(board, 'p2', ship('p2', PieceType.Probe, PieceLevel.Two))
        expect(own.some((c) => c.q === 0 && c.r === 0)).toBe(true)
    })
})

describe('Nebula Seeder', () => {
    it('offers a hex to lay each turn, and the nebula stops ships and sight', () => {
        const { g, mover, rival } = game(
            (mover) => [[at(0, 0), { ship: ship(mover, PieceType.NebulaSeeder) }]],
            (playerId) => [ship(playerId, PieceType.Station), ship(playerId, PieceType.Station)]
        )
        expect(g.state.machineState).toBe(MachineState.Seeding)
        g.run(SeedNebula, {
            type: ActionType.SeedNebula,
            playerId: mover,
            seeder: at(0, 0),
            hex: at(1, 0)
        })
        expect(g.state.board.hexes[hexKey(at(1, 0))].kind).toBe(HexKind.Nebula)
        expect(g.state.board.hexes[hexKey(at(0, 0))].piece?.seeded).toBe(1)
        expect(g.state.machineState).toBe(MachineState.PlacingPiece)
        expect(
            legalPlacementsFor(g.state.board, mover, ship(mover, PieceType.Station)).some(
                (c) => c.q === 1 && c.r === 0
            )
        ).toBe(false)

        // Two rival stations either side of a nebula no longer close the hex between them.
        const board = field([
            [at(-1, 0), { ship: ship(rival, PieceType.Station) }],
            [at(2, 0), { ship: ship(rival, PieceType.Station) }]
        ])
        expect(probeBlockedBy(board, at(0, 0), mover)).toBe(rival)
        board.hexes[hexKey(at(1, 0))].kind = HexKind.Nebula
        expect(probeBlockedBy(board, at(0, 0), mover)).toBeUndefined()
    })
})

describe('Nebula Seeder reach', () => {
    it('grows its cloud from any nebula joined to it, and from no other', () => {
        const board = field([[at(0, 0), { ship: ship('p1', PieceType.NebulaSeeder) }]])
        const reaches = (q: number, r: number) =>
            seedableHexes(board, at(0, 0)).some((c) => c.q === q && c.r === r)

        expect(seedableHexes(board, at(0, 0))).toHaveLength(6)
        expect(reaches(2, 0)).toBe(false)

        board.hexes[hexKey(at(1, 0))].kind = HexKind.Nebula
        expect(reaches(1, 0)).toBe(false)
        expect(reaches(2, 0)).toBe(true)
        expect(reaches(3, 0)).toBe(false)

        board.hexes[hexKey(at(2, 0))].kind = HexKind.Nebula
        expect(reaches(3, 0)).toBe(true)

        // A nebula standing apart from the seeder's cloud lends it nothing.
        board.hexes[hexKey(at(-3, 0))].kind = HexKind.Nebula
        expect(reaches(-4, 0)).toBe(false)

        // An occupied hex is not empty, and a spent seeder lays no more.
        board.hexes[hexKey(at(3, 0))].piece = ship('p2', PieceType.Station)
        expect(reaches(3, 0)).toBe(false)
        board.hexes[hexKey(at(0, 0))].piece!.seeded = 4
        expect(seedableHexes(board, at(0, 0))).toEqual([])
    })
})

describe('Gate pair', () => {
    it('is one place for station links and probe influence', () => {
        const gates: Partial<Piece> = { pairId: 'p1-gates' }
        const board = field([
            [at(0, 0), { ship: ship('p1', PieceType.Gate, undefined, gates) }],
            [at(5, 0), { ship: ship('p1', PieceType.Gate, undefined, gates) }],
            [at(-1, 0), { ship: ship('p1', PieceType.Station) }],
            [at(6, 0), { ship: ship('p1', PieceType.Station) }],
            [at(5, 1), { planet: PlanetColor.Teal }],
            [at(-1, 1), { ship: ship('p1', PieceType.Probe, PieceLevel.Two) }]
        ])
        expect(stationComplex(board, 'p1', at(-1, 0))).toHaveLength(2)
        // The probe beside one gate counts on the planet beside the other.
        expect(probeInfluence(board, at(5, 1))).toEqual({ p1: 2 })
    })
})

describe('Artificial Planet', () => {
    it('becomes an unexplored planet of the chosen color', () => {
        const { g, mover } = game(
            () => [],
            (playerId) => [ship(playerId, PieceType.Station), ship(playerId, PieceType.Station)]
        )
        const planet = ship(mover, PieceType.ArtificialPlanet)
        g.state.players.find((p) => p.playerId === mover)!.specialPieces = [planet]
        g.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Special,
            pieceId: planet.id
        })
        expect(g.state.machineState).toBe(MachineState.FoundingPlanet)
        g.run(FoundPlanet, {
            type: ActionType.FoundPlanet,
            playerId: mover,
            color: PlanetColor.Mint
        })
        const hex = g.state.board.hexes[hexKey(at(0, 0))]
        expect(hex).toMatchObject({
            kind: HexKind.Planet,
            color: PlanetColor.Mint,
            explored: false
        })
        expect(hex.piece).toBeUndefined()
    })
})

describe('Quarantine Beacon', () => {
    it('stops surveys of the planet and holds its claims', () => {
        const tech = focusedCardId(TechnologyEffectKind.Railgun, PlanetColor.Violet, 0)
        const t = new TestGame(2, 1, { turnStyle: TurnStyle.SinglePiece })
        const mover = t.activePlayerId
        const rival = t.state.players.find((p) => p.playerId !== mover)!.playerId
        t.state.board = field([
            [at(0, 0), { planet: PlanetColor.Violet, technologyId: tech }],
            [at(1, 0), { ship: ship(rival, PieceType.QuarantineBeacon) }],
            [at(-1, 0), { ship: ship(mover, PieceType.Probe, PieceLevel.Three) }]
        ])
        t.state.probeClaims = [{ playerId: mover, coords: at(0, 0), technologyId: tech }]
        const state = t.hydrated
        expect(
            probeDestinations(state, at(-1, 0), state.board.hexes[hexKey(at(-1, 0))].piece!)
        ).toEqual([])
        expect(probeTechnologiesFor(state, mover)).toEqual({
            gained: [],
            lapsed: [],
            researched: []
        })
    })
})

describe('Bastion', () => {
    it('shields its neighbors from every shot, No Quarter or not, and falls only to a torpedo', () => {
        const board = field([
            [at(0, 1), { ship: ship('p1', PieceType.Bastion) }],
            [at(1, 0), { ship: ship('p1', PieceType.Probe, PieceLevel.Two) }],
            [at(2, 0), { ship: ship('p2', PieceType.Fighter, PieceLevel.Three) }],
            [
                at(-5, -5),
                {
                    planet: PlanetColor.Teal,
                    technologyId: elevatedCardId(TechnologyEffectKind.NoQuarter)
                }
            ]
        ])
        expect(attackOutcomeAt(board, at(2, 0), at(1, 0))).toBeUndefined()
        expect(attackOutcomeAt(board, at(1, 1), at(0, 1))).toBeUndefined()
        expect(torpedoTargets(board, at(0, 2))).toEqual(expect.arrayContaining([at(0, 1)]))
    })
})

describe('Jammer', () => {
    it('blinds every station within two hexes, its owner’s included', () => {
        const board = field([
            [at(-1, 0), { ship: ship('p2', PieceType.Station) }],
            [at(1, 0), { ship: ship('p2', PieceType.Station) }]
        ])
        expect(probeBlockedBy(board, at(0, 0), 'p1')).toBe('p2')
        board.hexes[hexKey(at(3, 0))].piece = ship('p2', PieceType.Jammer)
        expect(probeBlockedBy(board, at(0, 0), 'p1')).toBeUndefined()
    })
})

describe('Carrier', () => {
    it('weighs as a level 3 probe and takes a level 3 fighter to touch', () => {
        const board = field([
            [at(0, 0), { planet: PlanetColor.Aqua }],
            [at(1, 0), { ship: ship('p1', PieceType.Carrier) }],
            [at(2, 0), { ship: ship('p2', PieceType.Fighter, PieceLevel.Two) }]
        ])
        expect(probeInfluence(board, at(0, 0))).toEqual({ p1: 3 })
        expect(attackOutcomeAt(board, at(2, 0), at(1, 0))).toBeUndefined()
        board.hexes[hexKey(at(2, 0))].piece = ship('p2', PieceType.Fighter, PieceLevel.Three)
        expect(attackOutcomeAt(board, at(2, 0), at(1, 0))).toBe('destroyed')
    })
})

describe('Deep Scanner', () => {
    it('draws one more and throws one more out', () => {
        const { g, mover } = game(
            (mover) => [[at(0, 0), { ship: ship(mover, PieceType.DeepScanner) }]],
            (playerId) => [1, 2, 3, 4, 5].map(() => ship(playerId, PieceType.Station)),
            TurnStyle.DraftThree
        )
        expect(g.state.heldPieces).toHaveLength(4)
        expect(g.state.machineState).toBe(MachineState.DraftingPieces)
        g.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: g.state.heldPieces[0].id
        })
        expect(g.state.machineState).toBe(MachineState.DraftingPieces)
        g.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: g.state.heldPieces[0].id
        })
        expect(g.state.machineState).toBe(MachineState.PlacingPiece)
        expect(g.state.heldPieces).toHaveLength(2)
    })
})

describe('Salvage Drone', () => {
    it('takes a ship destroyed within two hexes into its owner’s bag', () => {
        const { g, mover, rival } = game(
            (mover, rival) => [
                [at(1, 0), { ship: ship(rival, PieceType.Probe, PieceLevel.Two) }],
                [at(3, 0), { ship: ship(mover, PieceType.SalvageDrone) }]
            ],
            (playerId) => [
                ship(playerId, PieceType.Fighter, PieceLevel.Three),
                ship(playerId, PieceType.Station)
            ]
        )
        const before = g.state.players.find((p) => p.playerId === mover)!.bag.remaining
        g.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })
        const [shot] = g.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(1, 0)
        })
        expect((shot as AttackPiece).metadata?.salvaged?.[0].playerId).toBe(mover)
        expect(g.state.players.find((p) => p.playerId === mover)!.bag.remaining).toBe(before + 1)
        void rival
    })
})
