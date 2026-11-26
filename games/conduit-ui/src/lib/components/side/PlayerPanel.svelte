<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/conduit'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()
    const state = $derived(gameSession.tableState)
    const seat = $derived(state.getPlayerState(playerId))
    const stations = $derived(
        state.ownedStations().filter((station) => station.ownerId === playerId)
    )
    const cubesOnBoard = $derived(stations.reduce((total, station) => total + station.cubes, 0))
    const projected = $derived(gameSession.projectedIncome.get(playerId) ?? 0)
    const isStartPlayer = $derived(state.turnManager.turnOrder[0] === playerId)
    const isActive = $derived(state.activePlayerIds.includes(playerId))
    const hasPassed = $derived(
        state.machineState === MachineState.Bidding && (state.bidPasses ?? []).includes(playerId)
    )
    const color = $derived(gameSession.colors.getPlayerBgColorValue(playerId))
</script>

<article class="meter" class:active={isActive} style:--player={color}>
    <header>
        <PlayerName {playerId} />
        <span class="badges">
            {#if hasPassed}
                <span class="start" title="Done bidding this round">Passed</span>
            {/if}
            {#if isStartPlayer}
                <span class="start" title="Start Player">Start</span>
            {/if}
        </span>
    </header>
    <div class="readout">
        <div class="cash">
            <span class="label">Cash</span>
            <span class="value">${gameSession.cashOf(playerId)}</span>
        </div>
        <dl class="stats">
            <div>
                <dt>Supply</dt>
                <dd>{seat.supply}</dd>
            </div>
            <div>
                <dt>Reserve</dt>
                <dd>{seat.reserve}</dd>
            </div>
            <div>
                <dt>On grid</dt>
                <dd>{cubesOnBoard}</dd>
            </div>
            <div>
                <dt>Stations</dt>
                <dd>{stations.length}</dd>
            </div>
            <div>
                <dt>Revenue</dt>
                <dd>${projected}</dd>
            </div>
        </dl>
    </div>
</article>

<style>
    .meter {
        overflow: hidden;
        border-radius: 10px;
        background: var(--conduit-panel);
        box-shadow: inset 0 0 0 1px var(--conduit-line);
    }

    .meter.active {
        box-shadow: inset 0 0 0 2px var(--conduit-accent);
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        background: var(--player);
    }

    .badges {
        display: flex;
        gap: 4px;
    }

    .start {
        padding: 1px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--conduit-accent-ink);
        background: var(--conduit-accent);
    }

    .readout {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 8px 10px 10px;
    }

    .cash {
        display: grid;
        place-items: center;
        min-width: 72px;
        padding: 4px 8px;
        border-radius: 6px;
        background: #0b1118;
        box-shadow: inset 0 0 0 1px var(--conduit-line);
    }

    .label,
    dt {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--conduit-muted);
    }

    .value {
        font-family: 'Consolas', 'Courier New', monospace;
        font-size: 24px;
        font-weight: 700;
        color: var(--conduit-accent);
    }

    .stats {
        display: grid;
        grid-template-columns: repeat(3, auto);
        gap: 2px 14px;
    }

    dd {
        font-size: 16px;
        font-weight: 700;
    }
</style>
