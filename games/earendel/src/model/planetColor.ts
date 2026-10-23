// Its own module so that both board.ts and technology.ts can depend on it without depending
// on each other: a hex holds a technology card, and a card lists planet colours, so anything
// shared by the two has to sit below them both.
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
