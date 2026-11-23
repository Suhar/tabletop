<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { PieceType } from '@tabletop/earendel'

    // The granted pieces beyond hubs, relays and terraformers, each a simple outline in the
    // player's color so they read as structures rather than ships.
    let { center, color, type }: { center: Point; color: string; type: PieceType } = $props()

    // The Interdictor's spikes point at the six hexes it closes: flat-topped hexes put the
    // neighbors at 30° plus multiples of 60°.
    const SPIKE = { base: 17.5, tip: 23, halfWidth: 3 }
    const interdictorSpikes = Array.from({ length: 6 }, (_unused, index) => {
        const angle = ((30 + index * 60) * Math.PI) / 180
        const along = { x: Math.cos(angle), y: Math.sin(angle) }
        const across = { x: -along.y, y: along.x }
        const corner = (side: 1 | -1) =>
            `${along.x * SPIKE.base + side * across.x * SPIKE.halfWidth},${along.y * SPIKE.base + side * across.y * SPIKE.halfWidth}`
        return `${corner(1)} ${along.x * SPIKE.tip},${along.y * SPIKE.tip} ${corner(-1)}`
    })

    // The Quarantine Beacon's barriers stand square to the six neighboring hexes, where the
    // Interdictor's spikes point at them.
    const quarantineBarriers = Array.from({ length: 6 }, (_unused, index) => {
        const angle = ((30 + index * 60) * Math.PI) / 180
        const at = { x: Math.cos(angle) * 22.5, y: Math.sin(angle) * 22.5 }
        const across = { x: -Math.sin(angle) * 4, y: Math.cos(angle) * 4 }
        return `M${at.x - across.x},${at.y - across.y} L${at.x + across.x},${at.y + across.y}`
    })

    // The Nebula Seeder's two arms: puffs growing and fading as they wind out to a hub's reach.
    const seederArms = [0, 180].flatMap((offset) =>
        Array.from({ length: 8 }, (_unused, step) => {
            const angle = ((offset + step * 38) * Math.PI) / 180
            const radius = 8.5 + step * 2.6
            return {
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle),
                size: 1.5 + step * 0.5,
                opacity: 0.95 - step * 0.1
            }
        })
    )
</script>

