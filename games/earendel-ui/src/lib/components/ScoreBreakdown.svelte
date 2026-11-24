<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    let rows = $derived(gameSession.scoreBreakdown)
    let showOther = $derived(rows.some((row) => row.other > 0))
    let showBonus = $derived(rows.some((row) => row.bonus > 0))
</script>

<!-- Who has how many points and why: the banked kinds from the history. -->
<table class="whitespace-nowrap text-xs text-white">
    <thead>
        <tr class="text-[10px] uppercase tracking-widest opacity-60">
            <th class="px-1.5 font-normal"></th>
            <th class="px-1.5 text-left font-normal">Player</th>
            <th class="px-1.5 font-normal" title="Banked from station complexes">Complex</th>
            <th class="px-1.5 font-normal" title="Banked from trade routes">Routes</th>
            {#if showBonus}
                <th
                    class="px-1.5 font-normal"
                    title="Bounties, and 2 a turn for controlling a planet of every color"
                >
                    Bonus
                </th>
            {/if}
            {#if showOther}
                <th class="px-1.5 font-normal" title="Banked before the shown history">Other</th>
            {/if}
            <th class="px-1.5 font-normal">Total</th>
        </tr>
    </thead>
    <tbody>
        {#each rows as row (row.playerId)}
            <tr class="border-t border-white/15">
                <td class="px-1.5 py-0.5 text-center opacity-70">{row.rank}</td>
                <td class="px-1.5 py-0.5"><PlayerName playerId={row.playerId} /></td>
                <td class="px-1.5 py-0.5 text-center">{row.complexes}</td>
                <td class="px-1.5 py-0.5 text-center">{row.routes}</td>
                {#if showBonus}
                    <td class="px-1.5 py-0.5 text-center">{row.bonus}</td>
                {/if}
                {#if showOther}
                    <td class="px-1.5 py-0.5 text-center">{row.other}</td>
                {/if}
                <td class="px-1.5 py-0.5 text-center font-semibold">{row.total}</td>
            </tr>
        {/each}
    </tbody>
</table>
