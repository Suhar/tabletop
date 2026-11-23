import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { elevatedCardId, focusedCardId } from '../model/technologyCards.js'
import { buildTechnologyDeck } from './technologyDeck.js'
import { BASIC_PIECE_TECHNOLOGIES } from '../model/technology.js'
import { Prng } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { type EarendelGameConfig, ElevatedChoice, TurnStyle } from '../definition/config.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { ChoosePlanet } from '../actions/choosePlanet.js'
import { ChooseTechnology, isChooseTechnology } from '../actions/chooseTechnology.js'
import { ChooseEventOrder, HydratedChooseEventOrder } from '../actions/chooseEventOrder.js'
import { EventPick, isEventPick } from '../actions/eventPick.js'
import { isMovePiece, MovePiece } from '../actions/movePiece.js'
import { DrawPieces, isDrawPieces } from '../actions/drawPieces.js'
import { AttackPiece } from '../actions/attackPiece.js'
import { DiscardPiece, isDiscardPiece } from '../actions/discardPiece.js'
import { attackOutcomeAt } from './attack.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

type Spec = { planet?: PlanetColor; technologyId?: string; ship?: Piece }

// Open space q -4..4, r -4..4, with planets and ships where given.
function field(spec: Array<[AxialCoordinates, Spec]>): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = -4; q <= 4; q++) {
        for (let r = -4; r <= 4; r++) {
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

const config = (extra: Record<string, string> = {}): EarendelGameConfig =>
    ({ turnStyle: TurnStyle.SinglePiece, ...extra }) as EarendelGameConfig

const PLANET = at(0, 0)
const PROBE_HEX = at(1, 0)

// The mover holds a probe to place beside an unexplored planet, and the deck turns up the card.
function surveyScenario(
    players: number,
    color: PlanetColor,
    cardId: string,
    extra: Array<[AxialCoordinates, Spec]> = [],
    extraConfig: Record<string, string> = {}
) {
    const game = new TestGame(players, 1, config(extraConfig))
    const mover = game.activePlayerId
    const rivals = game.state.players
        .map((player) => player.playerId)
        .filter((playerId) => playerId !== mover)

    game.state.board = field([[PLANET, { planet: color }], ...extra])
    game.state.technologyDeck = stackedBag([
        cardId,
        focusedCardId(TechnologyEffectKind.Railgun, color, 0)
    ])
    game.state.tileSupply = stackedBag([])
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Probe, PieceLevel.Two),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])
    return { game, mover, rivals }
}

function survey(game: TestGame, mover: string, cardId: string) {
    game.run(PlacePiece, {
        type: ActionType.PlacePiece,
        playerId: mover,
        coords: PROBE_HEX,
        pieceSource: PieceSource.Bag
    })
    game.run(ChoosePlanet, { type: ActionType.ChoosePlanet, playerId: mover, coords: PLANET })
    return game.run(ChooseTechnology, {
        type: ActionType.ChooseTechnology,
        playerId: mover,
        technologyId: cardId
    })
}

const BOMBARDMENT = elevatedCardId(TechnologyEffectKind.OrbitalBombardment)
const STORM = elevatedCardId(TechnologyEffectKind.WormholeStorm)
const SALVAGE = elevatedCardId(TechnologyEffectKind.SalvageRights)
const INTERCEPT = elevatedCardId(TechnologyEffectKind.SignalIntercept)
const SHIPYARD = elevatedCardId(TechnologyEffectKind.ShipyardWorld)
const FREE_DRIFT = elevatedCardId(TechnologyEffectKind.FreeDrift)
const RAILGUN_0 = focusedCardId(TechnologyEffectKind.Railgun, PlanetColor.Violet, 0)

describe('the setup draw', () => {
    it('deals one elevated card per color into the deck, as the options say', () => {
        const game = new TestGame(
            2,
            1,
            config({
                'elevated-violet': ElevatedChoice.Event,
                'elevated-aqua': ElevatedChoice.Rule,
                'elevated-mint': ElevatedChoice.None
            })
        )
        const elevated = game.state.elevatedTechnologies ?? {}
        expect(elevated[PlanetColor.Violet]).toBe(BOMBARDMENT)
        expect(elevated[PlanetColor.Aqua]).toBe(FREE_DRIFT)
        expect(elevated[PlanetColor.Mint]).toBeUndefined()
        expect([
            elevatedCardId(TechnologyEffectKind.SignalIntercept),
            elevatedCardId(TechnologyEffectKind.SharedScience)
        ]).toContain(elevated[PlanetColor.Periwinkle])

        // The four elevated cards join the standard deck for the basic units.
        const standard = buildTechnologyDeck(
            new Prng({ seed: 1, invocations: 0 }),
            BASIC_PIECE_TECHNOLOGIES
        )
        const deck = game.state.technologyDeck.items
        expect(deck).toHaveLength(standard.length + 4)
        expect(deck).toContain(BOMBARDMENT)
        expect(deck).toContain(FREE_DRIFT)
    })
})

