import {
    createCompanyStations,
    createOrdinaryShareCertificates,
    treasuryPool,
    type CompanyState
} from '@tabletop/18xx'
import { TwoCrownsBranchCompanies } from './generated/data.js'

export const TwoCrownsBranches = TwoCrownsBranchCompanies.map(({ id, name }) => ({ id, name }))

export function addTwoCrownsBranches(state: CompanyState): void {
    const market = { owner: { kind: 'bank' } as const, poolId: 'market' }
    for (const branch of TwoCrownsBranches) {
        state.companies.push({
            id: branch.id,
            kind: 'major',
            started: false,
            floated: false,
            funded: false,
            operated: false
        })
        state.cash.push({ owner: { kind: 'company', companyId: branch.id }, amount: 0 })
        state.certificatePools.push(treasuryPool(branch.id))
        state.certificates.push(
            ...createOrdinaryShareCertificates(
                branch.id,
                Array.from({ length: 8 }, () => market),
                market
            )
        )
        state.stations.push(...createCompanyStations(branch.id, 4))
    }
}
