<script lang="ts">
    import { PieceType } from '@tabletop/earendel'
    import UnitGlyph from './UnitGlyph.svelte'

    // A special unit's board shape at a given size, for the cards that name the units in play.
    let {
        type,
        hub = false,
        color,
        size
    }: { type: PieceType; hub?: boolean; color: string; size: number } = $props()
    const center = { x: 0, y: 0 }
    // The shapes fit a radius of 24, except the hub, whose turning ring of pods reaches 31, and
    // the nebula seeder, whose arms reach as far.
    let extent = $derived(hub || type === PieceType.NebulaSeeder ? 32 : 24)
</script>

<svg
    viewBox="{-extent} {-extent} {2 * extent} {2 * extent}"
    height={size}
    width={size}
    class="shrink-0"
    aria-hidden="true"
>
    <UnitGlyph {type} {hub} {color} {center} />
</svg>
