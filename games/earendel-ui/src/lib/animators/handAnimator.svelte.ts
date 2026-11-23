import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    type DrawPieces,
    isDrawPieces,
    type HydratedEarendelGameState,
    type Piece
} from '@tabletop/earendel'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import { ElementRegistry } from './elementRegistry.js'

const DEAL_GAP = 0.18
const DEAL_FLIGHT = 0.55
const DEAL_LIFT = 18
const COUNT_AT = 0.1
const BAG_FADE = 0.4
const BAG_COLLAPSE = 0.35
const FLIP = 0.5
const FLIP_LIFT = 14
const FLIP_GAP = 0.08
const FALLBACK_FLIP = 0.18
const HAND_FADE = 0.35
const FALLBACK_FADE = 0.18

export type Dealing = { playerId: string; pieces: Piece[] }

// The hand: the turn's draw deals out of the bag, the bag counts down with each ship, then
// fades and closes up so the hand settles where it will stay. A ship that leaves the hand
// (thrown out, placed, or back in the bag) turns face down where it lies, and turns back up
// if that is undone. When the last ship leaves, the whole hand fades out after its turn, so
// that whatever the turn asks for next has the space.
export class HandAnimator {
    // The ships in flight, drawn in the hand's row until the state shows them there.
    dealing: Dealing | undefined = $state()
    // The bag's count during the deal, before the state catches up.
    shownRemaining: number | undefined = $state()
    // The prompt beside the bag goes the moment the deal begins.
    promptHidden: boolean = $state(false)
    readonly bag = new ElementRegistry<HTMLElement>()
    // The hand's card wrappers by ship id, dealt or standing.
    readonly cards = new ElementRegistry<HTMLElement>()

