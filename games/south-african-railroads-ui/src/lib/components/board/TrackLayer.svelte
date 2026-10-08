<script lang="ts">
    import { LINKS, linkOwner, settlement } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { linkPath } from '$lib/utils/mapGeometry.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'
    import Cube from '../icons/Cube.svelte'

    const gameSession = getGameSession()

    const targets = $derived(new Set(gameSession.linkTargets))
    const builder = $derived(gameSession.buildingRailroad)
    const builderStyle = $derived(builder ? RAILROAD_STYLE[builder] : undefined)

    const links = $derived(
        LINKS.map((trackLink) => {
            const owner = linkOwner(gameSession.gameState, trackLink.id)
            return {
                ...trackLink,
                path: linkPath(trackLink.id),
                label: trackLink.ends.map((id) => settlement(id).name).join(' to '),
                style: owner ? RAILROAD_STYLE[owner] : undefined,
                target: targets.has(trackLink.id),
                chosen: gameSession.firstLink === trackLink.id
            }
        })
    )

    function onKey(event: KeyboardEvent, linkId: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void gameSession.clickLink(linkId)
        }
    }
</script>

<g class="track-layer">
    {#each links as trackLink (trackLink.id)}
        <g class="link" class:built={trackLink.style}>
            <path d={trackLink.path} class="ties" />
            {#if trackLink.style}
                <path d={trackLink.path} class="rail-built-edge" />
                <path d={trackLink.path} class="rail-built" stroke={trackLink.style.fill} />
            {:else}
                <path d={trackLink.path} class="rail" />
            {/if}
        </g>
    {/each}

    {#each links as trackLink (trackLink.id)}
        {#if trackLink.target || trackLink.chosen}
            <path
                d={trackLink.path}
                class="target-glow"
                class:chosen={trackLink.chosen}
                stroke={builderStyle?.light ?? '#ffcf3f'}
            />
        {/if}
    {/each}

    {#each links as trackLink (trackLink.id)}
        <g transform="translate({trackLink.box.x} {trackLink.box.y})">
            {#if trackLink.style}
                <Cube x={0} y={1} size={20} color={trackLink.style.fill} edge={trackLink.style.dark} />
            {:else}
                <rect x="-10" y="-10" width="20" height="20" rx="2.5" class="box" />
            {/if}
        </g>
    {/each}

    {#each links as trackLink (trackLink.id)}
        {#if trackLink.target}
            <g
                class="hit"
                role="button"
                tabindex="0"
                aria-label="Build {trackLink.label}"
                onclick={() => gameSession.clickLink(trackLink.id)}
                onkeydown={(event) => onKey(event, trackLink.id)}
            >
                <path d={trackLink.path} class="hit-path" />
                <rect
                    x={trackLink.box.x - 15}
                    y={trackLink.box.y - 15}
                    width="30"
                    height="30"
                    rx="5"
                    class="hit-box"
                    stroke={builderStyle?.fill ?? '#c8961a'}
                />
            </g>
        {/if}
    {/each}
</g>

<style>
    .ties {
        fill: none;
        stroke: #6b5638;
        stroke-width: 10;
        stroke-dasharray: 1.6 5.4;
        opacity: 0.85;
    }

    .rail {
        fill: none;
        stroke: #6b5638;
        stroke-width: 2.6;
        stroke-linejoin: round;
    }

    .rail-built-edge {
        fill: none;
        stroke: #1d140b;
        stroke-width: 8.5;
        stroke-linejoin: round;
        stroke-linecap: round;
    }

    .rail-built {
        fill: none;
        stroke-width: 6;
        stroke-linejoin: round;
        stroke-linecap: round;
    }

    .box {
        fill: #fffdf6;
        stroke: #3b2a17;
        stroke-width: 1.6;
    }

    .target-glow {
        fill: none;
        stroke-width: 15;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.55;
        animation: sar-pulse 1.4s ease-in-out infinite;
        pointer-events: none;
    }

    .target-glow.chosen {
        opacity: 0.9;
        stroke-width: 18;
        animation: none;
    }

    .hit {
        cursor: pointer;
        outline: none;
    }

    .hit-path {
        fill: none;
        stroke: transparent;
        stroke-width: 22;
    }

    .hit-box {
        fill: rgba(255, 244, 200, 0.35);
        stroke-width: 3;
        stroke-dasharray: 5 3;
    }

    .hit:hover .hit-box,
    .hit:focus-visible .hit-box {
        fill: rgba(255, 236, 160, 0.75);
    }

    @keyframes sar-pulse {
        0%,
        100% {
            opacity: 0.25;
        }
        50% {
            opacity: 0.7;
        }
    }
</style>
