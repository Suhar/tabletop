import {
    privateOwner,
    EighteenXXTransferTiming,
    controllingOwner,
    type PrivatePowerRules
} from '@tabletop/18xx'
export const TwoCrownsPrivatePowerRules: PrivatePowerRules = {
    trackTerms: () => undefined,
    earlyTrainCompany(state, privateCompanyId, playerId) {
        if (
            privateCompanyId !== 'P10' ||
            !state.companies.some((company) => company.id === 'P10' && !company.closed)
        )
            return undefined
        const companyId = EighteenXXTransferTiming.operatingCompany(state)
        const owner = privateOwner(state, privateCompanyId)
        return privateCompanyId === 'P10' &&
            !state.companies.find((company) => company.id === 'P10')?.closed &&
            companyId &&
            companyId !== 'LUKA' &&
            owner?.kind === 'company' &&
            owner.companyId === companyId &&
            controllingOwner(state, companyId)?.playerId === playerId
            ? companyId
            : undefined
    }
}
