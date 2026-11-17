import { getCompany } from '@tabletop/18xx'
import { createEighteenXXSessionClass, type MapLocationChoice } from '@tabletop/18xx-ui'
import type { GameSession } from '@tabletop/frontend-components'
import type { HydratedTwoCrownsState, TwoCrownsState } from '@tabletop/two-crowns'
import {
    TwoCrownsTitleRules,
    twoCrownsRole,
    unionBankStartingCompanyIds
} from '@tabletop/two-crowns'
import GrayCityTile from './images/tokens/gray-city-tile.svg'
import { TwoCrownsMapView } from './mapView.js'
import { TwoCrownsPresentation } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

import { assert } from '@tabletop/common'
import {
    ConvertCharter,
    QuarantineTrain,
    quarantineTrainIds,
    SplitCompany,
    TwoCrownsBranchSplit,
    isSplitCompany,
    type BranchSplitAllocation
} from '@tabletop/two-crowns'
import {
    backSplitSelection,
    chooseSplitAction,
    chooseSplitAllocation,
    chooseSplitBranch,
    chooseSplitParent,
    chooseSplitPrice,
    hasSplitSelection,
    splitRequest,
    type BranchSplitSelection
} from './branchSplitSelection.js'

const BaseSession = createEighteenXXSessionClass(
    TwoCrownsTitleRules,
    TwoCrownsMapView,
    TwoCrownsPresentation,
    createRouteWorker
)

