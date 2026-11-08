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
        '4H': 'Companies may buy the Station Rights (½×–1× face) and Wiener Neustadt (up to $200, not the Luka) until the first 4+. Public Line Bonds may be exchanged.',
        '5H': '80 start price removed; available: 58, 65, 74 (Late space: 80).',
        '2+': 'The Hungarian Bank can no longer convert to Ganz.',
        '3+': '74 start price removed; available: 58, 65 (Late space: 74).',
        '4+': 'Privates close except the Austrian and Hungarian Banks. Junction upgrades open.',
        '7': '65 start price removed; only 58 remains (Late space: 65).',
        D: 'Triggers game end.'
    },
    notes: ['The Luka may buy at most one train from the bank per operating turn.']
})
