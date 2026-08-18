import type { AxialCoordinates } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    ChoosePlanet,
    ChooseTechnology,
    AttackPiece,
    destinationsFrom,
    AttackOutcome,
    attackOutcome,
    canUseCooldownEffect,
    DiscardPiece,
    drawCountForPlayer,
    DrawPieces,
    TechnologyEffectKind,
    turnsUntilReady,
    attackableTargets,
    explorablePlanets,
    technologyName,
    UseUpdatedLogistics,
    AttackSpread,
    controllerOf,
    planetCoordinates,
    neighborsOf,
    type EarendelGameState,
    type HydratedEarendelGameState,
    type HydratedEarendelPlayerState,
    getHex,
    hexesClosedToProbesOf,
    hexKey,
    isElevated,
    isOpenHex,
    legalMovesFor,
    legalPlacementsFor,
    legalTilePlacements,
    MovePiece,
    openHexesOfTile,
    PlaceTile,
    tileFootprint,
    UseLogisticsUpgrade,
    TILE_ROTATIONS,
    type Piece,
    PieceSource,
    PieceType,
    PlacePiece,
    type PlanetColor,
    sameHex,
    type SightLine,
    sightLines,
    type TechnologyCard
} from '@tabletop/earendel'

export class EarendelGameSession extends GameSession<
    EarendelGameState,
    HydratedEarendelGameState
