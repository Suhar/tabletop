import { describe, expect, it } from 'vitest'
import { GameEngine, GameStorage, PlayerStatus } from '@tabletop/common'
import { Definition } from './definition/gameDefinition.js'
import { twoCrownsRole } from './companies.js'

// Autorun, the family's standing run instructions, as TOP and Shikoku 1889 offer it: a company's
// president may declare its runs and payout ahead of its turn.
describe('1874 Autorun', () => {
    it('offers the Mainline’s president a standing run instruction', () => {
        const game = Definition.runtime.initializer.initializeGame(
            {
                id: 'autorun',
                typeId: Definition.info.id,
                name: 'Autorun',
                ownerId: 'test',
                storage: GameStorage.Local,
                hotseat: true,
                seed: 1,
                config: {},
                players: ['p1', 'p2', 'p3'].map((id) => ({
                    id,
                    name: id,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            Definition
        )
        const engine = new GameEngine({ ...Definition.runtime, randomnessVersion: undefined })
        const state = engine.startGame(game).initialState
        const mainline = twoCrownsRole(state, 'mainline')
        const president = state.certificates.find(
            (item) => item.companyId === mainline && item.president
        )!
        president.owner = { kind: 'player', playerId: 'p2' }
        delete president.poolId
        expect(engine.getValidActionTypesForPlayer(game, state, 'p2')).toContain(
            'SetRunInstruction'
        )
        expect(engine.getValidActionTypesForPlayer(game, state, 'p3')).not.toContain(
            'SetRunInstruction'
        )
    })
})
