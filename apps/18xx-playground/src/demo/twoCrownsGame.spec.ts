import { expect, it } from 'vitest'
import { CompleteGameRun, TwoCrownsFullGame } from './completeGame.js'

// The scripted policy withholds until it owns a full set of trains, which can bankrupt a
// president at four players; either ending shows the game reaches final wealth.
it.each([
    [3, ['First D']],
    [4, ['First D', 'Bankruptcy']]
])(
    'plays The Two Crowns from opening through final wealth with %i players',
    (count, endings) => {
        const run = new CompleteGameRun(TwoCrownsFullGame, count)
        for (let step = 0; step < 4000 && !run.state.result; step++) run.step()
        expect(endings).toContain(run.state.gameEnding?.reason)
        expect(run.state.machineState).toBe('GameOver')
        expect(run.state.finalWealth).toHaveLength(count)
        expect(run.history.some((action) => action.type === 'RunTrains')).toBe(true)
        expect(run.history.some((action) => action.type === 'StartCompany')).toBe(true)
    },
    240000
)

it.each([3, 4])('completes The Two Crowns opening auction with %i players', (count) => {
    const run = new CompleteGameRun(TwoCrownsFullGame, count)
    for (let step = 0; step < 400 && run.state.machineState !== 'StockRound'; step++) run.step()
    expect(run.state.machineState).toBe('StockRound')
    const charters = run.state.certificates.filter(
        (certificate) => certificate.kind === 'private' && certificate.companyId !== 'P'
    )
    const lukaShares = run.state.certificates.filter((certificate) =>
        certificate.id.startsWith('LUKA:share:')
    )
    expect(charters.length + lukaShares.length).toBe(count === 3 ? 21 : 20)
    expect(charters.every((certificate) => certificate.owner.kind === 'player')).toBe(true)
})
