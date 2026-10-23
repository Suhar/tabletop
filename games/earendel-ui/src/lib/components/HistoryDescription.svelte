<script lang="ts">
    import ActionDescription from './ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { latestHistoryStep } from '$lib/utils/historyStep.js'

    const gameSession = getGameSession()

    const step = $derived(latestHistoryStep(gameSession.actions))
</script>

<div class="flex flex-col items-center gap-1 py-2 text-white text-sm sm:text-base min-h-[2.5rem]">
    {#each step as action (action.id)}
        <ActionDescription {action} justify="center" />
    {:else}
        <div>The game was started.</div>
    {/each}
</div>
