<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const winners = $derived(gameSession.gameState.winningPlayerIds)
    const standings = $derived(gameSession.finalStandings)
</script>

<div class="flex flex-col items-center gap-2 py-2 text-white" data-testid="game-end-summary">
    <div class="inline-flex flex-wrap items-center justify-center gap-x-1.5 text-base sm:text-lg font-semibold">
        {#each winners as winnerId, index (winnerId)}
            {#if index > 0}<span>and</span>{/if}
            <PlayerName playerId={winnerId} />
        {/each}
        <span>{winners.length > 1 ? 'share the win' : 'wins'}</span>
    </div>

    <table class="text-sm">
        <thead>
            <tr class="text-[11px] uppercase tracking-widest opacity-60">
                <th class="px-2 font-normal"></th>
                <th class="px-2 font-normal text-left">Player</th>
                <th class="px-2 font-normal" title="Points for planets controlled at the end">
                    Planets
                </th>
                <th class="px-2 font-normal">Total</th>
            </tr>
        </thead>
        <tbody>
            {#each standings as standing (standing.playerId)}
                <tr
                    class="border-t border-white/15 {winners.includes(standing.playerId)
                        ? 'bg-amber-300/15'
                        : ''}"
                >
                    <td class="px-2 py-0.5 text-center opacity-70">{standing.rank}</td>
                    <td class="px-2 py-0.5"><PlayerName playerId={standing.playerId} /></td>
                    <td class="px-2 py-0.5 text-center">+{standing.planetPoints}</td>
                    <td class="px-2 py-0.5 text-center font-semibold">{standing.score}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
