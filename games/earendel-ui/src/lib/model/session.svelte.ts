import type { AxialCoordinates } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    ChoosePlanet,
    ChooseTechnology,
    DestroyPiece,
    destroyableTargets,
    type EarendelGameState,
    type HydratedEarendelGameState,
    type HydratedEarendelPlayerState,
    getHex,
    hexesClosedToProbesOf,
    hexKey,
    isElevated,
    isOpenHex,
    MachineState,
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
    // A special piece the player has picked up and is about to place instead of their draw.
    // Held here rather than in game state because until it lands it is only an intention.
    chosenSpecialId: string | undefined = $state(undefined)

    myPlayerState: HydratedEarendelPlayerState | undefined = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return playerId ? this.gameState.findPlayerState(playerId) : undefined
    })

    drawnPiece: Piece | undefined = $derived(this.gameState.drawnPiece)

    // The piece that would land if the player clicked a hex right now.
    pieceToPlace: Piece | undefined = $derived.by(() => {
        if (this.chosenSpecialId) {
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
        this.isMyTurn && this.gameState.machineState === MachineState.PlacingPiece
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

    // What the board should invite a click on right now. One list keeps the board component
    // from having to know which decision is outstanding.
    highlightedHexes: AxialCoordinates[] = $derived.by(() => {
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

    async onBoardClick(coords: AxialCoordinates) {
        if (this.busy) return

        if (this.choosablePlanets.some((candidate) => sameHex(candidate, coords))) {
            await this.choosePlanet(coords)
            return
        }
        if (this.attackTargets.some((target) => sameHex(target, coords))) {
            await this.destroy(coords)
            return
        }
        if (this.isPlacing && isOpenHex(this.gameState.board, coords)) {
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
