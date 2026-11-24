<script lang="ts">
    import {
        type PlanetColor,
        technologyAbility,
        technologyName,
        type TechnologyCard,
        TechnologyTiming,
        timingOf
    } from '@tabletop/earendel'
    import { PLANET_FILL } from '$lib/utils/planetColors.js'
    import PlanetBadge from './PlanetBadge.svelte'

    let {
        card,
        color,
        spent = false,
        enlarged = false
    }: {
        card: TechnologyCard
        color: PlanetColor
        // Discovered: the planet is spent for everyone.
        spent?: boolean
        // Grown to read, about two and a half times, from its left edge out over the board.
        enlarged?: boolean
    } = $props()

    let fill = $derived(PLANET_FILL[color])
    let event = $derived(timingOf(card) === TechnologyTiming.Event)
</script>

<!-- A landscape card in the planet's color: the setup draw's elevated card for that color. -->
<div
    class="elevated-card relative flex min-h-[112px] w-[202px] shrink-0 flex-col overflow-hidden rounded-xl border-2 bg-[#0d1424] text-white shadow-xl transition-transform duration-200 ease-out {spent &&
    event &&
    !enlarged
        ? 'opacity-70'
        : ''}"
    style="border-color: {fill}; transform-origin: left center; transform: scale({enlarged
        ? 2.5
        : 1})"
>
    <!-- The band: a discovered global reads Active (an event, Resolved) at the left, the kind at
         the right. -->
    <div
        class="flex items-center justify-between px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.14em] text-[#0b1222]"
        style="background-color: {fill}"
    >
        <span>{spent ? (event ? 'Resolved' : 'Active') : ''}</span>
        <span>{event ? 'Event' : 'Global'}</span>
    </div>
    <div class="flex flex-1 items-center gap-2 px-2 py-1">
        <div class="flex shrink-0 flex-col items-center">
            <PlanetBadge {color} copy="card-{card.id}" height={40} />
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
            <div class="text-[12px] font-bold leading-tight" style="color: {fill}">
                {technologyName(card)}
            </div>
            <div class="text-[8.5px] leading-snug text-white/80">{technologyAbility(card)}</div>
        </div>
    </div>
</div>
