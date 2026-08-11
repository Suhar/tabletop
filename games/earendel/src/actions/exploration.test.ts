import { describe, expect, it } from 'vitest'
import { ActionSource, type AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { type EarendelBoard, HexKind, hexKey, neighborsOf, PlanetColor } from '../model/board.js'
import { type EarendelGameState, HydratedEarendelGameState } from '../model/gameState.js'
import { PieceType, PieceLevel } from '../model/pieces.js'
import { TechnologyTier } from '../model/technology.js'
import type { PendingExploration } from '../model/exploration.js'
import { HydratedChoosePlanet } from './choosePlanet.js'
import { HydratedChooseTechnology } from './chooseTechnology.js'

const PLANET_A: AxialCoordinates = { q: 0, r: 0 }
const PLANET_B: AxialCoordinates = { q: 3, r: 0 }
const PROBE_HEX = neighborsOf(PLANET_A)[0]

function board(): EarendelBoard {
    const hexes: EarendelBoard['hexes'] = {
        [hexKey(PLANET_A)]: {
            coords: PLANET_A,
            tileId: 't1',
            kind: HexKind.Planet,
            color: PlanetColor.Azure
        },
        [hexKey(PLANET_B)]: {
            coords: PLANET_B,
            tileId: 't2',
            kind: HexKind.Planet,
            color: PlanetColor.Gold
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
            bag: [],
            specialPieces: [],
            technologies: [],
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
        technologyDeck: [
            { id: 'azure-1', colors: [PlanetColor.Azure], tier: TechnologyTier.Standard },
            { id: 'azure-2', colors: [PlanetColor.Azure], tier: TechnologyTier.Standard }
        ],
        technologyDiscard: [],
        scoredPlanetPairs: [],
        tileSupply: [],
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

function choosePlanet(playerId: string, coords: AxialCoordinates): HydratedChoosePlanet {
    return new HydratedChoosePlanet({
        id: 'a1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.ChoosePlanet,
        playerId,
        revealsInfo: true,
        coords
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
            "That planet isn't in reach of the probe you just placed."
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
        expect(chooseTechnology('p2', 'azure-1').invalidChooseTechnologyReason(state)).toBe(
            "That exploration isn't yours."
        )
    })

    it('refuses to choose a technology before the planet is settled', () => {
        const state = buildState(unsettled())

        expect(chooseTechnology('p1', 'azure-1').invalidChooseTechnologyReason(state)).toBe(
            'That probe hasn’t chosen a planet yet.'
        )
    })

    it('takes nothing, and only nothing, when the reveal produced no candidates', () => {
        // A planet whose colour the deck couldn't match: explored, but with nothing to house.
        const state = buildState(unsettled())
        state.technologyDeck = []
        choosePlanet('p1', PLANET_A).apply(state)

        expect(chooseTechnology('p1', 'azure-1').invalidChooseTechnologyReason(state)).toBe(
            'There was no technology to choose.'
        )
        expect(chooseTechnology('p1').invalidChooseTechnologyReason(state)).toBeUndefined()
    })
})
