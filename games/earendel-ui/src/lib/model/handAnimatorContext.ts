import { getContext, setContext } from 'svelte'
import type { HandAnimator } from '$lib/animators/handAnimator.svelte.js'

const KEY = Symbol('earendel-hand-animator')

export function setHandAnimator(animator: HandAnimator) {
    setContext(KEY, animator)
}

export function getHandAnimator(): HandAnimator {
    return getContext<HandAnimator>(KEY)
}
