import { PrivateCatalog, type PrivateDefinition } from '@tabletop/18xx'
import { TwoCrownsLocationNames } from './generated/map.js'
import { TwoCrownsPrivateData } from './generated/data.js'
import { TwoCrownsPhases } from './trains.js'
import { BondIds } from './holdings.js'

// Public Line Bonds and Ganz are created by setup and the charter, not dealt.
const UndealtPrivateIds = ['BD', 'G']
// Powers the copied 1871 rules do not yet provide; these pay revenue only.
const PendingPowerIds: string[] = []
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
        sale:
            item.id === 'P10'
                ? { minimum: 1, maximum: 200 }
                : city
                  ? { minimum: item.faceValue / 2, maximum: item.faceValue }
                  : 'never',
        ...(item.id === 'P12' || item.id === 'P14' ? { closure: 'never' as const } : {}),
        ...(city
            ? { blocks: { locationIds: [locationNamed(city)], until: 'company-owned' as const } }
            : {})
    }
}

export const TwoCrownsPrivateCatalog = new PrivateCatalog(
    {
        closurePhaseId: '4+',
        privates: [
            ...TwoCrownsPrivateData.filter((item) => !UndealtPrivateIds.includes(item.id)).map(
                privateDefinition
            ),
            {
                ...privateDefinition(TwoCrownsPrivateData.find((item) => item.id === 'G')!),
                sale: { minimum: 1, maximum: 100 }
            },
            ...BondIds.map((id): PrivateDefinition => {
                const bond = TwoCrownsPrivateData.find((item) => item.id === 'BD')!
                return {
                    id,
                    name: bond.name,
                    faceValue: 0,
                    revenue: bond.revenue,
                    description: bond.description,
                    sale: 'never'
                }
            })
        ]
    },
    TwoCrownsPhases
)
export const TwoCrownsPrivates = TwoCrownsPrivateCatalog.privates
export const TwoCrownsPost = TwoCrownsPrivateCatalog.definition('P')

export function privatesForPlayerCount(playerCount: number) {
    const counts = (item: object) => item as { minPlayers?: number; maxPlayers?: number }
    return TwoCrownsPrivateData.filter(
        (item) =>
            !UndealtPrivateIds.includes(item.id) &&
            playerCount >= (counts(item).minPlayers ?? 0) &&
            playerCount <= (counts(item).maxPlayers ?? Infinity)
    ).map((item) => item.id)
}
