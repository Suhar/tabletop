import type { GameProgress, GameProgression } from '@tabletop/common'
import type { ConduitProjectedState } from '../model/gameState.js'
import { Rounds } from '../model/rules.js'

export class ConduitProgression implements GameProgression<ConduitProjectedState> {
    progress(state: ConduitProjectedState): GameProgress {
        const round = Math.max(state.roundManager.series.length, 1)
        const roundOver = state.roundManager.series[round - 1]?.end !== undefined
        if (state.result !== undefined) {
            return { fraction: 1, label: 'Game over', final: true }
        }
        if (round >= Rounds && roundOver) {
            return { fraction: 0.95, label: 'Final payouts', final: true }
        }
        return {
            fraction: (round - 1) / Rounds,
            label: round === Rounds ? 'Last round' : `Round ${round} of ${Rounds}`,
            ...(round === Rounds ? { final: true } : {})
        }
    }
}
