// A choice among cards, committed: the cards passed over fade, then the chosen one twirls and
// fades. Shared by the opening's stow and the Asteroid Field, on the action's timeline so the
// state moves on only once it has played.
const REJECT_FADE = 0.3
const TWIRL = 0.9
const TWIRL_LIFT = 16
const CHOSEN_FADE = 0.35

// The cards' leaf planes fade, never their wrappers: opacity flattens 3D children.
export const cardLayersOf = (card: HTMLElement) => [
    ...card.querySelectorAll<HTMLElement>('[data-card-layer]')
]

export function animateCardChoice(
    timeline: gsap.core.Timeline,
    cards: readonly (HTMLElement | undefined)[],
    picked: number
) {
    const card = cards[picked]
    if (!card) return

    const others = cards.filter((other, index) => other !== undefined && index !== picked)
    timeline.to(
        others.flatMap((other) => (other ? cardLayersOf(other) : [])),
        { opacity: 0, duration: REJECT_FADE, ease: 'power1.in' },
        0
    )
    timeline.to(card, { rotationY: 360, duration: TWIRL, ease: 'power2.inOut' }, REJECT_FADE)
    timeline.to(
        card,
        {
            keyframes: [
                { y: -TWIRL_LIFT, duration: TWIRL * 0.4, ease: 'power1.out' },
                { y: 0, duration: TWIRL * 0.6, ease: 'power1.in' }
            ]
        },
        REJECT_FADE
    )
    timeline.to(
        cardLayersOf(card),
        { opacity: 0, duration: CHOSEN_FADE, ease: 'power1.in' },
        REJECT_FADE + TWIRL
    )
}