describe('surveying an elevated planet', () => {
    it('spends the planet for everyone and asks the discoverer for an order', () => {
        const { game, mover, rivals } = surveyScenario(3, PlanetColor.Violet, BOMBARDMENT, [
            [at(3, 0), { ship: ship('r', PieceType.Fighter, PieceLevel.Two) }]
        ])
        game.state.board.hexes[hexKey(at(3, 0))].piece!.playerId = rivals[0]

        const [chosen] = survey(game, mover, BOMBARDMENT)
        expect(isChooseTechnology(chosen) && chosen.metadata?.elevated).toBe(true)

        const planet = game.state.board.hexes[hexKey(PLANET)]
        expect(planet.technologyId).toBe(BOMBARDMENT)
        // The surveying probe and a marker for each rival orbit the planet; the hex reopens.
        expect(planet.orbiters).toHaveLength(3)
        expect(game.state.board.hexes[hexKey(PROBE_HEX)].piece).toBeUndefined()
        for (const player of game.state.players) {
            expect(player.technologies).toContain(BOMBARDMENT)
        }

        expect(game.state.machineState).toBe(MachineState.ChoosingEventOrder)
        expect(game.activePlayerId).toBe(mover)
        expect(game.validActionsFor(mover)).toEqual([ActionType.ChooseEventOrder])

        const bad = (order: string[]) =>
            new HydratedChooseEventOrder({
                id: 'x',
                gameId: game.game.id,
                source: 'user',
                type: ActionType.ChooseEventOrder,
                playerId: mover,
                order
            } as never).invalidChooseEventOrderReason(game.hydrated)
        expect(bad([rivals[0], mover, rivals[1]])).toBe('The discoverer goes first.')
        expect(bad([mover, rivals[0]])).toBe('Every player goes exactly once.')

        game.run(ChooseEventOrder, {
            type: ActionType.ChooseEventOrder,
            playerId: mover,
            order: [mover, rivals[1], rivals[0]]
        })
        expect(game.state.machineState).toBe(MachineState.ResolvingEvent)
        expect(game.activePlayerId).toBe(mover)
    })

    it('with two players the order is settled and the discoverer picks at once', () => {
        const { game, mover, rivals } = surveyScenario(2, PlanetColor.Violet, BOMBARDMENT, [
            [at(3, 0), { ship: ship('r', PieceType.Fighter, PieceLevel.Two) }]
        ])
        game.state.board.hexes[hexKey(at(3, 0))].piece!.playerId = rivals[0]
        survey(game, mover, BOMBARDMENT)
        expect(game.state.machineState).toBe(MachineState.ResolvingEvent)
        expect(game.state.pendingEvent?.order).toEqual([mover, rivals[0]])
        expect(game.activePlayerId).toBe(mover)
    })

    it('is never offered again: everyone holds it', () => {
        const { game, mover, rivals } = surveyScenario(2, PlanetColor.Violet, BOMBARDMENT)
        survey(game, mover, BOMBARDMENT)
        // Nobody had a ship to bombard, so the event is over and the turn has passed.
        expect(game.state.pendingEvent).toBeUndefined()
        expect(game.activePlayerId).toBe(rivals[0])

        // The rival's probe lands beside the spent planet and is offered nothing.
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: rivals[0],
            coords: at(-1, 0),
            pieceSource: PieceSource.Bag
        })
        expect(game.state.pendingExploration).toBeUndefined()
        expect(game.state.machineState).not.toBe(MachineState.Exploring)
    })
})

