import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    ActionType,
    PieceType,
    PlanetColor,
    type AttackPiece,
    type AttackSpread,
    type UseUpdatedLogistics
} from '@tabletop/earendel'
import { describeAction } from './describe.js'

const base = { id: 'a', gameId: 'g', source: ActionSource.User, playerId: 'p1' }

const action = (type: string): GameAction => ({ ...base, type })

describe('describeAction', () => {
    it.each(Object.values(ActionType))('describes %s in words', (type) => {
        const description = describeAction(action(type))
        expect(description).not.toBe(type)
        expect(description.length).toBeGreaterThan(0)
    })

    it('names what a torpedo spread destroyed and damaged', () => {
        const spread: AttackSpread = {
            ...base,
            type: ActionType.AttackSpread,
            targets: [],
            metadata: {
                hits: [
                    { target: { id: 's', type: PieceType.Station, playerId: 'p2' } },
                    { target: { id: 'q', type: PieceType.Probe, playerId: 'p2', level: 1 } },
                    {
                        target: { id: 'f', type: PieceType.Fighter, playerId: 'p3', level: 2 },
                        damaged: true,
                        levelAfter: 1
                    }
                ]
            }
        }
        expect(describeAction(spread)).toBe(
            'fired a Full Torpedo Spread, destroying a station and a level 1 probe, damaging a fighter down to level 1'
        )
    })

    it('says how many targets an Updated Logistics fighter could reach', () => {
        const woke: UseUpdatedLogistics = {
            ...base,
            type: ActionType.UseUpdatedLogistics,
            coords: { q: 0, r: 0 },
            metadata: { targetCount: 2 }
        }
        expect(describeAction(woke)).toBe(
            'used Updated Logistics to send a fighter into the attack, with 2 targets in reach'
        )
    })

    it('says when an action breaks or restores a pending claim, naming whose', () => {
        const shot: AttackPiece = {
            ...base,
            type: ActionType.AttackPiece,
            coords: { q: 1, r: 0 },
            metadata: {
                target: { id: 'q', type: PieceType.Probe, playerId: 'p2', level: 2 },
                claimsBroken: [
                    {
                        playerId: 'p2',
                        coords: { q: 0, r: 0 },
                        technologyId: 'tech-3',
                        color: PlanetColor.Teal
                    }
                ],
                claimsRestored: [{ playerId: 'p1', coords: { q: 2, r: 0 }, technologyId: 'tech-3' }]
            }
        }
        const names: Record<string, string> = { p2: 'Bob' }
        const description = describeAction(shot, (playerId) => names[playerId] ?? playerId)
        expect(description).toMatch(/and broke Bob's pending .+ on the teal planet/)
        expect(description).toMatch(/and restored their own pending .+ on its planet$/)
    })
})
