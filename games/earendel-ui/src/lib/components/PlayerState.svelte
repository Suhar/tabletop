<script lang="ts">
    import { type Player } from '@tabletop/common'
    import {
        EarendelPlayerState,
        planetPointsByPlayer,
        TECHNOLOGY_EFFECT_INFO,
        technologyCard,
        technologyName,
        turnsUntilReady
    } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: EarendelPlayerState } = $props()

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))

    let planetPoints = $derived(
        planetPointsByPlayer(gameSession.gameState.board)[playerState.playerId] ?? 0
    )

    let heldTechnologyNames = $derived.by(() => {
        const repeatable = new Set(
            playerState.cooldownEffects.map((kind) => TECHNOLOGY_EFFECT_INFO[kind].name)
        )
        const names = playerState.technologies
            .map((technologyId) => technologyName(technologyCard(technologyId)))
            .filter((name) => !repeatable.has(name))

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
            <span title="Pieces left in the bag">{playerState.bag.remaining} in bag</span>
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

        {#if playerState.cooldownEffects.length > 0}
            <div class="text-xs flex flex-wrap justify-center gap-x-2">
                {#each playerState.cooldownEffects as kind (kind)}
                    {@const left = turnsUntilReady(gameSession.gameState, playerState.playerId, kind)}
                    <span
                        title={left > 0
                            ? `${TECHNOLOGY_EFFECT_INFO[kind].name} — ready in ${left} of this player's turns`
                            : `${TECHNOLOGY_EFFECT_INFO[kind].name} — ready to use`}
                    >
                        <span class="opacity-90">{TECHNOLOGY_EFFECT_INFO[kind].name}</span>
                        {#if left > 0}
                            <span class="font-semibold opacity-100">⏳{left}</span>
                        {:else}
                            <span class="font-semibold opacity-100">ready</span>
                        {/if}
                    </span>
                {/each}
            </div>
        {/if}

        {#if playerState.specialPieces.length > 0}
            <div class="text-xs opacity-90" title="Special pieces waiting to be placed">
                {playerState.specialPieces
                    .map((piece) => (piece.hub ? '▣ Station Hub' : `▢ ${piece.type}`))
                    .join(', ')}
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