describe('Orbital Targeting', () => {
    it('lets each player in order destroy an enemy ship, passing over one with no target', () => {
        const { game, mover, rivals } = surveyScenario(3, PlanetColor.Violet, BOMBARDMENT, [
            [at(3, 0), { ship: ship('r0', PieceType.Fighter, PieceLevel.Two) }],
            [at(-3, 0), { ship: ship('r1', PieceType.Station) }]
        ])
        // Fix the owners now that the seats are known.
        game.state.board.hexes[hexKey(at(3, 0))].piece!.playerId = rivals[0]
        game.state.board.hexes[hexKey(at(-3, 0))].piece!.playerId = rivals[1]

        survey(game, mover, BOMBARDMENT)
        game.run(ChooseEventOrder, {
            type: ActionType.ChooseEventOrder,
            playerId: mover,
            order: [mover, rivals[0], rivals[1]]
        })

        // The discoverer takes the only enemy ship. Stations are structures, not ships.
        expect(game.state.board.hexes[hexKey(at(-3, 0))].piece?.type).toBe(PieceType.Station)
        const actions = game.run(EventPick, {
            type: ActionType.EventPick,
            playerId: mover,
            coords: at(3, 0)
        })
        expect(game.state.board.hexes[hexKey(at(3, 0))].piece).toBeUndefined()

        // Nobody else has a ship to shoot, so both rivals are passed over and the turn goes on.
        const skipped = actions.filter((action) => isEventPick(action) && action.metadata?.skipped)
        expect(skipped).toHaveLength(2)
        expect(game.state.pendingEvent).toBeUndefined()
        expect(game.state.machineState).not.toBe(MachineState.ResolvingEvent)
    })
})

describe('Wormhole Storm', () => {
    it('moves a piece of the picker to an empty hex beside a planet', () => {
        const { game, mover } = surveyScenario(2, PlanetColor.Aqua, STORM, [
            [at(-3, 0), { planet: PlanetColor.Mint }],
            [at(3, 3), { ship: ship('m', PieceType.Station) }]
        ])
        game.state.board.hexes[hexKey(at(3, 3))].piece!.playerId = mover
        survey(game, mover, STORM)

        game.run(EventPick, {
            type: ActionType.EventPick,
            playerId: mover,
            from: at(3, 3),
            to: at(-2, 0)
        })
        expect(game.state.board.hexes[hexKey(at(-2, 0))].piece?.type).toBe(PieceType.Station)
        expect(game.state.board.hexes[hexKey(at(3, 3))].piece).toBeUndefined()
    })
})

describe('Salvage Rights and Signal Intercept', () => {
    it('salvages a discarded card, which goes once', () => {
        const { game, mover, rivals } = surveyScenario(2, PlanetColor.Mint, SALVAGE)
        game.state.technologyDiscard = [RAILGUN_0]
        survey(game, mover, SALVAGE)

        game.run(EventPick, {
            type: ActionType.EventPick,
            playerId: mover,
            technologyId: RAILGUN_0
        })
        const discoverer = game.state.players.find((p) => p.playerId === mover)!
        expect(discoverer.technologies).toContain(RAILGUN_0)
        expect(
            game.hydrated.getPlayerState(mover).hasCooldownEffect(TechnologyEffectKind.Railgun)
        ).toBe(true)
        expect(game.state.technologyDiscard).not.toContain(RAILGUN_0)
        // The rival finds the discard empty (the survey's own set-aside card is all that is left,
        // and it is not theirs to take twice): nothing to pick, so they are passed over.
        expect(
            game.state.players.find((p) => p.playerId === rivals[0])!.technologies
        ).not.toContain(RAILGUN_0)
    })

    it('intercepts an explored planet once', () => {
        const { game, mover, rivals } = surveyScenario(3, PlanetColor.Periwinkle, INTERCEPT, [
            [at(-3, 0), { planet: PlanetColor.Violet, technologyId: RAILGUN_0 }]
        ])
        survey(game, mover, INTERCEPT)
        game.run(ChooseEventOrder, {
            type: ActionType.ChooseEventOrder,
            playerId: mover,
            order: [mover, rivals[0], rivals[1]]
        })
        const actions = game.run(EventPick, {
            type: ActionType.EventPick,
            playerId: mover,
            coords: at(-3, 0)
        })

        expect(game.state.players.find((p) => p.playerId === mover)!.technologies).toContain(
            RAILGUN_0
        )
        // The one explored planet is taken, so the rivals have nothing left to intercept.
        expect(actions.filter((a) => isEventPick(a) && a.metadata?.skipped)).toHaveLength(2)
    })
})

