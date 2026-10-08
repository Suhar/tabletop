<script lang="ts">
    import { ACTION_BOXES, ActionBox, boxCapacity } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ACTION_BOX_RECTS } from '$lib/utils/boardLayout.js'
    import Locomotive from '../icons/Locomotive.svelte'

    const gameSession = getGameSession()

    const COPY: Record<ActionBox, { title: string; lines: string[] }> = {
        [ActionBox.PayDividends]: {
            title: 'Pay Dividends',
            lines: ['Reset the action track', 'Advance the dividend track']
        },
        [ActionBox.DevelopSettlements]: {
            title: 'Develop Settlements',
            lines: ['+5 action track', '1st free · 2nd $3 cash, Joburg free']
        },
        [ActionBox.OfferStock]: {
            title: 'Offer Stock',
            lines: ['+4 action track', 'Auction one share']
        },
        [ActionBox.ConstructTrack]: {
            title: 'Construct Track',
            lines: ['+3 action track · may repeat', '1 link $5 · 2 links $15']
        }
    }

    const playerCount = $derived(gameSession.gameState.players.length)

    const boxes = $derived(
        ACTION_BOXES.map((box) => {
            const rect = ACTION_BOX_RECTS[box]
            const slots = boxCapacity(box, playerCount)
            const locomotives = gameSession.gameState.players.filter(
                (player) => player.locomotive === box
            )
            return {
                box,
                rect,
                slots,
                locomotives,
                selectable: gameSession.selectableBoxes.includes(box),
                copy: COPY[box]
            }
        })
    )

    function slotX(index: number, slots: number, width: number) {
        const span = Math.min(56, (width - 20) / Math.max(slots, 1))
        return (width - span * slots) / 2 + span * index + span / 2
    }

    function onKey(event: KeyboardEvent, box: ActionBox) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void gameSession.chooseBox(box)
        }
    }
</script>

{#snippet boxContent(entry: (typeof boxes)[number])}
    <rect width={entry.rect.width} height={entry.rect.height} rx="10" class="panel" />
    <text x="12" y="27" class="title">{entry.copy.title}</text>
    {#each entry.copy.lines as line, index (line)}
        <text x="12" y={46 + index * 15} class="rule">{line}</text>
    {/each}
    {#each Array.from({ length: entry.slots }, (_, index) => index) as slot (slot)}
        <rect
            x={slotX(slot, entry.slots, entry.rect.width) - 24}
            y="82"
            width="48"
            height="38"
            rx="5"
            class="slot"
        />
    {/each}
    {#each entry.locomotives as player, index (player.playerId)}
        <Locomotive
            color={gameSession.colors.getPlayerUiColor(player.playerId)}
            x={slotX(index, Math.max(entry.slots, entry.locomotives.length), entry.rect.width)}
            y={100}
            scale={0.95}
        />
    {/each}
{/snippet}

{#each boxes as entry (entry.box)}
    {#if entry.selectable}
        <g
            transform="translate({entry.rect.x} {entry.rect.y})"
            class="action-box selectable"
            role="button"
            tabindex="0"
            aria-label="Choose {entry.copy.title}"
            onclick={() => gameSession.chooseBox(entry.box)}
            onkeydown={(event) => onKey(event, entry.box)}
        >
            {@render boxContent(entry)}
        </g>
    {:else}
        <g transform="translate({entry.rect.x} {entry.rect.y})" class="action-box">
            {@render boxContent(entry)}
        </g>
    {/if}
{/each}

<style>
    .panel {
        fill: #fbf5e3;
        stroke: #5c3f1f;
        stroke-width: 2;
    }

    .selectable {
        cursor: pointer;
        outline: none;
    }

    .selectable .panel {
        fill: #fff3c4;
        stroke: #c8961a;
        stroke-width: 4;
    }

    .selectable:hover .panel,
    .selectable:focus-visible .panel {
        fill: #ffe796;
    }

    .title {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 18px;
        font-weight: 700;
        fill: #3b2410;
    }

    .rule {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        fill: #6b4a28;
    }

    .slot {
        fill: #efe3c4;
        stroke: #a88a5c;
        stroke-width: 1.2;
        stroke-dasharray: 3 2;
    }
</style>
