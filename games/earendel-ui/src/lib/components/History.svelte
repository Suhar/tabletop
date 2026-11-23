<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import ActionDescription from './ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { rationaleFor } from '$lib/utils/rationale.js'
    import { setAsideBy } from '$lib/utils/setAside.js'
    import { technologyAbility, technologyName } from '@tabletop/earendel'
    import TechnologyChip from './TechnologyChip.svelte'

    const timeAgo = new TimeAgo('en-US')

    // What an entry can open under itself: why the action came out as it did, for players
    // learning, and the cards a survey turned up and set aside. Each opens on its own.
    type Detail = 'rationale' | 'setAside'
    let expanded: string[] = $state([])
    const detailKey = (id: string, detail: Detail) => `${id}:${detail}`
    function toggle(id: string, detail: Detail) {
        const key = detailKey(id, detail)
        expanded = expanded.includes(key)
            ? expanded.filter((open) => open !== key)
            : [...expanded, key]
    }
    const detailButton =
        'mt-1 mr-1 rounded border border-[#ad9c80]/50 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-[#ad9c80] hover:bg-[#ad9c80]/15'
    const nameOf = (playerId: string) => gameSession.getPlayerName(playerId)

    let gameSession = getGameSession()

    let reversedActions = $derived.by(() => {
        const reversed = gameSession.actions
            .toReversed()
            .toSorted(
                (a, b) =>
                    (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())
            )
        return reversed
    })
</script>

<div
    class="history rounded-lg border border-[#ad9c80] text-center p-2 h-full flex flex-col justify-start items-start overflow-hidden min-h-[300px] bg-black"
>
    <div class="overflow-auto h-full w-full">
        <Timeline class="ms-2 dark:border-[#ad9c80]">
            {#if gameSession.game.finishedAt && !gameSession.isViewingHistory}
                <div
                    class="absolute w-3 h-3 bg-[#ad9c80] rounded-full mt-1.5 -start-1.5 border dark:border-[#ad9c80] dark:bg-[#ad9c80]"
                ></div>
                <TimelineItem
                    timeClass="dark:text-[#ad9c80]"
                    title=""
                    class="timeline-item text-left mb-5"
                    date={timeAgo.format(gameSession.game.finishedAt)}
                >
                    <p class="mt-1 text-left text-sm text-base font-normal text-[#ad9c80">
                        The game has ended.
                    </p>
                </TimelineItem>
            {/if}
            {#each reversedActions as action, i (action.id)}
                <div
                    role="button"
                    tabindex={-1}
                    onfocus={() => {}}
                    onkeypress={() => {}}
                    in:fade={{ duration: 200, easing: quartIn }}
                    out:fade={{ duration: 50 }}
                    animate:flip={{ duration: 100 }}
                >
                    <div
                        class="absolute w-3 h-3 bg-[#ad9c80] rounded-full mt-1.5 -start-1.5 border dark:border-[#ad9c80] dark:bg-[#ad9c80]"
                    ></div>
                    <TimelineItem
                        timeClass="dark:text-[#ad9c80]"
                        title=""
                        class="timeline-item text-left mb-5"
                        date={action.createdAt ? timeAgo.format(action.createdAt) : 'sometime'}
                    >
                        <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                            <ActionDescription {action} justify="start" />
                        </p>
                        {@const reasons = rationaleFor(action, nameOf)}
                        {@const setAside = setAsideBy(action)}
                        {@const reasonsOpen = expanded.includes(detailKey(action.id, 'rationale'))}
                        {@const setAsideOpen = expanded.includes(detailKey(action.id, 'setAside'))}
                        {#if reasons.length > 0}
                            <button
                                type="button"
                                class={detailButton}
                                aria-expanded={reasonsOpen}
                                onclick={() => toggle(action.id, 'rationale')}
                            >
                                {reasonsOpen ? 'Hide rules' : 'Rules'}
                            </button>
                        {/if}
                        {#if setAside.length > 0}
                            <button
                                type="button"
                                class={detailButton}
                                aria-expanded={setAsideOpen}
                                onclick={() => toggle(action.id, 'setAside')}
                            >
                                {setAsideOpen ? 'Hide set aside' : 'Set aside'}
                            </button>
                        {/if}
                        {#if reasons.length > 0 && reasonsOpen}
                            <ul class="mt-1 list-disc space-y-1 pl-4 text-left text-xs text-gray-300">
                                {#each reasons as reason, index (index)}
                                    <li>{reason}</li>
                                {/each}
                            </ul>
                        {/if}
                        {#if setAside.length > 0 && setAsideOpen}
                            <!-- Turned over on the way and put back under the deck. A span, not a
                                 div: the style below hides every div directly inside an entry. -->
                            <span class="mt-1 flex flex-wrap items-center gap-1.5 text-gray-200">
                                {#each setAside as card (card.id)}
                                    <TechnologyChip
                                        kind={card.effect}
                                        name={technologyName(card)}
                                        ability={technologyAbility(card)}
                                        colors={card.colors}
                                        detail="Turned over on the way: not one this planet could take, so it went back under the deck."
                                        dimmed
                                    />
                                {/each}
                            </span>
                        {/if}
                    </TimelineItem>
                </div>
            {/each}
            <div
                class="absolute w-3 h-3 bg-[#ad9c80] rounded-full mt-1.5 -start-1.5 border dark:border-[#ad9c80] dark:bg-[#ad9c80]"
            ></div>
            <TimelineItem
                timeClass="dark:text-[#ad9c80]"
                title=""
                class="timeline-item text-left mb-5"
                date={timeAgo.format(gameSession.game.createdAt)}
            >
                <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                    The game was started
                </p>
            </TimelineItem>
        </Timeline>
    </div>
</div>

<!--  fixes a styling issue with timeline-item -->
<style>
    .history :global(.timeline-item > div) {
        display: none;
    }
</style>