describe('Shipyard World', () => {
    it('hands out one of each unit in play', () => {
        const { game, mover, rivals } = surveyScenario(3, PlanetColor.Teal, SHIPYARD)
        survey(game, mover, SHIPYARD)
        expect(game.state.pendingEvent?.stock).toEqual(
            Object.fromEntries(Object.values(BASIC_PIECE_TECHNOLOGIES).map((kind) => [kind, 1]))
        )
        game.run(ChooseEventOrder, {
            type: ActionType.ChooseEventOrder,
            playerId: mover,
            order: [mover, rivals[0], rivals[1]]
        })
        game.run(EventPick, {
            type: ActionType.EventPick,
            playerId: mover,
            piece: TechnologyEffectKind.StationUpgrade
        })
        // Each unit goes once: the hub is gone.
        expect(game.state.pendingEvent?.stock?.[TechnologyEffectKind.StationUpgrade]).toBe(0)
        expect(() =>
            game.run(EventPick, {
                type: ActionType.EventPick,
                playerId: rivals[0],
                piece: TechnologyEffectKind.StationUpgrade
            })
        ).toThrow()
        game.run(EventPick, {
            type: ActionType.EventPick,
            playerId: rivals[0],
            piece: TechnologyEffectKind.RelayNetwork
        })
        expect(game.validActionsFor(rivals[1])).toEqual([ActionType.EventPick])
        game.run(EventPick, {
            type: ActionType.EventPick,
            playerId: rivals[1],
            piece: TechnologyEffectKind.GateNetwork
        })

        const hub = game.state.players.find((p) => p.playerId === mover)!.specialPieces[0]
        expect(hub).toMatchObject({ type: PieceType.Station, hub: true })
        expect(
            game.state.players.find((p) => p.playerId === rivals[0])!.specialPieces[0].type
        ).toBe(PieceType.Relay)
        // A gate comes as its pair.
        const gates = game.state.players.find((p) => p.playerId === rivals[1])!.specialPieces
        expect(gates.map((piece) => piece.type)).toEqual([PieceType.Gate, PieceType.Gate])
        expect(game.state.pendingEvent).toBeUndefined()
    })
})

