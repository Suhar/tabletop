import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    type AttackPiece,
    PieceSource,
    PieceType,
    type PlacePiece,
    PlanetColor
} from '@tabletop/earendel'
import { rationaleFor } from './rationale.js'

const base = { id: 'a', gameId: 'g', source: ActionSource.User, playerId: 'p1' }

describe('rationaleFor', () => {
    it('explains a station that scored through a relay', () => {
        const placed: PlacePiece = {
            ...base,
            type: ActionType.PlacePiece,
            coords: { q: 0, r: 0 },
            pieceSource: PieceSource.Bag,
            metadata: {
                pieceType: PieceType.Station,
                stationGroupPoints: 3,
                stationComplex: { stations: 3, hubs: 0, relays: 1 }
            }
        }
        const lines = rationaleFor(placed)
        expect(lines[0]).toMatch(/1 for itself and 1 for every other friendly station.*3 here/)
        expect(lines.some((line) => /links chain/.test(line))).toBe(true)
        expect(
            lines.some((line) => /relay links every friendly station it can see/.test(line))
        ).toBe(true)
        expect(lines.some((line) => /Station Hub/.test(line))).toBe(false)
    })

    it('explains a chain and a claim the placement broke, naming whose', () => {
        const placed: PlacePiece = {
            ...base,
            type: ActionType.PlacePiece,
            coords: { q: 0, r: 0 },
            pieceSource: PieceSource.Bag,
            metadata: {
                pieceType: PieceType.Probe,
                chains: [
                    {
                        planets: [
                            { q: 0, r: 1 },
                            { q: 4, r: 1 }
                        ],
                        color: PlanetColor.Teal,
                        length: 3,
                        points: 6
                    }
                ],
                claimsBroken: [{ playerId: 'p2', coords: { q: 1, r: 1 }, technologyId: 'tech-0' }]
            }
        }
        const lines = rationaleFor(placed, (id) => (id === 'p2' ? 'Bob' : id))
        expect(lines).toContain(
            'Joining two teal planets with an unbroken run of 3 of your own ships scores the 3rd triangular number, 6. Each pair of planets pays once, to whoever joins it first.'
        )
        expect(lines.some((line) => /^Bob's pending .+ broke/.test(line))).toBe(true)
    })

    it('explains why a shot wore a fighter down rather than destroying it', () => {
        const shot: AttackPiece = {
            ...base,
            type: ActionType.AttackPiece,
            coords: { q: 1, r: 0 },
            metadata: {
                target: { id: 'f', playerId: 'p2', type: PieceType.Fighter, level: 3 },
                damaged: true,
                levelAfter: 2
            }
        }
        expect(rationaleFor(shot)).toEqual([
            'A hit on a fighter above level 1 wears it down a level instead of destroying it; at level 1 the next hit destroys it.'
        ])
    })

    it('has nothing to say about an action with no rule to explain', () => {
        expect(rationaleFor({ ...base, type: ActionType.DiscardPiece })).toEqual([])
    })
})
