<script lang="ts">
    import {
        categoryOfColor,
        PLANET_COLORS,
        TECHNOLOGY_CATEGORY_INFO,
        TECHNOLOGY_EFFECT_INFO,
        isElevated,
        PieceType,
        technologyAbility,
        technologyCard,
        type TechnologyCard,
        technologyName
    } from '@tabletop/earendel'
    import { slide } from 'svelte/transition'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { getHandAnimator } from '$lib/model/handAnimatorContext.js'
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState, TechnologyEffectKind } from '@tabletop/earendel'
    import { grantedPieceName } from '$lib/utils/specialPieces.js'
    import { describePiece } from '$lib/utils/describe.js'
    import { Power } from '$lib/model/stagedSelection.js'
    import TechnologyChip from './TechnologyChip.svelte'
    import Hand from './Hand.svelte'
    import ShipCard from './ShipCard.svelte'
    import StowChoices from './StowChoices.svelte'
    import AsteroidChoices from './AsteroidChoices.svelte'
    import RulesPill from './RulesPill.svelte'
    import PlanetBadge from './PlanetBadge.svelte'

    let gameSession = getGameSession()
    const handAnimator = getHandAnimator()

    let specials = $derived(gameSession.myPlayerState?.specialPieces ?? [])

    // The bag sits beside the prompt until the turn's draw; the deal replaces the prompt with
    // the ships, and once the state shows them the hand stands where they landed while a ship
    // is still held, each ship turning face down as it goes and the hand fading once the last
    // has gone.
    let bagShown = $derived(gameSession.gameState.machineState === MachineState.StartOfTurn)
    let dealing = $derived(handAnimator.dealing?.pieces ?? [])
    let handShown = $derived(
        bagShown ||
            dealing.length > 0 ||
            (gameSession.isMyTurn && gameSession.turnHand.some((card) => card.held))
    )

    // Salvage Rights offers every discarded technology the player lacks: the same technology
    // once, however many copies lie in the discard, taking the first copy when chosen.
    let salvageOptions = $derived.by(() => {
        const groups = new Map<string, { card: TechnologyCard; count: number }>()
        for (const card of gameSession.salvageChoices) {
            const name = technologyName(card)
            const group = groups.get(name)
            if (group) group.count += 1
            else groups.set(name, { card, count: 1 })
        }
        return [...groups.values()]
    })

    let powersShown = $derived(
        gameSession.torpedoFighter !== undefined ||
            gameSession.canUseLogisticsUpgrade ||
            gameSession.canUseUpdatedLogistics ||
            gameSession.canUseTacticalShift ||
            gameSession.canUseWarpDrive ||
            gameSession.canUseConscription ||
            gameSession.canUseFactoryOverride ||
            gameSession.canUseColonyShip ||
            gameSession.canUseDimensionalRift ||
            gameSession.canUseBeyondTheFrontier ||
            gameSession.canUseSpoofedOrders ||
            gameSession.canUseAsteroidField ||
            gameSession.canUseSecurityBreach ||
            gameSession.canUseTacticalFeint ||
            gameSession.canUseImmediateDownload ||
            gameSession.canUseTradeRouteWormhole
    )
    // Whether the turn offers anything beyond the prompt, the notes and the powers: a choice or
    // a button. With a hand on show these stand beside it.
    let controlsShown = $derived(
        gameSession.isChoosingEventOrder ||
            salvageOptions.length > 0 ||
            gameSession.shipyardChoices.length > 0 ||
            gameSession.technologyChoices.length > 0 ||
            gameSession.stowableShips.length > 0 ||
            gameSession.asteroidShips.length > 0 ||
            gameSession.breachTargets.length > 0 ||
            gameSession.isPlacingTile ||
            gameSession.canEndTurn ||
            gameSession.canSpread ||
            gameSession.canArmRailgun ||
            gameSession.isSeeding ||
            gameSession.canFoundPlanet ||
            gameSession.canTerraform ||
            gameSession.canHoldFire ||
            gameSession.isDrifting
    )
    // When a cooldown or stored power may be played (rules.md, Ending a turn): before, between
    // or after the turn's ships, and once they are down, before the turn ends.
    let powerTiming = $derived(
        gameSession.canEndTurn ? 'now, or end your turn' : 'before, between or after your ships'
    )

    let myTint = $derived(gameSession.colors.getPlayerUiColor(gameSession.myPlayer?.id))

    // A choice offered inside the prompt's sentence, as Löwenherz's status messages do: a yellow
    // pill with dark text.
    const inlineButton =
        'inline-block align-baseline leading-none px-2 py-[3px] rounded bg-[#ffe14d] text-[#0b1222] font-semibold hover:bg-[#fff08a]'