describe('a lasting card', () => {
    it("gives the discoverer one pick of the color's event, then holds for everyone", () => {
        const { game, mover, rivals } = surveyScenario(2, PlanetColor.Aqua, FREE_DRIFT, [
            [at(-3, 0), { planet: PlanetColor.Mint }],
            [at(3, 3), { ship: ship('m', PieceType.Station) }],
            [at(3, -3), { ship: ship('r', PieceType.Station) }]
        ])
        game.state.board.hexes[hexKey(at(3, 3))].piece!.playerId = mover
        game.state.board.hexes[hexKey(at(3, -3))].piece!.playerId = rivals[0]
        survey(game, mover, FREE_DRIFT)

        // One Wormhole Storm move, for the discoverer alone.
        expect(game.state.pendingEvent).toMatchObject({
            kind: TechnologyEffectKind.WormholeStorm,
            order: [mover]
        })
        game.run(EventPick, {
            type: ActionType.EventPick,
            playerId: mover,
            from: at(3, 3),
            to: at(-2, 0)
        })
        expect(game.state.pendingEvent).toBeUndefined()

        // The rival's turn opens with a drift step, which the technology-move screen serves.
        game.run(DrawPieces, { type: ActionType.DrawPieces, playerId: rivals[0] })
        expect(game.state.machineState).toBe(MachineState.ResolvingTechnology)
        expect(game.state.pendingTechnology?.technologyId).toBe(FREE_DRIFT)
        const scoreBefore = game.state.players.find((p) => p.playerId === rivals[0])!.score
        const drifted = game
            .run(MovePiece, {
                type: ActionType.MovePiece,
                playerId: rivals[0],
                from: at(3, -3),
                to: at(2, -3)
            })
            .find(isMovePiece)
        expect(game.state.board.hexes[hexKey(at(2, -3))].piece?.type).toBe(PieceType.Station)
        // A drift is a plain step, unlike a Tactical Shift: the station does not score again.
        expect(drifted?.metadata).not.toHaveProperty('arrived')
        expect(game.state.players.find((p) => p.playerId === rivals[0])!.score).toBe(scoreBefore)
        // Once a turn: the step does not come round again until the next turn.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })
})

describe('rules in force', () => {
    const ruled = (kind: TechnologyEffectKind, extra: Array<[AxialCoordinates, Spec]>) =>
        field([
            [at(-4, -4), { planet: PlanetColor.Teal, technologyId: elevatedCardId(kind) }],
            ...extra
        ])

    it('No Quarter: an escort protects nothing', () => {
        const board = ruled(TechnologyEffectKind.NoQuarter, [
            [at(0, 0), { ship: ship('p1', PieceType.Fighter, PieceLevel.Three) }],
            [at(1, 0), { ship: ship('p2', PieceType.Probe, PieceLevel.Two) }],
            [at(2, 0), { ship: ship('p2', PieceType.Fighter, PieceLevel.Three) }]
        ])
        expect(attackOutcomeAt(board, at(0, 0), at(1, 0))).toBe('destroyed')
        board.hexes[hexKey(at(-4, -4))].technologyId = undefined
        expect(attackOutcomeAt(board, at(0, 0), at(1, 0))).toBeUndefined()
    })

    it('Overdrive: a draft of three is placed in full', () => {
        const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
        game.state.board = ruled(TechnologyEffectKind.Overdrive, [])
        game.state.technologyDeck = stackedBag([])
        game.state.tileSupply = stackedBag([])
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station)
        ])
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.state.heldPieces).toHaveLength(3)
    })

    it('Shared Science: a rival probe beside a planet learns the technology as the claim pays', () => {
        const game = new TestGame(2, 1, config())
        const mover = game.activePlayerId
        const rival = game.state.players.find((p) => p.playerId !== mover)!.playerId
        game.state.board = ruled(TechnologyEffectKind.SharedScience, [
            [at(0, 0), { planet: PlanetColor.Violet, technologyId: RAILGUN_0 }],
            [at(1, 0), { ship: ship(mover, PieceType.Probe, PieceLevel.Three) }],
            [at(-1, 0), { ship: ship(rival, PieceType.Probe, PieceLevel.Two) }]
        ])
        game.state.probeClaims = [{ playerId: mover, coords: at(0, 0), technologyId: RAILGUN_0 }]
        game.state.technologyDeck = stackedBag([])
        game.state.tileSupply = stackedBag([])
        game.stackBags((playerId) => [ship(playerId, PieceType.Station)])

        const drew = game.processed.find(isDrawPieces)
        expect(drew?.metadata?.shared).toEqual([{ playerId: rival, technologyId: RAILGUN_0 }])
        expect(
            game.hydrated.getPlayerState(rival).hasCooldownEffect(TechnologyEffectKind.Railgun)
        ).toBe(true)
    })

    it('Global Recycling: a discarded ship goes back into its bag', () => {
        const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
        const mover = game.activePlayerId
        game.state.board = ruled(TechnologyEffectKind.Reinforcements, [])
        game.state.technologyDeck = stackedBag([])
        game.state.tileSupply = stackedBag([])
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Three),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Probe, PieceLevel.Two),
            ship(playerId, PieceType.Station)
        ])
        const bag = () => game.state.players.find((p) => p.playerId === mover)!.bag
        expect(bag().remaining).toBe(1)
        const thrown = game.state.heldPieces[0]

        const [discard] = game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: thrown.id
        })

        expect(isDiscardPiece(discard) && discard.metadata?.recycled).toBe(true)
        expect(bag().remaining).toBe(2)
        expect(bag().items.map((piece) => piece.id)).toContain(thrown.id)
        expect(game.state.heldPieces).toHaveLength(2)
    })

    it('Global Recycling: a destroyed ship is still out of the game', () => {
        const game = new TestGame(2, 1, config())
        const mover = game.activePlayerId
        const rival = game.state.players.find((p) => p.playerId !== mover)!.playerId
        game.state.board = ruled(TechnologyEffectKind.Reinforcements, [
            [at(1, 0), { ship: ship(rival, PieceType.Probe, PieceLevel.Two) }]
        ])
        game.state.technologyDeck = stackedBag([])
        game.state.tileSupply = stackedBag([])
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Three),
            ship(playerId, PieceType.Station)
        ])
        const before = game.state.players.find((p) => p.playerId === rival)!.bag.remaining

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })
        game.run(AttackPiece, { type: ActionType.AttackPiece, playerId: mover, coords: at(1, 0) })

        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeUndefined()
        expect(game.state.players.find((p) => p.playerId === rival)!.bag.remaining).toBe(before)
    })
})
