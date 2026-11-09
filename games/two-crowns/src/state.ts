import {
    composeEighteenXXState,
    defineEighteenXXState,
    NumberedCertificate,
    OfferAuctionMachineStates,
    OfferPileFields,
    OwnershipExemptionFields,
    PrivateStationFields,
    RailwayFields,
    RailwayMachineStates,
    RoleCompany,
    TrackConsentFields,
    TrancheFields,
    validateRailwayState,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import * as Type from 'typebox'

export const TwoCrownsState = composeEighteenXXState(
    {
        ...RailwayFields,
        ...TrackConsentFields,

        companies: Type.Array(RoleCompany),
        certificates: Type.Array(NumberedCertificate),
        ...OfferPileFields,
        ...TrancheFields,
        ...OwnershipExemptionFields,
        ...PrivateStationFields,
        fourPlusTrainIdsWithOperatingOpportunity: Type.Optional(
            Type.Array(Type.String(), { uniqueItems: true })
        ),
        // The company that bought the Ancona Steamship Line.
        anconaCompanyId: Type.Optional(Type.String({ minLength: 1 })),
        // Trade-ins this operating round, as "set.round:companyId" (once per OR, 1874design.md).
        tradeIns: Type.Optional(Type.Array(Type.String(), { uniqueItems: true })),
        // The train with the Rijeka Lazaretto's quarantine marker, which runs once more on its rust.
        quarantinedTrainId: Type.Optional(Type.String({ minLength: 1 })),
        // Optional because games set up before it was recorded lack it.
        unionBankDrawnCompanyId: Type.Optional(Type.String({ minLength: 1 }))
    },
    [...RailwayMachineStates, ...OfferAuctionMachineStates]
)
export type TwoCrownsState = Type.Static<typeof TwoCrownsState>
export type HydratedTwoCrownsState = HydratedEighteenXXState<typeof TwoCrownsState>
export const TwoCrownsStateDefinition = defineEighteenXXState(TwoCrownsState, [
    validateRailwayState
])
