<script lang="ts">
    import {
        GRANTED_TYPES,
        PieceType,
        TECHNOLOGY_CATEGORY_INFO,
        TECHNOLOGY_EFFECT_INFO,
        TechnologyEffectKind
    } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { grantedPieceInfo } from '$lib/utils/specialPieces.js'
    import { SPECIAL_UNITS_HELP } from '$lib/utils/rulesHelp.js'
    import DealtCards from './DealtCards.svelte'
    import UnitCard from './UnitCard.svelte'
    import UnitShape from './UnitShape.svelte'

    const gameSession = getGameSession()

    // The special units the setup drew, one per category, with the shape and rules each shows.
    let units = $derived(
        gameSession.piecesInPlay.flatMap(({ category, kind }) => {
            const hub = kind === TechnologyEffectKind.StationUpgrade
            const type = hub
                ? PieceType.Station
                : kind === TechnologyEffectKind.GateNetwork
                  ? PieceType.Gate
                  : GRANTED_TYPES[kind]
            const info = grantedPieceInfo(kind)
            if (!type || !info) return []
            return [
                {
                    category,
                    kind,
                    type,
                    hub,
                    name: info.name,
                    rules: info.rules ?? TECHNOLOGY_EFFECT_INFO[kind].ability,
                    fill: gameSession.planetFill(TECHNOLOGY_CATEGORY_INFO[category].color)
                }
            ]
        })
    )
</script>

<!-- The special units in play, as mini cards like the elevated technologies': the unit in its
     category's color, and its name. Clicking one deals the full cards out to read the rules. -->
<DealtCards
    entries={units}
    id={(unit) => unit.category}
    label="Special units in play"
    caption="Special units in play"
    help={gameSession.rulesHelpShown ? SPECIAL_UNITS_HELP : undefined}
    tint={(unit) => unit.fill}
    title={(unit) =>
        `${unit.name}, from ${TECHNOLOGY_EFFECT_INFO[unit.kind].name} (${TECHNOLOGY_CATEGORY_INFO[unit.category].name})`}
>
    {#snippet mini(unit)}
        <UnitShape type={unit.type} hub={unit.hub} color={unit.fill} size={26} />
        <span
            class="mt-0.5 line-clamp-2 text-center text-[9px] font-semibold leading-[1.1]"
            style="color: {unit.fill}">{unit.name}</span
        >
    {/snippet}
    {#snippet card(unit, enlarged)}
        <UnitCard
            kind={unit.kind}
            category={unit.category}
            type={unit.type}
            hub={unit.hub}
            name={unit.name}
            rules={unit.rules}
            {enlarged}
        />
    {/snippet}
</DealtCards>
