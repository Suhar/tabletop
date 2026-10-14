<script lang="ts">
    import { railroadDefinition, type RailroadId } from '@tabletop/south-african-railroads'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'

    let {
        railroadId,
        choice,
        shrinkOnPhone = false
    }: {
        railroadId: RailroadId
        choice?: { label: string; onclick: () => void }
        shrinkOnPhone?: boolean
    } = $props()

    const style = $derived(RAILROAD_STYLE[railroadId])
    const definition = $derived(railroadDefinition(railroadId))
</script>

{#snippet face()}
    <span class="kind">One share</span>
    <span class="code">{definition.shortName}</span>
    <span class="name">{definition.name}</span>
{/snippet}

{#if choice}
    <button
        type="button"
        class="certificate choosable"
        style:--rr={style.fill}
        style:--rr-text={style.text}
        aria-label={choice.label}
        title={choice.label}
        onclick={choice.onclick}
    >
        {@render face()}
    </button>
{:else}
    <div
        class="certificate"
        class:shrink-on-phone={shrinkOnPhone}
        style:--rr={style.fill}
        style:--rr-text={style.text}
        title="{definition.name} share"
    >
        {@render face()}
    </div>
{/if}

<style>
    .certificate {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 132px;
        height: 66px;
        padding: 0 6px;
        border-radius: 3px;
        background: var(--rr);
        color: var(--rr-text);
        font-family: 'Libre Baskerville', Georgia, serif;
        text-align: center;
        box-shadow:
            inset 0 0 0 3px var(--rr),
            inset 0 0 0 4.5px rgba(255, 255, 255, 0.6),
            0 0 0 1px rgba(0, 0, 0, 0.45);
    }

    .kind {
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 9px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        opacity: 0.85;
    }

    .code {
        font-size: 20px;
        font-weight: 700;
        line-height: 1.15;
    }

    .name {
        overflow: hidden;
        max-width: 100%;
        font-size: 8.5px;
        font-style: italic;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .choosable {
        cursor: pointer;
        transition:
            transform 120ms ease,
            box-shadow 120ms ease;
    }

    .choosable:hover,
    .choosable:focus-visible {
        outline: none;
        transform: translateY(-2px);
        box-shadow:
            inset 0 0 0 3px var(--rr),
            inset 0 0 0 4.5px rgba(255, 255, 255, 0.6),
            0 0 0 2px #c8961a,
            0 3px 6px rgba(40, 24, 8, 0.3);
    }

    @media (max-width: 639px) {
        .certificate {
            width: 104px;
            height: 52px;
        }

        .code {
            font-size: 17px;
        }

        .shrink-on-phone {
            width: 62px;
            height: 30px;
        }

        .shrink-on-phone .code {
            font-size: 13px;
        }

        .shrink-on-phone .kind,
        .shrink-on-phone .name {
            display: none;
        }
    }
</style>
