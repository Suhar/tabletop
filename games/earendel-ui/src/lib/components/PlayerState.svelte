<script lang="ts">
    import { type Player } from '@tabletop/common'
    import {
        EarendelPlayerState,
        planetPointsByPlayer,
        TECHNOLOGY_EFFECT_INFO,
        technologyName
    } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: EarendelPlayerState } = $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))

    // Planets pay only at the end, so a running total alone would hide half of what a player
    // has going. This shows what the board owes them if it stopped right now.
    let planetPoints = $derived(
        planetPointsByPlayer(gameSession.gameState.board)[playerState.playerId] ?? 0
    )

    // Every technology a player holds is housed on some planet, so the board can name what the
    // player's own ledger only records by id. Counted, since two planets can hold the same
    // technology name.
    let heldTechnologyNames = $derived.by(() => {
        const held = new Set(playerState.technologies)
        const names = Object.values(gameSession.gameState.board.hexes)
            .filter((hex) => hex.technology && held.has(hex.technology.id))
            .map((hex) => technologyName(hex.technology!))

        const counts = new Map<string, number>()
        for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)

        return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
    })
</script>

<div class="relative">
    <div
        class="rounded-lg {bgColor} py-[3px] px-4 text-center {gameSession.colors.getPlayerTextColor(
            playerState.playerId
        )} font-medium flex flex-col justify-between {isTurn ? 'border-2 pulse-border' : ''}"
    >
        <h1 class="{isTurn ? 'text-xl font-semibold' : 'text-lg font-medium'} mb-1">
            {isTurn ? '⇢ ' : ''}{player.name}{isTurn ? ' ⇠' : ''}
        </h1>

        <div class="flex justify-center gap-3 text-sm">
            <span title="Points banked so far">{playerState.score} pts</span>
            <span title="Points from planets if the game ended now">+{planetPoints} held</span>
            <span title="Pieces left in the bag">{playerState.bag.length} in bag</span>
        </div>

        {#if heldTechnologyNames.length > 0}
            <div class="mt-1 text-xs opacity-90" title="Technologies gained, kept for good">
                {heldTechnologyNames.join(', ')}
            </div>
        {/if}

        {#if playerState.storedEffects.length > 0}
            <div class="text-xs opacity-90" title="Technology powers not yet spent">
                unspent: {playerState.storedEffects
                    .map((kind) => TECHNOLOGY_EFFECT_INFO[kind].name)
                    .join(', ')}
            </div>
        {/if}

        {#if playerState.specialPieces.length > 0}
            <div class="text-xs opacity-90">
                specials: {playerState.specialPieces.length}
            </div>
        {/if}

        {#if gameSession.showDebug}
            <div class="text-xs mt-2">id: {player.id}</div>
        {/if}
    </div>
</div>

<style>
    @keyframes border-pulsate {
        0% {
            border-color: rgba(255, 255, 255, 0);
        }
        25% {
            border-color: rgba(255, 255, 255, 255);
        }
        75% {
            border-color: rgba(255, 255, 255, 255);
        }
        100% {
            border-color: rgba(255, 255, 255, 0);
        }
    }

    .pulse-border {
        border-color: white;
        animation: border-pulsate 2.5s infinite;
    }
</style>
