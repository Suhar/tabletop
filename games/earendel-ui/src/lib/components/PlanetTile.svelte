<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { type Hex, PlanetColor } from '@tabletop/earendel'
    import { PLANET_FILL } from '$lib/utils/planetColors.js'

    let {
        hex,
        center,
        points,
        inset,
        marked = false,
        copy = ''
    }: {
        hex: Hex
        center: Point
        points: string
        inset: string
        // The board's own tile, which a pending claim's line can find; a copy drawn for an
        // animation is not.
        marked?: boolean
        // Keeps a copy's clip path id from clashing with the tile it copies.
        copy?: string
    } = $props()

    let planetColor = $derived(hex.color ? PLANET_FILL[hex.color] : '#1b2436')
    let clipId = $derived(`planet-clip-${hex.coords.q},${hex.coords.r}${copy}`)
    let bodyOpacity = $derived(hex.explored ? 1 : 0.45)
    let dash = $derived(hex.explored ? '' : '5 4')
    let spin = $derived(
        `transform-box: view-box; transform-origin: ${center.x}px ${center.y}px;`
    )
</script>

<!-- data-planet lets a pending claim in the player panel point at this planet. -->
<polygon
    {points}
    data-planet={marked ? `${hex.coords.q},${hex.coords.r}` : undefined}
    fill={planetColor}
    fill-opacity="0.42"
    stroke="#2b3752"
    stroke-width="2"
/>
<!-- Inset so a neighbour drawn later cannot paint over half of the line. -->
<polygon
    points={inset}
    fill="none"
    stroke={planetColor}
    stroke-width="3"
    stroke-opacity="0.85"
    stroke-linejoin="round"
/>

{#if hex.color === PlanetColor.Mint}
    <!-- Drawn behind the body here and again in front at partial opacity. -->
    <ellipse
        cx={center.x}
        cy={center.y}
        rx="43"
        ry="13"
        fill="none"
        stroke={planetColor}
        stroke-width="5"
        stroke-opacity={hex.explored ? 0.9 : 0.4}
        transform="rotate(-20 {center.x} {center.y})"
    />
{/if}

{#if hex.color === PlanetColor.Aqua}
    <g class="planet-binary" style={spin}>
        <circle
            cx={center.x - 15}
            cy={center.y}
            r="16"
            fill={planetColor}
            fill-opacity={bodyOpacity}
            stroke={planetColor}
            stroke-width="3"
            stroke-dasharray={dash}
        />
        <circle
            cx={center.x + 15}
            cy={center.y}
            r="16"
            fill={planetColor}
            fill-opacity={bodyOpacity}
            stroke={planetColor}
            stroke-width="3"
            stroke-dasharray={dash}
        />
    </g>
{:else}
    <circle
        cx={center.x}
        cy={center.y}
        r="27"
        fill={planetColor}
        fill-opacity={bodyOpacity}
        stroke={planetColor}
        stroke-width="3"
        stroke-dasharray={dash}
    />
{/if}

{#if hex.color === PlanetColor.Teal}
    <circle
        cx={center.x}
        cy={center.y}
        r="27"
        fill="none"
        stroke={planetColor}
        stroke-width="6"
        class="planet-aura"
        style={spin}
    />
    <circle
        cx={center.x}
        cy={center.y}
        r="27"
        fill="none"
        stroke={planetColor}
        stroke-width="3"
        class="planet-aura planet-aura-late"
        style={spin}
    />
{/if}

{#if hex.color === PlanetColor.Periwinkle}
    <g class="planet-moon" style={spin}>
        <circle
            cx={center.x + 40}
            cy={center.y}
            r="7"
            fill={planetColor}
            fill-opacity={hex.explored ? 1 : 0.5}
        />
    </g>
{/if}

{#if hex.color === PlanetColor.Violet}
    <clipPath id={clipId}>
        <circle cx={center.x} cy={center.y} r="27" />
    </clipPath>
    <g clip-path="url(#{clipId})">
        <g class="planet-phase" style={spin}>
            <circle
                cx={center.x + 19}
                cy={center.y}
                r="26"
                fill="#0d1424"
                fill-opacity={hex.explored ? 0.72 : 0.4}
            />
        </g>
    </g>
{/if}

{#if hex.technologyId}
    <circle cx={center.x} cy={center.y} r="9" fill="#ffffff" fill-opacity="0.9" />
    <circle
        cx={center.x}
        cy={center.y}
        r="15"
        fill="none"
        stroke="#ffffff"
        stroke-opacity="0.55"
        stroke-width="2"
    />
{:else if !hex.explored}
    <text
        x={center.x}
        y={center.y + 7}
        text-anchor="middle"
        class="fill-white/70 text-[20px] font-bold"
    >
        ?
    </text>
{/if}

<style>
    @keyframes planet-revolve {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .planet-binary {
        animation: planet-revolve 28s linear infinite;
    }

    .planet-moon {
        animation: planet-revolve 14s linear infinite;
    }

    .planet-phase {
        animation: planet-revolve 44s linear infinite;
    }

    @keyframes planet-breathe {
        0%,
        100% {
            transform: scale(1);
            stroke-opacity: 0.5;
        }
        50% {
            transform: scale(1.42);
            stroke-opacity: 0;
        }
    }

    .planet-aura {
        animation: planet-breathe 4.2s ease-out infinite;
    }

    .planet-aura-late {
        animation-delay: 2.1s;
    }
</style>
