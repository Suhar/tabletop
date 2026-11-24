import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction, Point } from '@tabletop/common'
import type { HydratedEarendelGameState } from '@tabletop/earendel'
import { tick } from 'svelte'
import { hexGeometry } from '$lib/utils/hexDefinition.js'
import { scoreSourcesOf, type ScoreSource } from '$lib/utils/actionEffects.js'
import { ElementRegistry } from './elementRegistry.js'

// One float per scoring action: everything the action earned, summed. History tells the rest.
export type ScoreFloat = Pick<ScoreSource, 'points' | 'playerId'> & { key: string; at: Point }

const RISE = 70
const DURATION = 1.6

export class ScoreFloatAnimator {
    floats: ScoreFloat[] = $state([])
    readonly elements = new ElementRegistry<SVGGElement>()

    async onGameStateChange({
        action,
        animationContext
    }: {
        to: HydratedEarendelGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!action) return

        const sources = scoreSourcesOf(action)
        if (sources.length === 0) return

        // One float per player: a route a rival's chain took over pays that rival.
        const scorers = [...new Set(sources.map((source) => source.playerId))]
        this.floats = scorers.map((playerId) => {
            const theirs = sources.filter((source) => source.playerId === playerId)
            const center = hexGeometry(theirs[0].coords).center
            return {
                key: `${action.id}-${playerId}`,
                points: theirs.reduce((sum, source) => sum + source.points, 0),
                playerId,
                at: { x: center.x, y: center.y }
            }
        })

        await tick()

        const timeline = animationContext.finalTimeline
        for (const float of this.floats) {
            const element = this.elements.get(float.key)
            if (!element) continue
            timeline.fromTo(
                element,
                { y: 0, opacity: 0 },
                { y: -RISE, duration: DURATION, ease: 'power1.out' },
                0
            )
            timeline.to(element, { opacity: 1, duration: 0.15 }, 0)
            timeline.to(element, { opacity: 0, duration: 0.45 }, DURATION - 0.5)
        }

        animationContext.afterAnimations(() => {
            this.floats = []
        })
    }
}
