<script lang="ts">
    import { technologyName, TechnologyTiming, timingOf } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PLANET_FILL } from '$lib/utils/planetColors.js'
    import { ELEVATED_HELP } from '$lib/utils/rulesHelp.js'
    import DealtCards from './DealtCards.svelte'
    import ElevatedCard from './ElevatedCard.svelte'
    import PlanetBadge from './PlanetBadge.svelte'

    const gameSession = getGameSession()

    type Entry = (typeof gameSession.elevatedCards)[number]
    const isEvent = (entry: Entry) => timingOf(entry.card) === TechnologyTiming.Event
    const spent = (entry: Entry) => entry.housed !== undefined
</script>

<!-- The setup draw's elevated cards, side by side above the panels: the planet and the name.
     Clicking one deals the full cards out to read. -->
<DealtCards
    entries={gameSession.elevatedCards}
    id={(entry) => entry.card.id}
    label="Enhanced techs in play"
    caption="Enhanced techs in play"
    help={gameSession.rulesHelpShown ? ELEVATED_HELP : undefined}
    tint={(entry) => PLANET_FILL[entry.color]}
    title={(entry) =>
        `${technologyName(entry.card)}${spent(entry) ? (isEvent(entry) ? ' — resolved' : ' — active') : ''}`}
    dimmed={(entry) => spent(entry) && isEvent(entry)}
>
    {#snippet mini(entry)}
        <PlanetBadge color={entry.color} copy="mini-{entry.card.id}" height={26} />
        <span
            class="mt-0.5 line-clamp-2 text-center text-[9px] font-semibold leading-[1.1]"
            style="color: {PLANET_FILL[entry.color]}">{technologyName(entry.card)}</span
        >
        {#if spent(entry) && !isEvent(entry)}
            <span class="absolute inset-x-0 bottom-0 h-[3px] rounded-b-md bg-amber-300"></span>
        {/if}
    {/snippet}
    {#snippet card(entry, enlarged)}
        <ElevatedCard card={entry.card} color={entry.color} spent={spent(entry)} {enlarged} />
    {/snippet}
</DealtCards>
