import { GameSession } from '@tabletop/frontend-components'
import {
    ActionBox,
    BuildConnection,
    BuildTrack,
    ChooseAction,
    DeclineOffer,
    DelegateBuild,
    Develop,
    FinishDevelopment,
    MachineState,
    OfferShare,
    PassBid,
    PlaceBid,
    freeBuildHome,
    homeLinks,
    type HydratedSarGameState,
    type RailroadId,
    type SarGameState
} from '@tabletop/south-african-railroads'
import {
    clearFirstLink,
    hasManualBuildSelection,
    popBuildSelection,
    selectBuildRailroad,
    selectFirstLink,
    type BuildSelection
} from './selection.js'

export type DevelopTarget = { settlementId: string; cost: number }

export class SarGameSession extends GameSession<SarGameState, HydratedSarGameState> {
    private buildSelection: BuildSelection = $state({})

    myPlayerId = $derived(this.myPlayer?.id)

    canAct = $derived(this.isMyTurn && !this.isViewingHistory && !this.gameState.result)

    private actingIn(...states: MachineState[]): boolean {
        return this.canAct && states.includes(this.gameState.machineState)
    }

    selectableBoxes: ActionBox[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.actingIn(MachineState.ChoosingAction)
            ? this.gameState.availableBoxes(playerId)
            : []
    })

    // Construction

    private building = $derived(
        this.actingIn(MachineState.ConstructingTrack, MachineState.DelegatedBuild)
    )

    delegating = $derived(
        this.building &&
            this.gameState.machineState === MachineState.ConstructingTrack &&
            this.myPlayerId !== undefined &&
            this.gameState.ownBuildableRailroads(this.myPlayerId).length === 0
    )

    buildRailroadOptions: RailroadId[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!this.building || !playerId) {
            return []
        }
        return this.delegating
            ? this.gameState.buildableRailroads()
            : this.gameState.builderRailroads(playerId)
    })

    // A lone option counts as an automatic choice, so Undo steps straight past it.
    selectedRailroad: RailroadId | undefined = $derived.by(() => {
        const options = this.buildRailroadOptions
        const chosen = this.buildSelection.railroad?.value
        if (chosen && options.includes(chosen)) {
            return chosen
        }
        return !this.delegating && options.length === 1 ? options[0] : undefined
    })

    delegateBuilders: string[] = $derived(
        this.delegating && this.selectedRailroad
            ? this.gameState.controllers(this.selectedRailroad)
            : []
    )

    firstLink: string | undefined = $derived(
        this.selectedRailroad && !this.delegating ? this.buildSelection.firstLink?.value : undefined
    )

    private doubleStarts: Map<string, string[]> = $derived.by(() => {
        const railroadId = this.selectedRailroad
        const starts = new Map<string, string[]>()
        if (!railroadId || this.delegating) {
            return starts
        }
        for (const [first, second] of this.gameState.doubleBuilds(railroadId)) {
            starts.set(first, [...(starts.get(first) ?? []), second])
        }
        return starts
    })

    linkTargets: string[] = $derived.by(() => {
        const due = this.gameState.freeBuild
        if (due && this.actingIn(MachineState.FreeBuild) && due.playerId === this.myPlayerId) {
            return homeLinks(this.gameState, freeBuildHome(due.railroadId))
        }
        const railroadId = this.selectedRailroad
        if (!railroadId || this.delegating) {
            return []
        }
        const first = this.firstLink
        return first
            ? (this.doubleStarts.get(first) ?? [])
            : this.gameState.singleBuilds(railroadId)
    })

    connectionTargets: string[] = $derived(
        this.selectedRailroad && !this.delegating && !this.firstLink
            ? this.gameState
                  .connectionBuilds(this.selectedRailroad)
                  .map((connection) => connection.id)
            : []
    )

    buildingRailroad: RailroadId | undefined = $derived(
        this.actingIn(MachineState.FreeBuild)
            ? this.gameState.freeBuild?.railroadId
            : this.delegating
              ? undefined
              : this.selectedRailroad
    )

    selectRailroad(railroadId: RailroadId) {
        if (!this.buildRailroadOptions.includes(railroadId)) {
            return
        }
        if (this.delegating) {
            const builders = this.gameState.controllers(railroadId)
            if (builders.length === 1) {
                void this.delegateBuild(railroadId, builders[0])
                return
            }
        }
        this.buildSelection = selectBuildRailroad(this.buildSelection, railroadId)
    }

    async clickLink(linkId: string) {
        if (!this.linkTargets.includes(linkId)) {
            return
        }
        const due = this.gameState.freeBuild
        if (due && this.actingIn(MachineState.FreeBuild)) {
            await this.buildTrack(due.railroadId, [linkId])
            return
        }
        const railroadId = this.selectedRailroad
        if (!railroadId) {
            return
        }
        const first = this.firstLink
        if (first) {
            await this.buildTrack(railroadId, [first, linkId])
            return
        }
        if (this.doubleStarts.has(linkId)) {
            this.buildSelection = selectFirstLink(this.buildSelection, linkId)
            return
        }
        await this.buildTrack(railroadId, [linkId])
    }

    async buildFirstLinkAlone() {
        const railroadId = this.selectedRailroad
        const first = this.firstLink
        if (railroadId && first) {
            await this.buildTrack(railroadId, [first])
        }
    }

    cancelFirstLink() {
        this.buildSelection = clearFirstLink(this.buildSelection)
    }

    async buildTrack(railroadId: RailroadId, linkIds: string[]) {
        await this.applyAction(this.createPlayerAction(BuildTrack, { railroadId, linkIds }))
    }

    async buildConnection(connectionId: string) {
        const railroadId = this.selectedRailroad
        if (railroadId && this.connectionTargets.includes(connectionId)) {
            await this.applyAction(
                this.createPlayerAction(BuildConnection, { railroadId, connectionId })
            )
        }
    }

    async delegateBuild(railroadId: RailroadId, builderId: string) {
        await this.applyAction(this.createPlayerAction(DelegateBuild, { railroadId, builderId }))
    }

    // Development

    developTargets: DevelopTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!playerId || !this.actingIn(MachineState.DevelopingSettlements)) {
            return []
        }
        return this.gameState.affordableDevelopments(playerId).map((settlementId) => ({
            settlementId,
            cost: this.gameState.developmentCost(settlementId)
        }))
    })

    mayFinishDeveloping = $derived(
        this.actingIn(MachineState.DevelopingSettlements) && this.gameState.mayFinishDeveloping()
    )

    async develop(settlementId: string) {
        if (this.developTargets.some((target) => target.settlementId === settlementId)) {
            await this.applyAction(this.createPlayerAction(Develop, { settlementId }))
        }
    }

    async finishDevelopment() {
        await this.applyAction(this.createPlayerAction(FinishDevelopment, {}))
    }

    // Stock

    offeringStock = $derived(this.actingIn(MachineState.OfferingStock))

    async chooseBox(box: ActionBox) {
        if (this.selectableBoxes.includes(box)) {
            await this.applyAction(this.createPlayerAction(ChooseAction, { box }))
        }
    }

    async offerShare(railroadId: RailroadId, ownShare: boolean) {
        await this.applyAction(this.createPlayerAction(OfferShare, { railroadId, ownShare }))
    }

    async declineOffer() {
        await this.applyAction(this.createPlayerAction(DeclineOffer, {}))
    }

    bidding = $derived(this.actingIn(MachineState.Bidding))

    async placeBid(amount: number) {
        await this.applyAction(this.createPlayerAction(PlaceBid, { amount }))
    }

    async passBid() {
        await this.applyAction(this.createPlayerAction(PassBid, {}))
    }

    // Undo

    hasManualSelection(): boolean {
        return hasManualBuildSelection(this.buildSelection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.buildSelection = popBuildSelection(this.buildSelection)
            return
        }
        await super.undo()
    }

    override beforeNewState(): void {
        this.buildSelection = {}
    }
}
