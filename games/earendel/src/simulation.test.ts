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

    it('almost always ends on an empty bag, with nearly every piece played', () => {
        // Both endings are real rules now, but they say different things about the board. A
        // bag running out means the map held the game it was carrying; a player unable to
        // place what they drew should be the rare case, not the norm. If this ratio slips,
        // the board has got too small for the bags again - which is exactly the failure two
        // planets per tile used to produce, silently.
        const summaries = [2, 3, 4, 5].flatMap((playerCount) =>
            SEEDS.map((seed) => playRandomGame(playerCount, seed))
        )

        const byEmptyBag = summaries.filter((summary) => summary.endedBy === 'empty bag').length
        expect(byEmptyBag / summaries.length).toBeGreaterThan(0.85)

        const fewestPlaced = Math.min(
            ...summaries.flatMap((summary) => summary.piecesLeftInBags.map((left) => 22 - left))
        )
        expect(fewestPlaced).toBeGreaterThan(18)
    })

    it('explores a good share of the planets and pays chains without being swamped by them', () => {
        // Not assertions about balance, which is a playtest question - just a tripwire for a
        // sizing change that quietly turns the game into something else.
        const summary = playRandomGame(3, 1)
        expect(summary.planetsExplored).toBeGreaterThan(summary.planetsTotal / 4)
        expect(summary.chainsScored).toBeGreaterThan(0)
    })
})
