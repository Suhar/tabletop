import { describe, expect, it } from 'vitest'
import { ActionSource, type AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { type EarendelBoard, HexKind, hexKey, neighborsOf, PlanetColor } from '../model/board.js'
import { type Piece, PieceType, PieceLevel } from '../model/pieces.js'
import { type TechnologyCard, TechnologyTier } from '../model/technology.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { ChoosePlanet, isChoosePlanet } from '../actions/choosePlanet.js'
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

    planet(PLANET_A, PlanetColor.Periwinkle)
    for (const coords of neighborsOf(PLANET_A)) open(coords)
    // Somewhere well clear of any planet, for placements that shouldn't explore.
    open({ q: 5, r: 5 })

    if (secondPlanet) planet(PLANET_B, PlanetColor.Aqua)

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

// Sends the probe just placed to a planet. Never automatic - keeping the probe is always an
// answer - so every test that wants the exploration says so.
function sendProbe(game: TestGame, playerId: string, coords: AxialCoordinates = PLANET_A) {
    return game.run(ChoosePlanet, { type: ActionType.ChoosePlanet, playerId, coords })
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

        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
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
        // The turn has passed and the next player has not drawn yet - nothing is face up until
        // they ask for it, which is what leaves this player time to undo.
        expect(game.state.heldPieces).toEqual([])
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
    })

    it('holds the turn open when a probe finds a planet, and hands it on when the choice is made', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [
                card('periwinkle-1', PlanetColor.Periwinkle),
                card('miss', PlanetColor.Teal),
                card('periwinkle-2', PlanetColor.Periwinkle, PlanetColor.Violet)
            ]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // Only one planet is in reach, but sending the probe there is still the player's call.
        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.activePlayerId).toBe(mover)
        expect(game.validActionsFor(mover)).toEqual([ActionType.ChoosePlanet])

        sendProbe(game, mover)

        // The cards are face up now, and the only thing left is which one to keep.
        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.activePlayerId).toBe(mover)
        expect(game.validActionsFor(mover)).toEqual([ActionType.ChooseTechnology])
        expect(game.processed.map((action) => action.type)).toEqual([
            ActionType.DrawPieces,
            ActionType.PlacePiece,
            ActionType.ChoosePlanet
        ])
        expect(game.state.pendingExploration?.candidates?.map((c) => c.id)).toEqual([
            'periwinkle-1',
            'periwinkle-2'
        ])

        game.run(ChooseTechnology, {
            type: ActionType.ChooseTechnology,
            playerId: mover,
            technologyId: 'periwinkle-2'
        })

        expect(game.state.board.hexes[hexKey(PLANET_A)].technology?.id).toBe('periwinkle-2')
        expect(game.state.board.hexes[hexKey(PLANET_A)].explored).toBe(true)
        // Everything else that was turned over goes to the discard, matches included.
        expect(game.state.technologyDiscard.map((c) => c.id)).toEqual(['periwinkle-1', 'miss'])
        expect(game.state.pendingExploration).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('forces an elevated technology, putting the standard matches out of reach', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId, PieceLevel.Three), fighter(playerId)],
            deck: [
                card('periwinkle-standard', PlanetColor.Periwinkle),
                elevated('periwinkle-elevated', PlanetColor.Periwinkle),
                card('periwinkle-other', PlanetColor.Periwinkle)
            ]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        sendProbe(game, mover)

        // All three matched the planet's colour, but the elevated one is the only one that
        // can be housed - so there was never a decision, and the engine took it.
        expect(game.processed.map((action) => action.type)).toEqual([
            ActionType.DrawPieces,
            ActionType.PlacePiece,
            ActionType.ChoosePlanet,
            ActionType.ChooseTechnology
        ])
        expect(game.state.board.hexes[hexKey(PLANET_A)].technology?.id).toBe('periwinkle-elevated')
        // The standard matches are discarded like any other card turned over.
        expect(game.state.technologyDiscard.map((c) => c.id).sort()).toEqual([
            'periwinkle-other',
            'periwinkle-standard'
        ])
    })

    it('offers the choice between elevated cards when more than one turns up', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId, PieceLevel.Three), fighter(playerId)],
            deck: [
                elevated('elevated-1', PlanetColor.Periwinkle),
                card('standard', PlanetColor.Periwinkle),
                elevated('elevated-2', PlanetColor.Periwinkle)
            ]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        sendProbe(game, mover)

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

    it('asks which planet when the probe reached more than one', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('aqua-1', PlanetColor.Aqua), card('aqua-2', PlanetColor.Aqua)],
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

    it('never sends a probe by itself, even to the only planet in reach', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('periwinkle-1', PlanetColor.Periwinkle), card('periwinkle-2', PlanetColor.Periwinkle)]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // One planet, but two answers: send the probe there, or keep it on the board.
        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.validActionsFor(mover)).toEqual([ActionType.ChoosePlanet])
        expect(game.processed.map((action) => action.type)).toEqual([
            ActionType.DrawPieces,
            ActionType.PlacePiece
        ])
        expect(game.state.pendingExploration?.candidatePlanets).toEqual([PLANET_A])
        expect(game.state.board.hexes[hexKey(PLANET_A)].explored).toBeUndefined()
        expect(game.state.technologyDeck).toHaveLength(2)
    })

    it('leaves the probe on the board when it surveys, and reveals by its level', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId, PieceLevel.Three), fighter(playerId)],
            deck: [
                card('periwinkle-1', PlanetColor.Periwinkle),
                card('periwinkle-2', PlanetColor.Periwinkle),
                card('periwinkle-3', PlanetColor.Periwinkle),
                card('periwinkle-4', PlanetColor.Periwinkle)
            ]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })
        sendProbe(game, mover)

        // Surveying doesn't spend the probe: it stays on its hex, still weighing on the planet.
        expect(game.state.board.hexes[hexKey(APPROACH)].piece?.id).toBe(`${mover}-probe`)

        // Its level decides how many cards are turned: three, leaving the fourth in the deck.
        expect(game.state.pendingExploration?.candidates?.map((c) => c.id)).toEqual([
            'periwinkle-1',
            'periwinkle-2',
            'periwinkle-3'
        ])
        expect(game.state.technologyDeck.map((c) => c.id)).toEqual(['periwinkle-4'])
    })

    it('keeps the probe on the board when the player declines to send it', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('periwinkle-1', PlanetColor.Periwinkle), card('periwinkle-2', PlanetColor.Periwinkle)]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })
        // No coordinates is the answer "keep it".
        const processed = game.run(ChoosePlanet, {
            type: ActionType.ChoosePlanet,
            playerId: mover
        })

        expect(processed.map((action) => action.type)).toEqual([ActionType.ChoosePlanet])
        const choice = processed.find(isChoosePlanet)
        expect(choice?.metadata?.declined).toBe(true)
        expect(choice?.revealsInfo).toBeFalsy()

        // Nothing explored, nothing turned over, and the probe stays where it was put.
        expect(game.state.board.hexes[hexKey(APPROACH)].piece?.id).toBe(`${mover}-probe`)
        expect(game.state.board.hexes[hexKey(PLANET_A)].explored).toBeUndefined()
        expect(game.state.technologyDeck.map((c) => c.id)).toEqual(['periwinkle-1', 'periwinkle-2'])
        expect(game.state.technologyDiscard).toEqual([])
        expect(game.state.pendingExploration).toBeUndefined()

        // And with that the placement is over.
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('turns nothing over for a planet already explored, which keeps what it holds', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('periwinkle-1', PlanetColor.Periwinkle), card('periwinkle-2', PlanetColor.Periwinkle)]
        })
        const planet = game.state.board.hexes[hexKey(PLANET_A)]
        planet.explored = true
        planet.technology = card('held', PlanetColor.Periwinkle)
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // Explored or not, a planet beside the probe may be surveyed for a technology the
        // player doesn't have.
        expect(game.validActionsFor(mover)).toEqual([ActionType.ChoosePlanet])

        const processed = sendProbe(game, mover)

        // The technology it already holds is the only one on offer, so that choice takes itself.
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.ChoosePlanet,
            ActionType.ChooseTechnology
        ])
        const choice = processed.find(isChoosePlanet)
        expect(choice?.metadata?.alreadyExplored).toBe(true)
        expect(choice?.revealsInfo).toBeFalsy()

        expect(game.state.board.hexes[hexKey(PLANET_A)].technology?.id).toBe('held')
        expect(game.state.board.hexes[hexKey(APPROACH)].piece?.id).toBe(`${mover}-probe`)
        // What the player gets is a claim on what it holds, not the technology itself.
        expect(game.state.probeClaims).toEqual([
            { playerId: mover, coords: PLANET_A, technologyId: 'held' }
        ])
        expect(game.state.technologyDeck.map((c) => c.id)).toEqual(['periwinkle-1', 'periwinkle-2'])
        expect(game.state.technologyDiscard).toEqual([])
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
    })

    it('leaves the probe holding every planet it stands beside after it surveys', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('periwinkle-1', PlanetColor.Periwinkle), card('periwinkle-2', PlanetColor.Periwinkle)],
            secondPlanet: true
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // A probe's single point of power, unopposed, holds both planets it touches.
        expect(game.state.planetControllers?.[hexKey(PLANET_B)]).toBe(mover)

        sendProbe(game, mover, PLANET_A)

        // Surveying one of them takes nothing away from either.
        expect(game.state.planetControllers?.[hexKey(PLANET_A)]).toBe(mover)
        expect(game.state.planetControllers?.[hexKey(PLANET_B)]).toBe(mover)
    })

    it('takes a decision with one answer on the player’s behalf', () => {
        const game = scenario({
            // A level 3 probe against a deck holding a single Periwinkle card: the reveal exhausts
            // the piles and offers one candidate, which is no choice at all.
            bag: (playerId) => [probe(playerId, PieceLevel.Three), fighter(playerId)],
            deck: [card('only-periwinkle', PlanetColor.Periwinkle), card('miss', PlanetColor.Teal)]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        // Where the probe goes is never taken for the player, even with one planet in reach -
        // keeping it is always an answer too.
        expect(game.validActionsFor(mover)).toEqual([ActionType.ChoosePlanet])

        const processed = sendProbe(game, mover)

        // The technology is another matter: sending the probe resolved the rest of the
        // exploration inside the same submission.
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.ChoosePlanet,
            ActionType.ChooseTechnology
        ])
        expect(processed[1].source).toBe(ActionSource.System)
        expect(game.state.board.hexes[hexKey(PLANET_A)].technology?.id).toBe('only-periwinkle')
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('claims no reveal when both piles are spent, so the placement can still be undone', () => {
        // Nothing to flip means nothing became public, so there is no knowledge to protect and
        // the player is entitled to take the placement back.
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: []
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })
        const processed = sendProbe(game, mover)

        const choice = processed.find((action) => action.type === ActionType.ChoosePlanet)!
        expect(choice.revealsInfo).toBeFalsy()

        // Whereas a flip that did turn something over does claim one.
        const seen = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('periwinkle-1', PlanetColor.Periwinkle), card('periwinkle-2', PlanetColor.Periwinkle)]
        })
        const seenMover = seen.activePlayerId
        seen.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: seenMover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })
        const seenProcessed = sendProbe(seen, seenMover)
        expect(
            seenProcessed.find((action) => action.type === ActionType.ChoosePlanet)!.revealsInfo
        ).toBe(true)
    })

    it('explores with nothing to house when the deck has no card of the planet’s colour', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('teal', PlanetColor.Teal)]
        })
        const mover = game.activePlayerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: APPROACH,
            pieceSource: PieceSource.Bag
        })

        sendProbe(game, mover)

        // The planet is explored - nothing will ever be turned over for it again - and simply
        // holds nothing.
        expect(game.state.board.hexes[hexKey(PLANET_A)].explored).toBe(true)
        expect(game.state.board.hexes[hexKey(PLANET_A)].technology).toBeUndefined()
        expect(game.state.technologyDiscard.map((c) => c.id)).toEqual(['teal'])
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
    })

    it('lets no one but the exploring player act while a choice is pending', () => {
        const game = scenario({
            bag: (playerId) => [probe(playerId), fighter(playerId)],
            deck: [card('a', PlanetColor.Periwinkle), card('b', PlanetColor.Periwinkle)]
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
            deck: [card('a', PlanetColor.Periwinkle), card('b', PlanetColor.Periwinkle)]
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

        sendProbe(game, mover)

        game.run(ChooseTechnology, {
            type: ActionType.ChooseTechnology,
            playerId: mover,
            technologyId: 'b'
        })

        expect(game.state.board.hexes[hexKey(PLANET_A)].technology?.id).toBe('b')
        expect(game.state.machineState).toBe(MachineState.EndOfGame)
    })
})
