import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { ConduitGameStateValidator } from '@tabletop/conduit'

const FOLDER = new URL('../../scenarios/', import.meta.url)

const files = readdirSync(FOLDER).filter((name) => name.endsWith('.json'))

describe('the scenarios the harness offers', () => {
    it.each(files)('%s is a played position written by scripts/build-scenarios.mjs', (name) => {
        const { game, state, actions } = JSON.parse(readFileSync(new URL(name, FOLDER), 'utf8'))
        expect(ConduitGameStateValidator.Check(state)).toBe(true)
        expect(game.id).toBe(`scenario-${name.replace(/\.json$/, '')}`)
        expect(state.gameId).toBe(game.id)
        expect(actions.length).toBe(state.actionCount)
        expect(actions.every((action: { gameId: string }) => action.gameId === game.id)).toBe(true)
        expect(state.activePlayerIds).toHaveLength(1)
    })
})