export class TwoCrownsSession extends BaseSession {
    override privateCompanyTokens = $derived({
        P1: this.mapView.stations[twoCrownsRole(this.gameState, 'shortline')],
        P2: this.mapView.stations[twoCrownsRole(this.gameState, 'shortline')],
        P7: this.mapView.stations[twoCrownsRole(this.gameState, 'shortline')],
        P8: { label: 'G2', color: 'transparent', imageUrl: GrayCityTile },
        P9: this.mapView.stations[twoCrownsRole(this.gameState, 'mainline')],
        P11: this.mapView.stations[twoCrownsRole(this.gameState, 'mainline')],
        P15: this.mapView.stations[twoCrownsRole(this.gameState, 'mainline')],
        P16: this.mapView.stations[twoCrownsRole(this.gameState, 'shortline')]
    })
    protected override titlePrivateCardTokens = $derived({
        P12: unionBankStartingCompanyIds(this.gameState).map(
            (companyId) => this.mapView.stations[companyId]
        )
    })
    private splitStages: BranchSplitSelection = $state({})
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register(
            {
                hasManual: () => hasSplitSelection(this.splitStages),
                undo: () => {
                    if (!hasSplitSelection(this.splitStages)) return false
                    this.splitStages = backSplitSelection(this.splitStages)
                    return true
                },
                clear: () => {
                    this.splitStages = {}
                }
            },
            'first'
        )
    }
    splitModel = $derived(new TwoCrownsBranchSplit(this.gameState))
    canPreviewSplit = $derived(
        !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.gameState.machineState === 'StockRound' &&
            !!this.myPlayer &&
            this.gameState.activePlayerIds.includes(this.myPlayer.id) &&
            !this.gameState.stockRound.turn.bought &&
            this.validActionTypes.includes('SplitCompany')
    )
    get splitMenuAvailable() {
        return (
            this.canPreviewSplit &&
            !!this.myPlayer &&
            this.splitModel.branches().length > 0 &&
            this.splitModel.parents(this.myPlayer.id).some((parent) => !parent.reason)
        )
    }
    splitSelection = $derived.by((): BranchSplitSelection =>
        this.canPreviewSplit ? this.splitStages : {}
    )
    splitInProgress = $derived(!!this.splitSelection.action)
    splitPreview = $derived.by(() => {
        const request = this.myPlayer
            ? splitRequest(this.splitSelection, this.myPlayer.id)
            : undefined
        return request ? this.splitModel.evaluate(request) : undefined
    })
    splitSettlement = $derived.by(() => {
        const preview = this.splitPreview?.details
        const allocation = this.splitSelection.allocation?.value
        return preview && allocation
            ? this.splitModel.allocate(preview.request, allocation)
            : undefined
    })
    latestSplit = $derived(this.actions.filter(isSplitCompany).at(-1))
    /** The parent's stations that can move between parent and branch. */
    splitMovableStations = $derived(
        this.splitSelection.allocation
            ? (this.splitPreview?.details?.stations ?? [])
                  .filter((entry) => !entry.protectedHome)
                  .map((entry) => entry.station)
            : []
    )
    override get mapLocationChoice(): MapLocationChoice | undefined {
        const stations = this.splitMovableStations
        if (!stations.length) return super.mapLocationChoice
        return {
            locationIds: stations.map((station) => station.position.locationId),
            choose: (locationId) => {
                const station = stations.find(
                    (candidate) => candidate.position.locationId === locationId
                )
                assert(station, 'Choose a transferable station')
                this.transferSplitStation(station.id)
            }
        }
    }
    protected override get mapDisplayState() {
        const state = super.mapDisplayState
        const branchId = this.splitPreview?.details?.request.branchId
        const stationIds = this.splitSelection.allocation?.value.stationIds
        if (!branchId || !stationIds?.length) return state
        return {
            ...state,
            stations: state.stations.map((station) =>
                stationIds.includes(station.id) ? { ...station, companyId: branchId } : station
            )
        }
    }
    setSplitAllocation(allocation: BranchSplitAllocation) {
        assert(this.canPreviewSplit && this.splitSelection.allocation, 'Choose a split price first')
        this.splitStages = chooseSplitAllocation(this.splitStages, allocation)
    }
    setSplitCash(cash: number) {
        const allocation = this.splitSelection.allocation?.value
        const preview = this.splitPreview?.details
        assert(allocation && preview && Number.isFinite(cash), 'Choose a valid cash allocation')
        this.setSplitAllocation({
            ...allocation,
            cash: Math.max(0, Math.min(preview.parentCash, Math.round(cash)))
        })
    }
    transferSplitStation(stationId: string) {
        const allocation = this.splitSelection.allocation?.value
        const station = this.splitPreview?.details?.stations.find(
            (entry) => entry.station.id === stationId
        )
        assert(allocation && station && !station.protectedHome, 'Choose a transferable station')
        const stationIds = allocation.stationIds.includes(stationId)
            ? allocation.stationIds.filter((id) => id !== stationId)
            : [...allocation.stationIds, stationId]
        this.setSplitAllocation({
            ...allocation,
            stationIds,
            homeStationId: stationIds.includes(allocation.homeStationId)
                ? allocation.homeStationId
                : (stationIds[0] ?? '')
        })
    }
    transferSplitTrain(trainId: string) {
        const allocation = this.splitSelection.allocation?.value
        assert(allocation, 'Choose a split price first')
        this.setSplitAllocation({
            ...allocation,
            trainIds: allocation.trainIds.includes(trainId)
                ? allocation.trainIds.filter((id) => id !== trainId)
                : [...allocation.trainIds, trainId]
        })
    }
    // 1874's own free action: converting the Hungarian Bank.
    titleActionAvailable(type: 'ConvertCharter') {
        return (
            !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.validActionTypes.includes(type)
        )
    }
    async convertCharter() {
        await this.applyAction(this.createPlayerAction(ConvertCharter, {}))
    }
    // The Rijeka Lazaretto: the trains its owner may put the quarantine marker on now.
    quarantineTrains = $derived.by(() => {
        if (
            this.busy ||
            this.updatingVisibleState ||
            this.isViewingHistory ||
            !this.validActionTypes.includes('QuarantineTrain')
        )
            return []
        return this.gameState.activePlayerIds
            .flatMap((playerId) => quarantineTrainIds(this.gameState, playerId))
            .map((trainId) => ({
                trainId,
                name: this.gameState.trainInventory.trains.find((train) => train.id === trainId)!
                    .definitionId
            }))
    })
    async quarantineTrain(trainId: string) {
        await this.applyAction(this.createPlayerAction(QuarantineTrain, { trainId }))
    }
    async confirmSplit() {
        const preview = this.splitPreview?.details
        const allocation = this.splitSelection.allocation?.value
        assert(
            this.canPreviewSplit && preview && allocation && this.splitSettlement?.details,
            'Complete a valid split allocation'
        )
        await this.applyAction(
            this.createPlayerAction(SplitCompany, {
                parentId: preview.request.parentId,
                branchId: preview.request.branchId,
                marketSpaceId: preview.request.marketSpaceId,
                allocation,
                expectedFunding: preview.childFunding
            })
        )
    }
    protected override onStockSelectionCancelled() {
        this.splitStages = {}
    }
    override stockCompanyName(companyId: string) {
        return companyId === 'LUKA' ? 'Luka' : super.stockCompanyName(companyId)
    }
    override get stockCompanies() {
        return [
            ...super.stockCompanies.filter((company) => company.id !== 'LUKA'),
            getCompany(this.gameState, 'LUKA')
        ]
    }
    chooseSplit() {
        assert(this.canPreviewSplit, 'Split selection is unavailable')
        this.stock.chooseMenu(undefined)
        this.splitStages = chooseSplitAction()
    }
    selectSplitParent(parentId: string) {
        assert(this.canPreviewSplit && this.myPlayer, 'Split selection is unavailable')
        assert(
            !this.splitModel.parentReason(this.myPlayer.id, parentId),
            'Choose an eligible parent'
        )
        this.splitStages = chooseSplitParent(this.splitSelection, parentId)
    }
    selectSplitBranch(branchId: string) {
        assert(this.canPreviewSplit && this.splitSelection.parentId, 'Select a parent first')
        assert(
            this.splitModel.branches().some((branch) => branch.id === branchId),
            'Choose an available branch'
        )
        this.splitStages = chooseSplitBranch(this.splitStages, branchId)
    }
    selectSplitPrice(marketSpaceId: string) {
        assert(this.canPreviewSplit && this.splitSelection.branchId, 'Select a branch first')
        assert(
            this.splitModel.prices().some((price) => price.id === marketSpaceId),
            'Choose an available price'
        )
        this.splitStages = chooseSplitPrice(this.splitStages, marketSpaceId)
    }
    backSplit() {
        if (this.canPreviewSplit) this.splitStages = backSplitSelection(this.splitStages)
    }
    override async undo() {
        if (this.updatingVisibleState) return
        await super.undo()
    }
}
export function requireTwoCrownsSession(
    session: GameSession<TwoCrownsState, HydratedTwoCrownsState>
): TwoCrownsSession {
    assert(session instanceof TwoCrownsSession, 'Expected a Two Crowns session')
    return session
}
