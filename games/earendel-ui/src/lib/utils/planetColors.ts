import { Color } from '@tabletop/common'
import { PlanetColor } from '@tabletop/earendel'

// The planets' own scheme. Cool colors only: every player color is warm (see EarendelColors).
export const PLANET_FILL: Record<PlanetColor, string> = {
    [PlanetColor.Periwinkle]: '#859bfd',
    [PlanetColor.Aqua]: '#22d6fd',
    [PlanetColor.Mint]: '#9aff93',
    [PlanetColor.Teal]: '#1e948d',
    [PlanetColor.Violet]: '#9e58da'
}

// The shared scheme: the table's five player colors, one to a kind of planet, so a game shows
// five colors in all.
export const PLANET_PLAYER_COLOR: Record<PlanetColor, Color> = {
    [PlanetColor.Violet]: Color.Red,
    [PlanetColor.Aqua]: Color.Orange,
    [PlanetColor.Mint]: Color.Yellow,
    [PlanetColor.Teal]: Color.Pink,
    [PlanetColor.Periwinkle]: Color.White
}

// The bold scheme's planets: soft and light, each hue a little askew from the deep player colors
// (boldPlayerFill) so a planet never reads as a player's.
export const SOFT_PLANET_FILL: Record<PlanetColor, string> = {
    [PlanetColor.Violet]: '#f4a8d4',
    [PlanetColor.Aqua]: '#a8d4ff',
    [PlanetColor.Mint]: '#9fe6cf',
    [PlanetColor.Teal]: '#ffc7a1',
    [PlanetColor.Periwinkle]: '#f0e6a0'
}

// The bold scheme's players: deep and saturated, yet bright enough to read as outlines on the
// dark sky. Each of the game's five player colors keeps its seat and takes a bolder hue. The
// colorizer spells the same five out again as class names, which Tailwind must find in the source.
export function boldPlayerFill(color?: string): string | undefined {
    switch (color) {
        case Color.Red:
            return '#d62839'
        case Color.Orange:
            return '#e2711d'
        case Color.Yellow:
            return '#2a9d4b'
        case Color.Pink:
            return '#9b4de0'
        case Color.White:
            return '#2f6fed'
        default:
            return undefined
    }
}

// What each kind of planet looks like, for a planet icon's spoken label: its shape is the same in
// both schemes, and its color is not.
export const PLANET_SHAPE: Record<PlanetColor, string> = {
    [PlanetColor.Periwinkle]: 'Planet with a moon',
    [PlanetColor.Aqua]: 'Twin planet',
    [PlanetColor.Mint]: 'Ringed planet',
    [PlanetColor.Teal]: 'Pulsing planet',
    [PlanetColor.Violet]: 'Crescent planet'
}
