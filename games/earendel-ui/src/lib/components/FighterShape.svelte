<script lang="ts">
    import type { Point } from '@tabletop/common'

    // A fighter drawn as a flight of needle-thin darts, one per level, each with a short glowing
    // engine trail. A fighter's level IS its power, so the number of ships says how strong it is
    // without a numeral to read: one alone, two abreast, three in a V. Damage takes a ship out of
    // the formation, and a level 1 - only ever reached by damage - is a lone survivor.
    //
    // The trails make fighters the one piece on the board that looks like it is moving, which
    // suits the piece that arrives shooting.
    let { center, color, level }: { center: Point; color: string; level: number } = $props()

    // Offsets from the hex centre, and the scale of each dart, per level. The lone dart is drawn
    // larger so a level 1 doesn't look lost in its hex.
    const FORMATIONS: Record<number, { x: number; y: number }[]> = {
        1: [{ x: 0, y: -4 }],
        2: [
            { x: -10, y: -2 },
            { x: 10, y: -8 }
        ],
        3: [
            { x: 0, y: -14 },
            { x: -15, y: 4 },
            { x: 15, y: 4 }
        ]
    }

    let darts = $derived(FORMATIONS[Math.min(Math.max(level, 1), 3)])
    let scale = $derived(level <= 1 ? 1.3 : 1.05)
</script>

{#each darts as dart, index (index)}
    <g transform="translate({center.x + dart.x} {center.y + dart.y}) scale({scale})">
        <!-- Engine trail: a dim plume in the player's colour with a hot core. -->
        <path d="M-2,8 L0,20 L2,8 Z" fill={color} fill-opacity="0.45" />
        <path d="M-1,8 L0,14 L1,8 Z" fill="#fff3cc" fill-opacity="0.8" />
        <path d="M0,-13 L4,4 L7,9 L0,6 L-7,9 L-4,4 Z" fill={color} />
    </g>
{/each}
