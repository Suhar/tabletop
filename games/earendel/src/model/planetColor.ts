// Its own module so that both board.ts and technology.ts can depend on it without depending
// on each other: a hex holds a technology card, and a card lists planet colours, so anything
// shared by the two has to sit below them both.
export enum PlanetColor {
    Azure = 'azure',
    Crimson = 'crimson',
    Verdant = 'verdant',
    Gold = 'gold',
    Violet = 'violet'
}

export const PLANET_COLORS: PlanetColor[] = [
    PlanetColor.Azure,
    PlanetColor.Crimson,
    PlanetColor.Verdant,
    PlanetColor.Gold,
    PlanetColor.Violet
]
