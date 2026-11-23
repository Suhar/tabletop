<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { PieceType } from '@tabletop/earendel'
    import RelayShape from './RelayShape.svelte'
    import SpecialShape from './SpecialShape.svelte'
    import StationShape from './StationShape.svelte'
    import TerraformerShape from './TerraformerShape.svelte'

    // A special unit's board shape about a center, for drawing inside an svg that is already open.
    let {
        type,
        hub = false,
        color,
        center
    }: { type: PieceType; hub?: boolean; color: string; center: Point } = $props()
</script>

{#if type === PieceType.Station}
    <StationShape {center} {color} {hub} />
{:else if type === PieceType.Terraformer}
    <TerraformerShape {center} {color} />
{:else if type === PieceType.Relay}
    <RelayShape {center} {color} />
{:else}
    <SpecialShape {center} {color} {type} />
{/if}
