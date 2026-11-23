<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { getHandAnimator } from '$lib/model/handAnimatorContext.js'
    import { registerElement } from '$lib/animators/elementRegistry.js'
    import { fighterSilhouetteFor } from '$lib/utils/fighterShapes.js'
    import { SHIP_CARD_FRAME } from '$lib/utils/shipCard.js'

    const gameSession = getGameSession()
    const animator = getHandAnimator()

    // The bag of whoever's turn it is: a stack of ship backs in their color. On the owner's own
    // turn, before the draw, clicking it draws the turn's ships (rules.md, A turn).
    let playerId = $derived(gameSession.gameState.activePlayerIds[0])
    let tint = $derived(gameSession.colors.getPlayerUiColor(playerId))
    let text = $derived(gameSession.colors.getPlayerTextColor(playerId))
    let remaining = $derived(
        animator.shownRemaining ??
            gameSession.gameState.players.find((player) => player.playerId === playerId)?.bag
                .remaining ??
            0
    )
    let drawable = $derived(gameSession.canDraw)
    let ships = $derived(gameSession.drawCount === 1 ? 'ship' : 'ships')
    let silhouette = $derived(fighterSilhouetteFor(gameSession.colors.getPlayerColor(playerId)))
</script>

{#snippet face()}
    <span
        use:registerElement={{ registry: animator.bag, key: 'face' }}
        class="{SHIP_CARD_FRAME} absolute left-2 top-2 {text} {drawable
            ? 'border-white'
            : 'border-white/50'}"
        style="background-color: {tint}{drawable ? `; box-shadow: 0 0 14px ${tint}bf` : ''}"
    >
        <!-- The player color's own fighter. -->
        <svg aria-hidden="true" width="24" height="26" viewBox="-15 -17 30 34">
            {#if silhouette.trail}
                <path
                    d={silhouette.trail}
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.4"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                />
            {:else}
                <path d="M-2,8 L0,20 L2,8 Z" fill="currentColor" fill-opacity="0.45" />
                <path d="M-1,8 L0,14 L1,8 Z" fill="#fff3cc" fill-opacity="0.8" />
            {/if}
            <path d={silhouette.body} fill="currentColor" />
            {#each silhouette.windows ?? [] as window, pane (pane)}
                <path d={window} fill="#fff3cc" fill-opacity="0.85" />
            {/each}
        </svg>
        <span
            use:registerElement={{ registry: animator.bag, key: 'count' }}
            class="inline-block text-[26px] font-bold leading-none">{remaining}</span
        >
        <span class="text-[8px] font-semibold uppercase tracking-[0.16em] opacity-90">in bag</span>
    </span>
{/snippet}

{#snippet backs()}
    <span
        class="absolute left-4 top-0 h-24 w-[66px] rounded-lg border border-white/25"
        style="background-color: color-mix(in srgb, {tint} 45%, #000000)"
    ></span>
    <span
        class="absolute left-3 top-1 h-24 w-[66px] rounded-lg border border-white/25"
        style="background-color: color-mix(in srgb, {tint} 65%, #000000)"
    ></span>
{/snippet}

{#if playerId}
    {#if drawable}
        <button
            type="button"
            class="relative h-[104px] w-[90px] shrink-0"
            aria-label="Draw {gameSession.drawCount} {ships} from your bag, {remaining} left"
            title="Draw {gameSession.drawCount} {ships}"
            onclick={() => gameSession.drawPieces()}
        >
            {@render backs()}
            {@render face()}
        </button>
    {:else}
        <div
            class="relative h-[104px] w-[90px] shrink-0 opacity-85"
            role="img"
            aria-label="{remaining} {remaining === 1 ? 'ship' : 'ships'} in the bag"
            title="{remaining} in the bag"
        >
            {@render backs()}
            {@render face()}
        </div>
    {/if}
{/if}
