<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { Description } from '$lib/utils/describeAction.js'
    import RailroadBadge from './RailroadBadge.svelte'

    let { description }: { description: Description } = $props()
</script>

{#each description as segment, index (index)}
    {#if typeof segment === 'string'}<span>{segment}</span>{:else if 'playerId' in segment}<PlayerName
            playerId={segment.playerId}
        />{:else}<RailroadBadge railroadId={segment.railroadId} />{/if}
{/each}
