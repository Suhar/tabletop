import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import type { HydratedEarendelGameState } from '@tabletop/earendel'
import { gsap } from 'gsap'
import { boardFrame, viewBoxOf } from '$lib/utils/boardFrame.js'

const FRAME_SLIDE = 0.45
const FALLBACK_SLIDE = 0.15

// The board's frame is its SVG viewBox, which follows the board's extent. When a change of state
// grows or shrinks the board (a tile laid, or undone), the frame slides to the new extent with
// that change, on its timeline, so the new state arrives already framed. When only a tile's
// ghosts come and go as the player tries places for it, nothing in the game has changed and the
// frame slides on its own.
export class FrameAnimator {
    private node: SVGSVGElement | undefined
    private framed: string | undefined
    // What the board last asked for, kept while a change of state owns the frame.
    private wanted: string | undefined
    private changing = false
    private slide: gsap.core.Tween | undefined

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
        const node = this.node
        if (!from || !node) return

        this.changing = true
        animationContext.afterAnimations(() => {
            this.changing = false
            if (this.wanted) this.follow(this.wanted)
        })

        const target = viewBoxOf(boardFrame(Object.values(to.board.hexes).map((hex) => hex.coords)))
        if (target === this.framed) return
        this.slide?.kill()
        this.framed = target
        animationContext.actionTimeline.to(
            node,
            {
                attr: { viewBox: target },
                duration: action ? FRAME_SLIDE : FALLBACK_SLIDE,
                ease: 'power2.inOut'
            },
            0
        )
    }

    attach(node: SVGSVGElement, viewBox: string) {
        this.node = node
        this.framed = viewBox
        this.wanted = viewBox
        node.setAttribute('viewBox', viewBox)
    }

    detach(node: SVGSVGElement) {
        if (this.node !== node) return
        this.slide?.kill()
        this.node = undefined
    }

    // The board's own extent changed with nothing committed: ghosts came or went.
    follow(viewBox: string) {
        this.wanted = viewBox
        const node = this.node
        if (!node || this.changing || viewBox === this.framed) return
        this.framed = viewBox
        this.slide?.kill()
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            node.setAttribute('viewBox', viewBox)
            return
        }
        this.slide = gsap.to(node, {
            attr: { viewBox },
            duration: FRAME_SLIDE,
            ease: 'power2.inOut'
        })
    }
}

// The board's SVG, whose viewBox the animator alone writes.
export function frameBoard(
    node: SVGSVGElement,
    params: { animator: FrameAnimator; viewBox: string }
) {
    params.animator.attach(node, params.viewBox)

    return {
        update(next: { animator: FrameAnimator; viewBox: string }) {
            next.animator.follow(next.viewBox)
        },
        destroy() {
            params.animator.detach(node)
        }
    }
}
