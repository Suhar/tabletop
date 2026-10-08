<script lang="ts">
    import { RAILROADS, type HydratedSarPlayerState } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOX_NAMES } from '$lib/utils/describeAction.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'
    import Locomotive from './icons/Locomotive.svelte'

    let { playerState }: { playerState: HydratedSarPlayerState } = $props()

    const gameSession = getGameSession()

    const playerId = $derived(playerState.playerId)
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const textColor = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const acting = $derived(gameSession.gameState.activePlayerIds.includes(playerId))
    const holdings = $derived(
        RAILROADS.map((railroad) => ({
            railroad,
            style: RAILROAD_STYLE[railroad.id],
            shares: gameSession.gameState.sharesHeld(railroad.id, playerId),
            controls: gameSession.gameState.controls(railroad.id, playerId)
        })).filter((holding) => holding.shares > 0)
    )
    const projected = $derived(gameSession.gameState.projectedFinalCash(playerId))
</script>

<div class="certificate" class:acting style:--player={color} style:--player-text={textColor}>
    <div class="banner">
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
        <span class="engine" title="Last action: {BOX_NAMES[playerState.locomotive]}">
            <svg width="42" height="30" viewBox="-25 -20 50 36" aria-hidden="true">
                <Locomotive {color} />
            </svg>
        </span>
    </div>
    <div class="body">
        <div class="cash" title="Cash in hand">${playerState.cash}</div>
        <div class="last-action">{BOX_NAMES[playerState.locomotive]}</div>
    </div>
    <div class="shares">
        {#each holdings as holding (holding.railroad.id)}
            <span
                class="share"
                style:--rr={holding.style.fill}
                style:--rr-text={holding.style.text}
                title="{holding.shares} {holding.railroad.shortName} share{holding.shares > 1
                    ? 's'
                    : ''}{holding.controls ? ' · controls the railroad' : ''}"
            >
                <span class="rr">{holding.railroad.shortName}</span>
                <span class="count">×{holding.shares}</span>
                {#if holding.controls}<span class="crown" aria-label="controls">★</span>{/if}
            </span>
        {:else}
            <span class="none">No shares yet</span>
        {/each}
    </div>
    <div class="footer" title="Cash plus every share's final payoff if the game ended now">
        Worth at final payoff <strong>${projected}</strong>
    </div>
</div>

<style>
    .certificate {
        position: relative;
        border-radius: 6px;
        background:
            repeating-linear-gradient(45deg, rgba(122, 90, 50, 0.04) 0 2px, transparent 2px 6px),
            #fbf5e3;
        box-shadow:
            inset 0 0 0 2px #7a5a32,
            inset 0 0 0 5px #fbf5e3,
            inset 0 0 0 6px #b99a68,
            0 2px 6px rgba(40, 24, 8, 0.15);
        padding: 8px 8px 6px;
        color: #3b2410;
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    .certificate.acting {
        box-shadow:
            inset 0 0 0 3px var(--player),
            inset 0 0 0 6px #fbf5e3,
            inset 0 0 0 7px #b99a68,
            0 2px 8px rgba(40, 24, 8, 0.25);
    }

    .banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border-radius: 3px;
        padding: 3px 4px 3px 10px;
        background: var(--player);
        color: var(--player-text);
    }

    .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .engine {
        display: inline-flex;
        border-radius: 999px;
        background: rgba(255, 250, 235, 0.92);
        padding: 0 4px;
    }

    .body {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        padding: 6px 6px 2px;
    }

    .cash {
        font-size: 26px;
        font-weight: 700;
    }

    .last-action {
        font-size: 12px;
        font-style: italic;
        color: #6b4a28;
    }

    .shares {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        padding: 4px 6px;
    }

    .share {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        border: 1.5px solid var(--rr);
        border-radius: 4px;
        background: #fffdf6;
        padding: 0 5px 0 0;
        font-size: 13px;
    }

    .rr {
        background: var(--rr);
        color: var(--rr-text);
        padding: 0 5px;
        font-weight: 700;
    }

    .count {
        font-weight: 700;
    }

    .crown {
        color: #c8961a;
    }

    .none {
        font-size: 12px;
        font-style: italic;
        color: #8c6a45;
    }

    .footer {
        border-top: 1px solid rgba(122, 90, 50, 0.3);
        margin: 4px 6px 0;
        padding-top: 3px;
        font-size: 12px;
        color: #6b4a28;
    }
</style>