> {
    // A planet whose technology the player has clicked to keep open. Hovering shows one
    // too; pinning is for reading it without holding the mouse still.
    pinnedPlanet: AxialCoordinates | undefined = $state(undefined)

    // The piece the player has picked up to move, while resolving a technology. Two clicks:
    // choose the piece, then where it steps.
    movingFrom: AxialCoordinates | undefined = $state(undefined)

    // A special piece the player has picked up and is about to place instead of their draw.
    // Held here rather than in game state because until it lands it is only an intention.
    chosenSpecialId: string | undefined = $state(undefined)

    // Which of the ships in hand the player has picked up to place. Only a decision when the
    // hand has more than one, which is what a drafted turn leaves.
    chosenHeldId: string | undefined = $state(undefined)

    myPlayerState: HydratedEarendelPlayerState | undefined = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return playerId ? this.gameState.findPlayerState(playerId) : undefined
    })

    heldPieces: Piece[] = $derived(this.gameState.heldPieces)

    // The ship a click on the board would place: the one picked up, or the only one held.
    drawnPiece: Piece | undefined = $derived.by(() => {
        const held = this.gameState.heldPieces
        if (held.length === 0) return undefined
        if (held.length === 1) return held[0]
        return held.find((piece) => piece.id === this.chosenHeldId)
    })

    // Set while this player owes a discard, at the opening of a drafted turn.
    isDiscarding: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.DiscardPiece)
    )

    // Set while this player's turn is open but nothing has been drawn. Nothing is revealed
    // until they ask, which is what leaves the player before them time to undo.
    canDraw: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.DrawPieces)
    )

    // How many ships this turn will draw, so the button can say so.
    drawCount: number = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId) return 0
        return drawCountForPlayer(this.gameState, playerId, this.primaryGame.config)
    })

    // Armed for the next shot. Held here rather than in game state because until the target is
    // clicked it is only an intention.
    railgunArmed: boolean = $state(false)

    canArmRailgun: boolean = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId || this.attackTargets.length === 0) return false
        return canUseCooldownEffect(this.gameState, playerId, TechnologyEffectKind.Railgun)
    })

    // The targets a Railgun would actually change: the ones a plain shot would only wear down.
    // Anything else in reach dies to an ordinary shot, so spending a three-turn power on it buys
    // nothing - and the engine refuses it rather than letting it be wasted.
    railgunTargets: AxialCoordinates[] = $derived.by(() => {
        const pending = this.gameState.pendingAttack
        if (!pending || this.attackTargets.length === 0) return []

        const attacker = getHex(this.gameState.board, pending.fighterCoords)?.piece
        if (!attacker) return []

        return this.attackTargets.filter((coords) => {
            const target = getHex(this.gameState.board, coords)?.piece
            return target !== undefined && attackOutcome(attacker, target) === AttackOutcome.Damaged
        })
    })

    railgunWouldMatter(coords: AxialCoordinates): boolean {
        return this.railgunTargets.some((target) => sameHex(target, coords))
    }

    // Turns of this player's own that a power still has to sit out, for the panel.
    railgunTurnsLeft: number = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId) return 0
        return turnsUntilReady(this.gameState, playerId, TechnologyEffectKind.Railgun)
    })

    // Whether a Logistics Upgrade could be spent right now, in place of discarding.
    canUseLogisticsUpgrade: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseLogisticsUpgrade)
    )

    storedEffectCount(kind: TechnologyEffectKind): number {
        return (this.myPlayerState?.storedEffects ?? []).filter((stored) => stored === kind).length
    }

    // While a laid tile owes a ship, only that ship may be placed - so the rest of the hand is
    // not selectable.
    private get pinnedHeldId(): string | undefined {
        return this.gameState.bonusPlacementPieceId
    }

    // The piece that would land if the player clicked a hex right now.
    // The ship owed after a tile is laid is the one drawn with it - a special piece is not an
    // alternative there, so the choice isn't offered.
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

    // Asked of the engine rather than matched against a list of machine states. More than one
    // state permits a placement - the ordinary turn, and the ship owed after a tile is laid -
    // and hard-coding them meant the board highlighted hexes it then refused to act on.
    isPlacing: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.PlacePiece)
    )

    // Planets this probe could explore, when more than one was in reach. Empty at every other
    // moment - the engine settles a lone candidate itself.
    choosablePlanets: AxialCoordinates[] = $derived.by(() => {
        const pending = this.gameState.pendingExploration
        if (!this.isMyTurn || !pending || pending.exploringPlanet) return []
        return pending.playerId === this.myPlayer?.id ? pending.candidatePlanets : []
    })

    // The revealed cards to choose between, once the planet is settled.
    technologyChoices: TechnologyCard[] = $derived.by(() => {
        const pending = this.gameState.pendingExploration
        if (!this.isMyTurn || !pending?.exploringPlanet) return []
        if (pending.playerId !== this.myPlayer?.id) return []
        return pending.candidates ?? []
    })

    // The technologies already spent, grouped by what they DO rather than listed card by card.
    // Two cards with the same effect differ only in which planet colours they match, and a flat
    // list of twenty is not something a player reads mid-turn - whereas "three Railguns gone"
    // is. The colours are kept alongside each group, since they are about to mean something (a
    // colour will stand for a concept - military, economic - rather than being decoration).
    //
    // Sorted by count and then name, so the pile has a stable order and does not reshuffle under
    // the cursor as it grows.
    discardedTechnologies: { name: string; count: number; colors: string[] }[] = $derived.by(() => {
        const groups = new Map<string, { name: string; count: number; colors: Set<string> }>()

        for (const card of this.gameState.technologyDiscard ?? []) {
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

    // What is left to be turned over. Shown beside the discard because the two together say how
    // much of the deck is still unknown - and the deck is reshuffled from the discard when it
    // runs dry, so neither number means much without the other.
    technologyDeckCount: number = $derived(this.gameState.technologyDeck?.length ?? 0)

    // The cards turned over on the way to this exploration's choice that are NOT part of it: a
    // probe on a red planet keeps drawing until it has enough reds, and everything that came up
    // without red is set aside.
    //
    // Kept out of the choice row on purpose - they are not choices, and mixing them in buried the
    // real ones - but they are worth being able to look at. They say what has just left the deck,
    // and once a colour stands for a concept rather than being decoration, "you turned over three
    // military cards looking for an economic one" is a real read on what is left.
    setAsideCards: TechnologyCard[] = $derived.by(() => {
        const pending = this.gameState.pendingExploration
        if (!pending?.revealed) return []

        const choosable = new Set((pending.candidates ?? []).map((card) => card.id))
        return pending.revealed.filter((card) => !choosable.has(card.id))
    })

    // Which probe is choosing, and between which planets. Only while the choice is this
    // player's - the arrows are an invitation to click, not a report.
    explorationChoice: { from: AxialCoordinates; to: AxialCoordinates[] } | undefined = $derived.by(
        () => {
            const pending = this.gameState.pendingExploration
            if (this.choosablePlanets.length === 0 || !pending) return undefined
            return { from: pending.probeCoords, to: this.choosablePlanets }
        }
    )

    // Which fighter is firing, and at what. Only while the shot is this player's.
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

    // Every station pair projecting a blockade, whoever owns it. Drawn for everyone, since a
    // corridor you can't see is a rule you can only discover by being refused.
    sightLines: SightLine[] = $derived(sightLines(this.gameState.board))

    // Hexes this player's probes are shut out of. Only meaningful while holding a probe, so
    // the board isn't cluttered with a restriction that doesn't apply to the piece in hand.
    hexesClosedToMe: AxialCoordinates[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!playerId || this.pieceToPlace?.type !== PieceType.Probe) return []
        return hexesClosedToProbesOf(this.gameState.board, playerId)
    })

    // Set while this player has a tile to lay.
    isPlacingTile: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.PlaceTile)
    )

    // The tile waiting to be laid, so the board can show what is about to land.
    pendingTile = $derived(this.gameState.pendingTile?.tile)

    // How far the tile in hand is turned. A tile may be laid any of six ways, and the
    // rhombus's half-turn symmetry means two of those cover the same hexes with the planet in
    // opposite corners - so turning is worth doing even when the outline doesn't move.
    tileRotation: number = $state(0)

    private allTilePlacements = $derived(
        this.isPlacingTile ? legalTilePlacements(this.gameState.board) : []
    )

    // Where this tile could go at its current rotation.
    tileOrigins: AxialCoordinates[] = $derived(
        this.allTilePlacements
            .filter((placement) => placement.rotation === this.tileRotation)
            .map((placement) => placement.origin)
    )

    // The hex the cursor is over while laying a tile, so its footprint can be previewed.
    tilePreviewOrigin: AxialCoordinates | undefined = $state(undefined)

    tilePreviewHexes: AxialCoordinates[] = $derived(
        this.tilePreviewOrigin ? tileFootprint(this.tilePreviewOrigin, this.tileRotation) : []
    )

    rotateTile(step = 1) {
        this.tileRotation = (this.tileRotation + step + TILE_ROTATIONS) % TILE_ROTATIONS
        this.tilePreviewOrigin = undefined
    }

    // Set while the ship that follows a laid tile is owed, which may only land on that tile.
    bonusPlacementHexes: AxialCoordinates[] = $derived.by(() => {
        const tileId = this.gameState.bonusPlacementTileId
        if (!tileId || !this.isMyTurn) return []
        return openHexesOfTile(this.gameState.board, tileId)
    })

    // Set while a technology's immediate effect is waiting on this player.
    isMovingForTechnology: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.MovePiece)
    )

    // The pieces that could be stepped, or - once one is picked up - where it can go.
    movableHexes: AxialCoordinates[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.isMovingForTechnology || !playerId) return []

        if (this.movingFrom) return destinationsFrom(this.gameState.board, this.movingFrom)

        const moves = legalMovesFor(this.gameState.board, playerId)
        return moves.map((move) => move.from)
    })

    // What the board should invite a click on right now. One list keeps the board component
    // from having to know which decision is outstanding.
    highlightedHexes: AxialCoordinates[] = $derived.by(() => {
        // Choosing a fighter to wake takes precedence over the placement it interrupts: while the
        // question is "which fighter", the board should offer fighters and nothing else.
        if (this.choosingUpdatedLogistics) return this.wakeableFighters
        if (this.isPlacingTile) return this.tileOrigins
        if (this.bonusPlacementHexes.length > 0) return this.bonusPlacementHexes
        if (this.isMovingForTechnology) return this.movableHexes
        if (this.choosablePlanets.length > 0) return this.choosablePlanets
        if (this.attackTargets.length > 0) return this.attackTargets
        if (!this.isPlacing || !this.pieceToPlace) return []

        const closed = this.hexesClosedToMe
        return Object.values(this.gameState.board.hexes)
            .filter((hex) => isOpenHex(this.gameState.board, hex.coords))
            .filter((hex) => !closed.some((blocked) => sameHex(blocked, hex.coords)))
            .map((hex) => hex.coords)
    })

    isClosedToMe(coords: AxialCoordinates): boolean {
        return this.hexesClosedToMe.some((blocked) => sameHex(blocked, coords))
    }

    // Where a fighter about to be placed could shoot, shown before it lands so the placement
    // can be aimed rather than discovered.
    previewTargetsFor(coords: AxialCoordinates): AxialCoordinates[] {
        const piece = this.pieceToPlace
        if (!piece || piece.type !== PieceType.Fighter || !this.isPlacing) return []

        // Answered against a copy with the piece already standing there, so this is the
        // engine's own rule rather than a second implementation of it.
        const board = structuredClone($state.snapshot(this.gameState.board))
        const hex = board.hexes[hexKey(coords)]
        if (!hex) return []
        hex.piece = piece
        return attackableTargets(board, coords, piece.playerId)
    }

    // Which planets a probe would explore if it landed here - the same question
    // previewTargetsFor asks about a fighter's shot, so a player can see the consequence of a
    // placement before committing to it rather than discovering it afterwards.
    //
    // Unlike the fighter's, this needs no hypothetical board: whether a planet is explorable
    // depends on the planet and on the probe's own type, not on anything the probe changes by
    // arriving. It is asked of the engine's own rule all the same.
    previewExplorablesFor(coords: AxialCoordinates): AxialCoordinates[] {
        const piece = this.pieceToPlace
        if (!piece || piece.type !== PieceType.Probe || !this.isPlacing) return []
        return explorablePlanets(this.gameState.board, coords, piece.type)
    }

    // Full Torpedo Spread. Available only with more than one piece in reach, matching the engine:
    // on a single target a spread is an ordinary shot, and spending three turns on that is a trap
    // rather than a choice.
    canSpread: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.AttackSpread)
    )

    // Which targets the player has picked so far. Purely local until they confirm - "any or all"
    // means this is a subset being assembled, and nothing is sent while it is being changed.
    spreadTargets: AxialCoordinates[] = $state([])
    spreading: boolean = $state(false)

    isSpreadTarget(coords: AxialCoordinates): boolean {
        return this.spreadTargets.some((target) => sameHex(target, coords))
    }

    toggleSpreading() {
        this.spreading = !this.spreading
        // Leaving the mode throws the selection away rather than keeping it warm: a half-built
        // volley that survives being cancelled is a trap waiting for the next click.
        if (!this.spreading) this.spreadTargets = []
    }

    toggleSpreadTarget(coords: AxialCoordinates) {
        this.spreadTargets = this.isSpreadTarget(coords)
            ? this.spreadTargets.filter((target) => !sameHex(target, coords))
            : [...this.spreadTargets, coords]
    }

    // Two is the floor, and it is the engine's rule rather than this component's - a spread of one
    // is refused outright there.
    get canConfirmSpread(): boolean {
        return this.spreading && this.spreadTargets.length > 1
    }

    async confirmSpread() {
        if (!this.canConfirmSpread) return

        const action = this.createPlayerAction(AttackSpread, {
            targets: $state.snapshot(this.spreadTargets)
        })
        this.spreading = false
        this.spreadTargets = []
        await this.applyAction(action)
    }

    // Planets where a claim is ticking: someone holds it outright, it holds a technology, and
    // they don't have that technology yet - so it becomes theirs at the start of their next turn
    // unless somebody breaks the hold first.
    //
    // Derived from the board rather than stored, because that is exactly what the rule is: there
    // is no timer in state to read, only "who holds this right now", asked freshly. Which also
    // means this cannot drift out of step with what the engine will actually pay out.
    pendingClaims: { coords: AxialCoordinates; playerId: string }[] = $derived.by(() => {
        const held = new Map(
            this.gameState.players.map((player) => [player.playerId, player.technologies])
        )

        return planetCoordinates(this.gameState.board)
            .map((coords) => {
                const hex = getHex(this.gameState.board, coords)
                if (!hex?.technology) return undefined
                // The RECORDED controller, not dominance recomputed from the board: control is
                // sticky, so an incumbent who has merely been drawn level still holds the planet
                // and their timer is still running.
                const playerId = controllerOf(this.gameState, coords)
                if (!playerId) return undefined
                if ((held.get(playerId) ?? []).includes(hex.technology.id)) return undefined
                return { coords, playerId }
            })
            .filter((claim): claim is { coords: AxialCoordinates; playerId: string } => !!claim)
    })

    // Every boundary where a CONTROLLING piece meets the planet it controls: the planet, the
    // neighbouring hex the piece stands on, and whose it is.
    //
    // Only the controller's own edges, so the board shows the answer rather than the arithmetic -
    // a planet with three enemy ships around it and one of mine draws one line, not four, and
    // that line says who is winning.
    //
    // Control here is the INCLUSIVE kind, the one that pays end-game points, so a tie draws both
    // players' edges and reads as genuinely shared. That is deliberately a different question
    // from the hourglass, which tracks the strict hold a technology needs: the wiggle says who
    // scores this planet, the hourglass says who is about to take what it holds.
    controlEdges: { planet: AxialCoordinates; from: AxialCoordinates; playerId: string }[] =
        $derived.by(() => {
            const edges: { planet: AxialCoordinates; from: AxialCoordinates; playerId: string }[] =
                []

            for (const planet of planetCoordinates(this.gameState.board)) {
                // Exactly one controller now, or none. A tie no longer draws both players' lines:
                // drawing level takes nothing, so the incumbent's lines stay and the challenger
                // gets none - which is the difference between "we are equal" and "it is mine".
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

    claimOn(coords: AxialCoordinates): string | undefined {
        return this.pendingClaims.find((claim) => sameHex(claim.coords, coords))?.playerId
    }

    // Updated Logistics: whether the power is available to spend, and which of this player's
    // fighters could actually do something with it. A fighter with nothing in reach is left out,
    // since the engine refuses it rather than spending three turns on an impossible shot.
    canUseUpdatedLogistics: boolean = $derived(
        this.isMyTurn && this.validActionTypes.includes(ActionType.UseUpdatedLogistics)
    )

    // Local intent, like the Railgun's arming: pressing the button asks WHICH fighter, and the
    // board answers. Nothing is sent until one is clicked.
    choosingUpdatedLogistics: boolean = $state(false)

    wakeableFighters: AxialCoordinates[] = $derived.by(() => {
        if (!this.canUseUpdatedLogistics || !this.myPlayer) return []
        const playerId = this.myPlayer.id

        return Object.values(this.gameState.board.hexes)
            .filter((hex) => hex.piece?.playerId === playerId)
            .filter((hex) => hex.piece?.type === PieceType.Fighter)
            .map((hex) => hex.coords)
            .filter((coords) => attackableTargets(this.gameState.board, coords, playerId).length > 0)
    })

    toggleUpdatedLogistics() {
        this.choosingUpdatedLogistics = !this.choosingUpdatedLogistics
    }

    async useUpdatedLogistics(coords: AxialCoordinates) {
        if (!this.canUseUpdatedLogistics) return

        const action = this.createPlayerAction(UseUpdatedLogistics, { coords })
        this.choosingUpdatedLogistics = false
        await this.applyAction(action)
    }

    isHighlighted(coords: AxialCoordinates): boolean {
        return this.highlightedHexes.some((candidate) => sameHex(candidate, coords))
    }

    prompt: string = $derived.by(() => {
        if (this.gameState.result) return 'The game is over.'
        if (!this.isMyTurn) return 'Waiting for the other players.'
        if (this.choosablePlanets.length > 0) {
            return 'Your probe reached more than one planet — choose which one it explores.'
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
        if (this.choosingUpdatedLogistics) {
            return this.wakeableFighters.length === 0
                ? 'None of your fighters has anything in reach - press Updated Logistics again to back out.'
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

        this.chosenSpecialId = undefined
        this.chosenHeldId = undefined
        await this.applyAction(action)
    }

    async drawPieces() {
        await this.applyAction(
            this.createPlayerAction(DrawPieces, { type: ActionType.DrawPieces })
        )
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

    // Picking up one of the ships in hand. The pinned ship after a laid tile cannot be swapped
    // away from, so there is nothing to choose then.
    chooseHeld(pieceId: string) {
        if (this.pinnedHeldId) return
        this.chosenSpecialId = undefined
        this.chosenHeldId = this.chosenHeldId === pieceId ? undefined : pieceId
    }

    // Whether this held ship has anywhere legal to go, so the panel can grey out one that is
    // stuck rather than letting the player wonder why the board stays dark.
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

    async chooseTechnology(technologyId: string) {
        await this.applyAction(
            this.createPlayerAction(ChooseTechnology, {
                type: ActionType.ChooseTechnology,
                technologyId
            })
        )
    }

    toggleRailgun() {
        this.railgunArmed = !this.railgunArmed
    }

    async attack(coords: AxialCoordinates) {
        // Armed means "use it if it helps", not "use it regardless": firing on a target that dies
        // to an ordinary shot spends nothing, so the flag is dropped rather than sent and refused.
        const useRailgun = this.railgunArmed && this.railgunWouldMatter(coords)
        this.railgunArmed = false
        await this.applyAction(
            this.createPlayerAction(AttackPiece, {
                type: ActionType.AttackPiece,
                coords,
                ...(useRailgun ? { useRailgun } : {})
            })
        )
    }

    async holdFire() {
        this.railgunArmed = false
        await this.applyAction(
            this.createPlayerAction(AttackPiece, { type: ActionType.AttackPiece })
        )
    }

    // Holding position rather than stepping. Always allowed: a forced move could only hurt.
    async holdPosition() {
        this.movingFrom = undefined
        await this.applyAction(
            this.createPlayerAction(MovePiece, { type: ActionType.MovePiece })
        )
    }

    async movePiece(to: AxialCoordinates) {
        const from = this.movingFrom
        if (!from) return

        this.movingFrom = undefined
        await this.applyAction(
            this.createPlayerAction(MovePiece, { type: ActionType.MovePiece, from, to })
        )
    }

    async placeTile(coords: AxialCoordinates) {
        const rotation = this.tileRotation
        this.tilePreviewOrigin = undefined
        this.tileRotation = 0
        await this.applyAction(
            this.createPlayerAction(PlaceTile, {
                type: ActionType.PlaceTile,
                coords,
                rotation
            })
        )
    }

    async onBoardClick(coords: AxialCoordinates) {
        if (this.busy) return

        // Answered before anything else, for the same reason it takes over the highlights: while
        // the player is picking a fighter to wake, a click means that and nothing else.
        if (this.spreading) {
            return this.spreadTargets.length > 1
                ? `Full Torpedo Spread — ${this.spreadTargets.length} targets picked. Fire, or keep choosing.`
                : 'Full Torpedo Spread — click the neighbours to hit. A spread needs at least two.'
        }
        if (this.choosingUpdatedLogistics) {
            if (this.wakeableFighters.some((fighter) => sameHex(fighter, coords))) {
                await this.useUpdatedLogistics(coords)
            }
            return
        }

        if (this.spreading) {
            // While a volley is being assembled a click adds or removes a target; the shot is
            // only sent by the confirm button.
            if (this.attackTargets.some((target) => sameHex(target, coords))) {
                this.toggleSpreadTarget(coords)
            }
            return
        }

        if (this.isPlacingTile) {
            if (this.tileOrigins.some((origin) => sameHex(origin, coords))) {
                await this.placeTile(coords)
            }
            return
        }

        if (this.isMovingForTechnology) {
            // Clicking the piece already picked up puts it back down, so a misclick isn't a
            // committed move.
            if (this.movingFrom && sameHex(this.movingFrom, coords)) {
                this.movingFrom = undefined
                return
            }
            if (this.movingFrom && this.movableHexes.some((hex) => sameHex(hex, coords))) {
                await this.movePiece(coords)
                return
            }
            if (legalMovesFor(this.gameState.board, this.myPlayer?.id ?? '').some((move) =>
                sameHex(move.from, coords)
            )) {
                this.movingFrom = coords
            }
            return
        }

        if (this.choosablePlanets.some((candidate) => sameHex(candidate, coords))) {
            await this.choosePlanet(coords)
            return
        }
        if (this.attackTargets.some((target) => sameHex(target, coords))) {
            await this.attack(coords)
            return
        }

        // A planet is never somewhere a ship can go, so a click on one that holds a technology
        // is only ever a request to read it.
        if (getHex(this.gameState.board, coords)?.technology) {
            this.togglePinnedPlanet(coords)
            return
        }
        // isHighlighted rather than isOpenHex, so the restriction to a newly laid tile is
        // honoured by the same list the board drew from.
        if (this.isPlacing && isOpenHex(this.gameState.board, coords) && this.isHighlighted(coords)) {
            await this.place(coords)
        }
    }

    togglePinnedPlanet(coords: AxialCoordinates) {
        this.pinnedPlanet =
            this.pinnedPlanet && sameHex(this.pinnedPlanet, coords) ? undefined : coords
    }

    // Undo the last action of the player's own that nothing has been revealed since. The
    // platform works out which action that is; a game only has to say which of its actions
    // reveal something (see revealsInfo on ChoosePlanet and PlaceTile).
    async undoLastAction() {
        this.movingFrom = undefined
        this.chosenSpecialId = undefined
        this.chosenHeldId = undefined
        this.tilePreviewOrigin = undefined
        this.railgunArmed = false
        await this.undo()
    }

    toggleSpecial(pieceId: string) {
        this.chosenSpecialId = this.chosenSpecialId === pieceId ? undefined : pieceId
    }
}

export function describePiece(piece: Piece): string {
    if (piece.hub) return 'Station Hub'
    const name = piece.type === PieceType.Probe ? 'probe' : piece.type
    return piece.level ? `level ${piece.level} ${name}` : name
}
