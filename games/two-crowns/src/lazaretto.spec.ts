import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { startTwoCrowns } from './setup.spec.js'
import { twoCrownsRole } from './companies.js'
import { HydratedQuarantineTrain, LazarettoId, quarantineTrainIds } from './lazaretto.js'
import { TwoCrownsPhaseRules } from './phaseRules.js'

// 1874design.md, Quarantine: the owner closes the Lazaretto in a presided company's turn to mark
// one of its trains, which then runs one more OR when it would rust.
describe('1874 Rijeka Lazaretto', () => {
    function operating(playerId: string, machineState = 'LayingTrack') {
        // At 4–5 players the Lazaretto may be the private removed at setup; at 3 it is always dealt.
        const state = startTwoCrowns(3)
        const mainline = twoCrownsRole(state, 'mainline')
        state.companies.find((item) => item.id === mainline)!.president = {
            kind: 'player',
            playerId: 'p1'
        }
        const lazaretto = state.certificates.find((item) => item.companyId === LazarettoId)!
        lazaretto.owner = { kind: 'player', playerId }
        delete lazaretto.poolId
        const train = state.trainInventory.trains.find((item) => item.definitionId === '2H')!
        Object.assign(train, { status: 'owned', owner: { kind: 'company', companyId: mainline } })
        Object.assign(state, {
            machineState,
            activePlayerIds: ['p1'],
            operatingSet: {
                number: 1,
                roundNumber: 1,
                roundCount: 1,
                companyOrder: [mainline],
                completedCompanyIds: [],
                completed: false
            }
        })
        return { state, train }
    }
    const quarantine = (trainId: string) =>
        new HydratedQuarantineTrain({
            id: 'q',
            gameId: 'g',
            type: 'QuarantineTrain',
            playerId: 'p1',
            source: ActionSource.User,
            trainId
        } as never)

    it('marks a train of the company its owner presides, then closes', () => {
        const { state, train } = operating('p1')
        expect(quarantineTrainIds(state as never, 'p1')).toEqual([train.id])
        quarantine(train.id).apply(state as never)
        expect(state.quarantinedTrainId).toBe(train.id)
        expect(state.companies.find((item) => item.id === LazarettoId)!.closed).toBe(true)
        expect(quarantineTrainIds(state as never, 'p1')).toEqual([])
    })

    it('is not offered to another player or outside an operating turn', () => {
        expect(quarantineTrainIds(operating('p2').state as never, 'p1')).toEqual([])
        expect(quarantineTrainIds(operating('p1', 'StockRound').state as never, 'p1')).toEqual([])
    })

    it('lets the marked train run once more on its rust', () => {
        const { state, train } = operating('p1')
        state.phaseId = '5H'
        expect(TwoCrownsPhaseRules.rustTiming(state as never, train)).toBe('immediate')
        state.quarantinedTrainId = train.id
        expect(TwoCrownsPhaseRules.rustTiming(state as never, train)).toBe('after-operation')
    })
})
