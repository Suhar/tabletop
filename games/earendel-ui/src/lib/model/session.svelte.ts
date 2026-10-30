import { type AxialCoordinates, sameCoordinates } from '@tabletop/common'
import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition
} from '@tabletop/frontend-components'
import {
    EarendelStageOrder,
    hasManualEarendelSelection,
    Power,
    setEarendelSelection,
    toggleEarendelTarget,
    undoSelectionOrAction,
    type EarendelSelection,
    type EarendelSelectionValues
} from './stagedSelection.js'
import { describePiece } from '$lib/utils/describe.js'
import { highlightedHexesOf } from '$lib/utils/highlights.js'
import { rankStandings, type FinalStanding } from '$lib/utils/standings.js'
import { stationTubesOf, type StationTube } from '$lib/utils/stationLinks.js'
import {
    ActionType,
    ChoosePlanet,
    ChooseTechnology,
    AttackPiece,
    destinationsFrom,
    feintableShips,
    feintTargets,
    wakeableFighters,
    AttackOutcome,
    attackOutcomeAt,
    canUseCooldownEffect,
    DiscardPiece,
    drawCountForPlayer,
    DrawPieces,
    TechnologyEffectKind,
    turnsUntilReady,
    attackableTargets,
    probeDestinations,
    technologyCard,
    technologyName,
    UseUpdatedLogistics,
    UseTacticalFeint,
    UseTradeRouteWormhole,
    UseImmediateDownload,
    EndTurn,
    downloadAnchorsFor,
    downloadTargetsFrom,
    wormholableShips,
    wormholeDestinations,
    AttackSpread,
    controllerOf,
    planetCoordinates,
    relayedProbesOf,
    relayStationsOf,
    planetPointsByPlayer,
    neighborsOf,
    type EarendelGameState,
    type HydratedEarendelGameState,
    type HydratedEarendelPlayerState,
    getHex,
    hexesClosedToProbesOf,
    hexKey,
    isElevated,
    legalMovesFor,
    legalPlacementsFor,
    legalTilePlacements,
    MovePiece,
    openHexesOfTile,
    PlaceTile,
    UseLogisticsUpgrade,
    TILE_ROTATIONS,
    type Piece,
    PieceSource,
    PieceType,
    PlacePiece,
    type SightLine,
    sightLines,
    type TechnologyCard,
    probeTechnologiesFor
} from '@tabletop/earendel'

export class EarendelGameSession extends GameSession<EarendelGameState, HydratedEarendelGameState> {
    private selection: EarendelSelection = $state({})
    private stagedSelection = undoableStagedSelection<EarendelSelectionValues>(
        EarendelStageOrder,
        () => this.selection,
        (selection) => {
            this.selection = selection
        }
    )
    readonly hasManualSelection = $derived(hasManualEarendelSelection(this.selection))
    readonly canUndo = $derived(
        this.isPlayable &&
            !this.isViewingHistory &&
            (this.hasManualSelection || Boolean(this.undoableAction))
    )

    private canChoose = $derived(
        this.isPlayable && !this.isViewingHistory && this.isMyTurn && !this.busy
    )

    // A reading aid rather than a staged choice, so Undo leaves it alone.
    private pinned: AxialCoordinates | undefined = $state(undefined)
    pinnedPlanet: AxialCoordinates | undefined = $derived.by(() => {
        const pinned = this.pinned
        return pinned && getHex(this.gameState.board, pinned)?.technologyId ? pinned : undefined
    })

    activePower: Power | undefined = $derived.by(() => {
        const power = this.selection.power?.value
        return this.canChoose && power !== undefined && this.isPowerAvailable(power)
            ? power
            : undefined
    })

    private originChoice: AxialCoordinates | undefined = $derived(
        this.canChoose ? this.selection.origin?.value : undefined
    )

    previewHex: AxialCoordinates | undefined = $derived(
        this.canChoose ? this.selection.preview?.value : undefined
    )

    chosenSpecialId: string | undefined = $derived.by(() => {
        const choice = this.selection.piece?.value
        if (!this.canChoose || choice?.source !== 'special' || !this.canPlaySpecial)
            return undefined
        return this.myPlayerState?.specialPieces.some((piece) => piece.id === choice.pieceId)
            ? choice.pieceId
            : undefined
    })

    chosenHeldId: string | undefined = $derived.by(() => {
        const choice = this.selection.piece?.value
        if (!this.canChoose || choice?.source !== 'held') return undefined
        return this.gameState.heldPieces.some((piece) => piece.id === choice.pieceId)
            ? choice.pieceId
            : undefined
    })