</script>

<!-- A technology the player could use now, as the chip the player panel shows, in their color:
     hover or a tap explains it, a click plays it, and its second line says when it may be
     played, or what to do next while it is. -->
{#snippet power(kind: TechnologyEffectKind, note: string, active: boolean)}
    <TechnologyChip
        {kind}
        name={TECHNOLOGY_EFFECT_INFO[kind].name}
        ability={TECHNOLOGY_EFFECT_INFO[kind].ability}
        tint={myTint}
        {note}
        {active}
        onchoose={gameSession.powerActivators.get(kind)}
    />
{/snippet}

<!-- The technologies the player could use now. Beside the hand while there is one; on their
     own row otherwise. -->
{#snippet powers()}
    {#if gameSession.torpedoFighter}
        {@render power(
            TechnologyEffectKind.GammaTorpedo,
            gameSession.torpedoArmed
                ? 'Armed: place the fighter beside a station'
                : 'arm it, then place the fighter beside a station',
            gameSession.torpedoArmed
        )}
    {/if}
    {#if gameSession.canUseLogisticsUpgrade}
        {@render power(
            TechnologyEffectKind.LogisticsUpgrade,
            'now, instead of discarding: keep all three',
            false
        )}
    {/if}
    {#if gameSession.canUseUpdatedLogistics}
        {@render power(
            TechnologyEffectKind.UpdatedLogistics,
            gameSession.choosingUpdatedLogistics ? 'Choose a fighter to attack with' : powerTiming,
            gameSession.choosingUpdatedLogistics
        )}
    {/if}
    {#if gameSession.canUseTacticalShift}
        {@render power(
            TechnologyEffectKind.MoveFriendlyPiece,
            !gameSession.choosingShift
                ? `once: ${powerTiming}`
                : gameSession.shiftFrom
                  ? 'Choose the empty hex to step into'
                  : 'Choose one of your pieces',
            gameSession.choosingShift
        )}
    {/if}
    {#if gameSession.canUseWarpDrive}
        {@render power(
            TechnologyEffectKind.WarpDrive,
            !gameSession.choosingWarp
                ? `once: ${powerTiming}`
                : gameSession.warpFrom
                  ? 'Choose the empty hex to come out on'
                  : 'Choose one of your pieces',
            gameSession.choosingWarp
        )}
    {/if}
    {#if gameSession.canUseDimensionalRift}
        {@render power(
            TechnologyEffectKind.DimensionalRift,
            !gameSession.choosingRift
                ? `once: ${powerTiming}`
                : gameSession.riftFrom
                  ? 'Choose the empty border hex to come out on'
                  : 'Choose one of your pieces on the border',
            gameSession.choosingRift
        )}
    {/if}
    {#if gameSession.canUseSpoofedOrders}
        {@render power(
            TechnologyEffectKind.SpoofedOrders,
            !gameSession.choosingSpoof
                ? `once: ${powerTiming}`
                : gameSession.spoofFrom
                  ? 'Choose the empty hex to send it into'
                  : "Choose a rival's piece beside one of yours",
            gameSession.choosingSpoof
        )}
    {/if}
    {#if gameSession.canUseConscription}
        {@render power(
            TechnologyEffectKind.Conscription,
            `${powerTiming} — your discard goes back in your bag`,
            false
        )}
    {/if}
    {#if gameSession.canUseColonyShip}
        {@render power(
            TechnologyEffectKind.ColonyShip,
            gameSession.choosingColony ? 'Choose a planet you control' : `once: ${powerTiming}`,
            gameSession.choosingColony
        )}
    {/if}
    {#if gameSession.canUseFactoryOverride}
        {@render power(
            TechnologyEffectKind.FactoryOverride,
            `once: ${powerTiming} — draws two more ships to place`,
            false
        )}
    {/if}
    {#if gameSession.canUseAsteroidField}
        {@render power(
            TechnologyEffectKind.AsteroidField,
            gameSession.choosingAsteroid ? 'Choose the ship to build' : `once: ${powerTiming}`,
            gameSession.choosingAsteroid
        )}
    {/if}
    {#if gameSession.canUseSecurityBreach}
        {@render power(
            TechnologyEffectKind.SecurityBreach,
            gameSession.choosingBreach ? 'Choose an opponent' : `once: ${powerTiming}`,
            gameSession.choosingBreach
        )}
    {/if}
    {#if gameSession.canUseBeyondTheFrontier}
        {@render power(
            TechnologyEffectKind.GrowBoard,
            `once: ${powerTiming} — draws the tile and its ship`,
            false
        )}
    {/if}
    {#if gameSession.canUseTacticalFeint}
        {@render power(
            TechnologyEffectKind.TacticalFeint,
            !gameSession.choosingFeint
                ? powerTiming
                : gameSession.feintFrom
                  ? 'Choose the enemy ship to swap with'
                  : 'Choose one of your ships',
            gameSession.choosingFeint
        )}
    {/if}
    {#if gameSession.canUseImmediateDownload}
        {@render power(
            TechnologyEffectKind.ImmediateDownload,
            !gameSession.choosingDownload
                ? powerTiming
                : gameSession.downloadFrom
                  ? 'Choose a planet within three hexes'
                  : 'Choose your Download planet',
            gameSession.choosingDownload
        )}
    {/if}
    {#if gameSession.canUseTradeRouteWormhole}
        {@render power(
            TechnologyEffectKind.TradeRouteWormhole,
            !gameSession.choosingWormhole
                ? powerTiming
                : gameSession.wormholeFrom
                  ? 'Choose where it comes out'
                  : 'Choose a ship to send',
            gameSession.choosingWormhole
        )}
    {/if}
{/snippet}

<div class="flex flex-col items-center gap-2 pt-1 text-white">
    <!-- The prompt keeps its line while the bag holds the text, so the hand never moves when
         the next prompt arrives. -->
    {#if gameSession.boardAssembling}
        <!-- Nothing is said until the board has been built. -->
        <div class="text-sm sm:text-base">&nbsp;</div>
    {:else if gameSession.isMyTurn && gameSession.choosablePlanets.length === 1}
        <div class="text-center text-sm sm:text-base">
            Your probes lead on this planet —
            <button
                type="button"
                class={inlineButton}
                onclick={() => gameSession.choosePlanet(gameSession.choosablePlanets[0])}
            >
                survey
            </button>
            it, or
            <button type="button" class={inlineButton} onclick={() => gameSession.skipSurvey()}
                >skip</button
            >.{#if gameSession.rulesHelp}<RulesPill help={gameSession.rulesHelp} />{/if}
        </div>
    {:else if gameSession.isMyTurn && gameSession.choosablePlanets.length > 1}
        <div class="text-center text-sm sm:text-base">
            Your probes lead on more than one planet — click the one to survey, or
            <button type="button" class={inlineButton} onclick={() => gameSession.skipSurvey()}
                >skip</button
            >.{#if gameSession.rulesHelp}<RulesPill help={gameSession.rulesHelp} />{/if}
        </div>
    {:else if gameSession.prompt && !bagShown}
        <!-- The prompt, and beside it the Rules pill for the decision it asks for. -->
        <div class="text-center text-sm sm:text-base">
            {#if gameSession.waitingFor}Waiting for <PlayerName
                    playerId={gameSession.waitingFor}
                />.{:else}{gameSession.prompt}{/if}{#if gameSession.rulesHelp}<RulesPill
                    help={gameSession.rulesHelp}
                />{/if}
        </div>
    {:else if bagShown}
        <!-- The prompt's own line height, so the hand does not move when the text arrives. -->
        <div class="text-sm sm:text-base">&nbsp;</div>
    {/if}

    <!-- What the turn has to say beyond the prompt: probes gone into orbit, globals in force.
         Always on rows of their own under the prompt, above any hand, each sliding open so
         that whatever lies below slides down and never jumps. -->
    {#snippet notes()}
        {#each gameSession.orbitNotes as orbit (orbit.key)}
            <!-- A probe gone into orbit, and the technology that sent it, named by a chip that
                 explains itself on hover or click. -->
            <div
                transition:slide={{ duration: 200 }}
                class="flex py-1 flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-sm"
            >
                <PlayerName playerId={orbit.playerId} possessive />
                <span>
                    {orbit.probes === 1 ? 'probe' : `${orbit.probes} probes`} went into orbit,
                    {orbit.elevated ? 'discovering' : 'gaining'}
                </span>
                {#each orbit.technologyIds as technologyId, index (technologyId)}
                    {@const card = technologyCard(technologyId)}
                    {#if index > 0}<span>and</span>{/if}
                    <TechnologyChip
                        kind={card.effect}
                        name={technologyName(card)}
                        ability={technologyAbility(card)}
                        colors={card.colors}
                        elevated={isElevated(card)}
                    />
                {/each}
            </div>
        {/each}
        {#each gameSession.surveyUnblocks as claim (claim.playerId + (claim.color ?? ''))}
            <!-- What surveying would give up: this probe is all that stands in the way of a
                 rival's claim next door. -->
            <div
                transition:slide={{ duration: 200 }}
                class="flex py-1 flex-wrap items-center justify-center gap-x-1 text-center text-xs text-white/75"
            >
                <span>Surveying commits this probe, so it will stop blocking</span>
                <PlayerName playerId={claim.playerId} possessive />
                <span>claim on the</span>
                {#if claim.color}
                    <PlanetBadge color={claim.color} copy="unblock-{claim.color}" height={18} />
                {/if}
                <span>planet beside it. Skip to keep blocking it.</span>
            </div>
        {/each}
        {#each gameSession.ruleNotes as note (note.kind)}
            <!-- Why the game is behaving differently: a global in force, named by a chip that explains
                 itself on hover or click. -->
            <div
                transition:slide={{ duration: 200 }}
                class="flex py-1 flex-wrap items-center justify-center gap-x-1 text-center text-xs text-white/75"
            >
                <span>{note.before}</span>
                <TechnologyChip
                    kind={note.kind}
                    name={TECHNOLOGY_EFFECT_INFO[note.kind].name}
                    ability={TECHNOLOGY_EFFECT_INFO[note.kind].ability}
                    detail="A global: in force for everyone for the rest of the game."
                />
                <span>{note.after}</span>
            </div>
        {/each}
    {/snippet}
    <!-- The choices and buttons the turn offers. With a hand on show they stand in a column
         beside the cards, which slide left to make room, so the cards are never pushed out of
         the bar; with no hand they take the rows under the notes. -->
    {#snippet choices()}
        {#if gameSession.isChoosingEventOrder}
            <!-- The discoverer goes first; the others are lined up in the order clicked. -->
            <div class="flex flex-wrap items-center justify-center gap-2 text-sm">
                <span class="text-xs uppercase tracking-widest opacity-60">Order</span>
                {#if gameSession.myPlayer}
                    <PlayerName playerId={gameSession.myPlayer.id} />
                {/if}
                {#each gameSession.eventOrderDraft as playerId (playerId)}
                    <span class="opacity-60">→</span>
                    <PlayerName {playerId} />
                {/each}
                {#each gameSession.eventOrderCandidates as playerId (playerId)}
                    <button
                        type="button"
                        class="rounded-full border-2 border-white/60 bg-white/10 px-2 py-0.5 hover:bg-white/20"
                        onclick={() => gameSession.addToEventOrder(playerId)}
                    >
                        <PlayerName {playerId} />
                    </button>
                {/each}
                {#if gameSession.canConfirmEventOrder}
                    <button
                        type="button"
                        class="rounded-md px-4 py-1.5 text-sm font-semibold bg-amber-300/20 hover:bg-amber-300/30 border-2 border-amber-300"
                        onclick={() => gameSession.chooseEventOrder()}
                    >
                        Confirm order
                    </button>
                {/if}
            </div>
        {/if}

        {#if salvageOptions.length > 0}
            <!-- Each technology once, with a count when the discard holds more than one copy. -->
            <div class="flex flex-wrap items-center justify-center gap-2">
                {#each salvageOptions as { card, count } (card.id)}
                    <TechnologyChip
                        kind={card.effect}
                        name={technologyName(card)}
                        ability={technologyAbility(card)}
                        colors={card.colors}
                        count={count > 1 ? count : undefined}
                        onchoose={() => gameSession.eventPick({ technologyId: card.id })}
                    />
                {/each}
            </div>
        {/if}

        {#if gameSession.shipyardChoices.length > 0}
            <!-- One of each unit in play, each going once. -->
            <div class="flex flex-wrap items-center justify-center gap-2">
                {#each gameSession.shipyardChoices as kind (kind)}
                    <button
                        type="button"
                        class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
                        title={TECHNOLOGY_EFFECT_INFO[kind].ability}
                        onclick={() => gameSession.eventPick({ piece: kind })}
                    >
                        {grantedPieceName(kind) ?? TECHNOLOGY_EFFECT_INFO[kind].name}
                    </button>
                {/each}
            </div>
        {/if}

        {#if gameSession.technologyChoices.length > 0}
            <div class="flex flex-wrap items-center justify-center gap-2">
                {#each gameSession.technologyChoices as card (card.id)}
                    <TechnologyChip
                        kind={card.effect}
                        name={technologyName(card)}
                        ability={technologyAbility(card)}
                        colors={card.colors}
                        elevated={isElevated(card)}
                        onchoose={() => gameSession.chooseTechnology(card.id)}
                    />
                {/each}
            </div>
        {/if}
    {/snippet}
    {#snippet actions()}
        {#if gameSession.isPlacingTile}
            <!-- Rotating is worth offering even when the outline repeats: the planet swaps corners. -->
            <div class="flex items-center gap-2">
                <button
                    class="rounded-md px-3 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
                    onclick={() => gameSession.rotateTile(-1)}
                >
                    ⟲ Rotate
                </button>
                <span class="text-xs opacity-75">turn {gameSession.tileRotation + 1} of 6</span>
                <button
                    class="rounded-md px-3 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
                    onclick={() => gameSession.rotateTile(1)}
                >
                    Rotate ⟳
                </button>
            </div>
        {/if}

        {#if gameSession.asteroidShips.length > 0}
            <AsteroidChoices />
        {/if}

        {#if gameSession.breachTargets.length > 0}
            <!-- A Security Breach's opponents to choose from. -->
            <div class="flex flex-wrap items-center justify-center gap-2 text-sm">
                <span class="text-xs uppercase tracking-widest opacity-60">Scrap for</span>
                {#each gameSession.breachTargets as playerId (playerId)}
                    <button
                        type="button"
                        class="rounded-full border-2 border-white/60 bg-white/10 px-2 py-0.5 hover:bg-white/20"
                        onclick={() => gameSession.useSecurityBreach(playerId)}
                    >
                        <PlayerName {playerId} />
                    </button>
                {/each}
            </div>
        {/if}

        {#if gameSession.canEndTurn}
            <button
                class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
                onclick={() => gameSession.endTurn()}
            >
                End turn
            </button>
        {/if}

        {#if gameSession.canSpread}
            <div class="flex items-center gap-2">
                <button
                    class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.spreading
                        ? 'bg-orange-400/30 border-orange-300'
                        : 'bg-white/15 hover:bg-white/25 border-white/70'}"
                    onclick={() => gameSession.choosePower(Power.Spread)}
                >
                    Full Torpedo Spread
                </button>

                {#if gameSession.spreading}
                    <button
                        disabled={!gameSession.canConfirmSpread}
                        class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.canConfirmSpread
                            ? 'bg-orange-400/30 border-orange-300 hover:bg-orange-400/40'
                            : 'border-white/25 bg-white/5 opacity-50 cursor-default'}"
                        onclick={() => gameSession.confirmSpread()}
                    >
                        Fire at {gameSession.spreadTargets.length}
                    </button>
                {/if}
            </div>
        {/if}

        {#if gameSession.canArmRailgun}
            <button
                class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.railgunArmed
                    ? 'bg-red-400/30 border-red-300'
                    : 'bg-white/15 hover:bg-white/25 border-white/70'}"
                onclick={() => gameSession.choosePower(Power.Railgun)}
            >
                {gameSession.railgunArmed ? 'Railgun armed' : 'Arm Railgun'}
            </button>
        {/if}

        {#if gameSession.isSeeding}
            <button
                class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
                onclick={() => gameSession.skipSeeding()}
            >
                Leave the nebula be
            </button>
        {/if}

        {#if gameSession.stowableShips.length > 0}
            {#if gameSession.boardAssembling}
                <!-- The cards' own height, so the board does not move when they arrive. -->
                <div class="min-h-[104px]"></div>
            {:else}
                <StowChoices />
            {/if}
        {/if}

        {#if gameSession.canFoundPlanet}
            <div class="flex flex-wrap items-center justify-center gap-2">
                {#each PLANET_COLORS as color (color)}
                    {@const category = TECHNOLOGY_CATEGORY_INFO[categoryOfColor(color)]}
                    <button
                        class="inline-flex items-center gap-1.5 rounded-md border-2 bg-[#0d1424] px-3 py-1 text-sm font-semibold text-white hover:bg-[#1b2740]"
                        style="border-color: {gameSession.planetFill(color)}"
                        onclick={() => gameSession.foundPlanet(color)}
                    >
                        <PlanetBadge {color} copy="found-{color}" height={22} />
                        <span>{category.name}</span>
                    </button>
                {/each}
            </div>
        {/if}

        {#if gameSession.canTerraform}
            <div class="flex flex-wrap items-center justify-center gap-2">
                {#each gameSession.terraformColors as color (color)}
                    {@const category = TECHNOLOGY_CATEGORY_INFO[categoryOfColor(color)]}
                    <button
                        class="inline-flex items-center gap-1.5 rounded-md border-2 bg-[#0d1424] px-3 py-1 text-sm font-semibold text-white hover:bg-[#1b2740]"
                        style="border-color: {gameSession.planetFill(color)}"
                        onclick={() => gameSession.terraform(color)}
                    >
                        <PlanetBadge {color} copy="terraform-{color}" height={22} />
                        <span>{category.name}</span>
                    </button>
                {/each}
                <button
                    class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
                    onclick={() => gameSession.terraform()}
                >
                    Leave it
                </button>
            </div>
        {/if}

        {#if gameSession.canHoldFire}
            <button
                class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
                onclick={() => gameSession.holdFire()}
            >
                Hold fire
            </button>
        {/if}

        {#if gameSession.isDrifting}
            <button
                class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
                onclick={() => gameSession.holdPosition()}
            >
                Hold position
            </button>
        {/if}
    {/snippet}
    {#snippet beside()}
        {@render choices()}
        {#if powersShown}
            {@render powers()}
        {/if}
        {@render actions()}
    {/snippet}
    <!-- No room is kept for the notes: each slides open and what lies below slides down. The
         wrapper's negative margin cancels the notes' own padding, so the wrapper adds nothing
         to the column's spacing while it is empty and the spacing does not jump when it fills. -->
    <div class="-my-1 flex flex-col items-center">
        {@render notes()}
    </div>
    {#if !handShown}
        {@render choices()}
        {#if powersShown}
            <div class="flex flex-wrap items-stretch justify-center gap-2">
                {@render powers()}
            </div>
        {/if}
        {@render actions()}
    {/if}
    <!-- The hand comes last: whatever the turn asks for next (a technology, a tile, a power) sits
         under the prompt, and the ships already played lie face down below it. -->
    {#snippet besideBag()}
        <!-- One line, the pill at its right. It may run past the box the hand holds for it
             (three cards wide), which keeps its width so the bag stays put when the cards come. -->
        <div class="flex items-center whitespace-nowrap text-left text-sm sm:text-base">
            {#if gameSession.waitingFor}
                <span>Waiting for <PlayerName playerId={gameSession.waitingFor} />.</span>
            {:else}
                <span>{gameSession.prompt}</span>
            {/if}
            {#if gameSession.rulesHelp}
                <span class="shrink-0"><RulesPill help={gameSession.rulesHelp} /></span>
            {/if}
        </div>
    {/snippet}
    <!-- The special pieces playable instead of the draw, as cards on the hand's level. -->
    {#snippet specialCards()}
        {#each specials as special (special.id)}
            <button
                type="button"
                class="rounded-lg transition-transform hover:-translate-y-1"
                title="{describePiece(special)} — played instead of your draw, which {gameSession
                    .heldPieces.length === 1
                    ? 'goes'
                    : 'all goes'} back in the bag"
                onclick={() => gameSession.chooseSpecial(special.id)}
            >
                <ShipCard piece={special} selected={gameSession.chosenSpecialId === special.id} />
            </button>
        {/each}
    {/snippet}
    <Hand
        cards={gameSession.isMyTurn}
        interactive={gameSession.isMyTurn}
        beside={besideBag}
        side={beside}
        sideShown={powersShown || controlsShown}
        specials={specialCards}
        specialsShown={gameSession.canPlaySpecial && specials.length > 0}
    />
</div>

<style>
    .discardable {
        transition:
            opacity 120ms ease-out,
            filter 120ms ease-out;
    }

    .discardable:hover,
    .discardable:focus-visible {
        opacity: 0.3;
        filter: grayscale(1);
    }
</style>
