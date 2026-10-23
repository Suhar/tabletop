import { describe, expect, it } from 'vitest'
import { EarendelGameStateValidator } from '../model/gameState.js'
import { TestGame } from '../util/testHarness.js'
import { EarendelGameExploration } from './gameExploration.js'

const masterSeed = '0123456789abcdef0123456789abcdef'

describe('EarendelGameExploration.createFromCanonicalState', () => {
    it('reshuffles hidden orders, keeps every count and leaves the source untouched', () => {
        const { state } = new TestGame(3, 7, undefined, { masterSeed })
        const source = structuredClone(state)

        const branch = new EarendelGameExploration().createFromCanonicalState(state)

        expect(state).toEqual(source)
        expect(EarendelGameStateValidator.Check(branch)).toBe(true)

        const sorted = (ids: string[]) => [...ids].sort()
        expect(sorted(branch.technologyDeck.items.map((card) => card.id))).toEqual(
            sorted(source.technologyDeck.items.map((card) => card.id))
        )
        expect(branch.technologyDeck.remaining).toBe(source.technologyDeck.remaining)
        expect(branch.tileSupply.remaining).toBe(source.tileSupply.remaining)
        branch.players.forEach((player, index) => {
            expect(player.bag.remaining).toBe(source.players[index].bag.remaining)
            expect(sorted(player.bag.items.map((piece) => piece.id))).toEqual(
                sorted(source.players[index].bag.items.map((piece) => piece.id))
            )
        })
        expect(branch.technologyDeck.items.map((card) => card.id)).not.toEqual(
            source.technologyDeck.items.map((card) => card.id)
        )
    })
})
