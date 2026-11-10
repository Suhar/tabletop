import { createPhaseChart } from '@tabletop/18xx-ui'
import { TwoCrownsPhases, TwoCrownsTrainDepot } from '@tabletop/two-crowns'

export const TwoCrownsPhaseChart = createPhaseChart({
    phases: TwoCrownsPhases,
    depot: TwoCrownsTrainDepot,
    rustNotes: {
        '4+': 'At phase D, a company-owned 4+ survives only if it has had no operating opportunity. It rusts after its company’s next run step, even if unused, and cannot be traded.'
    },
    // From 1874design.md's phase table, as the engine implements it.
    phaseNotes: {
        '2H': 'Start prices: 58, 65, 74, 80 (Late space: 86).',
        '4H': 'Until the first 4+, companies may buy the Station Rights (½×–1× face), Wiener Neustadt (up to $200) and the Ancona Steamship (½×–1× face); the Luka only the Station Rights.',
        '5H': '80 start price removed; available: 58, 65, 74 (Late space: 80).',
        '2+': 'The Hungarian Bank can no longer convert to Ganz.',
        '3+': '74 start price removed; available: 58, 65 (Late space: 74).',
        '4+': 'Privates close except the Austrian Bank, the Hungarian Bank and the Lika Survey Office. Junction upgrades open.',
        '7': '65 start price removed; only 58 remains (Late space: 65).',
        D: 'Triggers game end. Gray tiles: the CX, G1, and G2 for the Lika Survey Office; only these in the final three ORs.'
    },
    notes: ['The Luka may buy at most one train from the bank per operating turn.']
})
