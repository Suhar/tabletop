<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        type PieceType,
        TECHNOLOGY_CATEGORY_INFO,
        TECHNOLOGY_EFFECT_INFO,
        type TechnologyCategory,
        type TechnologyEffectKind
    } from '@tabletop/earendel'
    import UnitShape from './UnitShape.svelte'

    let {
        kind,
        category,
        type,
        hub = false,
        name,
        rules,
        enlarged = false
    }: {
        kind: TechnologyEffectKind
        category: TechnologyCategory
        type: PieceType
        hub?: boolean
        name: string
        rules: string
        // Grown to read, about two and a half times, from its left edge out over the board.
        enlarged?: boolean
    } = $props()

    const gameSession = getGameSession()

    let fill = $derived(gameSession.planetFill(TECHNOLOGY_CATEGORY_INFO[category].color))
</script>

<!-- A landscape card in the category's color: the special unit in play for that category. -->
<div
    class="relative flex min-h-[112px] w-[202px] shrink-0 flex-col overflow-hidden rounded-xl border-2 bg-[#0d1424] text-white shadow-xl transition-transform duration-200 ease-out"
    style="border-color: {fill}; transform-origin: left center; transform: scale({enlarged
        ? 2.5
        : 1})"
>
    <!-- The band: the technology that grants the unit. -->
    <div
        class="flex items-center px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.14em] text-[#0b1222]"
        style="background-color: {fill}"
    >
        <span class="truncate">{TECHNOLOGY_EFFECT_INFO[kind].name}</span>
    </div>
    <div class="flex flex-1 items-center gap-2 px-2 py-1">
        <UnitShape {type} {hub} color={fill} size={40} />
        <div class="flex min-w-0 flex-col gap-0.5">
            <div class="text-[12px] font-bold leading-tight" style="color: {fill}">{name}</div>
            <div class="text-[8px] leading-snug text-white/80">{rules}</div>
        </div>
    </div>
</div>
