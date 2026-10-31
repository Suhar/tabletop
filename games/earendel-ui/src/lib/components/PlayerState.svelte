<script lang="ts">
    import { type Player } from '@tabletop/common'
    import {
        EarendelPlayerState,
        hexKey,
        planetPointsByPlayer,
        TECHNOLOGY_EFFECT_INFO,
        technologyCard,
        TechnologyEffectKind,
        TechnologyTiming,
        turnsUntilReady,
        PieceType
    } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import TechnologyChip from './TechnologyChip.svelte'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: EarendelPlayerState } = $props()

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))

    let planetPoints = $derived(
        planetPointsByPlayer(gameSession.gameState.board)[playerState.playerId] ?? 0
    )

    type TechnologyEntry = {
        kind: TechnologyEffectKind
        count: number
        turnsLeft?: number
        unspent?: boolean
    }

    // Technologies this player's probes will research at their next turn if they still lead.
    let pendingTechnologies = $derived(
        gameSession.pendingClaims
            .filter((claim) => claim.playerId === playerState.playerId)
            .map((claim) => ({
                key: hexKey(claim.coords),
                coords: claim.coords,
                kind: technologyCard(claim.technologyId).effect
            }))
    )

    // One chip per technology, in the order they were gained.
    let technologyEntries: TechnologyEntry[] = $derived.by(() => {
        const counts = new Map<TechnologyEffectKind, number>()
        const kinds = [
            ...playerState.technologies.map((technologyId) => technologyCard(technologyId).effect),
            ...playerState.cooldownEffects,
            ...playerState.storedEffects
        ]
        for (const technologyId of playerState.technologies) {
            const kind = technologyCard(technologyId).effect
            counts.set(kind, (counts.get(kind) ?? 0) + 1)
        }

        return [...new Set(kinds)].map((kind) => {
            const timing = TECHNOLOGY_EFFECT_INFO[kind].timing
            return {
                kind,
                count: counts.get(kind) ?? 1,
                ...(timing === TechnologyTiming.Cooldown
                    ? {
                          turnsLeft: turnsUntilReady(
                              gameSession.gameState,
                              playerState.playerId,
                              kind
                          )
                      }
                    : {}),
                ...(timing === TechnologyTiming.Stored
                    ? { unspent: playerState.storedEffects.includes(kind) }
                    : {})
            }
        })
    })
</script>

<div class="relative">
    <div
        class="rounded-lg {bgColor} py-[3px] px-4 text-center {gameSession.colors.getPlayerTextColor(
            playerState.playerId
        )} font-medium flex flex-col justify-between {isTurn ? 'border-2 pulse-border' : ''}"
    >
        <h1 class="{isTurn ? 'text-xl font-semibold' : 'text-lg font-medium'} mb-1">
            {isTurn ? '⇢ ' : ''}{player.name}{isTurn ? ' ⇠' : ''}
        </h1>

        <div class="flex justify-center gap-3 text-sm">
            <span title="Points banked so far">{playerState.score} pts</span>
            <span title="Points from planets if the game ended now">+{planetPoints} held</span>
            <span title="Pieces left in the bag">{playerState.bag.remaining} in bag</span>
        </div>

        {#if technologyEntries.length > 0 || pendingTechnologies.length > 0}
            <div class="mt-1 mb-0.5 flex flex-wrap justify-center gap-1">
                {#each technologyEntries as entry (entry.kind)}
                    <TechnologyChip
                        kind={entry.kind}
                        name={TECHNOLOGY_EFFECT_INFO[entry.kind].name}
                        ability={TECHNOLOGY_EFFECT_INFO[entry.kind].ability}
                        count={entry.count}
                        turnsLeft={entry.turnsLeft}
                        unspent={entry.unspent}
                    />
                {/each}
                {#each pendingTechnologies as claim (claim.key)}
                    <TechnologyChip
                        kind={claim.kind}
                        name={TECHNOLOGY_EFFECT_INFO[claim.kind].name}
                        ability={TECHNOLOGY_EFFECT_INFO[claim.kind].ability}
                        pending
                        planet={claim.coords}
                    />
                {/each}
            </div>
        {:else}
            <div class="mt-1 mb-0.5 flex justify-center">
                <button
                    type="button"
                    disabled
                    class="inline-flex items-center rounded-full border border-current/35 bg-black/10 px-2 py-0.5 text-xs leading-tight opacity-60"
                >
                    No technologies currently
                </button>
            </div>
        {/if}

        {#if playerState.specialPieces.length > 0}
            <div class="text-xs opacity-90" title="Special pieces waiting to be placed">
                {playerState.specialPieces
                    .map((piece) =>
                        piece.hub
                            ? '▣ Station Hub'
                            : piece.type === PieceType.Terraformer
                              ? '◈ Terraformer'
                              : `▢ ${piece.type}`
                    )
                    .join(', ')}
            </div>
        {/if}

        {#if gameSession.showDebug}
            <div class="text-xs mt-2">id: {player.id}</div>
        {/if}
    </div>
</div>

<style>
    @keyframes border-pulsate {
        0% {
            border-color: rgba(255, 255, 255, 0);
        }
        25% {
            border-color: rgba(255, 255, 255, 255);
        }
        75% {
            border-color: rgba(255, 255, 255, 255);
        }
        100% {
            border-color: rgba(255, 255, 255, 0);
        }
    }

    .pulse-border {
        border-color: white;
        animation: border-pulsate 2.5s infinite;
    }
</style>
