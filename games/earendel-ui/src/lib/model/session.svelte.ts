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
import { type RulesHelp, rulesHelpFor } from '$lib/utils/rulesHelp.js'
import { orbitNotes, type OrbitNote } from '$lib/utils/orbitNotes.js'
import { describePiece } from '$lib/utils/describe.js'
import { highlightedHexesOf } from '$lib/utils/highlights.js'
import { rankStandings, type FinalStanding } from '$lib/utils/standings.js'
import { scoreBreakdown, type ScoreBreakdown } from '$lib/utils/scoreBreakdown.js'
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
    TechnologyCategory,
    turnsUntilReady,
    attackableTargets,
    isTorpedoAt,
    torpedoTargets,
    probeDestinations,
    technologyCard,
    technologyName,
    UseUpdatedLogistics,
    UseTacticalFeint,
    UseTacticalShift,
    UseWarpDrive,
    UseDimensionalRift,
    UseConscription,
    UseFactoryOverride,
    UseColonyShip,
    settleablePlanets,
    legalRiftsFor,
    riftDestinationsFrom,
    legalWarpsFor,
    warpDestinationsFrom,
    UseBeyondTheFrontier,
    UseSpoofedOrders,
    UseAsteroidField,
    UseSecurityBreach,
    PlayScrap,
    spoofablePieces,
    UseTradeRouteWormhole,
    UseImmediateDownload,
    EndTurn,
    Terraform,
    PLANET_COLORS,
    type PlanetColor,
    downloadAnchorsFor,
    downloadTargetsFrom,
    wormholableShips,
    wormholeDestinations,
    AttackSpread,
    FoundPlanet,
    StowShip,
    StowChoice,
    stowedShipKind,
    hexesInterdictedFor,
    seedableHexes,
    SeedNebula,
    isDraftThree,
    isEscorted,
    ruleInForce,
    bombardmentTargets,
    ChooseEventOrder,
    EventPick,
    type EventChoice,
    interceptTargets,
    salvageChoices,
    shipyardChoices,
    stormDestinations,
    stormOrigins,
    TECHNOLOGY_EFFECT_INFO,
    controllerOf,
    planetCoordinates,
    relayedProbesOf,
    relayStationsOf,
    gateTwin,
    neighborsOf,
    neighborsThrough,
    HexKind,
    type EarendelGameState,
    type HydratedEarendelGameState,
    type HydratedEarendelPlayerState,
    claimsBlockedBy,
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
    isDrawPieces,
    MachineState,
    type Piece,
    PieceSource,
    PieceType,
    PlacePiece,
    type SightLine,
    sightLines,
    type TechnologyCard,
    payableClaims
} from '@tabletop/earendel'

// A ship in the turn's hand: still held, or gone (thrown out, placed or back in the bag).
export type HandCard = { piece: Piece; held: boolean }

const RULES_HELP_KEY = 'earendel:rules-help'