<g transform="translate({center.x} {center.y})" stroke={color} fill="none" stroke-linejoin="round">
    {#if type === PieceType.Interdictor}
        <!-- A barred ring inside a spiked guard ring: nothing of the enemy's comes close. The
             guard ring stands still, a spike toward each hex it closes; the barred ring turns
             slowly counterclockwise, against the way every other piece turns. -->
        <circle r="17" stroke-width="2" stroke-opacity="0.75"></circle>
        {#each interdictorSpikes as points (points)}
            <polygon {points} fill={color} stroke="none"></polygon>
        {/each}
        <g class="interdictor-bar">
            <circle r="10.5" stroke-width="3.5"></circle>
            <path d="M-7.4,-7.4 L7.4,7.4" stroke-width="3.5"></path>
        </g>
    {:else if type === PieceType.NebulaSeeder}
        <!-- A pinwheel: a small core throwing two arms of cloud that swell and thin as they
             wind outward, turning slowly. As wide as a Station Hub, for a nebula is vast. -->
        <circle r="5.5" fill={color} stroke="none"></circle>
        <circle r="8.5" stroke-width="1.5"></circle>
        <g class="seeder-arms">
            {#each seederArms as puff, index (index)}
                <circle
                    cx={puff.x}
                    cy={puff.y}
                    r={puff.size}
                    fill={color}
                    fill-opacity={puff.opacity}
                    stroke="none"
                ></circle>
            {/each}
        </g>
    {:else if type === PieceType.Gate}
        <!-- A ring with an open center: a doorway. -->
        <circle r="17" stroke-width="5"></circle>
        <circle r="8" stroke-width="2" stroke-opacity="0.6"></circle>
    {:else if type === PieceType.ArtificialPlanet}
        <!-- A planet in the making: a dashed globe. -->
        <circle r="20" stroke-width="3" stroke-dasharray="5 4"></circle>
        <circle r="9" fill={color} stroke="none"></circle>
    {:else if type === PieceType.QuarantineBeacon}
        <!-- Kin to the Interdictor, but its "no" is to probes: a little probe struck through
             inside a cordon. The cordon is a dashed ring that turns slowly, and a barrier stands
             toward each of the six hexes whose planets it closes, the six lit in turn like a
             beacon sweeping round. -->
        <circle class="quarantine-cordon" r="17" stroke-width="2" stroke-dasharray="4 3.63"
        ></circle>
        {#each quarantineBarriers as d, index (d)}
            <path
                class="quarantine-barrier"
                style="animation-delay: {index * 0.5}s"
                {d}
                stroke-width="3"
                stroke-linecap="round"
            ></path>
        {/each}
        <!-- The probe: a body and its two panels. -->
        <circle r="3" fill={color} stroke="none"></circle>
        <path d="M-3,0 L-5,0 M3,0 L5,0" stroke-width="1.5"></path>
        <rect x="-10.5" y="-2.6" width="5.5" height="5.2" rx="0.8" fill={color} stroke="none"
        ></rect>
        <rect x="5" y="-2.6" width="5.5" height="5.2" rx="0.8" fill={color} stroke="none"></rect>
        <!-- Struck through, as the Interdictor's ring is barred. -->
        <path d="M-9,-9 L9,9" stroke="#0b1222" stroke-width="5.5" stroke-linecap="round"></path>
        <path d="M-9,-9 L9,9" stroke-width="3" stroke-linecap="round"></path>
    {:else if type === PieceType.Bastion}
        <!-- A shield. -->
        <path
            d="M0,-18 L16,-11 L14,6 L0,18 L-14,6 L-16,-11 Z"
            stroke-width="4"
            fill={color}
            fill-opacity="0.3"
        ></path>
    {:else if type === PieceType.Jammer}
        <!-- A scrambler: a core inside two broken rings that turn against each other, slowly.
             On the board a wave runs out from it now and then to the edge of its reach. -->
        <circle r="5" fill={color} stroke="none"></circle>
        <circle
            class="jammer-ring jammer-ring-inner"
            r="13"
            stroke-width="3.5"
            stroke-dasharray="9 4 3 6 14 5 4 7"
            stroke-linecap="round"
        ></circle>
        <circle
            class="jammer-ring jammer-ring-outer"
            r="21"
            stroke-width="2.5"
            stroke-opacity="0.7"
            stroke-dasharray="6 7 16 4 5 9 11 6"
            stroke-linecap="round"
        ></circle>
    {:else if type === PieceType.Carrier}
        <!-- A long hull with three bays. -->
        <rect
            x="-19"
            y="-7"
            width="38"
            height="14"
            rx="4"
            stroke-width="3"
            fill={color}
            fill-opacity="0.35"
        ></rect>
        <circle cx="-10" r="3" fill={color} stroke="none"></circle>
        <circle cx="0" r="3" fill={color} stroke="none"></circle>
        <circle cx="10" r="3" fill={color} stroke="none"></circle>
    {:else if type === PieceType.DeepScanner}
        <!-- A lens. -->
        <circle r="14" stroke-width="4"></circle>
        <circle r="6" fill={color} stroke="none"></circle>
        <path d="M10,10 L19,19" stroke-width="4" stroke-linecap="round"></path>
    {:else if type === PieceType.SalvageDrone}
        <!-- A factory ship, nose up: a spine carrying two pairs of processing holds, and an
             engine block astern. Lights run down the spine from bow to
             stern as the catch is worked, and the engines flicker. On the board its nanobots
             wander out to the edge of its reach and bring back what they find. -->
        <!-- Drawn from the bow at -15.5 to the exhaust's tip at 24, so lifted to sit centered. -->
        <g transform="translate(0 -4.25)">
            <!-- The holds, a pair either side of the spine. -->
            {#each [-10, -1] as y (y)}
                {#each [-11.5, 4] as x (x)}
                    <rect
                        {x}
                        {y}
                        width="7.5"
                        height="7"
                        rx="1.2"
                        stroke-width="2"
                        fill={color}
                        fill-opacity="0.3"
                    ></rect>
                {/each}
            {/each}
            <!-- The spine, and the lights that run down it. -->
            <path d="M0,-13 L0,10" stroke-width="5" stroke-linecap="round" stroke-opacity="0.55"
            ></path>
            {#each [-8.5, -2, 4.5] as y, index (y)}
                <circle
                    class="drone-furnace"
                    style="animation-delay: {index * 0.5}s"
                    cy={y}
                    r="1.8"
                    fill={color}
                    stroke="none"
                ></circle>
            {/each}
            <!-- The engine block and its two nozzles. -->
            <path d="M-9,9 L9,9 L7,16 L-7,16 Z" fill={color} stroke-width="1.5"></path>
            {#each [-4.5, 4.5] as x, index (x)}
                <path
                    class="drone-exhaust"
                    style="animation-delay: {index * -0.37}s"
                    d="M{x - 2.2},17.5 L{x},24 L{x + 2.2},17.5 Z"
                    fill={color}
                    stroke="none"
                ></path>
            {/each}
        </g>
    {:else if type === PieceType.Scrap}
        <!-- A buckled hull plate, snapped across. Only ever seen on a card. -->
        <path d="M-17,-9 L-2,-15 L3,-3 L-6,4 L-14,2 Z" stroke-width="2.5"></path>
        <path d="M6,-4 L17,-8 L15,9 L1,15 L-3,7 Z" stroke-width="2.5"></path>
        <path d="M-12,-6 L-7,-2 M9,2 L12,6" stroke-width="2" stroke-linecap="round"></path>
    {/if}
</g>

<style>
    /* Use the `animation` shorthand: Svelte rewrites scoped @keyframes names only there. */
    .interdictor-bar {
        transform-box: fill-box;
        transform-origin: center;
        animation: interdictor-turn 24s linear infinite;
    }

    /* The two arms mirror each other, so their own middle is the seeder's. */
    .seeder-arms {
        transform-box: fill-box;
        transform-origin: center;
        animation: seeder-turn 40s linear infinite;
    }

    @keyframes seeder-turn {
        to {
            transform: rotate(360deg);
        }
    }

    .quarantine-cordon {
        transform-box: fill-box;
        transform-origin: center;
        animation: seeder-turn 50s linear infinite;
    }

    /* Each barrier in turn, one after another round the ring. */
    .quarantine-barrier {
        animation: quarantine-sweep 3s ease-in-out infinite;
    }

    @keyframes quarantine-sweep {
        0%,
        40%,
        100% {
            opacity: 0.45;
        }
        12% {
            opacity: 1;
        }
    }

    .jammer-ring {
        transform-box: fill-box;
        transform-origin: center;
    }

    .jammer-ring-inner {
        animation: seeder-turn 30s linear infinite;
    }

    .jammer-ring-outer {
        animation: interdictor-turn 43s linear infinite;
    }

    .drone-furnace {
        animation: drone-furnace-frames 2s ease-in-out infinite;
    }

    .drone-exhaust {
        animation: drone-exhaust-frames 0.9s ease-in-out infinite;
    }

    @keyframes drone-exhaust-frames {
        0%,
        100% {
            opacity: 0.35;
        }
        50% {
            opacity: 0.85;
        }
    }

    @keyframes drone-furnace-frames {
        0%,
        100% {
            opacity: 0.25;
        }
        35% {
            opacity: 1;
        }
    }

    @keyframes interdictor-turn {
        to {
            transform: rotate(-360deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .interdictor-bar,
        .seeder-arms,
        .jammer-ring,
        .drone-furnace,
        .drone-exhaust,
        .quarantine-cordon,
        .quarantine-barrier {
            animation: none;
        }
    }
</style>
