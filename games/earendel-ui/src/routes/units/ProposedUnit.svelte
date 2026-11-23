<script lang="ts">
    // Proposals for the review sheet only: each special piece with a motion, and some other
    // looks for the Jammer. Nothing here is on the board. Turning is done with SVG's own
    // animation so that every turn is about a stated point.
    let { kind, color }: { kind: string; color: string } = $props()

    const polar = (radius: number, degrees: number) => ({
        x: radius * Math.cos((degrees * Math.PI) / 180),
        y: radius * Math.sin((degrees * Math.PI) / 180)
    })

    function arc(radius: number, side: 1 | -1): string {
        const spread = Math.PI / 4
        const x = side * radius * Math.cos(spread)
        const y = radius * Math.sin(spread)
        return `M${x},${-y} A${radius},${radius} 0 0 ${side === 1 ? 1 : 0} ${x},${y}`
    }

    // A ring broken into uneven pieces, for the scrambled Jammer.
    const BROKEN_INNER = '9 4 3 6 14 5 4 7'
    const BROKEN_OUTER = '6 7 16 4 5 9 11 6'

    // A burst of uneven spikes, for the noise Jammer.
    const BURST = Array.from({ length: 16 }, (_unused, index) => {
        const reach = index % 2 === 0 ? [20, 13, 24, 15, 18, 26, 14, 22][index / 2] : 7
        const at = polar(reach, index * 22.5 - 90)
        return `${at.x},${at.y}`
    }).join(' ')
</script>

