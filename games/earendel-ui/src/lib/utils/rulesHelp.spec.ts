import { describe, expect, it } from 'vitest'
import { GRANTED_TYPES, type Piece, PieceType, TechnologyEffectKind } from '@tabletop/earendel'
import { Power } from '$lib/model/stagedSelection.js'
import {
    EVENT_KINDS,
    eventHelp,
    powerHelp,
    RULES_HELP,
    type RulesHelp,
    rulesHelpFor,
    RulesTopic,
    specialPieceHelp
} from './rulesHelp.js'

const piece = (type: PieceType, extra: Partial<Piece> = {}): Piece => ({
    id: 'p1-piece',
    playerId: 'p1',
    type,
    ...extra
})

// A short note, not a page of rules.
function expectNote(help: RulesHelp | undefined) {
    expect(help).toBeDefined()
    expect(help!.title.length).toBeGreaterThan(0)
    expect(help!.lead.length).toBeGreaterThan(0)
    expect(help!.points.length).toBeGreaterThanOrEqual(2)
    expect(help!.points.length).toBeLessThanOrEqual(4)
    for (const point of help!.points) expect(point.length).toBeGreaterThan(0)
}

describe('the Rules pill has something to say', () => {
    it('on every decision with a note of its own', () => {
        for (const topic of Object.values(RulesTopic)) expectNote(RULES_HELP[topic])
    })

    it('on every power', () => {
        for (const power of Object.values(Power)) {
            const help = powerHelp(power)
            expectNote(help)
            expect(help.title.startsWith('Using ')).toBe(true)
        }
    })

    it('on every elevated event', () => {
        for (const kind of EVENT_KINDS) expectNote(eventHelp(kind))
        expect(eventHelp(TechnologyEffectKind.Railgun)).toBeUndefined()
    })

    it('on every special piece', () => {
        const types = [...Object.values(GRANTED_TYPES), PieceType.Gate]
        expect(types.length).toBeGreaterThanOrEqual(12)
        for (const type of types) expectNote(specialPieceHelp(piece(type)))
        expectNote(specialPieceHelp(piece(PieceType.Station, { hub: true })))
        // An ordinary ship is not a special piece.
        expect(specialPieceHelp(piece(PieceType.Probe))).toBeUndefined()
    })
})

describe('the Rules pill follows the decision', () => {
    const title = (decision: Parameters<typeof rulesHelpFor>[0]) => rulesHelpFor(decision)?.title

    it('says nothing when nothing is asked', () => {
        expect(rulesHelpFor({})).toBeUndefined()
    })

    it('names each decision the game waits on', () => {
        expect(title({ stowing: true })).toBe(RULES_HELP[RulesTopic.Stow].title)
        expect(title({ openingStation: true })).toBe(RULES_HELP[RulesTopic.OpeningStation].title)
        expect(title({ drawing: true })).toBe(RULES_HELP[RulesTopic.Draw].title)
        expect(title({ discarding: true })).toBe(RULES_HELP[RulesTopic.DraftDiscard].title)
        expect(title({ surveying: true })).toBe(RULES_HELP[RulesTopic.Survey].title)
        expect(title({ choosingTechnology: true })).toBe(
            RULES_HELP[RulesTopic.ChooseTechnology].title
        )
        expect(title({ attacking: true })).toBe(RULES_HELP[RulesTopic.Attack].title)
        expect(title({ attacking: true, torpedoStrike: true })).toBe(
            RULES_HELP[RulesTopic.TorpedoStrike].title
        )
        expect(title({ terraforming: true })).toBe(RULES_HELP[RulesTopic.Terraform].title)
        expect(title({ seeding: true })).toBe(RULES_HELP[RulesTopic.Seed].title)
        expect(title({ founding: true })).toBe(RULES_HELP[RulesTopic.FoundPlanet].title)
        expect(title({ layingTile: true })).toBe(RULES_HELP[RulesTopic.LayTile].title)
        expect(title({ choosingEventOrder: true })).toBe(RULES_HELP[RulesTopic.EventOrder].title)
        expect(title({ drifting: true })).toBe(RULES_HELP[RulesTopic.Drift].title)
        expect(title({ endingTurn: true })).toBe(RULES_HELP[RulesTopic.EndTurn].title)
        expect(title({ event: TechnologyEffectKind.WormholeStorm })).toBe(
            'Wormhole Storm: your pick'
        )
    })

    it('follows the ship chosen to place', () => {
        const placing = { placing: true }
        expect(title(placing)).toBe(RULES_HELP[RulesTopic.PlaceShips].title)
        expect(title({ ...placing, piece: piece(PieceType.Probe) })).toBe(
            RULES_HELP[RulesTopic.PlaceProbe].title
        )
        expect(title({ ...placing, piece: piece(PieceType.Fighter) })).toBe(
            RULES_HELP[RulesTopic.PlaceFighter].title
        )
        expect(title({ ...placing, piece: piece(PieceType.Station) })).toBe(
            RULES_HELP[RulesTopic.PlaceStation].title
        )
        expect(title({ ...placing, piece: piece(PieceType.Station, { hub: true }) })).toBe(
            'Placing your Station Hub'
        )
        expect(title({ ...placing, piece: piece(PieceType.Jammer) })).toBe('Placing your Jammer')
        expect(title({ ...placing, piece: piece(PieceType.Station), tileShip: true })).toBe(
            RULES_HELP[RulesTopic.TileShip].title
        )
    })

    it('puts what the game waits on ahead of what the player could do', () => {
        const hand = { placing: true, piece: piece(PieceType.Probe) }
        expect(title({ ...hand, discarding: true })).toBe(RULES_HELP[RulesTopic.DraftDiscard].title)
        expect(title({ ...hand, power: Power.Warp })).toBe('Using Warp Drive')
        expect(title({ ...hand, power: Power.Warp, surveying: true })).toBe(
            RULES_HELP[RulesTopic.Survey].title
        )
        expect(title({ ...hand, endingTurn: true })).toBe(RULES_HELP[RulesTopic.PlaceProbe].title)
        // Arming a railgun or choosing a spread is explained while the shot is open.
        expect(title({ attacking: true, power: Power.Railgun })).toBe('Using Railgun')
    })
})
