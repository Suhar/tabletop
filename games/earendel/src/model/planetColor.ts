// Its own module so board.ts and technology.ts can share it without depending on each other.
export enum PlanetColor {
    Periwinkle = 'periwinkle',
    Aqua = 'aqua',
    Mint = 'mint',
    Teal = 'teal',
    Violet = 'violet'
}

export const PLANET_COLORS: PlanetColor[] = [
    PlanetColor.Periwinkle,
    PlanetColor.Aqua,
    PlanetColor.Mint,
    PlanetColor.Teal,
    PlanetColor.Violet
]
