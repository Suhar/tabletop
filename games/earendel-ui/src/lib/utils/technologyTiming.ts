import {
    COOLDOWN_TURNS,
    TECHNOLOGY_EFFECT_INFO,
    type TechnologyEffectKind,
    TechnologyTiming
} from '@tabletop/earendel'

// How often a technology may be used, for its popups: a one-shot or one on a timer. The other
// kinds (a granted piece, an elevated event or rule) say what they are in their own text.
export function timingNote(
    kind: TechnologyEffectKind
): { label: string; text: string } | undefined {
    switch (TECHNOLOGY_EFFECT_INFO[kind].timing) {
        case TechnologyTiming.Stored:
            return { label: 'One-shot', text: 'Used once, on a turn you choose, then spent.' }
        case TechnologyTiming.Cooldown:
            return {
                label: 'Timer',
                text: `After each use it rests for ${COOLDOWN_TURNS} of your turns.`
            }
        default:
            return undefined
    }
}
