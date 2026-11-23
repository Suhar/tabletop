import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { ActionType, type ChooseTechnology, type DrawPieces, PieceType } from '@tabletop/earendel'
import { orbitNotes } from './orbitNotes.js'

const base = { gameId: 'g', source: ActionSource.User, playerId: 'p1' }
const probe = { id: 'p1-ship-a', playerId: 'p1', type: PieceType.Probe, level: 2 }
const orbited = [{ probe, from: { q: 0, r: 1 }, planet: { q: 0, r: 0 } }]

describe('orbitNotes', () => {
    it('tells of a claim paying at the draw', () => {
        const draw: DrawPieces = {
            ...base,
            id: 'draw',
            type: ActionType.DrawPieces,
            metadata: { orbited, technologiesClaimed: ['railgun-1'] }
        }
        expect(orbitNotes([draw])).toEqual([
            {
                key: 'draw',
                playerId: 'p1',
                probes: 1,
                technologyIds: ['railgun-1'],
                elevated: false
            }
        ])
    })

    it('tells of an elevated technology sending a probe into orbit at once', () => {
        const chosen: ChooseTechnology = {
            ...base,
            id: 'choose',
            type: ActionType.ChooseTechnology,
            metadata: { technologyId: 'gammaTorpedo-1', elevated: true, orbited }
        }
        expect(orbitNotes([chosen])).toEqual([
            {
                key: 'choose',
                playerId: 'p1',
                probes: 1,
                technologyIds: ['gammaTorpedo-1'],
                elevated: true
            }
        ])
    })

    it('drops a note once a piece has been played after it, and keeps a later one', () => {
        const draw: DrawPieces = {
            ...base,
            id: 'draw',
            type: ActionType.DrawPieces,
            metadata: { orbited, technologiesClaimed: ['railgun-1'] }
        }
        const placed = { ...base, id: 'place', type: ActionType.PlacePiece }
        const chosen: ChooseTechnology = {
            ...base,
            id: 'choose',
            type: ActionType.ChooseTechnology,
            metadata: { technologyId: 'gammaTorpedo-1', elevated: true, orbited }
        }
        expect(orbitNotes([draw, placed])).toEqual([])
        expect(orbitNotes([draw, placed, chosen]).map((note) => note.key)).toEqual(['choose'])
        expect(orbitNotes([draw, placed, chosen, { ...placed, id: 'place-2' }])).toEqual([])
    })

    it('says nothing of a draw or a choice that sent no probe into orbit', () => {
        const draw: DrawPieces = { ...base, id: 'draw', type: ActionType.DrawPieces, metadata: {} }
        const chosen: ChooseTechnology = {
            ...base,
            id: 'choose',
            type: ActionType.ChooseTechnology,
            metadata: { technologyId: 'gammaTorpedo-1' }
        }
        expect(orbitNotes([draw, chosen])).toEqual([])
    })
})
