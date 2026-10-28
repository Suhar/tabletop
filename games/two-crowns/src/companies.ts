import { assertExists } from '@tabletop/common'
import type { FinancialState } from '@tabletop/18xx'
import { TwoCrownsLukaCompanies } from './generated/data.js'

export const TwoCrownsCompanies = TwoCrownsLukaCompanies.map(({ companyId, name, number }) => ({
    companyId,
    name,
    number
}))
export const TwoCrownsRoles = {
    mainline: { name: 'Mainline', shortName: 'Main' },
    shortline: { name: 'Shortline', shortName: 'Short' },
    narodna: { name: 'Public Line', shortName: 'Public' }
} as const
export type TwoCrownsRole = keyof typeof TwoCrownsRoles
function isTwoCrownsRole(role: string | undefined): role is TwoCrownsRole {
    return role !== undefined && Object.hasOwn(TwoCrownsRoles, role)
}
export function twoCrownsCompanyRole(
    state: FinancialState,
    companyId: string
): TwoCrownsRole | undefined {
    const role = state.companies.find((company) => company.id === companyId)?.role
    return isTwoCrownsRole(role) ? role : undefined
}
export function twoCrownsRole(state: FinancialState, role: TwoCrownsRole): string {
    const company = state.companies.find((company) => company.role === role)
    assertExists(company, `Missing ${role} company`)
    return company.id
}
export function lukaCompanies(state: FinancialState) {
    return TwoCrownsCompanies.filter((item) =>
        state.certificates.some((certificate) => certificate.id === `LUKA:share:${item.number}`)
    ).map((item) => ({ ...item, lukaCertificateId: `LUKA:share:${item.number}` }))
}
