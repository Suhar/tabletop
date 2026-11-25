// How the table is colored, for this player alone and remembered in this browser. It lives
// outside the game session because the colorizer, which has no session, reads it too.
//
// - classic: warm player colors, and the planets' own five cool colors.
// - shared: the planets wear the five player colors, so a game shows five colors in all.
// - bold: deep, saturated player colors, and soft light planets whose hues sit between them.
export type ColorScheme = 'classic' | 'shared' | 'bold'

const SCHEMES: ColorScheme[] = ['classic', 'shared', 'bold']
const COLOR_SCHEME_KEY = 'earendel:colors'

function readColorScheme(): ColorScheme {
    try {
        const stored = localStorage.getItem(COLOR_SCHEME_KEY)
        return SCHEMES.find((scheme) => scheme === stored) ?? 'classic'
    } catch {
        return 'classic'
    }
}

let current: ColorScheme = $state(readColorScheme())

export const colorScheme = {
    get current(): ColorScheme {
        return current
    },
    cycle() {
        current = SCHEMES[(SCHEMES.indexOf(current) + 1) % SCHEMES.length]
        try {
            localStorage.setItem(COLOR_SCHEME_KEY, current)
        } catch {
            // Storage may be unavailable (a private window, blocked site data): the choice then
            // lasts for this visit alone.
        }
    }
}
