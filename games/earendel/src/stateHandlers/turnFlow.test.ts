import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { type EarendelBoard, HexKind, hexKey, neighborsOf, PlanetColor } from '../model/board.js'
import { type Piece, PieceType, PieceLevel } from '../model/pieces.js'
import { type TechnologyCard, TechnologyTier } from '../model/technology.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { ChoosePlanet } from '../actions/choosePlanet.js'
import { ChooseTechnology } from '../actions/chooseTechnology.js'
import { TestGame } from '../util/testHarness.js'

const PLANET_A: AxialCoordinates = { q: 0, r: 0 }
// A hex touching PLANET_A - where a probe goes to reach it.
const APPROACH = neighborsOf(PLANET_A)[0]
// A second planet touching APPROACH, so one probe can reach two planets.
const PLANET_B = neighborsOf(APPROACH).find(
    (coords) => !neighborsOf(PLANET_A).some((n) => n.q === coords.q && n.r === coords.r)
)!

// A board we control completely: the generated one is random by seed, and none of these tests
// are about setup.
function testBoard({ secondPlanet = false } = {}): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    const planet = (coords: AxialCoordinates, color: PlanetColor) => {
        board.hexes[hexKey(coords)] = { coords, tileId: 't1', kind: HexKind.Planet, color }
    }
    const open = (coords: AxialCoordinates) => {
        board.hexes[hexKey(coords)] = { coords, tileId: 't1', kind: HexKind.Open }
    }

    planet(PLANET_A, PlanetColor.Azure)
    for (const coords of neighborsOf(PLANET_A)) open(coords)
    // Somewhere well clear of any planet, for placements that shouldn't explore.
    open({ q: 5, r: 5 })

    if (secondPlanet) planet(PLANET_B, PlanetColor.Crimson)

    return board
}

function card(id: string, ...colors: PlanetColor[]): TechnologyCard {
    return { id, colors, tier: TechnologyTier.Standard }
}

function elevated(id: string, ...colors: PlanetColor[]): TechnologyCard {
    return { id, colors, tier: TechnologyTier.Elevated }
}

function probe(playerId: string, level = PieceLevel.Two): Piece {
    return { id: `${playerId}-probe`, playerId, type: PieceType.Probe, level }
}

function fighter(playerId: string): Piece {
    return { id: `${playerId}-fighter`, playerId, type: PieceType.Fighter }
}

// A game whose board, bags and technology deck are all fixed, with the given player's bag
// stacked so the next draw is known.
function scenario({
    bag,
    deck = [],
    secondPlanet = false
}: {
    bag: (playerId: string) => Piece[]
    deck?: TechnologyCard[]
    secondPlanet?: boolean
}) {
    const game = new TestGame()
    game.state.board = testBoard({ secondPlanet })
    game.state.technologyDeck = deck
    game.state.technologyDiscard = []
    game.stackBags(bag)
    return game
}

