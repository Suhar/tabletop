import { describe, expect, it } from 'vitest'
import { liftedPrivateBlocks } from '@tabletop/18xx'
import { TwoCrownsMap } from './map.js'
import { TwoCrownsLocationNames } from './generated/map.js'
import { TwoCrownsPrivateRules } from './privateRules.js'
import { startTwoCrowns } from './setup.spec.js'

const locationNamed = (name: string) =>
    Object.entries(TwoCrownsLocationNames).find(([, value]) => value === name)![0]

// 1874design.md, Station Rights: no tile may be laid on Zadar or Virovitica while a player owns
// its Station Rights. The map marks both, as 1830 marks its privates' hexes, until the block lifts.
describe('1874 private block map markers', () => {
    it('marks Zadar, Virovitica and the Sava hex with their privates', () => {
        for (const [city, privateId] of [
            ['Zadar', 'P3'],
            ['Virovitica', 'P4']
        ]) {
            const markers = TwoCrownsMap.location(locationNamed(city)).markers ?? []
            expect(markers.map((marker) => marker.privateCompanyId)).toContain(privateId)
        }
        expect(
            TwoCrownsMap.location('L6').markers?.map((marker) => marker.privateCompanyId)
        ).toEqual(['P1'])
        expect([...TwoCrownsMap.markedPrivateIds].sort()).toEqual(['P1', 'P3', 'P4'])
    })

    it('lifts a block once a company owns the Station Rights', () => {
        const state = startTwoCrowns(3)
        const lifted = () =>
            liftedPrivateBlocks(TwoCrownsMap.markedPrivateIds, TwoCrownsPrivateRules, state)
        expect(lifted()).toEqual([])
        const zadar = state.companies.find((company) => company.id === 'P3')!
        const charter = state.certificates.find((item) => item.companyId === 'P3')!
        charter.owner = {
            kind: 'company',
            companyId: state.companies.find((c) => c.kind !== 'private')!.id
        }
        delete charter.poolId
        expect(zadar.closed).toBeFalsy()
        expect(lifted()).toEqual(['P3'])
        // The Sava River Bridge blocks L6 until it closes, whoever owns it.
        state.companies.find((company) => company.id === 'P1')!.closed = true
        expect(lifted().sort()).toEqual(['P1', 'P3'])
    })
})
