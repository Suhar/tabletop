import { describe, expect, it } from 'vitest'
import { startTwoCrowns } from './setup.spec.js'
import { TwoCrownsTransferRules } from './transferRules.js'
import { twoCrownsRole } from './companies.js'
import { AnconaLineId, afterAnconaPurchase } from './ancona.js'

// 1874design.md, Ancona Steamship Line (P17): sold to a non-Luka company for ½×–1× face.
describe('1874 Ancona Steamship Line', () => {
    const asset = { kind: 'private' as const, privateCompanyId: AnconaLineId }
    function withLineHeldBy(playerId: string) {
        const state = startTwoCrowns(4)
        const line = state.certificates.find((item) => item.companyId === AnconaLineId)!
        line.owner = { kind: 'player', playerId }
        delete line.poolId
        return state
    }

    it('sells to a company other than the Luka from 4H until the first 4+', () => {
        const state = withLineHeldBy('p1')
        const mainline = twoCrownsRole(state, 'mainline')
        expect(TwoCrownsTransferRules.priceRange(state, mainline, asset)).toBeUndefined()
        state.phaseId = '4H'
        expect(TwoCrownsTransferRules.priceRange(state, mainline, asset)).toEqual({
            minimum: 45,
            maximum: 90
        })
        expect(TwoCrownsTransferRules.priceRange(state, 'LUKA', asset)).toBeUndefined()
        state.phaseId = '4+'
        expect(TwoCrownsTransferRules.priceRange(state, mainline, asset)).toBeUndefined()
    })

    it('gives the buyer the Ancona bonus and closes', () => {
        const state = withLineHeldBy('p1')
        const mainline = twoCrownsRole(state, 'mainline')
        const line = state.certificates.find((item) => item.companyId === AnconaLineId)!
        line.owner = { kind: 'company', companyId: mainline }
        afterAnconaPurchase(state, {
            id: 'offer',
            seller: { kind: 'player', playerId: 'p1' },
            buyer: { kind: 'company', companyId: mainline },
            asset,
            price: 90
        } as never)
        expect(state.anconaCompanyId).toBe(mainline)
        expect(state.companies.find((item) => item.id === AnconaLineId)!.closed).toBe(true)
    })
})