describe('the turn spine', () => {
    it('passes the turn on after a placement that explores nothing', () => {
        const game = scenario({ bag: (playerId) => [fighter(playerId), fighter(playerId)] })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: { q: 5, r: 5 },
            pieceSource: PieceSource.Bag
        })

        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).not.toBe(mover)
        expect(game.state.pendingExploration).toBeUndefined()
    })

    it('draws before the placement, and puts the draw back when a special is played instead', () => {
        const game = scenario({ bag: (playerId) => [fighter(playerId), fighter(playerId)] })
        const mover = game.activePlayerId

        // Face up before any hex is chosen - knowing what you drew is what makes the
        // placement a decision.
        expect(game.state.heldPieces.length).toBeGreaterThan(0)
        const drawnId = game.state.heldPieces[0]!.id

        const special = { id: `${mover}-special`, playerId: mover, type: PieceType.Station }
        game.state.players.find((p) => p.playerId === mover)!.specialPieces = [special]

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: { q: 5, r: 5 },
            pieceSource: PieceSource.Special,
            pieceId: special.id
        })

        expect(game.state.board.hexes[hexKey({ q: 5, r: 5 })].piece?.id).toBe(special.id)

        // The ship they didn't fancy is back in the bag, so declining a draw costs nothing
        // but the turn's placement.
        const moverState = game.state.players.find((p) => p.playerId === mover)!
        expect(moverState.bag).toHaveLength(2)
        expect(moverState.bag.map((piece) => piece.id)).toContain(drawnId)
        // The turn has passed, so what is face up now is the next player's own draw.
        expect(game.state.heldPieces[0]?.playerId).toBe(game.activePlayerId)
    })

    it('holds the turn open when a probe finds a planet, and hands it on when the choice is made', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [
                card('azure-1', PlanetColor.Azure),
                card('miss', PlanetColor.Gold),
                card('azure-2', PlanetColor.Azure, PlanetColor.Violet)
            ]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // Only one planet is in reach, so the engine settles that for the player: the cards
        // are already face up and the only thing left is which one to keep.
        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.activePlayerId).toBe(mover)
        expect(game.validActionsFor(mover)).toEqual([ActionType.ChooseTechnology])
        expect(game.processed.map((action) => action.type)).toEqual([
            ActionType.PlacePiece,
            ActionType.ChoosePlanet
        ])
        expect(game.state.pendingExploration?.candidates?.map((c) => c.id)).toEqual([
            'azure-1',
            'azure-2'
        ])

        game.run(ChooseTechnology, {
            type: ActionType.ChooseTechnology,
            playerId: mover,
            technologyId: 'azure-2'
        })

        expect(game.state.board.hexes[hexKey(PLANET_A)].technology?.id).toBe('azure-2')
        expect(game.state.board.hexes[hexKey(PLANET_A)].explored).toBe(true)
        // Everything else that was turned over goes to the discard, matches included.
        expect(game.state.technologyDiscard.map((c) => c.id)).toEqual(['azure-1', 'miss'])
        expect(game.state.pendingExploration).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('forces an elevated technology, putting the standard matches out of reach', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId, PieceLevel.Three), fighter(playerId)],
            deck: [
                card('azure-standard', PlanetColor.Azure),
                elevated('azure-elevated', PlanetColor.Azure),
                card('azure-other', PlanetColor.Azure)
            ]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // All three matched the planet's colour, but the elevated one is the only one that
        // can be housed - so there was never a decision, and the engine took it.
        expect(game.processed.map((action) => action.type)).toEqual([
            ActionType.PlacePiece,
            ActionType.ChoosePlanet,
            ActionType.ChooseTechnology
        ])
        expect(game.state.board.hexes[hexKey(PLANET_A)].technology?.id).toBe('azure-elevated')
        // The standard matches are discarded like any other card turned over.
        expect(game.state.technologyDiscard.map((c) => c.id).sort()).toEqual([
            'azure-other',
            'azure-standard'
        ])
    })

    it('offers the choice between elevated cards when more than one turns up', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId, PieceLevel.Three), fighter(playerId)],
            deck: [
                elevated('elevated-1', PlanetColor.Azure),
                card('standard', PlanetColor.Azure),
                elevated('elevated-2', PlanetColor.Azure)
            ]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // Two elevated cards is a real choice; the standard card between them is not part of
        // it, even though its colour matches.
        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.state.pendingExploration?.candidates?.map((c) => c.id)).toEqual([
            'elevated-1',
            'elevated-2'
        ])
        expect(game.state.pendingExploration?.revealed).toHaveLength(3)

        expect(() =>
            game.run(ChooseTechnology, {
                type: ActionType.ChooseTechnology,
                playerId: mover,
                technologyId: 'standard'
            })
        ).toThrow()

        game.run(ChooseTechnology, {
            type: ActionType.ChooseTechnology,
            playerId: mover,
            technologyId: 'elevated-2'
        })
        expect(game.state.board.hexes[hexKey(PLANET_A)].technology?.id).toBe('elevated-2')
    })

    it('asks which planet only when the probe reached more than one', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('crimson-1', PlanetColor.Crimson), card('crimson-2', PlanetColor.Crimson)],
            secondPlanet: true
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.validActionsFor(mover)).toEqual([ActionType.ChoosePlanet])
        // Nothing is revealed yet - the colour of the planet decides what the flip looks for.
        expect(game.state.pendingExploration?.revealed).toBeUndefined()

        game.run(ChoosePlanet, {
            type: ActionType.ChoosePlanet,
            playerId: mover,
            coords: PLANET_B
        })

        expect(game.state.board.hexes[hexKey(PLANET_B)].explored).toBe(true)
        // The planet passed over stays unexplored for a later probe.
        expect(game.state.board.hexes[hexKey(PLANET_A)].explored).toBeUndefined()
        expect(game.validActionsFor(mover)).toEqual([ActionType.ChooseTechnology])
    })

    it('takes a decision with one answer on the player’s behalf', () => {
        const game = scenario({
            // A level 3 probe against a deck holding a single Azure card: the reveal exhausts
            // the piles and offers one candidate, which is no choice at all.
            bag: (playerId) => [probe(playerId, PieceLevel.Three), fighter(playerId)],
            deck: [card('only-azure', PlanetColor.Azure), card('miss', PlanetColor.Gold)]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // One placement, and the whole exploration resolved itself inside the same submission.
        expect(game.processed.map((action) => action.type)).toEqual([
            ActionType.PlacePiece,
            ActionType.ChoosePlanet,
            ActionType.ChooseTechnology
        ])
        expect(game.state.board.hexes[hexKey(PLANET_A)].technology?.id).toBe('only-azure')
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('explores with nothing to house when the deck has no card of the planet’s colour', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('gold', PlanetColor.Gold)]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // The planet is explored - it can never be explored again - and simply holds nothing.
        expect(game.state.board.hexes[hexKey(PLANET_A)].explored).toBe(true)
        expect(game.state.board.hexes[hexKey(PLANET_A)].technology).toBeUndefined()
        expect(game.state.technologyDiscard.map((c) => c.id)).toEqual(['gold'])
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('lets no one but the exploring player act while a choice is pending', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('a', PlanetColor.Azure), card('b', PlanetColor.Azure)]
        })
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        expect(game.validActionsFor(other)).toEqual([])
        expect(() =>
            game.run(ChooseTechnology, {
                type: ActionType.ChooseTechnology,
                playerId: other,
                technologyId: 'a'
            })
        ).toThrow()
    })

    it('ends the game the instant a bag runs out, mid-round', () => {
        const game = scenario({ bag: (playerId) => [fighter(playerId)] })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: { q: 5, r: 5 },
            pieceSource: PieceSource.Bag
        })

        // The other player still has a piece and never gets to play it - that's the rule.
        expect(game.state.machineState).toBe(MachineState.EndOfGame)
        expect(game.state.activePlayerIds).toEqual([])
        expect(game.state.result).toBeDefined()
    })

    it('ends the game even when the last piece is a probe that found something', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId)],
            deck: [card('a', PlanetColor.Azure), card('b', PlanetColor.Azure)]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // The exploration is still owed, and is still resolved - the game ends after it, not
        // instead of it.
        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.activePlayerId).toBe(mover)

        game.run(ChooseTechnology, {
            type: ActionType.ChooseTechnology,
            playerId: mover,
            technologyId: 'b'
        })

        expect(game.state.board.hexes[hexKey(PLANET_A)].technology?.id).toBe('b')
        expect(game.state.machineState).toBe(MachineState.EndOfGame)
    })
})
