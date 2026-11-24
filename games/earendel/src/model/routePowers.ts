import { PlanetColor } from './planetColor.js'

// What a standing trade route of each color gives its holder (rules.md, Chains and trade routes).
export const ROUTE_POWER_INFO: Record<PlanetColor, { name: string; ability: string }> = {
    [PlanetColor.Violet]: {
        name: 'Bounty',
        ability:
            'Score 1 point each time one of your fighters or torpedoes destroys an enemy piece.'
    },
    [PlanetColor.Aqua]: {
        name: 'Blockade Runners',
        ability: 'Your probes ignore station blockades.'
    },
    [PlanetColor.Mint]: {
        name: 'Strongholds',
        ability: 'Each of your stations counts 2 toward control of the planets beside it.'
    },
    [PlanetColor.Periwinkle]: {
        name: 'Wide Survey',
        ability: 'Your surveys reveal one more matching card to choose from.'
    },
    [PlanetColor.Teal]: {
        name: 'Reclamation',
        ability:
            "Your own destroyed ships go back into your bag instead of out of the game, unless a rival's Salvage Drone in reach takes them."
    }
}