    constructor(private readonly viewerId: () => string | undefined) {}

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
        if (isDrawPieces(action)) {
            await this.deal(from, to, action, animationContext)
            return
        }
        this.flip(from, to, action, animationContext)
    }

    private async deal(
        from: HydratedEarendelGameState,
        to: HydratedEarendelGameState,
        action: DrawPieces,
        animationContext: AnimationContext
    ) {
        const drawn = action.metadata?.drawn ?? []
        if (drawn.length === 0) return

        const before = from.players.find((p) => p.playerId === action.playerId)?.bag.remaining ?? 0
        const after = to.players.find((p) => p.playerId === action.playerId)?.bag.remaining ?? 0
        const mine = action.playerId === this.viewerId()

        this.promptHidden = true
        if (mine) this.dealing = { playerId: action.playerId, pieces: drawn }
        animationContext.afterAnimations(() => {
            this.dealing = undefined
            this.shownRemaining = undefined
            this.promptHidden = false
        })
        await tick()

        const timeline = animationContext.actionTimeline
        const bag = this.bag.get('bag')
        const face = this.bag.get('face')
        const count = this.bag.get('count')

        drawn.forEach((piece, index) => {
            const at = index * DEAL_GAP
            const card = mine ? this.cards.get(piece.id) : undefined
            if (card && face) {
                const start = face.getBoundingClientRect()
                const end = card.getBoundingClientRect()
                const dx = start.left - end.left
                const dy = start.top - end.top
                gsap.set(card, { x: dx, y: dy, rotationY: 180, zIndex: 20 - index })
                timeline.to(
                    card,
                    { x: 0, rotationY: 0, duration: DEAL_FLIGHT, ease: 'power2.out' },
                    at
                )
                timeline.to(
                    card,
                    {
                        keyframes: [
                            { y: dy - DEAL_LIFT, duration: DEAL_FLIGHT * 0.35, ease: 'power1.out' },
                            { y: 0, duration: DEAL_FLIGHT * 0.65, ease: 'power1.inOut' }
                        ]
                    },
                    at
                )
            }
            timeline.call(
                () => {
                    this.shownRemaining = Math.max(after, before - index - 1)
                },
                undefined,
                at + COUNT_AT
            )
            if (count) {
                timeline.fromTo(
                    count,
                    { scale: 1.35 },
                    { scale: 1, duration: 0.25, ease: 'back.out(2)' },
                    at + COUNT_AT
                )
            }
        })

        if (bag) {
            const gone = (drawn.length - 1) * DEAL_GAP + DEAL_FLIGHT + 0.1
            timeline.to(bag, { opacity: 0, duration: BAG_FADE, ease: 'power1.in' }, gone)
            timeline.to(
                bag,
                { width: 0, marginRight: 0, duration: BAG_COLLAPSE, ease: 'power2.inOut' },
                gone + BAG_FADE * 0.5
            )
        }
    }

    // Every ship whose hold changes turns over: the wrapper turns to the angle the new state will
    // rest at (face up at 0, face down at 180), so when the state arrives nothing has to move.
    private flip(
        from: HydratedEarendelGameState,
        to: HydratedEarendelGameState,
        action: GameAction | undefined,
        animationContext: AnimationContext
    ) {
        const was = new Set(from.heldPieces.map((piece) => piece.id))
        const now = new Set(to.heldPieces.map((piece) => piece.id))
        const turning = [
            ...from.heldPieces.filter((piece) => !now.has(piece.id)),
            ...to.heldPieces.filter((piece) => !was.has(piece.id))
        ].map((piece) => piece.id)

        const timeline = animationContext.actionTimeline
        // Once nothing is held, every card in the hand fades out after the last turn. A hand put
        // back in the bag for a special piece fades face up instead: turning the cards would
        // say they were thrown out.
        if (from.heldPieces.length > 0 && to.heldPieces.length === 0) {
            const returned = handReturned(from, to)
            // The cards' leaf planes, never their wrappers: opacity flattens 3D children.
            const hand = this.cards
                .entries()
                .flatMap(([, card]) => [...card.querySelectorAll<HTMLElement>('[data-card-layer]')])
            const turned = action && !returned ? (turning.length - 1) * FLIP_GAP + FLIP : 0
            if (hand.length > 0) {
                timeline.to(
                    hand,
                    { opacity: 0, duration: action ? HAND_FADE : FALLBACK_FADE, ease: 'power1.in' },
                    turned
                )
            }
            if (returned) return
        }
        turning.forEach((pieceId, index) => {
            const card = this.cards.get(pieceId)
            if (!card) return
            const rotationY = was.has(pieceId) ? 180 : 0
            if (!action) {
                timeline.to(card, { rotationY, duration: FALLBACK_FLIP, ease: 'power1.inOut' }, 0)
                return
            }
            const at = index * FLIP_GAP
            timeline.to(card, { rotationY, duration: FLIP, ease: 'power2.inOut' }, at)
            timeline.to(
                card,
                {
                    keyframes: [
                        { y: -FLIP_LIFT, duration: FLIP * 0.4, ease: 'power1.out' },
                        { y: 0, duration: FLIP * 0.6, ease: 'power1.in' }
                    ]
                },
                at
            )
        })
    }
}

// The hand went back into its owner's bag, which a special piece's placement does: the bag
// grew by what was held. Read from the states, so history navigation sees it without the action.
function handReturned(from: HydratedEarendelGameState, to: HydratedEarendelGameState): boolean {
    const playerId = from.heldPieces[0]?.playerId
    if (!playerId) return false
    return to.getPlayerState(playerId).bag.remaining > from.getPlayerState(playerId).bag.remaining
}

// A hand card's wrapper, which the animator turns and which alone carries the card's angle:
// face up at 0, face down at 180. The state sets the resting angle; when it arrives after the
// animator's turn the angle is already there, so nothing moves.
export function flipCard(
    node: HTMLElement,
    params: { animator: HandAnimator; pieceId: string; faceDown: boolean }
) {
    let current = params
    current.animator.cards.set(current.pieceId, node)
    gsap.set(node, { rotationY: current.faceDown ? 180 : 0 })

    return {
        update(next: { animator: HandAnimator; pieceId: string; faceDown: boolean }) {
            if (next.pieceId !== current.pieceId || next.animator !== current.animator) {
                current.animator.cards.release(current.pieceId, node)
                next.animator.cards.set(next.pieceId, node)
            }
            if (next.faceDown !== current.faceDown) {
                gsap.set(node, { rotationY: next.faceDown ? 180 : 0, y: 0 })
            }
            current = next
        },
        destroy() {
            current.animator.cards.release(current.pieceId, node)
        }
    }
}
