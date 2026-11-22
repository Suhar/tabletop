import { assertExists } from '@tabletop/common'
import { TwoCrownsLukaCompanies, TwoCrownsMap } from '@tabletop/two-crowns'

/** The Luka companies by share number, each with the city it starts in. */
export const LukaHomes = TwoCrownsLukaCompanies.map((company) => {
    const [locationId] = TwoCrownsMap.reservedLocationIds(company.companyId)
    assertExists(locationId, `${company.name} has a printed home`)
    return { ...company, locationId, place: TwoCrownsMap.placeName(locationId) }
}).toSorted((first, second) => first.number - second.number)

export function lukaHome(number: number) {
    return LukaHomes.find((home) => home.number === number)
}
