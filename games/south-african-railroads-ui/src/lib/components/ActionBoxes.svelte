<script lang="ts">
    import {
        ACTION_BOXES,
        ACTION_TRACK_ADVANCE,
        ACTION_TRACK_LIMIT,
        ActionBox,
        ROUNDS
    } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOX_NAMES, BOX_SHORT_NAMES, boxRules, boxTerms } from '$lib/utils/describeAction.js'
    import ActionBoxIcon from './ActionBoxIcon.svelte'
    import PlayerInitial from './PlayerInitial.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const finalPayoffNext = $derived(state.isFinalPayoffNext())
    const trackFraction = $derived(Math.min(state.actionTrack / (ACTION_TRACK_LIMIT + 1), 1))
    const trackWillPass = $derived(
        gameSession.dividendBoxes.some((box) => box !== ActionBox.PayDividends)
    )

    const boxes = $derived(
        ACTION_BOXES.map((box) => {
            const occupants = gameSession.placedPlayers
                .filter((player) => player.locomotive === box)
                .map((player) => player.playerId)
            const slots = Math.max(state.boxCapacity(box), occupants.length)
            const advance = ACTION_TRACK_ADVANCE[box]
            return {
                box,
                title: BOX_NAMES[box],
                shortTitle: BOX_SHORT_NAMES[box],
                terms: boxTerms(state.map, box, finalPayoffNext),
                rules: boxRules(state.map, box, finalPayoffNext),
                advance: box === ActionBox.PayDividends ? '↺' : `+${advance}`,
                paysDividends: gameSession.dividendBoxes.includes(box),
                slots: Array.from({ length: slots }, (_, index) => occupants[index]),
                selectable: gameSession.selectableBoxes.includes(box)
            }
        })
    )

    function advanceTitle(entry: (typeof boxes)[number]): string {
        if (entry.box === ActionBox.PayDividends) {
            return `Pays ${finalPayoffNext ? 'the final payoff' : 'dividends'} and resets the action track`
        }
        return entry.paysDividends
            ? `Moves the action track past ${ACTION_TRACK_LIMIT}: ${finalPayoffNext ? 'the final payoff' : 'dividends'} follow at once`
            : `Moves the action track ${entry.advance}`
    }
</script>

