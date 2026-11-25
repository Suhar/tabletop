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

// The other scheme: the table's five player colors, one to a kind of planet, so a game shows
// five colors in all.
export const PLANET_PLAYER_COLOR: Record<PlanetColor, Color> = {
    [PlanetColor.Violet]: Color.Red,
    [PlanetColor.Aqua]: Color.Orange,
    [PlanetColor.Mint]: Color.Yellow,
    [PlanetColor.Teal]: Color.Pink,
    [PlanetColor.Periwinkle]: Color.White
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
