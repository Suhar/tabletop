<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { technologyAbility, technologyCard, technologyName } from '@tabletop/earendel'
    import { describeActionSegments } from '$lib/utils/describe.js'
    import TechnologyChip from './TechnologyChip.svelte'
    import PlanetBadge from './PlanetBadge.svelte'

    let {
        action,
        justify = 'start'
    }: { action: GameAction; justify?: 'start' | 'center' | 'end' } = $props()

    let segments = $derived(describeActionSegments(action))

    const ALIGN = { start: 'text-left', center: 'text-center', end: 'text-right' }
</script>

<!-- One flowing sentence: the words follow the name on its line and wrap where they must. As
     separate boxes in a row, a long stretch of text would drop whole to the line below. -->
<div class="{ALIGN[justify]} leading-relaxed">
    <PlayerName playerId={action.playerId} />
    {#each segments as segment, index (index)}
        {' '}
        {#if segment.kind === 'text'}
            <span>{segment.text}</span>
        {:else if segment.kind === 'claimant'}
            <PlayerName
                playerId={segment.playerId}
                possessive
                possessivePlayerId={action.playerId}
            />
        {:else if segment.kind === 'planet'}
            <span class="inline-block align-middle">
                <PlanetBadge
                    color={segment.color}
                    copy="history-{justify}-{action.id}-{index}"
                    height={18}
                />
            </span>
        {:else}
            {@const card = technologyCard(segment.technologyId)}
            <span class="inline-block align-middle">
                <TechnologyChip
                    kind={card.effect}
                    name={technologyName(card)}
                    ability={technologyAbility(card)}
                    planet={segment.planet}
                />
            </span>
        {/if}
    {/each}
</div>