    movingFrom: AxialCoordinates | undefined = $derived.by(() => {
        const origin = this.originChoice
        const playerId = this.myPlayer?.id
        if (!origin || !playerId || this.activePower || !this.isMovingForTechnology) {
            return undefined
        }
        return legalMovesFor(this.gameState.board, playerId).some((move) =>
            sameCoordinates(move.from, origin)
        )
            ? origin
            : undefined
    })

    myPlayerState: HydratedEarendelPlayerState | undefined = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return playerId ? this.gameState.findPlayerState(playerId) : undefined
    })

    heldPieces: Piece[] = $derived(this.gameState.heldPieces)

    drawnPiece: Piece | undefined = $derived.by(() => {
        const held = this.gameState.heldPieces
        if (held.length === 0) return undefined
        if (held.length === 1) return held[0]
        const heldId = this.pinnedHeldId ?? this.chosenHeldId
        return held.find((piece) => piece.id === heldId)
    })

    isDiscarding: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.DiscardPiece)
    )

    // An explicit draw reveals nothing until asked, leaving the previous player time to undo.
    canDraw: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.DrawPieces)
    )

    drawCount: number = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId) return 0
        return drawCountForPlayer(this.gameState, playerId, this.primaryGame.config)
    })

    railgunArmed: boolean = $derived(this.activePower === Power.Railgun)

    canArmRailgun: boolean = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId || this.attackTargets.length === 0) return false
        return canUseCooldownEffect(this.gameState, playerId, TechnologyEffectKind.Railgun)
    })

    railgunTargets: AxialCoordinates[] = $derived.by(() => {
        const pending = this.gameState.pendingAttack
        if (!pending) return []

        return this.attackTargets.filter(
            (coords) =>
                attackOutcomeAt(this.gameState.board, pending.fighterCoords, coords) ===
                AttackOutcome.Damaged
        )
    })

    railgunWouldMatter(coords: AxialCoordinates): boolean {
        return this.railgunTargets.some((target) => sameCoordinates(target, coords))
    }

    railgunTurnsLeft: number = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId) return 0
        return turnsUntilReady(this.gameState, playerId, TechnologyEffectKind.Railgun)
    })

    canUseLogisticsUpgrade: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseLogisticsUpgrade)
    )

    storedEffectCount(kind: TechnologyEffectKind): number {
        return (this.myPlayerState?.storedEffects ?? []).filter((stored) => stored === kind).length
    }

    private get pinnedHeldId(): string | undefined {
        return this.gameState.bonusPlacementPieceId
    }

    canPlaySpecial: boolean = $derived.by(
        () => this.isPlacing && this.bonusPlacementHexes.length === 0
    )

    pieceToPlace: Piece | undefined = $derived.by(() => {
        if (this.chosenSpecialId && this.canPlaySpecial) {
            return this.myPlayerState?.specialPieces.find(
                (piece) => piece.id === this.chosenSpecialId
            )
        }
        return this.drawnPiece
    })

    private get pendingExploration() {
        const pending = this.gameState.pendingExploration
        return pending?.playerId === this.myPlayer?.id ? pending : undefined
    }

    private get pendingAttack() {
        const pending = this.gameState.pendingAttack
        return pending?.playerId === this.myPlayer?.id ? pending : undefined
    }

    isPlacing: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.PlacePiece)
    )

    // Not auto-selected even when only one: skipping is always allowed.
    choosablePlanets: AxialCoordinates[] = $derived.by(() => {
        const pending = this.gameState.pendingExploration
        if (!this.isMyTurn || !pending || pending.exploringPlanet) return []
        return pending.playerId === this.myPlayer?.id ? pending.candidatePlanets : []
    })

    technologyChoices: TechnologyCard[] = $derived.by(() => {
        const pending = this.gameState.pendingExploration
        if (!this.isMyTurn || !pending?.exploringPlanet) return []
        if (pending.playerId !== this.myPlayer?.id) return []
        return (pending.candidates ?? []).map(technologyCard)
    })

    discardedTechnologies: { name: string; count: number; colors: string[] }[] = $derived.by(() => {
        const groups = new Map<string, { name: string; count: number; colors: Set<string> }>()

        for (const card of (this.gameState.technologyDiscard ?? []).map(technologyCard)) {
            const name = technologyName(card)
            const group = groups.get(name) ?? { name, count: 0, colors: new Set<string>() }
            group.count += 1
            for (const color of card.colors) group.colors.add(color)
            groups.set(name, group)
        }

        return [...groups.values()]
            .map((group) => ({ name: group.name, count: group.count, colors: [...group.colors] }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    })

    discardedTechnologyCount: number = $derived(this.gameState.technologyDiscard?.length ?? 0)

    technologyDeckCount: number = $derived(this.gameState.technologyDeck.remaining)

    setAsideCards: TechnologyCard[] = $derived.by(() => {
        const pending = this.gameState.pendingExploration
        if (!pending?.revealed) return []

        const choosable = new Set(pending.candidates ?? [])
        return pending.revealed.filter((id) => !choosable.has(id)).map(technologyCard)
    })

    explorationChoice: { from: AxialCoordinates; to: AxialCoordinates[] } | undefined = $derived.by(
        () => {
            const pending = this.gameState.pendingExploration
            if (this.choosablePlanets.length === 0 || !pending) return undefined
            return { from: pending.probeCoords, to: this.choosablePlanets }
        }
    )

    attackChoice: { from: AxialCoordinates; to: AxialCoordinates[] } | undefined = $derived.by(
        () => {
            const pending = this.gameState.pendingAttack
            if (this.attackTargets.length === 0 || !pending) return undefined
            return { from: pending.fighterCoords, to: this.attackTargets }
        }
    )

    attackTargets: AxialCoordinates[] = $derived.by(() => {
        const pending = this.gameState.pendingAttack
        if (!this.isMyTurn || !pending) return []
        return pending.playerId === this.myPlayer?.id ? pending.targets : []
    })

    sightLines: SightLine[] = $derived(sightLines(this.gameState.board))

    stationTubes: StationTube[] = $derived(stationTubesOf(this.gameState.board))

    hexesClosedToMe: AxialCoordinates[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId || this.pieceToPlace?.type !== PieceType.Probe) return []
        return hexesClosedToProbesOf(this.gameState.board, playerId)
    })

    isPlacingTile: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.PlaceTile)
    )

    pendingTile = $derived(this.gameState.pendingTile?.tile)

    tileRotation: number = $derived(this.isPlacingTile ? (this.selection.rotation?.value ?? 0) : 0)

    private allTilePlacements = $derived(
        this.isPlacingTile ? legalTilePlacements(this.gameState.board) : []
    )

    tileOrigins: AxialCoordinates[] = $derived(
        this.allTilePlacements
            .filter((placement) => placement.rotation === this.tileRotation)
            .map((placement) => placement.origin)
    )

    rotateTile(step = 1) {
        if (!this.canChoose) return
        const rotation = (this.tileRotation + step + TILE_ROTATIONS) % TILE_ROTATIONS
        this.select('rotation', rotation)
    }

    bonusPlacementHexes: AxialCoordinates[] = $derived.by(() => {
        const tileId = this.gameState.bonusPlacementTileId
        if (!tileId || !this.isMyTurn) return []
        return openHexesOfTile(this.gameState.board, tileId)
    })

    isMovingForTechnology: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.MovePiece)
    )

    movableHexes: AxialCoordinates[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.isMovingForTechnology || !playerId) return []

        if (this.movingFrom) return destinationsFrom(this.gameState.board, this.movingFrom)

        const moves = legalMovesFor(this.gameState.board, playerId)
        return moves.map((move) => move.from)
    })

    highlightedHexes: AxialCoordinates[] = $derived.by(() =>
        highlightedHexesOf({
            feint: this.choosingFeint ? this.feintHexes : undefined,
            wormhole: this.choosingWormhole ? this.wormholeHexes : undefined,
            download: this.choosingDownload ? this.downloadHexes : undefined,
            updatedLogistics: this.choosingUpdatedLogistics ? this.wakeableFighters : undefined,
            tileOrigins: this.isPlacingTile ? this.tileOrigins : undefined,
            bonusPlacement: this.bonusPlacementHexes.length > 0 ? this.placementHexes : undefined,
            technologyMove: this.isMovingForTechnology ? this.movableHexes : undefined,
            survey: this.choosablePlanets.length > 0 ? this.choosablePlanets : undefined,
            attack: this.attackTargets.length > 0 ? this.attackTargets : undefined,
            placement: this.placementHexes
        })
    )

    private placementHexes: AxialCoordinates[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        const piece = this.pieceToPlace
        if (!this.isPlacing || !piece || !playerId) return []

        const legal = legalPlacementsFor(this.gameState.board, playerId, piece)
        const bonus = this.bonusPlacementHexes
        if (bonus.length === 0) return legal
        return legal.filter((coords) => bonus.some((hex) => sameCoordinates(hex, coords)))
    })

    isClosedToMe(coords: AxialCoordinates): boolean {
        return this.hexesClosedToMe.some((blocked) => sameCoordinates(blocked, coords))
    }

    previewTargetsFor(coords: AxialCoordinates): AxialCoordinates[] {
        const piece = this.pieceToPlace
        if (!piece || piece.type !== PieceType.Fighter || !this.isPlacing) return []

        const board = structuredClone($state.snapshot(this.gameState.board))
        const hex = board.hexes[hexKey(coords)]
        if (!hex) return []
        hex.piece = piece
        return attackableTargets(board, coords, piece.playerId)
    }

    previewProbeDestinationsFor(coords: AxialCoordinates): AxialCoordinates[] {
        const piece = this.pieceToPlace
        if (!piece || piece.type !== PieceType.Probe || !this.isPlacing) return []
        return probeDestinations(this.gameState, coords, piece)
    }

    canSpread: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.AttackSpread)
    )

    spreading: boolean = $derived(this.activePower === Power.Spread)

    spreadTargets: AxialCoordinates[] = $derived(
        this.spreading
            ? (this.selection.targets?.value ?? []).filter((target) =>
                  this.attackTargets.some((candidate) => sameCoordinates(candidate, target))
              )
            : []
    )

    isSpreadTarget(coords: AxialCoordinates): boolean {
        return this.spreadTargets.some((target) => sameCoordinates(target, coords))
    }

    private toggleSpreadTarget(coords: AxialCoordinates) {
        this.selection = toggleEarendelTarget(this.selection, coords)
    }

    get canConfirmSpread(): boolean {
        return this.spreading && this.spreadTargets.length > 1
    }

    async confirmSpread() {
        if (!this.canConfirmSpread) return

        const action = this.createPlayerAction(AttackSpread, {
            targets: $state.snapshot(this.spreadTargets)
        })
        this.resetAction()
        await this.applyAction(action)
    }

    // Claims that would pay if settled now: the same test the claimant's next turn applies, so a
    // claim whose probes were destroyed or outnumbered stops showing until it is regained.
    pendingClaims: { coords: AxialCoordinates; playerId: string; technologyId: string }[] =
        $derived.by(() => {
            const claimants = new Set(this.gameState.probeClaims.map((claim) => claim.playerId))
            return [...claimants].flatMap((playerId) => {
                const { researched } = probeTechnologiesFor(this.gameState, playerId)
                return this.gameState.probeClaims.filter(
                    (claim) =>
                        claim.playerId === playerId &&
                        researched.some((coords) => sameCoordinates(coords, claim.coords))
                )
            })
        })

    controlEdges: { planet: AxialCoordinates; from: AxialCoordinates; playerId: string }[] =
        $derived.by(() => {
            const edges: { planet: AxialCoordinates; from: AxialCoordinates; playerId: string }[] =
                []

            for (const planet of planetCoordinates(this.gameState.board)) {
                const controller = controllerOf(this.gameState, planet)
                if (!controller) continue

                for (const neighbor of neighborsOf(planet)) {
                    const piece = getHex(this.gameState.board, neighbor)?.piece
                    if (piece?.playerId !== controller) continue
                    edges.push({ planet, from: neighbor, playerId: controller })
                }
            }

            return edges
        })

    // Relay lines touching the piece at `coords`: from each station relaying a probe there, or from
    // a station there to each probe it relays.
    relayLinesFor(
        coords: AxialCoordinates
    ): { station: AxialCoordinates; probe: AxialCoordinates; playerId: string }[] {
        const piece = getHex(this.gameState.board, coords)?.piece
        if (!piece) return []
        const board = this.gameState.board
        if (piece.type === PieceType.Probe) {
            return relayStationsOf(board, coords).map((station) => ({
                station,
                probe: coords,
                playerId: piece.playerId
            }))
        }
        if (piece.type === PieceType.Station) {
            return relayedProbesOf(board, coords).map((probe) => ({
                station: coords,
                probe,
                playerId: piece.playerId
            }))
        }
        return []
    }

    controlEdgesFor(
        coords: AxialCoordinates
    ): { planet: AxialCoordinates; from: AxialCoordinates; playerId: string }[] {
        const piece = getHex(this.gameState.board, coords)?.piece
        if (!piece) return []

        const planets = neighborsOf(coords)
        return this.controlEdges.filter(
            (edge) =>
                edge.playerId === piece.playerId &&
                planets.some((planet) => sameCoordinates(planet, edge.planet))
        )
    }

    // Each probe staking a pending claim: the claimant's probes beside the claimed planet.
    claimUplinks: { planet: AxialCoordinates; probe: AxialCoordinates; playerId: string }[] =
        $derived(
            this.pendingClaims.flatMap(({ coords, playerId }) =>
                neighborsOf(coords)
                    .filter((neighbor) => {
                        const piece = getHex(this.gameState.board, neighbor)?.piece
                        return piece?.type === PieceType.Probe && piece.playerId === playerId
                    })
                    .map((probe) => ({ planet: coords, probe, playerId }))
            )
        )

    canUseUpdatedLogistics: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseUpdatedLogistics)
    )

    choosingUpdatedLogistics: boolean = $derived(this.activePower === Power.Logistics)

    wakeableFighters: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseUpdatedLogistics || !this.myPlayer) return []
        return wakeableFighters(this.gameState.board, this.myPlayer.id)
    })

    async useUpdatedLogistics(coords: AxialCoordinates) {
        if (!this.canUseUpdatedLogistics) return

        const action = this.createPlayerAction(UseUpdatedLogistics, { coords })
        this.resetAction()
        await this.applyAction(action)
    }

    // The ships are placed but a technology could still act: the player may end the turn instead.
    canEndTurn: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.EndTurn)
    )

    async endTurn() {
        if (!this.canEndTurn) return

        const action = this.createPlayerAction(EndTurn, {})
        this.resetAction()
        await this.applyAction(action)
    }

    canUseTacticalFeint: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseTacticalFeint)
    )

    choosingFeint: boolean = $derived(this.activePower === Power.Feint)

    feintableShips: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseTacticalFeint || !this.myPlayer) return []
        return feintableShips(this.gameState.board, this.myPlayer.id)
    })

    feintFrom: AxialCoordinates | undefined = $derived(
        this.choosingFeint ? this.validOrigin(this.feintableShips) : undefined
    )

    feintTargetsFrom(coords: AxialCoordinates): AxialCoordinates[] {
        const playerId = this.myPlayer?.id
        if (!playerId) return []
        return feintTargets(this.gameState.board, coords, playerId)
    }

    feintHexes: AxialCoordinates[] = $derived.by(() => {
        if (!this.choosingFeint) return []
        return this.feintFrom ? this.feintTargetsFrom(this.feintFrom) : this.feintableShips
    })

    private async onFeintClick(coords: AxialCoordinates) {
        const from = this.feintFrom
        if (from && this.feintTargetsFrom(from).some((target) => sameCoordinates(target, coords))) {
            await this.useTacticalFeint(from, coords)
            return
        }
        this.toggleOrigin(coords, this.feintableShips)
    }

    canUseTradeRouteWormhole: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseTradeRouteWormhole)
    )

    choosingWormhole: boolean = $derived(this.activePower === Power.Wormhole)

    travellableShips: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseTradeRouteWormhole || !this.myPlayer) return []
        return wormholableShips(this.gameState.board, this.myPlayer.id)
    })

    wormholeExits(from: AxialCoordinates): AxialCoordinates[] {
        const playerId = this.myPlayer?.id
        if (!playerId) return []
        return wormholeDestinations(this.gameState.board, from, playerId)
    }

    wormholeFrom: AxialCoordinates | undefined = $derived(
        this.choosingWormhole ? this.validOrigin(this.travellableShips) : undefined
    )

    wormholeHexes: AxialCoordinates[] = $derived.by(() => {
        if (!this.choosingWormhole) return []
        return this.wormholeFrom ? this.wormholeExits(this.wormholeFrom) : this.travellableShips
    })

    private async onWormholeClick(coords: AxialCoordinates) {
        const from = this.wormholeFrom
        if (from && this.wormholeExits(from).some((exit) => sameCoordinates(exit, coords))) {
            await this.useTradeRouteWormhole(from, coords)
            return
        }
        this.toggleOrigin(coords, this.travellableShips)
    }

    canUseImmediateDownload: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseImmediateDownload)
    )

    choosingDownload: boolean = $derived(this.activePower === Power.Download)

    downloadAnchors: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseImmediateDownload || !this.myPlayer) return []
        return downloadAnchorsFor(this.gameState, this.myPlayer.id).filter(
            (anchor) => this.downloadTargets(anchor).length > 0
        )
    })

    downloadTargets(anchor: AxialCoordinates): AxialCoordinates[] {
        const playerId = this.myPlayer?.id
        if (!playerId) return []
        return downloadTargetsFrom(this.gameState, playerId, anchor)
    }

    downloadFrom: AxialCoordinates | undefined = $derived(
        this.choosingDownload ? this.validOrigin(this.downloadAnchors) : undefined
    )

    downloadHexes: AxialCoordinates[] = $derived.by(() => {
        if (!this.choosingDownload) return []
        return this.downloadFrom ? this.downloadTargets(this.downloadFrom) : this.downloadAnchors
    })

    private async onDownloadClick(coords: AxialCoordinates) {
        const from = this.downloadFrom
        if (from && this.downloadTargets(from).some((target) => sameCoordinates(target, coords))) {
            await this.useImmediateDownload(from, coords)
            return
        }
        this.toggleOrigin(coords, this.downloadAnchors)
    }

    async useImmediateDownload(from: AxialCoordinates, to: AxialCoordinates) {
        if (!this.canUseImmediateDownload) return

        const action = this.createPlayerAction(UseImmediateDownload, { from, to })
        this.resetAction()
        await this.applyAction(action)
    }

    async useTradeRouteWormhole(from: AxialCoordinates, to: AxialCoordinates) {
        if (!this.canUseTradeRouteWormhole) return

        const action = this.createPlayerAction(UseTradeRouteWormhole, { from, to })
        this.resetAction()
        await this.applyAction(action)
    }

    async useTacticalFeint(from: AxialCoordinates, to: AxialCoordinates) {
        if (!this.canUseTacticalFeint) return

        const action = this.createPlayerAction(UseTacticalFeint, { from, to })
        this.resetAction()
        await this.applyAction(action)
    }

    finalStandings: FinalStanding[] = $derived.by(() => {
        if (!this.gameState.result) return []
        return rankStandings(
            this.gameState.players.map((player) => ({
                playerId: player.playerId,
                score: player.score
            })),
            planetPointsByPlayer(this.gameState.board)
        )
    })

    isHighlighted(coords: AxialCoordinates): boolean {
        return this.highlightedHexes.some((candidate) => sameCoordinates(candidate, coords))
    }

    prompt: string = $derived.by(() => {
        if (!this.isMyTurn) return 'Waiting for the other players.'
        if (this.choosablePlanets.length > 0) {
            return this.choosablePlanets.length > 1
                ? 'Your probes lead on more than one planet — choose one to survey, or skip.'
                : 'Your probes lead on this planet — survey it, or skip.'
        }
        if (this.technologyChoices.length > 0) {
            return this.technologyChoices.length > 1 && this.technologyChoices.every(isElevated)
                ? 'Two elevated technologies — choose which one this planet holds.'
                : 'Choose the technology this planet will hold.'
        }
        if (this.attackTargets.length > 0) {
            if (this.railgunArmed) {
                return this.railgunTargets.length > 0
                    ? 'Railgun armed — ringed targets are destroyed outright rather than damaged.'
                    : 'Railgun armed, but nothing here needs it — every target dies to a plain shot.'
            }
            return this.canArmRailgun
                ? 'Your fighter may attack one adjacent piece, arm the Railgun first, or hold fire.'
                : 'Your fighter may attack one adjacent piece, or hold fire.'
        }
        if (this.spreading) {
            return this.spreadTargets.length > 1
                ? `Full Torpedo Spread — ${this.spreadTargets.length} targets picked. Fire, or keep choosing.`
                : 'Full Torpedo Spread — click the neighbours to hit. A spread needs at least two.'
        }
        if (this.choosingDownload) {
            if (this.downloadFrom) {
                return 'Immediate Download — click a planet that one can see to take its technology.'
            }
            return this.downloadAnchors.length === 0
                ? 'None of your Download planets can see a technology you could take.'
                : 'Immediate Download — click the planet holding your Download.'
        }
        if (this.choosingWormhole) {
            if (this.wormholeFrom) {
                return 'Trade Route Wormhole — click where it comes out. Click your own ship again to change it.'
            }
            return this.travellableShips.length === 0
                ? 'None of your ships beside a planet has a route to travel.'
                : 'Trade Route Wormhole — click one of your highlighted ships to send it.'
        }
        if (this.choosingFeint) {
            if (this.feintFrom) {
                return 'Tactical Feint — click the enemy ship to trade places with. Click your own ship again to change it.'
            }
            return this.feintableShips.length === 0
                ? 'None of your ships has an enemy beside it.'
                : 'Tactical Feint — click one of your highlighted ships to swap it with a neighbour.'
        }
        if (this.choosingUpdatedLogistics) {
            return this.wakeableFighters.length === 0
                ? 'None of your fighters has anything in reach.'
                : 'Updated Logistics — click one of your highlighted fighters to attack with it.'
        }
        if (this.isPlacingTile) {
            return this.tileOrigins.length === 0
                ? 'No room for the tile turned this way — rotate it.'
                : 'That technology grows the map — rotate the tile if you like, then lay it.'
        }
        if (this.bonusPlacementHexes.length > 0) {
            const piece = this.drawnPiece
            return piece
                ? `You drew a ${describePiece(piece)} with the tile — it must land on the new tile.`
                : 'Place the drawn ship on the new tile.'
        }
        if (this.isMovingForTechnology) {
            return this.movingFrom
                ? 'Now choose where it steps, or hold position.'
                : 'That technology may move one of your pieces — choose which, or hold position.'
        }
        if (this.canEndTurn) {
            return 'Your ships are placed — use a technology while it can still act, or end your turn.'
        }
        if (this.canDraw) {
            return `Your turn — draw ${this.drawCount} ${this.drawCount === 1 ? 'ship' : 'ships'} when you are ready.`
        }
        if (this.isDiscarding) {
            return this.canUseLogisticsUpgrade
                ? 'Three drawn — throw one out, or spend a Logistics Upgrade to keep all three.'
                : 'Three drawn — throw one out of the game, then place the other two.'
        }
        if (this.isPlacing) {
            const piece = this.pieceToPlace
            if (!piece) {
                return this.heldPieces.length > 1
                    ? 'Choose which ship to place.'
                    : 'Nothing to place.'
            }
            if (piece.type === PieceType.Probe && this.hexesClosedToMe.length > 0) {
                return `You drew a ${describePiece(piece)}. The wavy lines are closed to it — anything else may pass.`
            }
            return this.chosenSpecialId
                ? `Place your ${describePiece(piece)} — your draw goes back in the bag.`
                : `You drew a ${describePiece(piece)}. Place it, or play a special piece instead.`
        }
        return ''
    })

    async place(coords: AxialCoordinates) {
        if (!this.isPlacing) return

        const specialId = this.chosenSpecialId
        const pieceId = specialId ?? this.pinnedHeldId ?? this.drawnPiece?.id
        const action = this.createPlayerAction(PlacePiece, {
            type: ActionType.PlacePiece,
            coords,
            pieceSource: specialId ? PieceSource.Special : PieceSource.Bag,
            ...(pieceId ? { pieceId } : {})
        })

        this.resetAction()
        await this.applyAction(action)
    }

    async drawPieces() {
        await this.applyAction(this.createPlayerAction(DrawPieces, { type: ActionType.DrawPieces }))
    }

    async useLogisticsUpgrade() {
        await this.applyAction(
            this.createPlayerAction(UseLogisticsUpgrade, {
                type: ActionType.UseLogisticsUpgrade
            })
        )
    }

    async discard(pieceId: string) {
        await this.applyAction(
            this.createPlayerAction(DiscardPiece, { type: ActionType.DiscardPiece, pieceId })
        )
    }

    chooseHeld(pieceId: string) {
        if (this.pinnedHeldId || !this.canChoose) return
        this.select(
            'piece',
            this.chosenHeldId === pieceId ? undefined : { source: 'held', pieceId }
        )
    }

    chooseSpecial(pieceId: string) {
        if (!this.canChoose) return
        this.select(
            'piece',
            this.chosenSpecialId === pieceId ? undefined : { source: 'special', pieceId }
        )
    }

    canPlaceHeld(piece: Piece): boolean {
        const playerId = this.myPlayer?.id
        if (!playerId) return false
        return legalPlacementsFor(this.gameState.board, playerId, piece).length > 0
    }

    async choosePlanet(coords: AxialCoordinates) {
        await this.applyAction(
            this.createPlayerAction(ChoosePlanet, { type: ActionType.ChoosePlanet, coords })
        )
    }

    async skipSurvey() {
        await this.applyAction(
            this.createPlayerAction(ChoosePlanet, { type: ActionType.ChoosePlanet })
        )
    }

    async chooseTechnology(technologyId: string) {
        await this.applyAction(
            this.createPlayerAction(ChooseTechnology, {
                type: ActionType.ChooseTechnology,
                technologyId
            })
        )
    }

    choosePower(power: Power) {
        if (!this.canChoose || !this.isPowerAvailable(power) || this.activePower === power) return
        this.select('power', power)

        const origins = this.originCandidates(power)
        if (origins.length === 1) this.select('origin', origins[0], 'auto')
    }

    async attack(coords: AxialCoordinates) {
        const useRailgun = this.railgunArmed && this.railgunWouldMatter(coords)
        this.resetAction()
        await this.applyAction(
            this.createPlayerAction(AttackPiece, {
                type: ActionType.AttackPiece,
                coords,
                ...(useRailgun ? { useRailgun } : {})
            })
        )
    }

    async holdFire() {
        this.resetAction()
        await this.applyAction(
            this.createPlayerAction(AttackPiece, { type: ActionType.AttackPiece })
        )
    }

    async holdPosition() {
        this.resetAction()
        await this.applyAction(this.createPlayerAction(MovePiece, { type: ActionType.MovePiece }))
    }

    async movePiece(to: AxialCoordinates) {
        const from = this.movingFrom
        if (!from) return

        this.resetAction()
        await this.applyAction(
            this.createPlayerAction(MovePiece, { type: ActionType.MovePiece, from, to })
        )
    }

    async placeTile(coords: AxialCoordinates) {
        const rotation = this.tileRotation
        this.resetAction()
        await this.applyAction(
            this.createPlayerAction(PlaceTile, {
                type: ActionType.PlaceTile,
                coords,
                rotation
            })
        )
    }

    // Touch has no hover, so the first tap previews a placement and a second tap commits.
    async onTileOriginClick(origin: AxialCoordinates, touch = false) {
        if (this.busy || !this.tileOrigins.some((candidate) => sameCoordinates(candidate, origin)))
            return
        if (touch && !this.isPreviewing(origin)) {
            this.select('preview', origin)
            return
        }
        await this.placeTile(origin)
    }

    async onBoardClick(coords: AxialCoordinates, touch = false) {
        if (this.busy) return

        switch (this.activePower) {
            case Power.Feint:
                await this.onFeintClick(coords)
                return
            case Power.Wormhole:
                await this.onWormholeClick(coords)
                return
            case Power.Download:
                await this.onDownloadClick(coords)
                return
            case Power.Logistics:
                if (this.wakeableFighters.some((fighter) => sameCoordinates(fighter, coords))) {
                    await this.useUpdatedLogistics(coords)
                }
                return
            case Power.Spread:
                if (this.attackTargets.some((target) => sameCoordinates(target, coords))) {
                    this.toggleSpreadTarget(coords)
                }
                return
        }

        if (this.isPlacingTile) {
            await this.onTileOriginClick(coords, touch)
            return
        }

        if (this.isMovingForTechnology) {
            const from = this.movingFrom
            if (from && this.movableHexes.some((hex) => sameCoordinates(hex, coords))) {
                await this.movePiece(coords)
                return
            }
            const playerId = this.myPlayer?.id ?? ''
            const origins = legalMovesFor(this.gameState.board, playerId).map((move) => move.from)
            this.toggleOrigin(coords, origins)
            return
        }

        if (this.choosablePlanets.some((candidate) => sameCoordinates(candidate, coords))) {
            await this.choosePlanet(coords)
            return
        }
        if (this.attackTargets.some((target) => sameCoordinates(target, coords))) {
            await this.attack(coords)
            return
        }

        if (getHex(this.gameState.board, coords)?.technologyId) {
            this.togglePinnedPlanet(coords)
            return
        }
        if (this.isPlacing && this.isHighlighted(coords)) {
            if (touch && !this.isPreviewing(coords)) {
                this.select('preview', coords)
                return
            }
            await this.place(coords)
        }
    }

    togglePinnedPlanet(coords: AxialCoordinates) {
        this.pinned =
            this.pinnedPlanet && sameCoordinates(this.pinnedPlanet, coords) ? undefined : coords
    }

    override beforeNewState(_transition: PresentedTransition) {
        this.resetAction()
    }

    override async undo() {
        if (!this.canUndo || this.busy) return
        await undoSelectionOrAction(this.stagedSelection, () => super.undo())
    }

    resetAction() {
        this.stagedSelection.clear()
    }

    private select<TStage extends keyof EarendelSelectionValues>(
        stage: TStage,
        value: EarendelSelectionValues[TStage] | undefined,
        source: 'manual' | 'auto' = 'manual'
    ) {
        this.selection = setEarendelSelection(this.selection, stage, value, source)
    }

    private isPreviewing(coords: AxialCoordinates): boolean {
        return this.previewHex !== undefined && sameCoordinates(this.previewHex, coords)
    }

    private validOrigin(candidates: AxialCoordinates[]): AxialCoordinates | undefined {
        const origin = this.originChoice
        return origin && candidates.some((candidate) => sameCoordinates(candidate, origin))
            ? origin
            : undefined
    }

    private toggleOrigin(coords: AxialCoordinates, candidates: AxialCoordinates[]) {
        if (!candidates.some((candidate) => sameCoordinates(candidate, coords))) return
        const origin = this.originChoice
        this.select('origin', origin && sameCoordinates(origin, coords) ? undefined : coords)
    }

    private originCandidates(power: Power): AxialCoordinates[] {
        switch (power) {
            case Power.Feint:
                return this.feintableShips
            case Power.Wormhole:
                return this.travellableShips
            case Power.Download:
                return this.downloadAnchors
            default:
                return []
        }
    }

    private isPowerAvailable(power: Power): boolean {
        switch (power) {
            case Power.Feint:
                return this.canUseTacticalFeint
            case Power.Wormhole:
                return this.canUseTradeRouteWormhole
            case Power.Download:
                return this.canUseImmediateDownload
            case Power.Logistics:
                return this.canUseUpdatedLogistics
            case Power.Spread:
                return this.canSpread
            case Power.Railgun:
                return this.canArmRailgun
        }
    }
}
