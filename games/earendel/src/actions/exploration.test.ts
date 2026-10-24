import { describe, expect, it } from 'vitest'
import { ActionSource, type AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { type EarendelBoard, HexKind, hexKey, neighborsOf, PlanetColor } from '../model/board.js'
import { type EarendelGameState, HydratedEarendelGameState } from '../model/gameState.js'
import { PieceType, PieceLevel } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { focusedCardId } from '../model/technologyCards.js'
import { HydratedTechnologyDeck } from '../model/bags.js'
import type { PendingExploration } from '../model/exploration.js'
import { HydratedChoosePlanet } from './choosePlanet.js'
import { HydratedChooseTechnology } from './chooseTechnology.js'
import { stackedBag } from '../util/testHarness.js'

const PLANET_A: AxialCoordinates = { q: 0, r: 0 }
const PLANET_B: AxialCoordinates = { q: 3, r: 0 }
const PROBE_HEX = neighborsOf(PLANET_A)[0]
const PERIWINKLE_1 = focusedCardId(TechnologyEffectKind.Railgun, PlanetColor.Periwinkle, 1)
const PERIWINKLE_2 = focusedCardId(TechnologyEffectKind.Railgun, PlanetColor.Periwinkle, 2)
const HELD = focusedCardId(TechnologyEffectKind.Railgun, PlanetColor.Periwinkle, 3)

function board(): EarendelBoard {
    const hexes: EarendelBoard['hexes'] = {
        [hexKey(PLANET_A)]: {
            coords: PLANET_A,
            tileId: 't1',
            kind: HexKind.Planet,
            color: PlanetColor.Periwinkle
        },
        [hexKey(PLANET_B)]: {
            coords: PLANET_B,
            tileId: 't2',
            kind: HexKind.Planet,
            color: PlanetColor.Teal
        },
        [hexKey(PROBE_HEX)]: {
            coords: PROBE_HEX,
            tileId: 't1',
            kind: HexKind.Open,
            piece: { id: 'probe', playerId: 'p1', type: PieceType.Probe, level: PieceLevel.Two }
        }
    }
    return { hexes }
}

function buildState(pending?: PendingExploration): HydratedEarendelGameState {
    const data: EarendelGameState = {
        id: 'game-1',
        gameId: 'game-1',
        players: ['p1', 'p2'].map((playerId) => ({
            playerId,
            color: 'blue',
            bag: stackedBag([]),
            specialPieces: [],
            technologies: [],
            storedEffects: [],
            cooldownEffects: [],
            cooldowns: {},
            score: 0
        })),
        activePlayerIds: ['p1'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.Exploring,
        turnManager: { series: [], turnOrder: ['p1', 'p2'], turnCounts: {} },
        winningPlayerIds: [],
        board: board(),
        technologyDeck: stackedBag([PERIWINKLE_1, PERIWINKLE_2]),
        technologyDiscard: [],
        queuedTechnologyEffects: [],
        planetControllers: {},
        scoredPlanetPairs: [],
        probeClaims: [],
        tileSupply: stackedBag([]),
        heldPieces: [],
        ...(pending ? { pendingExploration: pending } : {})
    } as EarendelGameState

    return new HydratedEarendelGameState(data)
}

function unsettled(): PendingExploration {
    return {
        playerId: 'p1',
        probeCoords: PROBE_HEX,
        probeLevel: PieceLevel.Two,
        candidatePlanets: [PLANET_A]
    }
}

// Leaving out the coordinates is keeping the probe on the board.
function choosePlanet(playerId: string, coords?: AxialCoordinates): HydratedChoosePlanet {
    return new HydratedChoosePlanet({
        id: 'a1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.ChoosePlanet,
        playerId,
        revealsInfo: true,
        ...(coords ? { coords } : {})
    })
}

function chooseTechnology(playerId: string, technologyId?: string): HydratedChooseTechnology {
    return new HydratedChooseTechnology({
        id: 'a2',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.ChooseTechnology,
        playerId,
        ...(technologyId ? { technologyId } : {})
    })
}

describe('HydratedChoosePlanet', () => {
    it('refuses a planet the probe cannot reach, and one belonging to someone else’s probe', () => {
        const state = buildState(unsettled())

        expect(choosePlanet('p1', PLANET_B).invalidChoosePlanetReason(state)).toBe(
            "Your probes don't lead on that planet, so this probe can't survey it."
        )
        expect(choosePlanet('p2', PLANET_A).invalidChoosePlanetReason(state)).toBe(
            "That probe isn't yours."
        )
        expect(choosePlanet('p1', PLANET_A).invalidChoosePlanetReason(buildState())).toBe(
            'No probe is waiting to explore.'
        )
    })

    it('refuses to choose a planet twice', () => {
        const state = buildState(unsettled())
        choosePlanet('p1', PLANET_A).apply(state)

        expect(choosePlanet('p1', PLANET_A).invalidChoosePlanetReason(state)).toBe(
            'That probe has already chosen its planet.'
        )
    })

    it('surveys the planet with the probe left where it stands', () => {
        const state = buildState(unsettled())
        const action = choosePlanet('p1', PLANET_A)
        action.apply(state)

        expect(state.board.hexes[hexKey(PROBE_HEX)].piece?.id).toBe('probe')
        expect(state.board.hexes[hexKey(PLANET_A)].explored).toBe(true)
        // Level two: two matching cards, which here is the whole deck.
        expect(state.pendingExploration?.candidates).toEqual([PERIWINKLE_1, PERIWINKLE_2])
        expect(action.revealsInfo).toBe(true)
    })

    it('allows keeping the probe, which explores nothing and leaves it where it is', () => {
        const state = buildState(unsettled())
        const action = choosePlanet('p1')

        expect(action.invalidChoosePlanetReason(state)).toBeUndefined()
        action.apply(state)

        expect(action.metadata).toEqual({ declined: true })
        expect(state.board.hexes[hexKey(PROBE_HEX)].piece?.id).toBe('probe')
        expect(state.board.hexes[hexKey(PLANET_A)].explored).toBeUndefined()
        expect(state.technologyDeck.remaining).toBe(2)
        expect(state.pendingExploration).toBeUndefined()
    })

    it('turns nothing over for an explored planet, offering only what it already holds', () => {
        const state = buildState(unsettled())
        state.board.hexes[hexKey(PLANET_A)].explored = true
        state.board.hexes[hexKey(PLANET_A)].technologyId = HELD
        const action = choosePlanet('p1', PLANET_A)
        action.apply(state)

        expect(action.metadata?.alreadyExplored).toBe(true)
        expect(action.metadata?.flipped).toBeUndefined()
        expect(state.pendingExploration?.candidates).toEqual([HELD])
        expect(state.technologyDeck.remaining).toBe(2)
        expect(action.revealsInfo).toBe(false)
        expect(state.board.hexes[hexKey(PROBE_HEX)].piece?.id).toBe('probe')
    })
})

describe('HydratedChooseTechnology', () => {
    it('refuses a card that wasn’t revealed for this planet', () => {
        const state = buildState(unsettled())
        choosePlanet('p1', PLANET_A).apply(state)

        expect(chooseTechnology('p1', 'some-other-card').invalidChooseTechnologyReason(state)).toBe(
            "That technology isn't one of the cards revealed for this planet."
        )
        expect(chooseTechnology('p1').invalidChooseTechnologyReason(state)).toBe(
            'No technology was chosen.'
        )
        expect(chooseTechnology('p2', PERIWINKLE_1).invalidChooseTechnologyReason(state)).toBe(
            "That exploration isn't yours."
        )
    })

    it('refuses to choose a technology before the planet is settled', () => {
        const state = buildState(unsettled())

        expect(chooseTechnology('p1', PERIWINKLE_1).invalidChooseTechnologyReason(state)).toBe(
            'That probe hasn’t chosen a planet yet.'
        )
    })

    it('houses the chosen card and stakes a claim on it, without handing it over', () => {
        const state = buildState(unsettled())
        choosePlanet('p1', PLANET_A).apply(state)
        chooseTechnology('p1', PERIWINKLE_2).apply(state)

        expect(state.board.hexes[hexKey(PLANET_A)].technologyId).toBe(PERIWINKLE_2)
        expect(state.technologyDiscard).toEqual([PERIWINKLE_1])
        expect(state.probeClaims).toEqual([
            { playerId: 'p1', coords: PLANET_A, technologyId: PERIWINKLE_2 }
        ])
        // Won only at the start of p1's next turn, and only if their probes still lead.
        expect(state.getPlayerState('p1').technologies).toEqual([])
        expect(state.board.hexes[hexKey(PROBE_HEX)].piece?.id).toBe('probe')
    })

    it('stakes a claim on what an explored planet already holds, discarding nothing', () => {
        const state = buildState(unsettled())
        state.board.hexes[hexKey(PLANET_A)].explored = true
        state.board.hexes[hexKey(PLANET_A)].technologyId = HELD
        choosePlanet('p1', PLANET_A).apply(state)
        chooseTechnology('p1', HELD).apply(state)

        expect(state.board.hexes[hexKey(PLANET_A)].technologyId).toBe(HELD)
        expect(state.technologyDiscard).toEqual([])
        expect(state.probeClaims).toEqual([
            { playerId: 'p1', coords: PLANET_A, technologyId: HELD }
        ])
        expect(state.getPlayerState('p1').technologies).toEqual([])
    })

    it('takes nothing, and only nothing, when the reveal produced no candidates', () => {
        // A planet whose colour the deck couldn't match: explored, but with nothing to house.
        const state = buildState(unsettled())
        state.technologyDeck = new HydratedTechnologyDeck(stackedBag([]))
        choosePlanet('p1', PLANET_A).apply(state)

        expect(chooseTechnology('p1', PERIWINKLE_1).invalidChooseTechnologyReason(state)).toBe(
            'There was no technology to choose.'
        )
        expect(chooseTechnology('p1').invalidChooseTechnologyReason(state)).toBeUndefined()
    })
})