function readRulesHelpShown(): boolean {
    try {
        return localStorage.getItem(RULES_HELP_KEY) !== 'off'
    } catch {
        return true
    }
}

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
        if (!origin || !playerId || this.activePower || !this.isDrifting) {
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

    // The turn's hand: every ship drawn this turn, held or gone, so a ship that was thrown out,
    // placed or returned to the bag stays in the hand face down rather than vanishing.
    // Before the first turn: each player, last first, stows one more ship in their bag and
    // then places a free station (rules.md, Setup).
    isStowing: boolean = $derived(this.gameState.machineState === MachineState.StowingShip)

    isOpening: boolean = $derived(
        this.isStowing || this.gameState.machineState === MachineState.PlacingOpeningStation
    )

    // The game is still opening (`Board`): its assembly is playing, or the title stands over the
    // built board waiting for Play. The panel says and offers nothing until it ends.
    boardAssembling: boolean = $state(false)

    // The title over the board on a first opening: while the board builds, then with its Play
    // and Overview buttons once it is built.
    titleStage: 'hidden' | 'building' | 'ready' = $state('hidden')

    // Play: the title goes and the game begins.
    beginPlay() {
        this.titleStage = 'hidden'
        this.boardAssembling = false
    }

    // The rules overview, opened from the title or the header.
    overviewShown: boolean = $state(false)

    // Whether stow cards that arrive now were brought by live play (a rival's opening done, or
    // the board just built) and so arrive with their reveal. Cards that come back by undo, on
    // leaving history or on reload are simply there, face up.
    private stowRevealDue = false

    announceStowReveal() {
        this.stowRevealDue = true
    }

    takeStowReveal(): boolean {
        const due = this.stowRevealDue
        this.stowRevealDue = false
        return due
    }

    // The ships the player may stow, as they would look in hand.
    stowableShips: { choice: StowChoice; piece: Piece }[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId || !this.isMyTurn || !this.validActionTypes.includes(ActionType.StowShip)) {
            return []
        }
        return Object.values(StowChoice).map((choice) => ({
            choice,
            piece: { id: `stow-${choice}`, playerId, ...stowedShipKind(choice) }
        }))
    })

    async stowShip(choice: StowChoice) {
        if (this.stowableShips.length === 0) return
        const action = this.createPlayerAction(StowShip, { choice })
        this.resetAction()
        await this.applyAction(action)
    }

    turnHand: HandCard[] = $derived.by(() => {
        // The opening station is placed from the board, never shown as a card.
        if (this.isOpening) return []
        // The turn's actions by index: a turn can end without an action of its own, so the turn
        // manager's record of where this one began is the boundary.
        const start = this.gameState.turnManager.currentTurn()?.start
        if (start === undefined) return []
        const drawn: Piece[] = []
        for (const action of this.actions) {
            if (action.index === undefined) continue
            if (action.index < start || action.index >= this.gameState.actionCount) continue
            if (isDrawPieces(action)) drawn.push(...(action.metadata?.drawn ?? []))
        }
        const held = new Set(this.gameState.heldPieces.map((piece) => piece.id))
        // A laid tile's extra ship is drawn outside the turn's draw.
        const extra = this.gameState.heldPieces.filter(
            (piece) => !drawn.some((card) => card.id === piece.id)
        )
        return [...drawn, ...extra].map((piece) => ({ piece, held: held.has(piece.id) }))
    })

    // The technologies the player could use this moment, each with what a click on it does: the
    // action panel's chips and the player's own panel play them alike.
    powerActivators: Map<TechnologyEffectKind, () => void> = $derived.by(() => {
        const offered: [boolean, TechnologyEffectKind, () => void][] = [
            [
                this.torpedoFighter !== undefined,
                TechnologyEffectKind.GammaTorpedo,
                () => this.armTorpedo()
            ],
            [
                this.canUseLogisticsUpgrade,
                TechnologyEffectKind.LogisticsUpgrade,
                () => this.useLogisticsUpgrade()
            ],
            [
                this.canUseUpdatedLogistics,
                TechnologyEffectKind.UpdatedLogistics,
                () => this.choosePower(Power.Logistics)
            ],
            [
                this.canUseTacticalShift,
                TechnologyEffectKind.MoveFriendlyPiece,
                () => this.choosePower(Power.Shift)
            ],
            [
                this.canUseWarpDrive,
                TechnologyEffectKind.WarpDrive,
                () => this.choosePower(Power.Warp)
            ],
            [
                this.canUseDimensionalRift,
                TechnologyEffectKind.DimensionalRift,
                () => this.choosePower(Power.Rift)
            ],
            [
                this.canUseSpoofedOrders,
                TechnologyEffectKind.SpoofedOrders,
                () => this.choosePower(Power.Spoof)
            ],
            [
                this.canUseConscription,
                TechnologyEffectKind.Conscription,
                () => this.useConscription()
            ],
            [
                this.canUseColonyShip,
                TechnologyEffectKind.ColonyShip,
                () => this.choosePower(Power.Colony)
            ],
            [
                this.canUseFactoryOverride,
                TechnologyEffectKind.FactoryOverride,
                () => this.useFactoryOverride()
            ],
            [
                this.canUseAsteroidField,
                TechnologyEffectKind.AsteroidField,
                () => this.choosePower(Power.Asteroid)
            ],
            [
                this.canUseSecurityBreach,
                TechnologyEffectKind.SecurityBreach,
                () => this.choosePower(Power.Breach)
            ],
            [
                this.canUseBeyondTheFrontier,
                TechnologyEffectKind.GrowBoard,
                () => this.useBeyondTheFrontier()
            ],
            [
                this.canUseTacticalFeint,
                TechnologyEffectKind.TacticalFeint,
                () => this.choosePower(Power.Feint)
            ],
            [
                this.canUseImmediateDownload,
                TechnologyEffectKind.ImmediateDownload,
                () => this.choosePower(Power.Download)
            ],
            [
                this.canUseTradeRouteWormhole,
                TechnologyEffectKind.TradeRouteWormhole,
                () => this.choosePower(Power.Wormhole)
            ]
        ]
        return new Map(
            offered
                .filter(([usable]) => usable)
                .map(([, kind, activate]): [TechnologyEffectKind, () => void] => [kind, activate])
        )
    })

    // The probes that went into orbit this turn and what for, said above the board for everyone
    // (rules.md, Exploration): the history is not the only place so large a moment is told.
    // A note lasts until the next piece is played.
    orbitNotes: OrbitNote[] = $derived.by(() => {
        if (this.isViewingHistory) return []
        const start = this.gameState.turnManager.currentTurn()?.start
        if (start === undefined) return []
        return orbitNotes(
            this.actions.filter(
                (action) =>
                    action.index !== undefined &&
                    action.index >= start &&
                    action.index < this.gameState.actionCount
            )
        )
    })

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
        if (!playerId || this.attackTargets.length === 0 || this.torpedoPending) return false
        return canUseCooldownEffect(this.gameState, playerId, TechnologyEffectKind.Railgun)
    })

    // Gamma Torpedo: armed while a fighter is in hand, it goes down beside a station and strikes.
    torpedoArmed: boolean = $derived(this.activePower === Power.Torpedo)

    canArmTorpedo: boolean = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId || !this.isPlacing || this.pieceToPlace?.type !== PieceType.Fighter) {
            return false
        }
        if (!canUseCooldownEffect(this.gameState, playerId, TechnologyEffectKind.GammaTorpedo)) {
            return false
        }
        return this.torpedoPlacements.length > 0
    })

    // A held fighter that could be placed as a torpedo, chosen for placement or not: the Gamma
    // Torpedo is offered as soon as it could be used, so the player need not pick the fighter
    // first to find it.
    torpedoFighter: Piece | undefined = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId || !this.isPlacing || this.chosenSpecialId) return undefined
        if (!canUseCooldownEffect(this.gameState, playerId, TechnologyEffectKind.GammaTorpedo)) {
            return undefined
        }
        return this.heldPieces.find(
            (piece) =>
                piece.type === PieceType.Fighter &&
                legalPlacementsFor(this.gameState.board, playerId, piece).some(
                    (coords) => torpedoTargets(this.gameState.board, coords).length > 0
                )
        )
    })

    // Arms the torpedo, choosing the fighter for placement first if another ship was chosen.
    armTorpedo() {
        const fighter = this.torpedoFighter
        if (!fighter || !this.canChoose) return
        if (this.torpedoArmed) {
            this.choosePower(Power.Torpedo)
            return
        }
        if (this.pieceToPlace?.id !== fighter.id) this.chooseHeld(fighter.id)
        this.choosePower(Power.Torpedo)
    }

    // The legal hexes for the fighter that have a station beside them.
    torpedoPlacements: AxialCoordinates[] = $derived.by(() =>
        this.placementHexes.filter(
            (coords) => torpedoTargets(this.gameState.board, coords).length > 0
        )
    )

    // A torpedo just placed is waiting to strike: it cannot hold fire, spread or railgun.
    torpedoPending: boolean = $derived.by(() => {
        const pending = this.pendingAttack
        return pending !== undefined && isTorpedoAt(this.gameState.board, pending.fighterCoords)
    })

    canHoldFire: boolean = $derived.by(() => this.attackTargets.length > 0 && !this.torpedoPending)

    // Elevated technologies (rules.md): the face-up row, with where each ended up once spent.
    elevatedCards: { color: PlanetColor; card: TechnologyCard; housed?: AxialCoordinates }[] =
        $derived.by(() => {
            const chosen = this.gameState.elevatedTechnologies ?? {}
            return PLANET_COLORS.flatMap((color) => {
                const technologyId = chosen[color]
                if (!technologyId) return []
                const housed = planetCoordinates(this.gameState.board).find(
                    (planet) => getHex(this.gameState.board, planet)?.technologyId === technologyId
                )
                return [
                    { color, card: technologyCard(technologyId), ...(housed ? { housed } : {}) }
                ]
            })
        })

    // The special-piece technologies in play this game (rules.md, Granted pieces), one per
    // category in the categories' order; empty when every piece is in the deck.
    piecesInPlay: { category: TechnologyCategory; kind: TechnologyEffectKind }[] = $derived.by(
        () => {
            const chosen = this.gameState.pieceTechnologies ?? {}
            return Object.values(TechnologyCategory).flatMap((category) => {
                const kind = chosen[category]
                return kind ? [{ category, kind }] : []
            })
        }
    )

    // An elevated event being resolved: who picks, and what the picker may take.
    eventKind: TechnologyEffectKind | undefined = $derived(this.gameState.pendingEvent?.kind)

    eventName: string = $derived.by(() =>
        this.eventKind ? TECHNOLOGY_EFFECT_INFO[this.eventKind].name : ''
    )

    // Who is picking now, or the discoverer while the order is still theirs to set.
    eventPicker: string | undefined = $derived.by(() => {
        const pending = this.gameState.pendingEvent
        if (!pending) return undefined
        return pending.order ? pending.order[0] : pending.discovererId
    })

    isChoosingEventOrder: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.ChooseEventOrder)
    )

    // The others lined up after the discoverer so far, in the order chosen.
    eventOrderDraft: string[] = $derived.by(() =>
        this.isChoosingEventOrder && this.canChoose ? (this.selection.order?.value ?? []) : []
    )

    eventOrderCandidates: string[] = $derived.by(() => {
        if (!this.isChoosingEventOrder) return []
        const me = this.myPlayer?.id
        return this.gameState.players
            .map((player) => player.playerId)
            .filter((playerId) => playerId !== me && !this.eventOrderDraft.includes(playerId))
    })

    addToEventOrder(playerId: string) {
        if (!this.eventOrderCandidates.includes(playerId)) return
        this.select('order', [...this.eventOrderDraft, playerId])
    }

    get canConfirmEventOrder(): boolean {
        return this.isChoosingEventOrder && this.eventOrderCandidates.length === 0
    }

    async chooseEventOrder() {
        if (!this.canConfirmEventOrder || !this.myPlayer) return
        const action = this.createPlayerAction(ChooseEventOrder, {
            order: [this.myPlayer.id, ...$state.snapshot(this.eventOrderDraft)]
        })
        this.resetAction()
        await this.applyAction(action)
    }

    isPickingEvent: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.EventPick)
    )

    bombardmentTargets: AxialCoordinates[] = $derived.by(() => {
        const me = this.myPlayer?.id
        if (!me || !this.isPickingEvent) return []
        if (this.eventKind !== TechnologyEffectKind.OrbitalBombardment) return []
        return bombardmentTargets(this.gameState, me)
    })

    stormOrigins: AxialCoordinates[] = $derived.by(() => {
        const me = this.myPlayer?.id
        if (!me || !this.isPickingEvent) return []
        if (this.eventKind !== TechnologyEffectKind.WormholeStorm) return []
        return stormOrigins(this.gameState, me).filter(
            (from) => stormDestinations(this.gameState, from).length > 0
        )
    })

    stormFrom: AxialCoordinates | undefined = $derived.by(() =>
        this.stormOrigins.length === 1 ? this.stormOrigins[0] : this.validOrigin(this.stormOrigins)
    )

    stormDestinations: AxialCoordinates[] = $derived.by(() =>
        this.stormFrom ? stormDestinations(this.gameState, this.stormFrom) : []
    )

    salvageChoices: TechnologyCard[] = $derived.by(() => {
        const me = this.myPlayer?.id
        if (!me || !this.isPickingEvent) return []
        if (this.eventKind !== TechnologyEffectKind.SalvageRights) return []
        return salvageChoices(this.gameState, me).map(technologyCard)
    })

    interceptTargets: AxialCoordinates[] = $derived.by(() => {
        const me = this.myPlayer?.id
        const pending = this.gameState.pendingEvent
        if (!me || !pending || !this.isPickingEvent) return []
        if (this.eventKind !== TechnologyEffectKind.SignalIntercept) return []
        return interceptTargets(this.gameState, pending, me)
    })

    // Shipyard World: the units still on offer, by the technology that grants each.
    shipyardChoices: TechnologyEffectKind[] = $derived.by(() => {
        const pending = this.gameState.pendingEvent
        if (!pending || !this.isPickingEvent) return []
        if (this.eventKind !== TechnologyEffectKind.ShipyardWorld) return []
        return shipyardChoices(pending)
    })

    // The hexes the current pick may take.
    eventHexes: AxialCoordinates[] = $derived.by(() => {
        switch (this.eventKind) {
            case TechnologyEffectKind.OrbitalBombardment:
                return this.bombardmentTargets
            case TechnologyEffectKind.WormholeStorm:
                return this.stormFrom ? this.stormDestinations : this.stormOrigins
            case TechnologyEffectKind.SignalIntercept:
                return this.interceptTargets
            default:
                return []
        }
    })

    async eventPick(choice: EventChoice) {
        if (!this.isPickingEvent) return
        const action = this.createPlayerAction(EventPick, { ...choice })
        this.resetAction()
        await this.applyAction(action)
    }

    private async onEventClick(coords: AxialCoordinates) {
        const among = (candidates: AxialCoordinates[]) =>
            candidates.some((candidate) => sameCoordinates(candidate, coords))
        switch (this.eventKind) {
            case TechnologyEffectKind.OrbitalBombardment:
            case TechnologyEffectKind.SignalIntercept:
                if (among(this.eventHexes)) await this.eventPick({ coords })
                return
            case TechnologyEffectKind.WormholeStorm: {
                const from = this.stormFrom
                if (from && among(this.stormDestinations)) {
                    await this.eventPick({ from, to: coords })
                    return
                }
                this.toggleOrigin(coords, this.stormOrigins)
                return
            }
        }
    }

    // A line under the prompt whenever a global in force is changing what the player sees, with
    // the global's name as a chip that explains it (rules.md, Elevated technologies).
    ruleNotes: { kind: TechnologyEffectKind; before: string; after: string }[] = $derived.by(() => {
        if (!this.isMyTurn || this.isViewingHistory) return []
        const board = this.gameState.board
        const notes: { kind: TechnologyEffectKind; before: string; after: string }[] = []

        if (
            this.isPlacing &&
            ruleInForce(board, TechnologyEffectKind.Overdrive) &&
            isDraftThree(this.primaryGame.config) &&
            !this.gameState.shipPlacedThisTurn &&
            this.heldPieces.length > 2
        ) {
            notes.push({
                kind: TechnologyEffectKind.Overdrive,
                before: 'No discard this turn:',
                after: 'places every drawn ship.'
            })
        }

        if (this.isDrifting) {
            notes.push({
                kind: TechnologyEffectKind.FreeDrift,
                before: 'A free step before placing, thanks to',
                after: '.'
            })
        }

        if (
            this.attackTargets.length > 0 &&
            !this.torpedoPending &&
            ruleInForce(board, TechnologyEffectKind.NoQuarter) &&
            this.attackTargets.some((target) => isEscorted(board, target))
        ) {
            notes.push({
                kind: TechnologyEffectKind.NoQuarter,
                before: 'Escorted ships are in reach:',
                after: 'protects nobody.'
            })
        }

        if (this.isDiscarding && ruleInForce(board, TechnologyEffectKind.Reinforcements)) {
            notes.push({
                kind: TechnologyEffectKind.Reinforcements,
                before: 'The discarded ship goes back into your bag, under',
                after: '.'
            })
        }

        const me = this.myPlayer?.id
        if (
            me &&
            this.isPlacing &&
            ruleInForce(board, TechnologyEffectKind.SharedScience) &&
            this.pendingClaims.some(
                (claim) =>
                    claim.playerId === me &&
                    neighborsOf(claim.coords).some((neighbor) => {
                        const piece = getHex(board, neighbor)?.piece
                        return piece?.type === PieceType.Probe && piece.playerId !== me
                    })
            )
        ) {
            notes.push({
                kind: TechnologyEffectKind.SharedScience,
                before: "Rivals' probes beside your claimed planets will learn the technology too, under",
                after: '.'
            })
        }

        return notes
    })

    private playerName(playerId: string): string {
        return this.primaryGame.players.find((player) => player.id === playerId)?.name ?? 'A player'
    }

    torpedoTurnsLeft: number = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId) return 0
        return turnsUntilReady(this.gameState, playerId, TechnologyEffectKind.GammaTorpedo)
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
        () =>
            this.isPlacing &&
            !this.isOpening &&
            this.bonusPlacementHexes.length === 0 &&
            !this.gameState.shipPlacedThisTurn
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

    // A ship may be placed and no technology is being chosen, so hovering previews a placement.
    // An armed torpedo is still a placement, previewed with the stations it could strike.
    previewingPlacement: boolean = $derived(
        this.isPlacing && (this.activePower === undefined || this.torpedoArmed)
    )

    // Placing a ship anywhere it may go: the player knows where, so the board marks nothing. A
    // torpedo, or the ship owed on a new tile, is a special case whose hexes are marked.
    ordinaryPlacement: boolean = $derived.by(
        () =>
            this.previewingPlacement && !this.torpedoArmed && this.bonusPlacementHexes.length === 0
    )

    // Not auto-selected even when only one: skipping is always allowed.
    choosablePlanets: AxialCoordinates[] = $derived.by(() => {
        const pending = this.gameState.pendingExploration
        if (!this.isMyTurn || !pending || pending.exploringPlanet) return []
        return pending.playerId === this.myPlayer?.id ? pending.candidatePlanets : []
    })

    // The player whose controlled planets the board is ringing, asked for from their panel: a
    // hover shows them, a click keeps them shown.
    heldPlanetsHoveredFor: string | undefined = $state(undefined)
    heldPlanetsPinnedFor: string | undefined = $state(undefined)
    heldPlanetsShownFor: string | undefined = $derived(
        this.heldPlanetsHoveredFor ?? this.heldPlanetsPinnedFor
    )

    // Rival claims the probe being surveyed with is holding off, on planets it cannot survey:
    // surveying commits it elsewhere and lets them pay.
    surveyUnblocks: { playerId: string; color?: PlanetColor }[] = $derived.by(() => {
        const pending = this.gameState.pendingExploration
        if (this.choosablePlanets.length === 0 || !pending) return []
        return claimsBlockedBy(this.gameState, pending.probeCoords)
            .filter(
                (claim) =>
                    !this.choosablePlanets.some((planet) => sameCoordinates(planet, claim.coords))
            )
            .map((claim) => ({
                playerId: claim.playerId,
                color: getHex(this.gameState.board, claim.coords)?.color
            }))
    })

    technologyChoices: TechnologyCard[] = $derived.by(() => {
        const pending = this.gameState.pendingExploration
        if (!this.isMyTurn || !pending?.exploringPlanet) return []
        if (pending.playerId !== this.myPlayer?.id) return []
        return (pending.candidates ?? []).map(technologyCard)
    })

    discardedTechnologies: { name: string; count: number; colors: PlanetColor[] }[] = $derived.by(
        () => {
            const groups = new Map<
                string,
                { name: string; count: number; colors: Set<PlanetColor> }
            >()

            for (const card of (this.gameState.technologyDiscard ?? []).map(technologyCard)) {
                const name = technologyName(card)
                const group = groups.get(name) ?? { name, count: 0, colors: new Set<PlanetColor>() }
                group.count += 1
                for (const color of card.colors) group.colors.add(color)
                groups.set(name, group)
            }

            return [...groups.values()]
                .map((group) => ({
                    name: group.name,
                    count: group.count,
                    colors: [...group.colors]
                }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        }
    )

    discardedTechnologyCount: number = $derived(this.gameState.technologyDiscard?.length ?? 0)

    technologyDeckCount: number = $derived(this.gameState.technologyDeck.remaining)

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

    // Hexes the ship in hand cannot enter: an enemy interdictor's neighbors for any ship, and
    // the hexes two enemy stations watch for a probe.
    hexesClosedToMe: AxialCoordinates[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        const piece = this.pieceToPlace
        if (!playerId || !piece || !this.isPlacing) return []
        const interdicted = hexesInterdictedFor(this.gameState.board, playerId)
        if (piece.type !== PieceType.Probe) return interdicted
        return [...interdicted, ...hexesClosedToProbesOf(this.gameState.board, playerId)]
    })

    // Nebula Seeding: the player's seeders lay a hex each at the turn's start.
    isSeeding: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.SeedNebula)
    )

    seedingHexes: AxialCoordinates[] = $derived.by(() => {
        const pending = this.gameState.pendingSeeding
        if (!this.isSeeding || !pending) return []
        return pending.seeders.flatMap((seeder) => seedableHexes(this.gameState.board, seeder))
    })

    async seedNebula(hex: AxialCoordinates) {
        const pending = this.gameState.pendingSeeding
        if (!this.isSeeding || !pending) return
        const seeder = pending.seeders.find((at) =>
            seedableHexes(this.gameState.board, at).some((candidate) =>
                sameCoordinates(candidate, hex)
            )
        )
        if (!seeder) return
        const action = this.createPlayerAction(SeedNebula, { seeder, hex })
        this.resetAction()
        await this.applyAction(action)
    }

    async skipSeeding() {
        if (!this.isSeeding) return
        const action = this.createPlayerAction(SeedNebula, {})
        this.resetAction()
        await this.applyAction(action)
    }

    // Artificial World: the planet just placed waits for its color.
    canFoundPlanet: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.FoundPlanet)
    )

    foundingHex: AxialCoordinates | undefined = $derived(
        this.canFoundPlanet ? this.gameState.pendingFounding?.coords : undefined
    )

    async foundPlanet(color: PlanetColor) {
        if (!this.canFoundPlanet) return
        const action = this.createPlayerAction(FoundPlanet, { color })
        this.resetAction()
        await this.applyAction(action)
    }

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

    // Free Drift's step (rules.md, Elevated technologies): the one move a turn can owe.
    isDrifting: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.MovePiece)
    )

    movableHexes: AxialCoordinates[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.isDrifting || !playerId) return []

        if (this.movingFrom) return destinationsFrom(this.gameState.board, this.movingFrom)

        const moves = legalMovesFor(this.gameState.board, playerId)
        return moves.map((move) => move.from)
    })

    // A mark says the player may act on that hex, so none shows while a change is still being
    // presented: the terraformed planet's ring is gone before its wipe plays.
    highlightedHexes: AxialCoordinates[] = $derived.by(() =>
        this.updatingVisibleState
            ? []
            : highlightedHexesOf({
                  event: this.isPickingEvent ? this.eventHexes : undefined,
                  seeding: this.isSeeding ? this.seedingHexes : undefined,
                  founding: this.foundingHex ? [this.foundingHex] : undefined,
                  shift: this.choosingShift ? this.shiftHexes : undefined,
                  warp: this.choosingWarp ? this.warpHexes : undefined,
                  rift: this.choosingRift ? this.riftHexes : undefined,
                  spoof: this.choosingSpoof ? this.spoofHexes : undefined,
                  feint: this.choosingFeint ? this.feintHexes : undefined,
                  wormhole: this.choosingWormhole ? this.wormholeHexes : undefined,
                  download: this.choosingDownload ? this.downloadHexes : undefined,
                  updatedLogistics: this.choosingUpdatedLogistics
                      ? this.wakeableFighters
                      : undefined,
                  colony: this.choosingColony ? this.settleablePlanets : undefined,
                  tileOrigins: this.isPlacingTile ? this.tileOrigins : undefined,
                  bonusPlacement:
                      this.bonusPlacementHexes.length > 0 ? this.placementHexes : undefined,
                  technologyMove: this.isDrifting ? this.movableHexes : undefined,
                  terraform: this.canTerraform
                      ? this.terraformPlanet
                          ? [this.terraformPlanet]
                          : this.terraformPlanets
                      : undefined,
                  survey: this.choosablePlanets.length > 0 ? this.choosablePlanets : undefined,
                  attack: this.attackTargets.length > 0 ? this.attackTargets : undefined,
                  placement: this.torpedoArmed ? this.torpedoPlacements : this.placementHexes
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

    // The ground every interdictor on the board holds, anyone's, for everyone at all times: the
    // open hexes beside it. A standing signal, apart from the red outline of what is closed to
    // the ship in hand.
    interdictedGround: Set<number> = $derived.by(() => {
        const board = this.gameState.board
        const ground = new Set<number>()
        for (const hex of Object.values(board.hexes)) {
            if (hex.piece?.type !== PieceType.Interdictor) continue
            for (const neighbor of neighborsOf(hex.coords)) {
                if (getHex(board, neighbor)?.kind === HexKind.Open) ground.add(hexKey(neighbor))
            }
        }
        return ground
    })

    // Every interdictor's ground together with the hex it stands on: the region whose outside
    // the board draws brightest.
    interdictedRegion: AxialCoordinates[] = $derived.by(() => {
        const board = this.gameState.board
        return Object.values(board.hexes)
            .filter(
                (hex) =>
                    hex.piece?.type === PieceType.Interdictor ||
                    this.interdictedGround.has(hexKey(hex.coords))
            )
            .map((hex) => hex.coords)
    })

    isInterdictedGround(coords: AxialCoordinates): boolean {
        return this.interdictedGround.has(hexKey(coords))
    }

    previewTargetsFor(coords: AxialCoordinates): AxialCoordinates[] {
        const piece = this.pieceToPlace
        if (!piece || piece.type !== PieceType.Fighter || !this.previewingPlacement) return []
        if (this.torpedoArmed) return torpedoTargets(this.gameState.board, coords)

        const board = structuredClone($state.snapshot(this.gameState.board))
        const hex = board.hexes[hexKey(coords)]
        if (!hex) return []
        hex.piece = piece
        return attackableTargets(board, coords, piece.playerId)
    }

    previewProbeDestinationsFor(coords: AxialCoordinates): AxialCoordinates[] {
        const piece = this.pieceToPlace
        if (!piece || piece.type !== PieceType.Probe || !this.previewingPlacement) return []
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

    // Every player's points and where they come from, if the game ended now.
    scoreBreakdown: ScoreBreakdown[] = $derived.by(() =>
        scoreBreakdown(
            this.actions,
            this.gameState.players.map((player) => ({
                playerId: player.playerId,
                score: player.score
            }))
        )
    )

    // Claims that would pay if settled now, so one whose probes were destroyed or outnumbered
    // stops showing until it is regained.
    pendingClaims: { coords: AxialCoordinates; playerId: string; technologyId: string }[] =
        $derived(payableClaims(this.gameState))

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

    // Relay lines touching the piece at `coords`: from each station or relay protecting a probe
    // there, or from a station or relay there to each probe it protects.
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
        if (piece.type === PieceType.Station || piece.type === PieceType.Relay) {
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

    // Each probe staking a pending claim: the claimant's probes beside the claimed planet, a
    // gate pair counting as one place. A probe reached through gates names the gate beside the
    // planet and its twin, so the beam can run into one and out of the other.
    claimUplinks: {
        planet: AxialCoordinates
        probe: AxialCoordinates
        playerId: string
        via?: { near: AxialCoordinates; far: AxialCoordinates }
    }[] = $derived(
        this.pendingClaims.flatMap(({ coords, playerId }) => {
            const board = this.gameState.board
            const beside = neighborsOf(coords)
            return neighborsThrough(board, coords)
                .filter((neighbor) => {
                    const piece = getHex(board, neighbor)?.piece
                    return (
                        piece?.type === PieceType.Probe &&
                        piece.playerId === playerId &&
                        // A probe committed to another planet counts nothing here.
                        (!piece.surveying || sameCoordinates(piece.surveying, coords))
                    )
                })
                .map((probe) => {
                    if (beside.some((neighbor) => sameCoordinates(neighbor, probe))) {
                        return { planet: coords, probe, playerId }
                    }
                    const via = beside.flatMap((near) => {
                        const far = gateTwin(board, near)
                        return far &&
                            neighborsOf(far).some((neighbor) => sameCoordinates(neighbor, probe))
                            ? [{ near, far }]
                            : []
                    })[0]
                    return { planet: coords, probe, playerId, ...(via ? { via } : {}) }
                })
        })
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

    // A terraformer just placed may recolor one planet beside it (rules.md, Terraformer).
    canTerraform: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.Terraform)
    )

    terraformPlanets: AxialCoordinates[] = $derived(
        this.canTerraform ? (this.gameState.pendingTerraform?.planets ?? []) : []
    )

    // With a single planet in reach there is nothing to pick, so it is chosen without a stage.
    terraformPlanet: AxialCoordinates | undefined = $derived(
        this.terraformPlanets.length === 1
            ? this.terraformPlanets[0]
            : this.validOrigin(this.terraformPlanets)
    )

    terraformColors: PlanetColor[] = $derived.by(() => {
        const planet = this.terraformPlanet
        if (!planet) return []
        const current = getHex(this.gameState.board, planet)?.color
        return PLANET_COLORS.filter((color) => color !== current)
    })

    async terraform(color?: PlanetColor) {
        if (!this.canTerraform) return
        const planet = this.terraformPlanet
        const action = this.createPlayerAction(Terraform, color && planet ? { planet, color } : {})
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

    // Tactical Shift: one of the player's pieces, then the empty hex beside it to step into.
    canUseTacticalShift: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseTacticalShift)
    )

    choosingShift: boolean = $derived(this.activePower === Power.Shift)

    shiftablePieces: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseTacticalShift || !this.myPlayer) return []
        const origins = legalMovesFor(this.gameState.board, this.myPlayer.id).map(
            (move) => move.from
        )
        return origins.filter(
            (origin, index) =>
                origins.findIndex((other) => sameCoordinates(other, origin)) === index
        )
    })

    shiftFrom: AxialCoordinates | undefined = $derived(
        this.choosingShift ? this.validOrigin(this.shiftablePieces) : undefined
    )

    shiftHexes: AxialCoordinates[] = $derived.by(() => {
        if (!this.choosingShift) return []
        return this.shiftFrom
            ? destinationsFrom(this.gameState.board, this.shiftFrom)
            : this.shiftablePieces
    })

    private async onShiftClick(coords: AxialCoordinates) {
        const from = this.shiftFrom
        if (
            from &&
            destinationsFrom(this.gameState.board, from).some((target) =>
                sameCoordinates(target, coords)
            )
        ) {
            await this.useTacticalShift(from, coords)
            return
        }
        this.toggleOrigin(coords, this.shiftablePieces)
    }

    async useTacticalShift(from: AxialCoordinates, to: AxialCoordinates) {
        if (!this.canUseTacticalShift) return

        const action = this.createPlayerAction(UseTacticalShift, { from, to })
        this.resetAction()
        await this.applyAction(action)
    }

    // Warp Drive: one of the player's pieces, then the empty hex it comes out on, however far.
    canUseWarpDrive: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseWarpDrive)
    )

    choosingWarp: boolean = $derived(this.activePower === Power.Warp)

    warpablePieces: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseWarpDrive || !this.myPlayer) return []
        const origins = legalWarpsFor(this.gameState.board, this.myPlayer.id).map(
            (move) => move.from
        )
        return origins.filter(
            (origin, index) =>
                origins.findIndex((other) => sameCoordinates(other, origin)) === index
        )
    })

    warpFrom: AxialCoordinates | undefined = $derived(
        this.choosingWarp ? this.validOrigin(this.warpablePieces) : undefined
    )

    warpHexes: AxialCoordinates[] = $derived.by(() => {
        if (!this.choosingWarp) return []
        return this.warpFrom
            ? warpDestinationsFrom(this.gameState.board, this.warpFrom)
            : this.warpablePieces
    })

    private async onWarpClick(coords: AxialCoordinates) {
        const from = this.warpFrom
        if (
            from &&
            warpDestinationsFrom(this.gameState.board, from).some((target) =>
                sameCoordinates(target, coords)
            )
        ) {
            await this.useWarpDrive(from, coords)
            return
        }
        this.toggleOrigin(coords, this.warpablePieces)
    }

    async useWarpDrive(from: AxialCoordinates, to: AxialCoordinates) {
        if (!this.canUseWarpDrive) return

        const action = this.createPlayerAction(UseWarpDrive, { from, to })
        this.resetAction()
        await this.applyAction(action)
    }

    // Dimensional Rift: one of the player's pieces on the border, then the empty border hex it
    // comes out on.
    canUseDimensionalRift: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseDimensionalRift)
    )

    choosingRift: boolean = $derived(this.activePower === Power.Rift)

    riftablePieces: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseDimensionalRift || !this.myPlayer) return []
        const origins = legalRiftsFor(this.gameState.board, this.myPlayer.id).map(
            (move) => move.from
        )
        return origins.filter(
            (origin, index) =>
                origins.findIndex((other) => sameCoordinates(other, origin)) === index
        )
    })

    riftFrom: AxialCoordinates | undefined = $derived(
        this.choosingRift ? this.validOrigin(this.riftablePieces) : undefined
    )

    riftHexes: AxialCoordinates[] = $derived.by(() => {
        if (!this.choosingRift) return []
        return this.riftFrom
            ? riftDestinationsFrom(this.gameState.board, this.riftFrom)
            : this.riftablePieces
    })

    private async onRiftClick(coords: AxialCoordinates) {
        const from = this.riftFrom
        if (
            from &&
            riftDestinationsFrom(this.gameState.board, from).some((target) =>
                sameCoordinates(target, coords)
            )
        ) {
            await this.useDimensionalRift(from, coords)
            return
        }
        this.toggleOrigin(coords, this.riftablePieces)
    }

    async useDimensionalRift(from: AxialCoordinates, to: AxialCoordinates) {
        if (!this.canUseDimensionalRift) return

        const action = this.createPlayerAction(UseDimensionalRift, { from, to })
        this.resetAction()
        await this.applyAction(action)
    }

    // Spoofed Orders: a rival's piece beside one of the player's own, then the empty hex beside
    // it to send it into.
    canUseSpoofedOrders: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseSpoofedOrders)
    )

    choosingSpoof: boolean = $derived(this.activePower === Power.Spoof)

    spoofablePieces: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseSpoofedOrders || !this.myPlayer) return []
        return spoofablePieces(this.gameState.board, this.myPlayer.id)
    })

    spoofFrom: AxialCoordinates | undefined = $derived(
        this.choosingSpoof ? this.validOrigin(this.spoofablePieces) : undefined
    )

    spoofHexes: AxialCoordinates[] = $derived.by(() => {
        if (!this.choosingSpoof) return []
        return this.spoofFrom
            ? destinationsFrom(this.gameState.board, this.spoofFrom)
            : this.spoofablePieces
    })

    private async onSpoofClick(coords: AxialCoordinates) {
        const from = this.spoofFrom
        if (
            from &&
            destinationsFrom(this.gameState.board, from).some((target) =>
                sameCoordinates(target, coords)
            )
        ) {
            await this.useSpoofedOrders(from, coords)
            return
        }
        this.toggleOrigin(coords, this.spoofablePieces)
    }

    async useSpoofedOrders(from: AxialCoordinates, to: AxialCoordinates) {
        if (!this.canUseSpoofedOrders) return

        const action = this.createPlayerAction(UseSpoofedOrders, { from, to })
        this.resetAction()
        await this.applyAction(action)
    }

    // Conscription: one click takes back what this turn's draft threw out of the game.
    canUseConscription: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseConscription)
    )

    async useConscription() {
        if (!this.canUseConscription) return

        const action = this.createPlayerAction(UseConscription, {})
        this.resetAction()
        await this.applyAction(action)
    }

    // Colony Ship: chosen from the panel, then one of the planets the player controls.
    canUseColonyShip: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseColonyShip)
    )

    choosingColony: boolean = $derived(this.activePower === Power.Colony)

    settleablePlanets: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseColonyShip || !this.myPlayer) return []
        return settleablePlanets(this.gameState, this.myPlayer.id)
    })

    async useColonyShip(planet: AxialCoordinates) {
        if (!this.canUseColonyShip) return

        const action = this.createPlayerAction(UseColonyShip, { planet })
        this.resetAction()
        await this.applyAction(action)
    }

    // Factory Override: one click draws two more ships into the hand.
    canUseFactoryOverride: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseFactoryOverride)
    )

    async useFactoryOverride() {
        if (!this.canUseFactoryOverride) return

        const action = this.createPlayerAction(UseFactoryOverride, {})
        this.resetAction()
        await this.applyAction(action)
    }

    // Asteroid Field: chosen from the panel, then one of three ships to build three of.
    canUseAsteroidField: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseAsteroidField)
    )

    choosingAsteroid: boolean = $derived(this.activePower === Power.Asteroid)

    // The choice is made and being applied: no power is in progress while the session is busy,
    // but the cards stay for the choice to play out on them (AsteroidChoices), until the state
    // moves on.
    private asteroidCardsHeld: boolean = $state(false)

    // The ships an Asteroid Field could build, as they would look in hand.
    asteroidShips: { choice: StowChoice; piece: Piece }[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId || !(this.choosingAsteroid || this.asteroidCardsHeld)) return []
        return Object.values(StowChoice).map((choice) => ({
            choice,
            piece: { id: `asteroid-${choice}`, playerId, ...stowedShipKind(choice) }
        }))
    })

    async useAsteroidField(choice: StowChoice) {
        if (!this.canUseAsteroidField) return

        const action = this.createPlayerAction(UseAsteroidField, { choice })
        this.asteroidCardsHeld = true
        this.resetAction()
        try {
            await this.applyAction(action)
        } catch (error) {
            this.asteroidCardsHeld = false
            throw error
        }
    }

    // Security Breach: chosen from the panel, then the opponent whose bag takes the Scrap.
    canUseSecurityBreach: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseSecurityBreach)
    )

    choosingBreach: boolean = $derived(this.activePower === Power.Breach)

    breachTargets: string[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId || !this.choosingBreach) return []
        return this.gameState.players
            .map((player) => player.playerId)
            .filter((candidate) => candidate !== playerId)
    })

    async useSecurityBreach(targetPlayerId: string) {
        if (!this.canUseSecurityBreach) return

        const action = this.createPlayerAction(UseSecurityBreach, { targetPlayerId })
        this.resetAction()
        await this.applyAction(action)
    }

    // The ship drawn with a tile, waiting to follow it onto the board.
    tileShip: Piece | undefined = $derived.by(() => {
        const pieceId = this.gameState.bonusPlacementPieceId
        return pieceId ? this.gameState.heldPieces.find((piece) => piece.id === pieceId) : undefined
    })

    // Beyond the Frontier: one click draws the tile and its ship; the tile is then laid.
    canUseBeyondTheFrontier: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseBeyondTheFrontier)
    )

    async useBeyondTheFrontier() {
        if (!this.canUseBeyondTheFrontier || !this.canChoose) return

        const action = this.createPlayerAction(UseBeyondTheFrontier, {})
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

    travelableShips: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseTradeRouteWormhole || !this.myPlayer) return []
        return wormholableShips(this.gameState.board, this.myPlayer.id)
    })

    wormholeExits(from: AxialCoordinates): AxialCoordinates[] {
        const playerId = this.myPlayer?.id
        if (!playerId) return []
        return wormholeDestinations(this.gameState.board, from, playerId)
    }

    wormholeFrom: AxialCoordinates | undefined = $derived(
        this.choosingWormhole ? this.validOrigin(this.travelableShips) : undefined
    )

    wormholeHexes: AxialCoordinates[] = $derived.by(() => {
        if (!this.choosingWormhole) return []
        return this.wormholeFrom ? this.wormholeExits(this.wormholeFrom) : this.travelableShips
    })

    private async onWormholeClick(coords: AxialCoordinates) {
        const from = this.wormholeFrom
        if (from && this.wormholeExits(from).some((exit) => sameCoordinates(exit, coords))) {
            await this.useTradeRouteWormhole(from, coords)
            return
        }
        this.toggleOrigin(coords, this.travelableShips)
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
            }))
        )
    })

    isHighlighted(coords: AxialCoordinates): boolean {
        return this.highlightedHexes.some((candidate) => sameCoordinates(candidate, coords))
    }

    prompt: string = $derived.by(() => {
        if (!this.isMyTurn) {
            const picker = this.eventPicker
            if (picker && this.eventName) {
                return this.gameState.pendingEvent?.order
                    ? `${this.eventName} — ${this.playerName(picker)} is picking.`
                    : `${this.eventName} — ${this.playerName(picker)} is setting the order of picks.`
            }
            if (this.isOpening) {
                const opener = this.gameState.activePlayerIds[0]
                if (!opener) return 'The opening.'
                return this.isStowing
                    ? `The opening — ${this.playerName(opener)} is stowing an extra ship in their bag.`
                    : `The opening — ${this.playerName(opener)} is placing their free station.`
            }
            return 'Waiting for the other players.'
        }
        if (this.isStowing) {
            return 'The opening — choose one extra ship to stow in your bag, unseen by the other players. Then you place your free station.'
        }
        if (this.isOpening) {
            return 'The opening — place your free station on any open hex. It scores nothing now; later stations that join it will.'
        }
        if (this.isSeeding) {
            return this.seedingHexes.length > 0
                ? 'Your nebula seeder may lay nebula on an empty hex beside it — click the hex, or leave it.'
                : 'Your nebula seeders have nowhere left to lay.'
        }
        if (this.canFoundPlanet) {
            return 'Choose the color of your new planet.'
        }
        if (this.isChoosingEventOrder) {
            return this.canConfirmEventOrder
                ? `${this.eventName} — you pick first. Confirm the order, or Undo to change it.`
                : `${this.eventName} — you pick first. Click the others in the order they follow.`
        }
        if (this.isPickingEvent) {
            switch (this.eventKind) {
                case TechnologyEffectKind.OrbitalBombardment:
                    return 'Orbital Targeting — click an enemy probe or fighter to destroy.'
                case TechnologyEffectKind.WormholeStorm:
                    return this.stormFrom
                        ? 'Wormhole Storm — click an empty hex beside a planet to set it down.'
                        : 'Wormhole Storm — click one of your pieces to move.'
                case TechnologyEffectKind.SalvageRights:
                    return 'Salvage Rights — choose a discarded technology to gain.'
                case TechnologyEffectKind.SignalIntercept:
                    return 'Signal Intercept — click an explored planet to take its technology.'
                case TechnologyEffectKind.ShipyardWorld:
                    return 'Shipyard World — choose a unit from the alien stock.'
            }
        }
        if (this.canTerraform) {
            return this.terraformPlanet
                ? "Your terraformer may change this planet's color — choose the new color, or leave it as it is."
                : 'Your terraformer may change one planet beside it — click the planet, or leave them as they are.'
        }
        // The survey prompt is a sentence with its buttons inside it, written by the panel.
        if (this.choosablePlanets.length > 0) return ''
        if (this.technologyChoices.length > 0) {
            return this.technologyChoices.length > 1 && this.technologyChoices.every(isElevated)
                ? 'Two elevated technologies — choose which one this planet holds.'
                : 'Choose the technology this planet will hold.'
        }
        if (this.attackTargets.length > 0) {
            if (this.torpedoPending) {
                return 'Your torpedo is down — click the station it strikes. Both leave the game.'
            }
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
                : 'Full Torpedo Spread — click the neighbors to hit. A spread needs at least two.'
        }
        if (this.choosingDownload) {
            if (this.downloadFrom) {
                return 'Immediate Download — click a planet within three hexes of that one to take its technology.'
            }
            return this.downloadAnchors.length === 0
                ? 'None of your Download planets has a technology you could take within three hexes.'
                : 'Immediate Download — click the planet holding your Download.'
        }
        if (this.choosingWormhole) {
            if (this.wormholeFrom) {
                return 'Trade Route Wormhole — click where it comes out. Click your own ship again to change it.'
            }
            return this.travelableShips.length === 0
                ? 'None of your ships beside a planet has a route to travel.'
                : 'Trade Route Wormhole — click one of your highlighted ships to send it.'
        }
        if (this.choosingRift) {
            return this.riftFrom
                ? 'Dimensional Rift — click a highlighted empty hex on the border for it to come out on; it counts as newly placed there. Click your piece again to change it.'
                : 'Dimensional Rift — click one of your highlighted pieces on the border of the map.'
        }
        if (this.choosingWarp) {
            return this.warpFrom
                ? 'Warp Drive — click any highlighted empty hex for it to come out on; it counts as newly placed there. Click your piece again to change it.'
                : 'Warp Drive — click one of your highlighted pieces to send it through empty space.'
        }
        if (this.choosingShift) {
            return this.shiftFrom
                ? 'Tactical Shift — click the empty hex beside it to step into; it counts as newly placed there. Click your piece again to change it.'
                : 'Tactical Shift — click one of your highlighted pieces to move it one hex.'
        }
        if (this.choosingAsteroid) {
            return 'Asteroid Field — choose the ship to build: three of it go into your bag, unseen by the other players.'
        }
        if (this.choosingBreach) {
            return 'Security Breach — choose the opponent whose bag takes the Scrap.'
        }
        if (this.choosingSpoof) {
            return this.spoofFrom
                ? "Spoofed Orders — click the empty hex beside it to send it into. Click the rival's piece again to change it."
                : "Spoofed Orders — click a highlighted rival's piece beside one of yours to send it one hex."
        }
        if (this.choosingFeint) {
            if (this.feintFrom) {
                return 'Tactical Feint — click the enemy ship to trade places with. Click your own ship again to change it.'
            }
            return this.feintableShips.length === 0
                ? 'None of your ships has an enemy beside it.'
                : 'Tactical Feint — click one of your highlighted ships to swap it with a neighbor.'
        }
        if (this.choosingColony) {
            return 'Colony Ship — click one of your highlighted planets to settle it. It counts as one of your stations from then on.'
        }
        if (this.choosingUpdatedLogistics) {
            return this.wakeableFighters.length === 0
                ? 'None of your fighters has anything in reach.'
                : 'Updated Logistics — click one of your highlighted fighters to attack with it.'
        }
        if (this.isPlacingTile) {
            return this.tileOrigins.length === 0
                ? 'No room for the tile turned this way — rotate it.'
                : `${TECHNOLOGY_EFFECT_INFO[TechnologyEffectKind.GrowBoard].name} grows the map — ${this.tileShip ? `you drew a ${describePiece(this.tileShip)} to place on the new tile. Rotate` : 'rotate'} the tile if you like, then lay it.`
        }
        if (this.bonusPlacementHexes.length > 0) {
            const piece = this.drawnPiece
            return piece
                ? `Place your ${describePiece(piece)} on the new tile.`
                : 'Place the drawn ship on the new tile.'
        }
        if (this.isDrifting) {
            return this.movingFrom
                ? 'Choose where it steps, or hold position.'
                : 'Step one of your pieces one hex, or hold position.'
        }
        if (this.canEndTurn) {
            return 'Your ships are placed — use a technology while it can still act, or end your turn.'
        }
        if (this.canDraw) {
            return `Click the bag to draw ${this.drawCount} ${this.drawCount === 1 ? 'ship' : 'ships'}.`
        }
        if (this.isDiscarding) {
            // The draft comes before everything else in the turn. A Deep Scanner's extra ship
            // leaves a second discard to make; under Global Recycling the discard is not lost.
            const again = this.turnHand.some((card) => !card.held)
            const discard = `${again ? 'Now discard one more' : 'First, discard one'} of your drawn cards`
            if (ruleInForce(this.gameState.board, TechnologyEffectKind.Reinforcements)) {
                return this.canUseLogisticsUpgrade
                    ? `${discard} back into your bag, or use Logistics Upgrade to keep them all.`
                    : `${discard} back into your bag.`
            }
            return this.canUseLogisticsUpgrade
                ? `${discard} from the game, or use Logistics Upgrade to keep them all.`
                : `${discard} from the game.`
        }
        if (this.isPlacing) {
            const piece = this.pieceToPlace
            const hasSpecial = (this.myPlayerState?.specialPieces.length ?? 0) > 0
            const orSpecial =
                hasSpecial && this.canPlaySpecial ? ', or play a special piece instead' : ''
            if (!piece) {
                return this.heldPieces.length > 1
                    ? `Place ${this.heldChoice()}${orSpecial}.`
                    : 'Nothing to place.'
            }
            if (this.hexesClosedToMe.length > 0) {
                return piece.type === PieceType.Probe
                    ? `Place your ${describePiece(piece)}. The red hexes are closed to it.`
                    : `Place your ${describePiece(piece)}. The red hexes are closed to your ships.`
            }
            if (this.chosenSpecialId) {
                return `Place your ${describePiece(piece)} — your draw goes back in the bag.`
            }
            if (this.torpedoArmed) {
                return 'Gamma Torpedo armed — place the fighter beside a station to destroy them both.'
            }
            if (orSpecial) return `Place your ${describePiece(piece)}${orSpecial}.`
            return this.canArmTorpedo
                ? `Place your ${describePiece(piece)}, or arm the Gamma Torpedo first.`
                : `Place your ${describePiece(piece)}.`
        }
        return ''
    })

    // The ships in hand as a choice: "your station or your probe", "one of your fighters",
    // "your station, your probe or one of your fighters".
    private heldChoice(): string {
        const counts = new Map<string, number>()
        for (const piece of this.heldPieces) {
            const name = describePiece(piece)
            counts.set(name, (counts.get(name) ?? 0) + 1)
        }
        const parts = [...counts.entries()].map(([name, count]) =>
            count > 1 ? `one of your ${name}s` : `your ${name}`
        )
        if (parts.length <= 1) return parts[0] ?? 'a ship'
        return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`
    }

    async place(coords: AxialCoordinates) {
        if (!this.isPlacing) return

        const specialId = this.chosenSpecialId
        const pieceId = specialId ?? this.pinnedHeldId ?? this.drawnPiece?.id
        const torpedo = this.torpedoArmed
        const action = this.createPlayerAction(PlacePiece, {
            type: ActionType.PlacePiece,
            coords,
            pieceSource: specialId ? PieceSource.Special : PieceSource.Bag,
            ...(pieceId ? { pieceId } : {}),
            ...(torpedo ? { torpedo } : {})
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

    // A Scrap is played from the hand with one click: it turns over and is gone.
    async playScrap(pieceId: string) {
        if (!this.isMyTurn || !this.validActionTypes.includes(ActionType.PlayScrap)) return

        const action = this.createPlayerAction(PlayScrap, { pieceId })
        this.resetAction()
        await this.applyAction(action)
    }

    // The Rules pills: on unless the player has turned them off, remembered in this browser.
    rulesHelpShown: boolean = $state(readRulesHelpShown())

    toggleRulesHelp() {
        this.rulesHelpShown = !this.rulesHelpShown
        try {
            localStorage.setItem(RULES_HELP_KEY, this.rulesHelpShown ? 'on' : 'off')
        } catch {
            // Storage may be unavailable (a private window, blocked site data): the choice then
            // lasts for this visit alone.
        }
    }

    // The note for the decision in front of the player, while the Rules pills are on.
    rulesHelp: RulesHelp | undefined = $derived.by(() => {
        if (!this.rulesHelpShown || !this.isMyTurn) return undefined
        const placing = this.isPlacing
        return rulesHelpFor({
            stowing: this.isStowing,
            openingStation: this.isOpening && !this.isStowing,
            drawing: this.canDraw,
            choosingEventOrder: this.isChoosingEventOrder,
            event: this.isPickingEvent ? this.eventKind : undefined,
            layingTile: this.isPlacingTile,
            drifting: this.isDrifting,
            seeding: this.isSeeding,
            founding: this.canFoundPlanet,
            terraforming: this.canTerraform,
            surveying: this.choosablePlanets.length > 0,
            choosingTechnology: this.technologyChoices.length > 0,
            torpedoStrike: this.torpedoPending,
            attacking: this.attackTargets.length > 0,
            discarding: this.isDiscarding,
            power: this.activePower,
            placing,
            piece: placing ? this.pieceToPlace : undefined,
            tileShip: placing && this.bonusPlacementHexes.length > 0,
            endingTurn: this.canEndTurn
        })
    })

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

        if (this.isPickingEvent) {
            await this.onEventClick(coords)
            return
        }
        if (this.isSeeding) {
            if (this.seedingHexes.some((hex) => sameCoordinates(hex, coords))) {
                await this.seedNebula(coords)
            }
            return
        }

        switch (this.activePower) {
            case Power.Shift:
                await this.onShiftClick(coords)
                return
            case Power.Warp:
                await this.onWarpClick(coords)
                return
            case Power.Rift:
                await this.onRiftClick(coords)
                return
            case Power.Spoof:
                await this.onSpoofClick(coords)
                return
            case Power.Feint:
                await this.onFeintClick(coords)
                return
            case Power.Wormhole:
                await this.onWormholeClick(coords)
                return
            case Power.Download:
                await this.onDownloadClick(coords)
                return
            case Power.Colony:
                if (this.settleablePlanets.some((planet) => sameCoordinates(planet, coords))) {
                    await this.useColonyShip(coords)
                }
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
            case Power.Torpedo:
                if (this.isHighlighted(coords)) {
                    if (touch && !this.isPreviewing(coords)) {
                        this.select('preview', coords)
                        return
                    }
                    await this.place(coords)
                }
                return
        }

        if (this.isPlacingTile) {
            await this.onTileOriginClick(coords, touch)
            return
        }

        if (this.isDrifting) {
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

        if (this.canTerraform) {
            this.toggleOrigin(coords, this.terraformPlanets.length > 1 ? this.terraformPlanets : [])
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

    override beforeNewState(transition: PresentedTransition) {
        this.resetAction()
        this.asteroidCardsHeld = false
        this.stowRevealDue = transition.kind === 'own-action' || transition.kind === 'other-action'
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
            case Power.Shift:
                return this.shiftablePieces
            case Power.Warp:
                return this.warpablePieces
            case Power.Rift:
                return this.riftablePieces
            case Power.Spoof:
                return this.spoofablePieces
            case Power.Feint:
                return this.feintableShips
            case Power.Wormhole:
                return this.travelableShips
            case Power.Download:
                return this.downloadAnchors
            default:
                return []
        }
    }

    private isPowerAvailable(power: Power): boolean {
        switch (power) {
            case Power.Shift:
                return this.canUseTacticalShift
            case Power.Warp:
                return this.canUseWarpDrive
            case Power.Rift:
                return this.canUseDimensionalRift
            case Power.Spoof:
                return this.canUseSpoofedOrders
            case Power.Asteroid:
                return this.canUseAsteroidField
            case Power.Breach:
                return this.canUseSecurityBreach
            case Power.Feint:
                return this.canUseTacticalFeint
            case Power.Wormhole:
                return this.canUseTradeRouteWormhole
            case Power.Download:
                return this.canUseImmediateDownload
            case Power.Colony:
                return this.canUseColonyShip
            case Power.Logistics:
                return this.canUseUpdatedLogistics
            case Power.Spread:
                return this.canSpread
            case Power.Railgun:
                return this.canArmRailgun
            case Power.Torpedo:
                return this.canArmTorpedo
        }
    }
}
