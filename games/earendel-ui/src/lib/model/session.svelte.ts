import type { AxialCoordinates } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    ChoosePlanet,
    ChooseTechnology,
    DestroyPiece,
    destinationsFrom,
    destroyableTargets,
    type EarendelGameState,
    type HydratedEarendelGameState,
    type HydratedEarendelPlayerState,
    getHex,
    hexesClosedToProbesOf,
    hexKey,
    isElevated,
    isOpenHex,
    legalMovesFor,
    legalTilePlacements,
    MovePiece,
    openHexesOfTile,
    PlaceTile,
    tileFootprint,
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
    // The piece the player has picked up to move, while resolving a technology. Two clicks:
    // choose the piece, then where it steps.
    movingFrom: AxialCoordinates | undefined = $state(undefined)

    // A special piece the player has picked up and is about to place instead of their draw.
    // Held here rather than in game state because until it lands it is only an intention.
    chosenSpecialId: string | undefined = $state(undefined)

    myPlayerState: HydratedEarendelPlayerState | undefined = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return playerId ? this.gameState.findPlayerState(playerId) : undefined
    })

    drawnPiece: Piece | undefined = $derived(this.gameState.drawnPiece)

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

    // Everything turned over on the way, so the player can see the flips that produced the
    // choice rather than only its result.
    revealedCards: TechnologyCard[] = $derived(
        this.gameState.pendingExploration?.revealed ?? []
    )

    // The colour of the planet being explored, so the panel can tell a card that missed the
    // colour from one that matched but was outranked by an elevated card.
    exploringPlanetColor: PlanetColor | undefined = $derived.by(() => {
        const planet = this.gameState.pendingExploration?.exploringPlanet
        return planet ? getHex(this.gameState.board, planet)?.color : undefined
    })

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
        return destroyableTargets(board, coords, piece.playerId)
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
            return 'Your fighter may destroy one adjacent piece, or hold fire.'
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
                ? 'Now choose where it steps.'
                : 'That technology moves one of your pieces — choose which.'
        }
        if (this.isPlacing) {
            const piece = this.pieceToPlace
            if (!piece) return 'Nothing to place.'
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
        const action = this.createPlayerAction(PlacePiece, {
            type: ActionType.PlacePiece,
            coords,
            pieceSource: specialId ? PieceSource.Special : PieceSource.Bag,
            ...(specialId ? { pieceId: specialId } : {})
        })

        this.chosenSpecialId = undefined
        await this.applyAction(action)
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

    async destroy(coords: AxialCoordinates) {
        await this.applyAction(
            this.createPlayerAction(DestroyPiece, { type: ActionType.DestroyPiece, coords })
        )
    }

    async holdFire() {
        await this.applyAction(
            this.createPlayerAction(DestroyPiece, { type: ActionType.DestroyPiece })
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
            await this.destroy(coords)
            return
        }
        // isHighlighted rather than isOpenHex, so the restriction to a newly laid tile is
        // honoured by the same list the board drew from.
        if (this.isPlacing && isOpenHex(this.gameState.board, coords) && this.isHighlighted(coords)) {
            await this.place(coords)
        }
    }

    toggleSpecial(pieceId: string) {
        this.chosenSpecialId = this.chosenSpecialId === pieceId ? undefined : pieceId
    }
}

export function describePiece(piece: Piece): string {
    const name = piece.type === PieceType.Probe ? 'probe' : piece.type
    return piece.level ? `level ${piece.level} ${name}` : name
}
