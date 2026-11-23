import { PlanetColor } from '@tabletop/earendel'

// Cool colors only: every player color is warm (see EarendelColors).
export const PLANET_FILL: Record<PlanetColor, string> = {
    [PlanetColor.Periwinkle]: '#859bfd',
    [PlanetColor.Aqua]: '#22d6fd',
    [PlanetColor.Mint]: '#9aff93',
    [PlanetColor.Teal]: '#1e948d',
    [PlanetColor.Violet]: '#9e58da'
}
