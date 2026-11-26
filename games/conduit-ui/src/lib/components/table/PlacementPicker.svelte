<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cellElementId } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()
    const cell = $derived(gameSession.chosenCell)
    const tileId = $derived(gameSession.placement?.tileId)
    const rotations = $derived(gameSession.rotationsForChosenCell)
    const rotation = $derived(gameSession.chosenRotation)
    const cubeChoices = $derived(gameSession.extraCubeChoices)
    // Every count shows its price, $0 included, so the counts line up.
    const priced = $derived(cubeChoices.some((choice) => choice.price > 0))
</script>

{#if cell && tileId !== undefined && !gameSession.busy}
    {#key `${cell.col},${cell.row}`}
        <Floater placement="right" reference="#{cellElementId(cell)}" trigger="manual">
            <div class="picker">
                {#if rotations.length > 1}
                    <div class="row turns">
                        <button
                            type="button"
                            class="turn"
                            aria-label="Turn the tile left"
                            title="Turn left"
                            onclick={() => gameSession.turnTile(-1)}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M9 4 4 9l5 5"></path>
                                <path d="M4 9h9a7 7 0 0 1 0 14h-3"></path>
                            </svg>
                        </button>
                        <button
                            type="button"
                            class="turn"
                            aria-label="Turn the tile right"
                            title="Turn right"
                            onclick={() => gameSession.turnTile(1)}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="m15 4 5 5-5 5"></path>
                                <path d="M20 9h-9a7 7 0 0 0 0 14h3"></path>
                            </svg>
                        </button>
                    </div>
                {/if}
                {#if rotation !== undefined && cubeChoices.length === 1}
                    <div class="row">
                        <button
                            type="button"
                            class="count place"
                            onclick={() => gameSession.chooseExtraCubes(0)}>Place</button
                        >
                    </div>
                {:else if rotation !== undefined}
                    <div class="title">Extra cubes</div>
                    <div class="row">
                        {#each cubeChoices as choice (choice.count)}
                            <button
                                type="button"
                                class="count"
                                disabled={!choice.affordable}
                                onclick={() => gameSession.chooseExtraCubes(choice.count)}
                                >{choice.count}{#if priced}<span class="cost">${choice.price}</span
                                    >{/if}</button
                            >
                        {/each}
                    </div>
                {/if}
            </div>
        </Floater>
    {/key}
{/if}

<style>
    .picker {
        padding: 10px;
        border-radius: 10px;
        color: #e8eef6;
        background: #18212d;
        box-shadow:
            inset 0 0 0 1px #33445a,
            0 8px 20px rgb(0 0 0 / 0.5);
    }

    .title {
        margin: 2px 2px 6px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #93a4b8;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-width: 240px;
    }

    .row + .title {
        margin-top: 10px;
    }

    .turn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        color: #e8eef6;
        background: #222e3d;
        box-shadow: inset 0 0 0 1px #33445a;
    }

    .turn svg {
        width: 22px;
        height: 22px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.4;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .turns + .title {
        margin-top: 10px;
    }

    .place {
        padding: 0 16px;
    }

    .count {
        min-width: 36px;
        min-height: 40px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 700;
        color: #e8eef6;
        background: #222e3d;
        box-shadow: inset 0 0 0 1px #33445a;
    }

    .count {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0 8px;
        line-height: 1.05;
    }

    .cost {
        font-size: 11px;
        font-weight: 600;
        color: #93a4b8;
    }

    .count:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    .turn:hover,
    .count:hover:not(:disabled) {
        background: #33445a;
    }
</style>
