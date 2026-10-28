import { PrivateCatalog, type PrivateDefinition } from '@tabletop/18xx'
import { TwoCrownsLocationNames } from './generated/map.js'
import { TwoCrownsPrivateData } from './generated/data.js'
import { TwoCrownsPhases } from './trains.js'

// Narodna Bond and Ganz are created by later rules, not dealt.
const UndealtPrivateIds = ['BD', 'G']
// Powers the copied 1871 rules do not yet provide; these pay revenue only.
const PendingPowerIds = ['P5', 'P6', 'P13', 'P14', 'P17']
const StationRightsCities: Readonly<Record<string, string>> = { P3: 'Zadar', P4: 'Vukovar' }

function locationNamed(name: string): string {
    const entry = Object.entries(TwoCrownsLocationNames).find(([, value]) => value === name)
    if (!entry) throw new Error(`No map location is named ${name}`)
    return entry[0]
}

function privateDefinition(item: (typeof TwoCrownsPrivateData)[number]): PrivateDefinition {
    const city = StationRightsCities[item.id]
    return {
        id: item.id,
        name: item.name,
        faceValue: item.faceValue,
        revenue: item.revenue,
        description: PendingPowerIds.includes(item.id)
            ? `${item.description}\n\nNot implemented yet: pays revenue only.`
            : item.description,
        sale: item.id === 'P10' ? { minimum: 1, maximum: 200 } : 'never',
        ...(item.id === 'P12' ? { closure: 'never' as const } : {}),
        ...(city
            ? { blocks: { locationIds: [locationNamed(city)], until: 'company-owned' as const } }
            : {})
    }
}

export const TwoCrownsPrivateCatalog = new PrivateCatalog(
    {
        closurePhaseId: '4+',
        privates: TwoCrownsPrivateData.filter((item) => !UndealtPrivateIds.includes(item.id)).map(
            privateDefinition
        )
    },
    TwoCrownsPhases
)
export const TwoCrownsPrivates = TwoCrownsPrivateCatalog.privates
export const TwoCrownsPost = TwoCrownsPrivateCatalog.definition('P')

export function privatesForPlayerCount(playerCount: number) {
    return TwoCrownsPrivateData.filter(
        (item) =>
            !UndealtPrivateIds.includes(item.id) &&
            playerCount >= ('minPlayers' in item ? item.minPlayers : 0) &&
            playerCount <= ('maxPlayers' in item ? item.maxPlayers : Infinity)
    ).map((item) => item.id)
}
