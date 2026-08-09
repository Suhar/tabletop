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

    it('ends because a bag ran out, which is the ending the rules name', () => {
        for (const playerCount of [2, 3, 5]) {
            for (const seed of SEEDS) {
                const summary = playRandomGame(playerCount, seed)
                expect(summary.endedBy, `${playerCount}p seed ${seed}`).toBe('empty bag')
                // Nearly the whole bag gets played, so the board is big enough for the game
                // it is holding - the thing two planets per tile could never manage.
                expect(Math.max(...summary.piecesLeftInBags)).toBeLessThan(4)
            }
        }
    })

    it('explores a good share of the planets and pays chains without being swamped by them', () => {
        // Not assertions about balance, which is a playtest question - just a tripwire for a
        // sizing change that quietly turns the game into something else.
        const summary = playRandomGame(3, 1)
        expect(summary.planetsExplored).toBeGreaterThan(summary.planetsTotal / 4)
        expect(summary.chainsScored).toBeGreaterThan(0)
    })
})
