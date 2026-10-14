import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    AuctionKind,
    RailroadId,
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
        expect(describeAction(resale)).toEqual([
            'offered a ',
            { railroadId: RailroadId.NRC },
            ' share for resale'
        ])
    })

    it('agrees the win with the winners', () => {
        expect(winVerb(['p2'], 'p1')).toBe('wins')
        expect(winVerb(['p1'], 'p1')).toBe('win')
        expect(winVerb(['p1'], undefined)).toBe('wins')
        expect(winVerb(['p1', 'p2'], 'p1')).toBe('share the win')
    })
})
