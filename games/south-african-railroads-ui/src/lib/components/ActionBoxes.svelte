<script lang="ts">
    import { ACTION_BOXES, ActionBox, boxCapacity } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOX_NAMES } from '$lib/utils/describeAction.js'
    import Locomotive from './icons/Locomotive.svelte'

    const gameSession = getGameSession()

    const ADVANCE: Record<ActionBox, string> = {
        [ActionBox.PayDividends]: 'reset',
        [ActionBox.DevelopSettlements]: '+5',
        [ActionBox.OfferStock]: '+4',
        [ActionBox.ConstructTrack]: '+3'
    }

    const playerCount = $derived(gameSession.gameState.players.length)

    const boxes = $derived(
        ACTION_BOXES.map((box) => {
            const locomotives = gameSession.placedLocomotives
                .filter((player) => player.locomotive === box)
                .map((player) => gameSession.colors.getPlayerUiColor(player.playerId))
            const slots = Math.max(boxCapacity(box, playerCount), locomotives.length)
            return {
                box,
                title: BOX_NAMES[box],
                advance: ADVANCE[box],
                slots: Array.from({ length: slots }, (_, index) => locomotives[index]),
                selectable: gameSession.selectableBoxes.includes(box)
            }
        })
    )
</script>

{#snippet boxContent(entry: (typeof boxes)[number])}
    <span class="head">
        <span class="title">{entry.title}</span>
        <span class="advance">{entry.advance}</span>
    </span>
    <span class="slots">
        {#each entry.slots as color, index (index)}
            <span class="slot">
                {#if color}
                    <svg viewBox="-25 -20 50 36" aria-hidden="true"><Locomotive {color} /></svg>
                {/if}
            </span>
        {/each}
    </span>
{/snippet}

<div class="action-boxes">
    {#each boxes as entry (entry.box)}
        {#if entry.selectable}
            <button
                type="button"
                class="box selectable"
                aria-label="Choose {entry.title}"
                onclick={() => gameSession.chooseBox(entry.box)}
            >
                {@render boxContent(entry)}
            </button>
        {:else}
            <div class="box">
                {@render boxContent(entry)}
            </div>
        {/if}
    {/each}
</div>

<style>
    .action-boxes {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        margin: 6px 8px 0;
    }

    .box {
        display: flex;
        flex-direction: column;
        gap: 3px;
        border: 2px solid #5c3f1f;
        border-radius: 8px;
        background: #fbf5e3;
        padding: 3px 8px 5px;
        color: #3b2410;
        font-family: 'Libre Baskerville', Georgia, serif;
        text-align: left;
    }

    .selectable {
        cursor: pointer;
        border-color: #c8961a;
        background: #fff3c4;
        box-shadow: 0 0 0 1px #c8961a;
    }

    .selectable:hover,
    .selectable:focus-visible {
        background: #ffe796;
        outline: none;
    }

    .head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 6px;
    }

    .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        font-weight: 700;
    }

    .advance {
        font-size: 12px;
        font-style: italic;
        color: #6b4a28;
        white-space: nowrap;
    }

    .slots {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
    }

    .slot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 24px;
        border: 1.2px dashed #a88a5c;
        border-radius: 4px;
        background: #efe3c4;
    }

    .slot svg {
        width: 30px;
        height: 22px;
    }

    @media (max-width: 639px) {
        .action-boxes {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 4px;
            margin: 4px 6px 0;
        }

        .box {
            padding: 2px 6px 4px;
        }

        .title {
            font-size: 12px;
        }

        .slot {
            width: 26px;
            height: 18px;
        }

        .slot svg {
            width: 23px;
            height: 16px;
        }
    }
</style>
