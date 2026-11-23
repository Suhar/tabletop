<script lang="ts">
    import ActionDescription from './ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { latestHistoryStep } from '$lib/utils/historyStep.js'

    const gameSession = getGameSession()

    const step = $derived(latestHistoryStep(gameSession.actions))
</script>

<div class="flex min-h-[2rem] flex-col items-center gap-1 py-1 text-sm text-white sm:text-base">
    {#each step as action (action.id)}
        <ActionDescription {action} justify="center" />
    {:else}
        <div>The game was started.</div>
    {/each}
</div>
