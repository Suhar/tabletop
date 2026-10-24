import { describe, expect, it, vi } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { type EarendelBoard, HexKind, hexKey, neighborsOf, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { focusedCardId } from '../model/technologyCards.js'
import { PieceSource, PlacePiece } from './placePiece.js'
import { ChoosePlanet } from './choosePlanet.js'
import { ChooseTechnology } from './chooseTechnology.js'
import { stackedBag, TestGame } from '../util/testHarness.js'

// No elevated card is dealt yet, so the catalogue is extended for this file only.
const elevated = vi.hoisted(() => ['elevated-a', 'elevated-b'])

vi.mock('../model/technologyCards.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../model/technologyCards.js')>()
    const { TechnologyEffectKind, TechnologyTier } = await import('../model/technology.js')
    const { PlanetColor } = await import('../model/planetColor.js')
    return {
        ...actual,
        technologyCard: (id: string) =>
            elevated.includes(id)
                ? {
                      id,
                      colors: [PlanetColor.Periwinkle],
                      tier: TechnologyTier.Elevated,
                      effect: TechnologyEffectKind.Railgun
                  }
                : actual.technologyCard(id)
    }
})

const [ELEVATED_A, ELEVATED_B] = elevated
const standard = (copy: number) =>
    focusedCardId(TechnologyEffectKind.Railgun, PlanetColor.Periwinkle, copy)

const PLANET: AxialCoordinates = { q: 0, r: 0 }
const APPROACH = neighborsOf(PLANET)[0]

function board(): EarendelBoard {
    const hexes: EarendelBoard['hexes'] = {
        [hexKey(PLANET)]: {
            coords: PLANET,
            tileId: 't1',
            kind: HexKind.Planet,
            color: PlanetColor.Periwinkle
        }
    }
    for (const coords of neighborsOf(PLANET)) {
        hexes[hexKey(coords)] = { coords, tileId: 't1', kind: HexKind.Open }
    }
    return { hexes }
}

const probe = (playerId: string): Piece => ({
    id: `${playerId}-probe`,
    playerId,
    type: PieceType.Probe,
    level: PieceLevel.Three
})

function surveyWith(deck: string[]) {
    const game = new TestGame()
    game.state.board = board()
    game.state.technologyDeck = stackedBag(deck)
    game.state.technologyDiscard = []
    game.stackBags((playerId) => [probe(playerId), probe(playerId)])
    const mover = game.activePlayerId

    game.run(PlacePiece, {
        type: ActionType.PlacePiece,
        playerId: mover,
        coords: APPROACH,
        pieceSource: PieceSource.Bag
    })
    game.run(ChoosePlanet, { type: ActionType.ChoosePlanet, playerId: mover, coords: PLANET })
    return { game, mover }
}

describe('an elevated technology', () => {
    it('is forced, putting the standard matches out of reach', () => {
        const { game } = surveyWith([standard(0), ELEVATED_A, standard(1)])

        // The elevated card is the only choice, so the engine takes it.
        expect(game.state.board.hexes[hexKey(PLANET)].technologyId).toBe(ELEVATED_A)
        expect([...game.state.technologyDiscard].sort()).toEqual([standard(0), standard(1)].sort())
    })

    it('refuses a standard match while an elevated card is on offer', () => {
        const { game, mover } = surveyWith([ELEVATED_A, standard(0), ELEVATED_B])

        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.state.pendingExploration?.candidates).toEqual([ELEVATED_A, ELEVATED_B])
        expect(() =>
            game.run(ChooseTechnology, {
                type: ActionType.ChooseTechnology,
                playerId: mover,
                technologyId: standard(0)
            })
        ).toThrow('An elevated technology was revealed, so a standard one cannot be taken.')

        game.run(ChooseTechnology, {
            type: ActionType.ChooseTechnology,
            playerId: mover,
            technologyId: ELEVATED_B
        })
        expect(game.state.board.hexes[hexKey(PLANET)].technologyId).toBe(ELEVATED_B)
    })
})
