import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import {
    cashOwnedBy,
    certificatesOwnedBy,
    closePrivate,
    companyShareCount,
    privateOwner,
    sameOwner,
    settleCashPayments,
    sharesOwned,
    stockCertificateCount,
    type Owner,
    type StockState
} from '@tabletop/18xx'
import { TwoCrownsStockRules } from './stockRules.js'
import { TwoCrownsPhases } from './trains.js'

// 1874design.md, Hungarian Bank: "Converting to Ganz".
export const CharterId = 'P14'
export const GanzId = 'G'
const charterOwner: Owner = { kind: 'company', companyId: CharterId }

export const ConvertCharter = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ConvertCharter'),
        metadata: Type.Optional(
            Type.Object(
                {
                    cash: Type.Integer({ minimum: 0 }),
                    certificateIds: Type.Array(Type.String()),
                    presidencies: Type.Array(Type.String())
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type ConvertCharter = Type.Static<typeof ConvertCharter>
const Validator = Compile(ConvertCharter)
export function isConvertCharter(action: GameAction): action is ConvertCharter {
    return (
        action instanceof HydratedConvertCharter ||
        (action.type === 'ConvertCharter' && Validator.Check(action))
    )
}

type ConversionState = StockState & { machineState: string; activePlayerIds: string[] }

/** Why the player can't convert the Hungarian Bank now, or undefined when they can. */
export function charterConversionReason(
    state: ConversionState,
    playerId: string
): string | undefined {
    if (state.machineState !== 'StockRound' || state.stockRound.completed)
        return 'The Hungarian Bank converts only during a stock round.'
    if (!state.activePlayerIds.includes(playerId)) return 'It is not your stock turn.'
    const charter = state.companies.find((company) => company.id === CharterId)
    if (!charter || charter.closed) return 'The Hungarian Bank is not open.'
    const owner = privateOwner(state, CharterId)
    const player: Owner = { kind: 'player', playerId }
    if (!owner || !sameOwner(owner, player)) return 'You do not own the Hungarian Bank.'
    // Until the first 3+ (1874design.md, Hungarian Bank; the first 2+ before design 0.14.0).
    if (TwoCrownsPhases.isAtLeast(state.phaseId, '3+'))
        return 'The Hungarian Bank can no longer convert once a 3+ is bought.'
    // The owner must be able to sell back within 60% and the certificate limit.
    const held = certificatesOwnedBy(state, charterOwner).filter((item) => item.kind === 'share')
    for (const companyId of new Set(held.map((item) => item.companyId))) {
        const shareCount = companyShareCount(state, TwoCrownsStockRules.charters, companyId)
        if (!shareCount) continue
        const total =
            sharesOwned(state, companyId, player) + sharesOwned(state, companyId, charterOwner)
        const company = state.companies.find((item) => item.id === companyId)
        if (
            total * 100 >
                TwoCrownsStockRules.ownershipLimit(state, companyId, player) * shareCount &&
            !company?.operated
        )
            return 'You could not sell back to 60% of a company that has not operated.'
    }
    const excess =
        stockCertificateCount(state, player, TwoCrownsStockRules) +
        held.length -
        TwoCrownsStockRules.certificateLimit(state, player)
    if (excess > 0) {
        const saleable = [...certificatesOwnedBy(state, player), ...held].filter(
            (item) =>
                item.kind === 'share' &&
                !item.president &&
                state.companies.find((company) => company.id === item.companyId)?.operated
        ).length
        if (saleable < excess) return 'You could not sell back within the certificate limit.'
    }
    return undefined
}

export class HydratedConvertCharter
    extends HydratableAction<typeof ConvertCharter>
    implements ConvertCharter
{
    declare type: 'ConvertCharter'
    declare playerId: string
    declare metadata?: ConvertCharter['metadata']
    constructor(data: ConvertCharter) {
        super(data instanceof HydratedConvertCharter ? data.dehydrate() : data, Validator)
    }
    isValid(state: ConversionState): boolean {
        return (
            this.source === ActionSource.User &&
            charterConversionReason(state, this.playerId) === undefined
        )
    }
    apply(state: HydratedGameState & ConversionState): void {
        assert(this.isValid(state), 'The Hungarian Bank cannot convert now')
        const player: Owner = { kind: 'player', playerId: this.playerId }
        const cash = cashOwnedBy(state, charterOwner)
        assert(typeof cash === 'number', 'The Hungarian Bank holds finite cash')
        if (cash > 0) settleCashPayments(state, [{ from: charterOwner, to: player, amount: cash }])
        const shares = certificatesOwnedBy(state, charterOwner).filter(
            (item) => item.kind === 'share'
        )
        for (const certificate of shares) {
            certificate.owner = { ...player }
            delete certificate.poolId
        }
        const presidencies = state.companies
            .filter((company) => company.president && sameOwner(company.president, charterOwner))
            .map((company) => company.id)
        for (const company of state.companies)
            if (presidencies.includes(company.id)) company.president = { ...player }
        closePrivate(state, CharterId)
        state.companies.push({ id: GanzId, kind: 'private' })
        state.certificates.push({
            id: `${GanzId}:charter`,
            companyId: GanzId,
            kind: 'private',
            owner: { ...player }
        })
        // A free action that still counts as acting, so finishing the turn is not a pass.
        state.stockRound.turn.acted = true
        this.metadata = {
            cash,
            certificateIds: shares.map((item) => item.id),
            presidencies
        }
    }
}

export function ganzOwner(state: StockState): Owner | undefined {
    const ganz = state.companies.find((company) => company.id === GanzId)
    if (!ganz || ganz.closed) return undefined
    const certificate = state.certificates.find((item) => item.id === `${GanzId}:charter`)
    assertExists(certificate, 'Ganz requires its charter')
    return certificate.owner
}
