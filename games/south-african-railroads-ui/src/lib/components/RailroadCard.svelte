<script lang="ts">
    import {
        RailroadId,
        SHARES_PER_RAILROAD,
        railroadDefinition
    } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'

    let {
        railroadId,
        choice,
        selected
    }: { railroadId: RailroadId; choice?: 'build' | 'offer'; selected: boolean } = $props()

    const gameSession = getGameSession()

    const definition = $derived(railroadDefinition(railroadId))
    const style = $derived(RAILROAD_STYLE[railroadId])
    const railroad = $derived(gameSession.gameState.railroad(railroadId))
    const shares = $derived(
        Array.from({ length: SHARES_PER_RAILROAD }, (_, index) => railroad.owners[index])
    )

    function choose() {
        if (choice === 'offer') {
            void gameSession.offerShare(railroadId, false)
        } else if (choice === 'build') {
            gameSession.selectRailroad(railroadId)
        }
    }
</script>

{#snippet body()}
    <div class="head" style:background={style.fill} style:color={style.text}>
        <span class="short" title={definition.name}>{definition.shortName}</span>
        <span class="treasury" title="Treasury">${railroad.treasury}</span>
    </div>
    {#if railroad.open}
        <div class="stats">
            <span>Income <strong>{gameSession.gameState.income(railroadId)}</strong></span>
            <span>Value <strong>{gameSession.gameState.value(railroadId)}</strong></span>
            <span>Div <strong>{gameSession.gameState.dividendPerShare(railroadId)}</strong></span>
        </div>
    {:else if railroadId === RailroadId.ZASM}
        <div class="stats closed-note">Opens when track reaches Johannesburg</div>
    {:else}
        <div class="stats closed-note">Opens in the initial offering</div>
    {/if}
    <div class="shares" title="{railroad.owners.length} of {SHARES_PER_RAILROAD} shares sold">
        {#each shares as owner, index (index)}
            <span class="share" class:sold={owner} style:--rr={style.fill}>
                {#if owner}
                    <span
                        class="owner"
                        style:background={gameSession.colors.getPlayerUiColor(owner)}
                        title={gameSession.getPlayerName(owner)}
                    ></span>
                {/if}
            </span>
        {/each}
    </div>
{/snippet}

{#if choice}
    <div
        class="card choosable"
        class:selected
        class:closed={!railroad.open}
        role="button"
        tabindex="0"
        aria-label={choice === 'offer'
            ? `Offer a ${definition.shortName} share`
            : `Choose the ${definition.shortName}`}
        onclick={choose}
        onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                choose()
            }
        }}
    >
        {@render body()}
    </div>
{:else}
    <div class="card" class:selected class:closed={!railroad.open}>
        {@render body()}
    </div>
{/if}

<style>
    .card {
        overflow: hidden;
        border: 2px solid #5c3f1f;
        border-radius: 6px;
        background: #fbf5e3;
        color: #3b2410;
        font-family: 'Libre Baskerville', Georgia, serif;
        box-shadow: 0 1px 3px rgba(40, 24, 8, 0.15);
    }

    .card.closed {
        opacity: 0.6;
    }

    .card.selected {
        border-color: #c8961a;
        box-shadow: 0 0 0 2px #c8961a;
    }

    .card.choosable {
        cursor: pointer;
        border: 2px dashed #c8961a;
        background: #fff3c4;
        opacity: 1;
        outline: none;
    }

    .card.choosable:hover,
    .card.choosable:focus-visible {
        background: #ffe796;
        box-shadow: 0 0 0 2px #c8961a;
    }

    .head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        padding: 2px 8px;
        font-weight: 700;
    }

    .short {
        font-size: 15px;
    }

    .treasury {
        font-size: 14px;
    }

    .stats {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        padding: 3px 8px 0;
        font-size: 11px;
        color: #6b4a28;
    }

    .stats strong {
        font-size: 14px;
        color: #2c1d0e;
    }

    .closed-note {
        font-style: italic;
    }

    .shares {
        display: flex;
        gap: 4px;
        padding: 4px 8px 6px;
    }

    .share {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 22px;
        border: 1px solid #a88a5c;
        border-radius: 3px;
        background: #efe3c4;
        box-shadow: inset 0 0 0 2px #efe3c4, inset 0 0 0 3px var(--rr);
    }

    .share.sold {
        background: #fffdf6;
        box-shadow: inset 0 0 0 2px #fffdf6, inset 0 0 0 3px var(--rr);
    }

    .owner {
        width: 12px;
        height: 12px;
        border: 1.2px solid #1d140b;
        border-radius: 999px;
    }
</style>
