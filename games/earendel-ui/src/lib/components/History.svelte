<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import ActionDescription from './ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { rationaleFor } from '$lib/utils/rationale.js'

    const timeAgo = new TimeAgo('en-US')

    // Entries whose rationale is open: why the action came out as it did, for players learning.
    let expanded: string[] = $state([])
    function toggle(id: string) {
        expanded = expanded.includes(id)
            ? expanded.filter((open) => open !== id)
            : [...expanded, id]
    }
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
                        {#if reasons.length > 0}
                            {@const open = expanded.includes(action.id)}
                            <button
                                type="button"
                                class="mt-1 rounded border border-[#ad9c80]/50 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-[#ad9c80] hover:bg-[#ad9c80]/15"
                                aria-expanded={open}
                                onclick={() => toggle(action.id)}
                            >
                                {open ? 'Hide rationale' : 'Rationale'}
                            </button>
                            {#if open}
                                <ul class="mt-1 list-disc space-y-1 pl-4 text-left text-xs text-gray-300">
                                    {#each reasons as reason, index (index)}
                                        <li>{reason}</li>
                                    {/each}
                                </ul>
                            {/if}
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