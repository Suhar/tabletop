import { describe, expect, it } from 'vitest'
import { playRandomGame } from './util/simulate.js'
import { PLAYTEST_TILES_PER_PLAYER } from './util/boardSetup.js'

const SEEDS = [1, 2, 3, 4, 5]

describe('a whole game, played at random', () => {
    it('always reaches an end, at every player count', { timeout: 120000 }, () => {
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

    it('never loses a piece down the back of the sofa', { timeout: 120000 }, () => {
        // Every piece that leaves a bag has to be somewhere at the end: on the board, back in a
        // bag, in a hand, discarded, or destroyed. Nothing else in the game notices a ship that
        // simply stops existing, so this is the only thing that would.
        for (const playerCount of [2, 3, 4, 5]) {
            for (const seed of SEEDS) {
                const summary = playRandomGame(playerCount, seed)
                expect(summary.piecesUnaccounted, `${playerCount}p seed ${seed}`).toBe(0)
            }
        }
    })

    it('leaves nobody with a negative score, and pays nothing twice', { timeout: 120000 }, () => {
        for (const playerCount of [2, 3, 5]) {
            for (const seed of SEEDS) {
                const summary = playRandomGame(playerCount, seed)
                expect(summary.scores.every((score) => score >= 0)).toBe(true)
                expect(summary.planetsExplored).toBeLessThanOrEqual(summary.planetsTotal)
            }
        }
    })

    it('almost always ends on an empty bag at the playtest board size', { timeout: 120000 }, () => {
        // The settled board is 3 tiles per player (rules.md). At 7, games end on an empty bag
        // rather than on a player unable to place; if this ratio slips, the board no longer
        // holds the bags.
        const summaries = [2, 3, 4, 5].flatMap((playerCount) =>
            SEEDS.map((seed) =>
                playRandomGame(playerCount, seed, {
                    tilesPerPlayer: PLAYTEST_TILES_PER_PLAYER
                })
            )
        )

        const byEmptyBag = summaries.filter((summary) => summary.endedBy === 'empty bag').length
        expect(byEmptyBag / summaries.length).toBeGreaterThan(0.85)

        // Measured on what is LEFT rather than on what the slowest player placed. A
        // drafted turn takes three from the bag and plays two, and the board-growing
        // technology adds a placement on top, so players finish at noticeably different
        // depths. That asymmetry is the rules working; a board too small for the bags
        // would instead show up as everyone stopping early at once.
        const mostLeftBehind = Math.max(...summaries.flatMap((summary) => summary.piecesLeftInBags))
        expect(mostLeftBehind).toBeLessThan(14)
    })

    it('explores a good share of the planets and pays chains without being swamped by them', () => {
        // Not assertions about balance, which is a playtest question - just a tripwire for a
        // sizing change that quietly turns the game into something else.
        // Chains are an achievement, so any one game may score none; three games should not.
        const summaries = [1, 2, 3].map((seed) =>
            playRandomGame(3, seed, { tilesPerPlayer: PLAYTEST_TILES_PER_PLAYER })
        )
        for (const summary of summaries) {
            expect(summary.planetsExplored).toBeGreaterThan(summary.planetsTotal / 4)
        }
        expect(summaries.reduce((sum, summary) => sum + summary.chainsScored, 0)).toBeGreaterThan(0)
    })
})
