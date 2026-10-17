import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    AuctionKind,
    MapId,
    RailroadId,
    sarMap,
    type BuildTrack,
    type FoundSpecialConnection,
    type LeaveTown,
    type OfferShare
} from '@tabletop/south-african-railroads'
import { describeAction, saleDescription, winVerb } from './describeAction.js'

describe('player sentences', () => {
    it('describes a sale in the past tense, so it reads for any buyer', () => {
        expect(
            saleDescription({
                railroadId: RailroadId.NRC,
                kind: AuctionKind.OfferStock,
                buyerId: 'p1',
                price: 4
            })
        ).toEqual([
            { playerId: 'p1' },
            ' bought the ',
            { railroadId: RailroadId.NRC },
            ' share for $4'
        ])
        expect(
            saleDescription({
                railroadId: RailroadId.CdFM,
                kind: AuctionKind.InitialOffering,
                buyerId: 'p1',
                price: 0
            })
        ).toEqual([
            { playerId: 'p1' },
            ' took the ',
            { railroadId: RailroadId.CdFM },
            ' share free'
        ])
    })

    it('describes reselling a share without a pronoun', () => {
        const resale: OfferShare = {
            id: 'a1',
            gameId: 'g',
            source: ActionSource.User,
            playerId: 'p1',
            type: ActionType.OfferShare,
            railroadId: RailroadId.NRC,
            ownShare: true
        }
        expect(describeAction(sarMap(MapId.SouthAfrica), resale)).toEqual([
            'offered a ',
            { railroadId: RailroadId.NRC },
            ' share for resale'
        ])
    })

    it('names the railroad a build opens and the home it reached', () => {
        const build: BuildTrack = {
            id: 'a2',
            gameId: 'g',
            source: ActionSource.User,
            playerId: 'p1',
            type: ActionType.BuildTrack,
            railroadId: RailroadId.CdFM,
            linkIds: ['johannesburg~witbank'],
            metadata: { cost: 5, income: 9, opensRailroad: RailroadId.ZASM }
        }
        expect(describeAction(sarMap(MapId.SouthAfrica), build)).toEqual([
            'built Johannesburg–Witbank for the ',
            { railroadId: RailroadId.CdFM },
            ' for $5',
            ' · Johannesburg reached: the ',
            { railroadId: RailroadId.ZASM },
            ' opens'
        ])
    })

    it('describes leaving town and the metro area it develops', () => {
        const leave: LeaveTown = {
            id: 'a3',
            gameId: 'g',
            source: ActionSource.User,
            playerId: 'p1',
            type: ActionType.LeaveTown,
            settlementId: 'topeka',
            metadata: { income: 2, automatic: { settlementId: 'dallas', income: 4 } }
        }
        expect(describeAction(sarMap(MapId.TexasSpecial), leave)).toEqual([
            'left Topeka, taking a cube that pays $3 a dividend · Dallas developed (now $4)'
        ])
    })

    it('describes founding the Texas Special with its special dividends', () => {
        const founding: FoundSpecialConnection = {
            id: 'a4',
            gameId: 'g',
            source: ActionSource.User,
            playerId: 'p1',
            type: ActionType.FoundSpecialConnection,
            railroadId: RailroadId.MKT,
            partnerId: RailroadId.SP,
            metadata: {
                cost: 30,
                rates: [
                    { railroadId: RailroadId.MKT, perShare: 2 },
                    { railroadId: RailroadId.SP, perShare: 1 }
                ],
                payouts: []
            }
        }
        expect(describeAction(sarMap(MapId.TexasSpecial), founding)).toEqual([
            'founded the Texas Special joining the ',
            { railroadId: RailroadId.MKT },
            ' and the ',
            { railroadId: RailroadId.SP },
            ' · special dividend per share: Katy $2, SoPac $1'
        ])
    })

    it('agrees the win with the winners', () => {
        expect(winVerb(['p2'], 'p1')).toBe('wins')
        expect(winVerb(['p1'], 'p1')).toBe('win')
        expect(winVerb(['p1'], undefined)).toBe('wins')
        expect(winVerb(['p1', 'p2'], 'p1')).toBe('share the win')
    })
})