{#snippet boxContent(entry: (typeof boxes)[number])}
    <ActionBoxIcon box={entry.box} />
    <span class="title"
        ><span class="full">{entry.title}</span><span class="short">{entry.shortTitle}</span></span
    >
    <span class="rules" title={entry.rules}>{entry.terms}</span>
    <span class="slots">
        {#each entry.slots as playerId, index (index)}
            <span class="slot">
                {#if playerId}<PlayerInitial {playerId} />{/if}
            </span>
        {/each}
    </span>
{/snippet}

<div class="strip" aria-label="Action boxes">
    <div
        class="timer"
        title="Action track: dividends are paid once it passes {ACTION_TRACK_LIMIT}"
    >
        <span class="round" class:final={finalPayoffNext}>
            {#if finalPayoffNext}Final<br class="wide" /> Round{:else}Round<br class="wide" />
                <span class="nowrap">{state.round()} of {ROUNDS}</span>{/if}
        </span>
        <span class="track">
            <span class="coin" class:ending={trackWillPass}>{state.actionTrack}</span>
            <span class="limit">of {ACTION_TRACK_LIMIT}</span>
        </span>
        <span class="track-bar" class:ending={trackWillPass}
            ><span style:width="{trackFraction * 100}%"></span></span
        >
    </div>
    {#each boxes as entry (entry.box)}
        <div class="box" class:selectable={entry.selectable}>
            <span class="bubble" class:pays={entry.paysDividends} title={advanceTitle(entry)}
                >{entry.advance}</span
            >
            {#if entry.selectable}
                <button
                    type="button"
                    class="face"
                    aria-label="Choose {entry.title}"
                    onclick={() => gameSession.chooseBox(entry.box)}
                >
                    {@render boxContent(entry)}
                </button>
            {:else}
                <div class="face">
                    {@render boxContent(entry)}
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .strip {
        display: grid;
        grid-template-columns: minmax(0, 0.8fr) repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin: 12px 10px 0;
        color: #3b2410;
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    .timer {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        border: 2px solid #4a2e17;
        border-radius: 8px;
        background: #4a2e17;
        color: #fbf3dc;
        padding: 4px;
        text-align: center;
    }

    .round {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.04em;
        line-height: 1.15;
        text-transform: uppercase;
    }

    .round.final {
        color: #ffb3a8;
    }

    .nowrap {
        white-space: nowrap;
    }

    .track {
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }

    .coin {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 38px;
        height: 38px;
        border: 2px solid #7a5f0a;
        border-radius: 999px;
        background: #e3c34a;
        box-shadow:
            inset 0 0 0 3px #e3c34a,
            inset 0 0 0 4px rgba(122, 95, 10, 0.45);
        color: #4a3a05;
        font-family: 'SAR Bitter', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        line-height: 1;
    }

    .coin.ending {
        border-color: #6e140f;
        background: #c42a22;
        box-shadow:
            inset 0 0 0 3px #c42a22,
            inset 0 0 0 4px rgba(255, 255, 255, 0.45);
        color: #ffffff;
    }

    .limit {
        font-size: 12px;
        font-style: italic;
    }

    .track-bar {
        display: none;
    }

    .box {
        position: relative;
        display: flex;
        border: 2px solid #5c3f1f;
        border-radius: 8px;
        background: #fbf5e3;
    }

    .box.selectable {
        border-color: #c8961a;
        background: #fff3c4;
        box-shadow: 0 0 0 1px #c8961a;
    }

    .bubble {
        position: absolute;
        top: -9px;
        right: -6px;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        min-width: 24px;
        height: 21px;
        padding: 0 5px;
        border: 1.5px solid #7a5f0a;
        border-radius: 999px;
        background: #e3c34a;
        color: #4a3a05;
        font-family: 'SAR Bitter', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
    }

    .bubble.pays {
        border-color: #6e140f;
        background: #c42a22;
        color: #ffffff;
    }

    .face {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        min-width: 0;
        padding: 6px 8px 7px;
        border-radius: 6px;
        color: inherit;
        text-align: center;
    }

    button.face:hover,
    button.face:focus-visible {
        background: #ffe796;
        outline: none;
    }

    .title {
        font-size: 14px;
        font-weight: 700;
        line-height: 1.15;
    }

    .short {
        display: none;
    }

    .rules {
        align-self: stretch;
        overflow: hidden;
        font-size: 11.5px;
        font-style: italic;
        line-height: 1.25;
        color: #6b4a28;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    .slots {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 3px;
        margin-top: auto;
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

    @media (max-width: 639px) {
        .strip {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px 6px;
            margin: 6px 8px 0;
        }

        .timer {
            display: grid;
            grid-column: 1 / -1;
            grid-template-columns: 1fr auto;
            align-items: center;
            gap: 4px 8px;
            border: 0;
            background: none;
            color: #4a2e17;
            padding: 0;
            text-align: left;
        }

        .wide {
            display: none;
        }

        .round {
            font-size: 12px;
        }

        .round.final {
            color: #b0262e;
        }

        .coin {
            width: 28px;
            height: 28px;
            border-width: 1.5px;
            font-size: 13px;
        }

        .limit {
            font-size: 11px;
        }

        .track-bar {
            display: block;
            grid-column: 1 / -1;
            height: 6px;
            overflow: hidden;
            border-radius: 3px;
            background: #dccaa0;
        }

        .track-bar span {
            display: block;
            height: 100%;
            background: #4a2e17;
        }

        .track-bar.ending span {
            background: #c42a22;
        }

        .bubble {
            min-width: 21px;
            height: 19px;
            font-size: 12px;
        }

        .face {
            gap: 2px;
            padding: 8px 2px 5px;
        }

        .face :global(svg) {
            width: 26px;
            height: 26px;
        }

        .title {
            font-size: 11px;
        }

        .full,
        .rules {
            display: none;
        }

        .short {
            display: inline;
        }

        .slot {
            width: 24px;
            height: 18px;
        }
    }
</style>