<g stroke={color} fill="none" stroke-linejoin="round">
    {#if kind === 'relay'}
        <!-- The signal runs outward: inner arcs, then outer, then quiet. -->
        <polygon points="0,-8 7,0 0,8 -7,0" fill={color} stroke="none" />
        <circle r="2.4" fill="#0b1222" fill-opacity="0.5" stroke="none" />
        {#each [11, 17, 23] as radius, index (radius)}
            {#each [1, -1] as const as side (side)}
                <path
                    class="pulse"
                    style="animation-delay: {index * 0.35}s"
                    d={arc(radius, side)}
                    stroke-width="2.5"
                    stroke-linecap="round"
                />
            {/each}
        {/each}
    {:else if kind === 'scanner'}
        <!-- A sweep turning inside the lens. -->
        <circle r="14" stroke-width="4" />
        <circle r="3.5" fill={color} stroke="none" />
        <g>
            <path d="M0,0 L0,-11" stroke-width="2.5" stroke-linecap="round" />
            <path d="M0,0 L0,-11 A11,11 0 0 0 -7.8,-7.8 Z" fill={color} fill-opacity="0.3" stroke="none" />
            <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="6s"
                repeatCount="indefinite"
            />
        </g>
        <path d="M10,10 L19,19" stroke-width="4" stroke-linecap="round" />
    {:else if kind === 'drone'}
        <!-- The claws open and close. -->
        <circle r="7" fill={color} stroke="none" />
        <path d="M0,7 L0,18" stroke-width="3" stroke-linecap="round" />
        <path d="M-6,5 L-14,16" stroke-width="3" stroke-linecap="round">
            <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 -6 5; 26 -6 5; 0 -6 5"
                dur="3.6s"
                repeatCount="indefinite"
            />
        </path>
        <path d="M6,5 L14,16" stroke-width="3" stroke-linecap="round">
            <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 6 5; -26 6 5; 0 6 5"
                dur="3.6s"
                repeatCount="indefinite"
            />
        </path>
    {:else if kind === 'beacon'}
        <!-- The lamp blinks; its halo turns. -->
        <path d="M0,16 L0,-4" stroke-width="4" />
        <path d="M-10,16 L10,16" stroke-width="4" stroke-linecap="round" />
        <circle class="blink" cy="-9" r="6" fill={color} stroke="none" />
        <circle cy="-9" r="13" stroke-width="2" stroke-dasharray="3 4">
            <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 0 -9"
                to="360 0 -9"
                dur="14s"
                repeatCount="indefinite"
            />
        </circle>
    {:else if kind === 'gate'}
        <!-- A glint runs round the doorway. -->
        <circle r="17" stroke-width="5" stroke-opacity="0.55" />
        <circle class="glint" r="17" stroke-width="5" stroke-dasharray="20 86.8" stroke-linecap="round" />
        <circle class="breathe" r="8" stroke-width="2" />
    {:else if kind === 'carrier'}
        <!-- The bays light in turn, and a craft circles the hull. -->
        <rect x="-19" y="-7" width="38" height="14" rx="4" stroke-width="3" fill={color} fill-opacity="0.35" />
        {#each [-10, 0, 10] as x, index (x)}
            <circle
                class="bay"
                style="animation-delay: {index * 0.5}s"
                cx={x}
                r="3"
                fill={color}
                stroke="none"
            />
        {/each}
        <path d="M0,-3 L2.6,3 L-2.6,3 Z" fill={color} stroke="none">
            <animateMotion
                dur="7s"
                repeatCount="indefinite"
                rotate="auto"
                path="M-25,0 A25,14 0 1 1 25,0 A25,14 0 1 1 -25,0"
            />
        </path>
    {:else if kind === 'bastion'}
        <!-- The shield holds; a field outside it swells and fades. -->
        <path
            d="M0,-18 L16,-11 L14,6 L0,18 L-14,6 L-16,-11 Z"
            stroke-width="4"
            fill={color}
            fill-opacity="0.3"
        />
        <path
            class="field"
            d="M0,-25 L22,-15.5 L19.5,8.5 L0,25 L-19.5,8.5 L-22,-15.5 Z"
            stroke-width="1.8"
        />
    {:else if kind === 'terraformer'}
        <!-- The ground rolls under the peaks. -->
        <circle r="17" fill={color} fill-opacity="0.22" stroke-width="2.5" />
        <path d="M-10,4 L-3,-8 L1,-2 L5,-7 L11,4 Z" fill={color} stroke="none" />
        <path stroke-width="2.2" stroke-linecap="round" d="M-11,9 Q-5.5,5.5 0,9 T11,9">
            <animate
                attributeName="d"
                dur="4s"
                repeatCount="indefinite"
                values="M-11,9 Q-5.5,5.5 0,9 T11,9; M-11,9 Q-5.5,12.5 0,9 T11,9; M-11,9 Q-5.5,5.5 0,9 T11,9"
            />
        </path>
    {:else if kind === 'world'}
        <!-- The globe's scaffold turns round the world being made. -->
        <circle r="20" stroke-width="3" stroke-dasharray="5 4">
            <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="30s"
                repeatCount="indefinite"
            />
        </circle>
        <circle class="breathe" r="9" fill={color} stroke="none" />
    {:else if kind === 'jammer-static'}
        <!-- The dish as it is, its broken waves flickering. -->
        <path d="M-12,4 A14,14 0 0 1 12,4" stroke-width="4" stroke-linecap="round" />
        <path d="M0,4 L0,16" stroke-width="4" />
        {#each ['M-16,-10 L-10,-14', 'M-4,-16 L2,-18', 'M9,-16 L15,-11'] as d, index (d)}
            <path
                class="flicker"
                style="animation-delay: {index * 0.27}s"
                {d}
                stroke-width="3"
                stroke-linecap="round"
            />
        {/each}
    {:else if kind === 'jammer-rings'}
        <!-- Two broken rings turning against each other round a core. -->
        <circle r="5" fill={color} stroke="none" />
        <circle r="13" stroke-width="3.5" stroke-dasharray={BROKEN_INNER} stroke-linecap="round">
            <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="30s"
                repeatCount="indefinite"
            />
        </circle>
        <circle
            r="21"
            stroke-width="2.5"
            stroke-opacity="0.7"
            stroke-dasharray={BROKEN_OUTER}
            stroke-linecap="round"
        >
            <animateTransform
                attributeName="transform"
                type="rotate"
                from="360"
                to="0"
                dur="43s"
                repeatCount="indefinite"
            />
        </circle>
    {:else if kind === 'jammer-bolts'}
        <!-- A mast throwing jagged bolts to either side. -->
        <path d="M0,18 L0,-8" stroke-width="4" stroke-linecap="round" />
        <path d="M-8,18 L8,18" stroke-width="4" stroke-linecap="round" />
        <circle cy="-12" r="4.5" fill={color} stroke="none" />
        {#each ['M-6,-12 L-11,-17 L-13,-9 L-19,-15 L-22,-7', 'M6,-12 L11,-17 L13,-9 L19,-15 L22,-7', 'M-5,-4 L-11,-1 L-12,5 L-19,4', 'M5,-4 L11,-1 L12,5 L19,4'] as d, index (d)}
            <path
                class="flicker"
                style="animation-delay: {index * 0.19}s"
                {d}
                stroke-width="2.4"
                stroke-linecap="round"
            />
        {/each}
    {:else if kind === 'jammer-burst'}
        <!-- A burst of noise, swelling and shrinking. -->
        <g>
            <polygon points={BURST} stroke-width="2.2" fill={color} fill-opacity="0.28" />
            <animateTransform
                attributeName="transform"
                type="scale"
                values="1; 0.82; 1.06; 0.9; 1"
                dur="2.2s"
                repeatCount="indefinite"
            />
        </g>
        <circle r="4" fill={color} stroke="none" />
    {:else if kind === 'jammer-cut'}
        <!-- A relay's signal arcs, struck through with a jagged line: the signal it kills. -->
        <polygon points="0,-7 6,0 0,7 -6,0" fill={color} stroke="none" />
        {#each [12, 19] as radius (radius)}
            {#each [1, -1] as const as side (side)}
                <path
                    class="flicker"
                    style="animation-delay: {radius * 0.03 + (side === 1 ? 0 : 0.4)}s"
                    d={arc(radius, side)}
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-opacity="0.75"
                />
            {/each}
        {/each}
        <path
            d="M-21,17 L-9,6 L-12,1 L3,-4 L0,-9 L21,-19"
            stroke-width="3.5"
            stroke-linecap="round"
        />
    {/if}
</g>

<style>
    /* Use the `animation` shorthand: Svelte rewrites scoped @keyframes names only there. */
    .pulse {
        opacity: 0.15;
        animation: proposed-pulse 2.4s ease-out infinite;
    }

    .blink {
        animation: proposed-blink 2.4s ease-in-out infinite;
    }

    .breathe {
        animation: proposed-breathe 4s ease-in-out infinite;
    }

    .bay {
        animation: proposed-blink 1.5s ease-in-out infinite;
    }

    .field {
        animation: proposed-field 3.6s ease-in-out infinite;
    }

    .glint {
        animation: proposed-glint 4s linear infinite;
    }

    .flicker {
        animation: proposed-flicker 1.3s steps(1, end) infinite;
    }

    @keyframes proposed-pulse {
        0% {
            opacity: 0.15;
        }
        20% {
            opacity: 1;
        }
        60%,
        100% {
            opacity: 0.15;
        }
    }

    @keyframes proposed-blink {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.25;
        }
    }

    @keyframes proposed-breathe {
        0%,
        100% {
            opacity: 0.55;
        }
        50% {
            opacity: 1;
        }
    }

    @keyframes proposed-field {
        0%,
        100% {
            opacity: 0.15;
        }
        50% {
            opacity: 0.85;
        }
    }

    @keyframes proposed-glint {
        to {
            stroke-dashoffset: -106.8;
        }
    }

    @keyframes proposed-flicker {
        0% {
            opacity: 1;
        }
        18% {
            opacity: 0.2;
        }
        31% {
            opacity: 0.9;
        }
        47% {
            opacity: 0.1;
        }
        58% {
            opacity: 1;
        }
        83% {
            opacity: 0.35;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .pulse,
        .blink,
        .breathe,
        .bay,
        .field,
        .glint,
        .flicker {
            animation: none;
            opacity: 1;
        }
    }
</style>
