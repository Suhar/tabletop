<script lang="ts">
    import {
        RAILROADS,
        SHARES_PER_RAILROAD,
        type RailroadId
    } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        RAILROAD_CARD_GAP,
        RAILROAD_CARD_HEIGHT,
        RAILROAD_CARD_WIDTH,
        RAILROAD_CARD_X,
        RAILROAD_CARD_Y
    } from '$lib/utils/boardLayout.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'

    const gameSession = getGameSession()

    const offerable = $derived(
        gameSession.offeringStock ? gameSession.gameState.unsoldOffers() : []
    )

    const cards = $derived(
        RAILROADS.map((railroad, index) => {
            const state = gameSession.gameState.railroad(railroad.id)
            const choosable = gameSession.buildRailroadOptions.includes(railroad.id)
            return {
                railroad,
                state,
                style: RAILROAD_STYLE[railroad.id],
                x: RAILROAD_CARD_X + index * (RAILROAD_CARD_WIDTH + RAILROAD_CARD_GAP),
                income: gameSession.gameState.income(railroad.id),
                value: gameSession.gameState.value(railroad.id),
                choosable: choosable && gameSession.buildRailroadOptions.length > 1,
                offerable: offerable.includes(railroad.id),
                selected:
                    gameSession.selectedRailroad === railroad.id &&
                    gameSession.buildRailroadOptions.length > 1,
                auctioned: gameSession.gameState.auction?.railroadId === railroad.id
            }
        })
    )

    function activate(railroadId: RailroadId, offer: boolean) {
        if (offer) {
            void gameSession.offerShare(railroadId, false)
        } else {
            gameSession.selectRailroad(railroadId)
        }
    }

    function onKey(event: KeyboardEvent, railroadId: RailroadId, offer: boolean) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activate(railroadId, offer)
        }
    }
</script>

{#snippet cardContent(card: (typeof cards)[number])}
    <rect
        width={RAILROAD_CARD_WIDTH}
        height={RAILROAD_CARD_HEIGHT}
        rx="8"
        class="body"
        class:selected={card.selected || card.auctioned}
    />
    <path
        d="M0 8 Q0 0 8 0 L{RAILROAD_CARD_WIDTH - 8} 0 Q{RAILROAD_CARD_WIDTH} 0 {RAILROAD_CARD_WIDTH} 8 L{RAILROAD_CARD_WIDTH} 30 L0 30 Z"
        fill={card.style.fill}
    />
    <text x="10" y="22" class="short" fill={card.style.text}>{card.railroad.shortName}</text>
    <text x={RAILROAD_CARD_WIDTH - 10} y="20" class="treasury" fill={card.style.text}
        >${card.state.treasury}</text
    >
    {#if card.state.open}
        <text x="10" y="52" class="stat">Income <tspan class="figure">{card.income}</tspan></text>
        <text x="92" y="52" class="stat">Value <tspan class="figure">{card.value}</tspan></text>
        <text x="170" y="52" class="stat"
            >Div <tspan class="figure">{gameSession.gameState.dividendPerShare(card.railroad.id)}</tspan></text
        >
    {:else}
        <text x="10" y="52" class="stat">Opens when track reaches Johannesburg</text>
    {/if}
    {#each Array.from({ length: SHARES_PER_RAILROAD }, (_, index) => index) as share (share)}
        {@const owner = card.state.owners[share]}
        <g transform="translate({10 + share * 45} 64)">
            <rect width="40" height="30" rx="3" class="share" class:sold={owner} />
            <rect x="3" y="3" width="34" height="24" rx="2" class="share-inner" stroke={card.style.fill} />
            {#if owner}
                <circle
                    cx="20"
                    cy="15"
                    r="8"
                    fill={gameSession.colors.getPlayerUiColor(owner)}
                    stroke="#1d140b"
                    stroke-width="1.2"
                />
            {/if}
        </g>
    {/each}
{/snippet}

{#each cards as card (card.railroad.id)}
    {#if card.choosable || card.offerable}
        <g
            transform="translate({card.x} {RAILROAD_CARD_Y})"
            class="card active"
            class:closed={!card.state.open}
            role="button"
            tabindex="0"
            aria-label={card.offerable
                ? `Offer a ${card.railroad.shortName} share`
                : `Choose the ${card.railroad.shortName}`}
            onclick={() => activate(card.railroad.id, card.offerable)}
            onkeydown={(event) => onKey(event, card.railroad.id, card.offerable)}
        >
            {@render cardContent(card)}
        </g>
    {:else}
        <g
            transform="translate({card.x} {RAILROAD_CARD_Y})"
            class="card"
            class:closed={!card.state.open}
        >
            {@render cardContent(card)}
        </g>
    {/if}
{/each}

<style>
    .body {
        fill: #fbf5e3;
        stroke: #5c3f1f;
        stroke-width: 2;
    }

    .body.selected {
        stroke: #c8961a;
        stroke-width: 4;
    }

    .closed {
        opacity: 0.55;
    }

    .active {
        cursor: pointer;
        outline: none;
    }

    .active .body {
        fill: #fff3c4;
        stroke: #c8961a;
        stroke-width: 4;
    }

    .active:hover .body,
    .active:focus-visible .body {
        fill: #ffe796;
    }

    .short {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
    }

    .treasury {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        text-anchor: end;
    }

    .stat {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        fill: #6b4a28;
    }

    .figure {
        font-size: 15px;
        font-weight: 700;
        fill: #2c1d0e;
    }

    .share {
        fill: #efe3c4;
        stroke: #a88a5c;
        stroke-width: 1;
    }

    .share.sold {
        fill: #fffdf6;
    }

    .share-inner {
        fill: none;
        stroke-width: 1.2;
        stroke-dasharray: 2 2;
    }
</style>
