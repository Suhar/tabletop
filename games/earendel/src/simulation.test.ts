import { describe, expect, it } from 'vitest'
import { playRandomGame } from './util/simulate.js'

const SEEDS = [1, 2, 3, 4, 5]

describe('a whole game, played at random', () => {
    it('always reaches an end, at every player count', () => {
        for (const playerCount of [2, 3, 4, 5]) {
            for (const seed of SEEDS) {
                const summary = playRandomGame(playerCount, seed)
                expect(
                    summary.finished,
                    `${playerCount}p seed ${seed}: ${summary.stoppedBecause}`
                ).toBe(true)
            }
        }
    })

    it('leaves nobody with a negative score, and pays nothing twice', () => {
        for (const playerCount of [2, 3, 5]) {
            for (const seed of SEEDS) {
                const summary = playRandomGame(playerCount, seed)
                expect(summary.scores.every((score) => score >= 0)).toBe(true)
                expect(summary.planetsExplored).toBeLessThanOrEqual(summary.planetsTotal)
            }
        }
    })

    // CANARY, expected to fail once the board is sized properly.
    //
    // Every game currently ends because the board filled up, never because a player emptied
    // their bag - the condition the rules actually name. The starting board gives 4 open
    // hexes per player and every player holds 18 pieces, so play stops at about a quarter of
    // a bag. When board growth or a resizing lands, this test should start failing, and that
    // is the signal to delete it.
    it('still ends by gridlock rather than by an empty bag', () => {
        for (const playerCount of [2, 3, 5]) {
            const summary = playRandomGame(playerCount, 1)
            expect(summary.openHexesLeft).toBe(0)
            expect(summary.piecesLeftInBags.every((left) => left > 0)).toBe(true)
        }
    })
})
