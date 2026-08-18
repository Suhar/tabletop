<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        type ChoosePlanet,
        type ChooseTechnology,
        type AttackPiece,
        isChoosePlanet,
        isChooseTechnology,
        isAttackPiece,
        isPass,
        isDiscardPiece,
        type DiscardPiece,
        isDrawPieces,
        type DrawPieces,
        isUseLogisticsUpgrade,
        type UseLogisticsUpgrade,
        isUseTacticalFeint,
        type UseTacticalFeint,
        isMovePiece,
        isPlacePiece,
        isPlaceTile,
        type PlaceTile,
        type MovePiece,
        type PlacePiece,
        TECHNOLOGY_EFFECT_INFO
    } from '@tabletop/earendel'
    import { describePiece } from '$lib/model/session.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        action,
        justify = 'start'
    }: { action: GameAction; justify?: 'start' | 'center' | 'end'; history?: boolean } = $props()

    const gameSession = getGameSession()

    const techName = (id?: string) => (id ? id.replace('tech-', 'Tech ') : 'nothing')

    // A claimed technology is named from the card itself, which the planet still holds - the id
    // alone says nothing a player would recognise. Falls back to the tidied id if the planet
    // has since left the board.
    const claimedName = (id: string) => {
        const card = Object.values(gameSession.gameState.board.hexes).find(
            (hex) => hex.technology?.id === id
        )?.technology
        const kind = card?.effect?.kind
        return kind ? TECHNOLOGY_EFFECT_INFO[kind].name : techName(id)
    }

    // History is read after the fact, so it has to say what happened rather than what was
    // clicked - which piece came out of the bag, what the flip turned up, who lost a ship.
    let text = $derived.by(() => {
        if (isPlacePiece(action)) {
            const placed = action as PlacePiece
            const parts: string[] = [`placed a ${placed.metadata?.pieceType ?? 'ship'}`]
            if (placed.metadata?.returnedToBag) {
                parts.push(
                    `(putting a ${describePiece(placed.metadata.returnedToBag)} back in the bag)`
                )
            }
            if (placed.metadata?.stationGroupPoints) {
                const points = placed.metadata.stationGroupPoints
                parts.push(
                    points === 1
                        ? 'for 1'
                        : `joining a group of ${points} stations for ${points}`
                )
            }
            for (const chain of placed.metadata?.chains ?? []) {
                parts.push(
                    `and joined two ${chain.color} planets with ${chain.length} ${
                        chain.length === 1 ? 'ship' : 'ships'
                    } for ${chain.points}`
                )
            }
            return parts.join(' ')
        }
        if (isChoosePlanet(action)) {
            const chosen = action as ChoosePlanet
            const flipped = chosen.metadata?.flipped?.length ?? 0
            return `explored a planet, turning over ${flipped} ${flipped === 1 ? 'card' : 'cards'}`
        }
        if (isChooseTechnology(action)) {
            const chosen = action as ChooseTechnology
            return chosen.metadata?.noTechnologyAvailable
                ? 'found nothing the planet could hold'
                : `housed ${techName(chosen.metadata?.technologyId)} on the planet`
        }
        if (isAttackPiece(action)) {
            const shot = action as AttackPiece
            if (shot.metadata?.declined) return 'held fire'
            if (shot.metadata?.railgun) {
                return `railgunned a ${shot.metadata?.target?.type ?? 'ship'} out of existence`
            }
            if (shot.metadata?.damaged) {
                return `damaged a fighter down to level ${shot.metadata.levelAfter ?? 1}`
            }
            return `destroyed a ${shot.metadata?.target?.type ?? 'ship'}`
        }
        if (isDrawPieces(action)) {
            const drew = action as DrawPieces
            const count = drew.metadata?.drawn?.length ?? 0
            const drawn = `drew ${count} ${count === 1 ? 'ship' : 'ships'}`

            // A technology claimed as the turn opened is the more interesting half of this
            // action, and nobody was watching the board when it was earned - it is the payoff
            // for a planet held through everyone else's turns, so it gets said out loud.
            const claimed = drew.metadata?.technologiesClaimed ?? []
            if (claimed.length === 0) return drawn
            return `${drawn}, and held ${claimed.map(claimedName).join(' and ')}`
        }
        if (isUseTacticalFeint(action)) {
            const feint = action as UseTacticalFeint
            const mine = feint.metadata?.movedType ?? 'ship'
            const theirs = feint.metadata?.displacedType ?? 'ship'
            const parts: string[] = [`feinted, swapping their ${mine} with a ${theirs}`]
            // The swap's own consequences, said out loud for the same reason a placement's are:
            // the score moved and history has to be able to say why.
            if (feint.metadata?.stationGroupPoints) {
                parts.push(`for ${feint.metadata.stationGroupPoints}`)
            }
            for (const chain of feint.metadata?.chains ?? []) {
                parts.push(
                    `and joined two ${chain.color} planets with ${chain.length} ${
                        chain.length === 1 ? 'ship' : 'ships'
                    } for ${chain.points}`
                )
            }
            return parts.join(' ')
        }
        if (isUseLogisticsUpgrade(action)) {
            const used = action as UseLogisticsUpgrade
            return `spent a Logistics Upgrade, keeping all ${used.metadata?.piecesKept ?? 3} ships`
        }
        if (isDiscardPiece(action)) {
            const discard = action as DiscardPiece
            return discard.metadata?.nothingToDiscard
                ? 'drew the last of the bag, with nothing to discard'
                : `drafted three and discarded a ${discard.metadata?.discarded?.type ?? 'ship'}`
        }
        if (isPlaceTile(action)) {
            const laid = action as PlaceTile
            return laid.metadata?.noTilePlaced
                ? 'had nowhere to lay the new tile'
                : laid.metadata?.noShipPlaced
                  ? 'laid a new tile, with no ship left to put on it'
                  : 'laid a new tile'
        }
        if (isMovePiece(action)) {
            const moved = action as MovePiece
            if (moved.metadata?.noMoveAvailable) return 'had nothing the technology could move'
            if (moved.metadata?.declined) return 'held position rather than moving'
            return `moved a ${moved.metadata?.piece?.type ?? 'ship'} one space`
        }
        if (isPass(action)) return 'could not place, ending the game'
        return action.type
    })
</script>

<div class="flex flex-row justify-{justify} items-center flex-wrap gap-x-1">
    <PlayerName playerId={action.playerId} />
    <span>{text}</span>
</div>
