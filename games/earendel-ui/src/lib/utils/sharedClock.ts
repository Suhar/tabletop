// Anchors an element's CSS animations to the page's clock rather than to the moment it mounted, so
// looping cues drawn at different times stay in step: each keeps its own animation-delay as an
// offset into the shared cycle. An element mounted with the rest of a page may not have its
// animations yet, so this is done again on the next frame.
export function onSharedClock(node: Element) {
    const align = () => {
        for (const animation of node.getAnimations()) animation.startTime = 0
    }
    align()
    const frame = requestAnimationFrame(align)
    return {
        destroy() {
            cancelAnimationFrame(frame)
        }
    }
}
