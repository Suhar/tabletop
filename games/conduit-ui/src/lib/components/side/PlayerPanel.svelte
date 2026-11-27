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
        clip-path: var(--conduit-cut);
        background: var(--conduit-panel);
        box-shadow: inset 0 0 0 1px var(--conduit-line);
    }

    /* The clipped corners would cut an outer glow, so the active panel glows inward. */
    .meter.active {
        box-shadow:
            inset 0 0 0 2px var(--conduit-accent),
            inset 0 0 14px var(--conduit-glow);
    }

    /* A stripe of the player's colour, like a wire's insulation. */
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px 6px 16px;
        font-family: var(--conduit-display);
        color: #fff;
        background: linear-gradient(90deg, var(--player) 0 6px, transparent 6px);
        border-bottom: 1px dashed var(--conduit-line);
    }

    .badges {
        display: flex;
        gap: 4px;
    }

    .start {
        padding: 1px 8px;
        border-radius: 2px;
        font-family: var(--conduit-text);
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #ffd36b;
        box-shadow: inset 0 0 0 1px #ffd36b;
    }

    /* The readout is all Share Tech Mono, thickened: it reads best here. */
    .readout {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 8px 10px 10px;
        font-family: var(--conduit-readout);
    }

    /* Cash reads out on a green display. */
    .cash {
        display: grid;
        place-items: center;
        min-width: 72px;
        padding: 4px 8px;
        border-radius: 2px;
        background: var(--conduit-lcd);
        box-shadow: inset 0 0 0 1px var(--conduit-lcd-line);
    }

    .label,
    dt {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--conduit-muted);
        -webkit-text-stroke: 0.3px currentColor;
    }

    .value {
        font-size: 28px;
        line-height: 1.1;
        color: var(--conduit-lcd-ink);
        text-shadow: 0 0 8px #2bff7a;
    }

    .stats {
        display: grid;
        grid-template-columns: repeat(3, auto);
        gap: 2px 14px;
    }

    dd {
        font-size: 18px;
        -webkit-text-stroke: 0.5px currentColor;
    }
</style>
