<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { describeAction } from '$lib/utils/describe.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    let {
        action,
        justify = 'start'
    }: { action: GameAction; justify?: 'start' | 'center' | 'end' } = $props()

    let text = $derived(
        describeAction(action, (playerId) => gameSession.getPlayerName(playerId))
    )
</script>

<div class="flex flex-row justify-{justify} items-center flex-wrap gap-x-1">
    <PlayerName playerId={action.playerId} />
    <span>{text}</span>
</div>
