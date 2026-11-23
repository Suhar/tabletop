import type { AnimationContext } from '@tabletop/frontend-components'
import { type AxialCoordinates, type GameAction, sameCoordinates } from '@tabletop/common'
import {
    type EarendelBoard,
    type Hex,
    HexKind,
    hexKey,
    type HydratedEarendelGameState
} from '@tabletop/earendel'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import { ElementRegistry } from './elementRegistry.js'

export const WIPE_DURATION = 0.9
const FALLBACK_WIPE_DURATION = 0.15

// A planet whose color is changing, drawn in its new color while a scan line wipes it in.
export type TerraformWipe = { key: string; hex: Hex }

// Recolors sweep across the planet from left to right behind a white line, leaving the new
// color, before the new state is shown. The board's own tile is clipped to the part the line
// has not reached, so the old color is wiped away rather than showing through the new.
export class TerraformAnimator {
    wipes: TerraformWipe[] = $state([])

    readonly clips = new ElementRegistry<SVGRectElement>()
    readonly remainders = new ElementRegistry<SVGRectElement>()
    readonly lines = new ElementRegistry<SVGGElement>()

    constructor(private readonly shownBoard: () => EarendelBoard) {}

    wipeFor(coords: AxialCoordinates): TerraformWipe | undefined {
        return this.wipes.find((wipe) => sameCoordinates(wipe.hex.coords, coords))
    }

    async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedEarendelGameState
        from?: HydratedEarendelGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from) return

        // Stood in against the board on show, not this step's start: while a run of actions
        // plays, the board on show is still the one from before the first of them, so a planet
        // an earlier step recolored keeps its new color while a later step animates.
        const recoloredSince = (board: EarendelBoard) =>
            Object.values(to.board.hexes).filter((hex) => {
                if (hex.kind !== HexKind.Planet) return false
                const before = board.hexes[hexKey(hex.coords)]
                return before?.kind === HexKind.Planet && before.color !== hex.color
            })
        const recolored = recoloredSince(this.shownBoard())
        if (recolored.length === 0) return
        const wipedNow = new Set(recoloredSince(from.board).map((hex) => hexKey(hex.coords)))

        this.wipes = recolored.map((hex) => ({ key: String(hexKey(hex.coords)), hex }))

        // The copies have to be mounted before their clips and lines can be tweened.
        await tick()

        const duration = action ? WIPE_DURATION : FALLBACK_WIPE_DURATION
        for (const wipe of this.wipes) {
            const clip = this.clips.get(wipe.key)
            const remainder = this.remainders.get(wipe.key)
            const line = this.lines.get(wipe.key)
            const width = Number(clip?.getAttribute('data-width') ?? 0)
            if (!wipedNow.has(hexKey(wipe.hex.coords))) {
                if (clip) gsap.set(clip, { attr: { width } })
                if (remainder) gsap.set(remainder, { attr: { width: 0 } })
                if (line) gsap.set(line, { opacity: 0 })
                continue
            }
            if (clip) {
                animationContext.actionTimeline.fromTo(
                    clip,
                    { attr: { width: 0 } },
                    { attr: { width }, duration, ease: 'power1.inOut' },
                    0
                )
            }
            if (remainder) {
                const left = Number(remainder.getAttribute('x') ?? 0)
                animationContext.actionTimeline.fromTo(
                    remainder,
                    { attr: { x: left, width } },
                    { attr: { x: left + width, width: 0 }, duration, ease: 'power1.inOut' },
                    0
                )
            }
            if (line) {
                animationContext.actionTimeline.fromTo(
                    line,
                    { x: 0, opacity: 1 },
                    { x: width, duration, ease: 'power1.inOut' },
                    0
                )
                animationContext.actionTimeline.to(
                    line,
                    { opacity: 0, duration: Math.min(0.15, duration / 3) },
                    duration
                )
            }
        }

        animationContext.afterAnimations(() => {
            this.wipes = []
        })
    }
}
