<script lang="ts">
    import { onMount, untrack } from 'svelte'
    import { Button } from 'flowbite-svelte'
    import { ActionSource, type GameAction } from '@tabletop/common'
    import type { GameSession, HarnessTools } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import {
        botServer,
        type BotGame,
        type BotSpecs,
        type KeptGame,
        type KeptRun
    } from './botServer.js'
    import { BotSeats } from './botSeats.svelte.js'

    const AutoMoveDelayMs = 300
    const ShownKey = 'two-crowns-bots-shown'

    let { harness }: { harness: HarnessTools } = $props()

    let specs: BotSpecs | undefined = $state()
    let error: string | undefined = $state()
    let thinking: string | undefined = $state()
    let working: string | undefined = $state()
    let paused = $state(true)
    // Hidden, the bar is one line: the toggle, Bot move and any status. Small screens start hidden.
    let shown = $state(
        (localStorage.getItem(ShownKey) ?? String(matchMedia('(min-width: 640px)').matches)) ===
            'true'
    )

    let runs: KeptRun[] = $state([])
    let run = $state('')
    let keptGames: KeptGame[] = $state([])
    let keptFile = $state('')
    let playPlayers = $state(4)
    let playSeed = $state(Math.floor(Math.random() * 100000))
    let playBots = $state('')

    let session = $derived(harness.session)
    let gameId = $derived(session?.primaryGame.id)
    let seats = $derived(gameId && specs ? new BotSeats(gameId, specs.preferred) : undefined)
    let players = $derived(session?.game.players ?? [])
    let activePlayerId = $derived(session?.gameState.activePlayerIds[0])
    let canMove = $derived(
        session !== undefined &&
            seats !== undefined &&
            activePlayerId !== undefined &&
            thinking === undefined &&
            session.isPlayable &&
            !session.busy &&
            !session.isViewingHistory &&
            session.gameState.result === undefined
    )
    let autoSeats = $derived(players.filter((player) => seats?.playsItself(player.id)).length)
    let botPlaysNext = $derived(
        canMove && activePlayerId !== undefined && seats?.playsItself(activePlayerId) === true
    )

    onMount(async () => {
        try {
            specs = await botServer.specs()
            playBots = specs.preferred
            runs = await botServer.runs()
            run = runs[0]?.run ?? ''
            await loadKeptGames()
        } catch (failure) {
            error = messageOf(failure)
        }
    })

    // Bots wait after a game opens and after Undo, so an undone move stays undone until a move is made.
    let seenSession: GameSession<GameState, HydratedGameState> | undefined
    let seenActions = 0
    $effect(() => {
        if (!session || session.isViewingHistory) return
        const count = session.actions.length
        untrack(() => {
            paused =
                seenSession !== session || count < seenActions || (paused && count === seenActions)
            seenSession = session
            seenActions = count
        })
    })

    $effect(() => {
        if (paused || !botPlaysNext) return
        const timer = setTimeout(botMove, AutoMoveDelayMs)
        return () => clearTimeout(timer)
    })

    async function botMove() {
        const current = session
        if (!canMove || !current || !seats || !activePlayerId) return
        error = undefined
        thinking = seats.bot(activePlayerId)
        const actionCount = current.gameState.actionCount
        try {
            const { action } = await botServer.move(
                current.game,
                current.gameState.dehydrate(),
                seats.all(players.map((player) => player.id))
            )
            if (current !== harness.session || current.gameState.actionCount !== actionCount) return
            const move: GameAction = {
                ...action,
                id: crypto.randomUUID(),
                gameId: current.game.id,
                source: ActionSource.User,
                createdAt: new Date()
            }
            paused = false
            await current.applyAction(move)
        } catch (failure) {
            error = messageOf(failure)
            paused = true
        } finally {
            thinking = undefined
        }
    }

    function toggleShown() {
        shown = !shown
        localStorage.setItem(ShownKey, String(shown))
    }

    /** A kept game names each player for their bot ("ana (human@v19)"); the bot menu already shows it. */
    function seatName(name: string): string {
        return name.replace(/ \([^)]*\)$/, '')
    }

    function setBot(playerId: string, event: Event & { currentTarget: HTMLSelectElement }) {
        seats?.setBot(playerId, event.currentTarget.value)
    }

    function setPlaysItself(playerId: string, event: Event & { currentTarget: HTMLInputElement }) {
        const plays = event.currentTarget.checked
        seats?.setPlaysItself(playerId, plays)
        if (plays && playerId === activePlayerId) paused = false
    }

    async function loadKeptGames() {
        keptGames = run ? await botServer.games(run) : []
        keptFile = keptGames[0]?.file ?? ''
    }

    async function chooseRun() {
        error = undefined
        try {
            await loadKeptGames()
        } catch (failure) {
            error = messageOf(failure)
        }
    }

    async function openKeptGame() {
        const file = keptFile
        await open(`Opening ${file}…`, file, () => botServer.game(file))
    }

    async function playBotGame() {
        const bots = playBots.split(',').map((spec) => spec.trim())
        const players = playPlayers
        const seed = playSeed
        await open(`Playing a ${players}-player game, seed ${seed}…`, `${players}p ${seed}`, () =>
            botServer.play(players, seed, bots)
        )
        playSeed = Math.floor(Math.random() * 100000)
        runs = await botServer.runs()
    }

    async function open(status: string, name: string, load: () => Promise<BotGame>) {
        error = undefined
        working = status
        try {
            await harness.openScenario({
                name,
                load: async () => {
                    const { scenario, seats } = await load()
                    BotSeats.seat(scenario.game.id, seats)
                    return scenario
                }
            })
        } finally {
            working = undefined
        }
    }

    function describe(game: KeptGame): string {
        const bots = [...new Set(Object.values(game.policies))].join(', ') || 'random'
        const winners = game.winners.join(', ') || 'no winner'
        return `${game.players}p ${game.seed} · ${bots} · ${winners}${game.final ? '' : ' (replays)'}`
    }

    function messageOf(failure: unknown): string {
        return failure instanceof Error ? failure.message : String(failure)
    }
</script>

<div class="flex flex-col gap-1 border-t border-gray-600 pt-1 text-sm text-white">
    <div class="flex flex-row flex-wrap items-center gap-2">
        <button
            type="button"
            class="font-semibold"
            aria-expanded={shown}
            title={shown ? 'Hide the bot seats' : 'Show the bot seats'}
            onclick={toggleShown}>{shown ? '▾' : '▸'} Bots</button
        >
        {#if specs && seats}
            <Button size="xs" color="green" disabled={!canMove} onclick={botMove}>Bot move</Button>
            {#if !shown && autoSeats > 0}
                <span class="text-gray-400">{autoSeats} auto</span>
            {/if}
        {/if}
        {#if specs && seats && shown}
            {#each players as player (player.id)}
                <label
                    class="flex items-center gap-1 rounded px-1"
                    class:bg-gray-600={player.id === activePlayerId}
                >
                    {seatName(player.name)}
                    <select
                        aria-label="{player.name}'s bot"
                        class="rounded bg-gray-700 py-0 text-sm text-white"
                        value={seats.bot(player.id)}
                        onchange={(event) => setBot(player.id, event)}
                    >
                        {#each specs.specs as spec (spec)}
                            <option value={spec}>{spec}</option>
                        {/each}
                    </select>
                    <input
                        type="checkbox"
                        title="Plays its own turns"
                        aria-label="{player.name} plays its own turns"
                        checked={seats.playsItself(player.id)}
                        onchange={(event) => setPlaysItself(player.id, event)}
                    />
                    auto
                </label>
            {/each}
        {/if}
        {#if thinking}
            <span role="status">{thinking} is thinking…</span>
        {:else if paused && botPlaysNext}
            <span>Auto bots wait after loading or Undo; make a move or press Bot move.</span>
        {/if}
        {#if error}
            <span role="alert" class="text-red-400">{error}</span>
        {/if}
    </div>
    {#if specs && shown}
        <details class="pb-1">
            <summary class="cursor-pointer">Bot games</summary>
            <div class="flex flex-row flex-wrap items-center gap-2 pt-1">
                <select
                    aria-label="Run"
                    class="rounded bg-gray-700 py-0 text-sm text-white"
                    bind:value={run}
                    onchange={chooseRun}
                >
                    {#each runs as kept (kept.run)}
                        <option value={kept.run}>{kept.run} ({kept.games})</option>
                    {/each}
                </select>
                <select
                    aria-label="Kept game"
                    class="rounded bg-gray-700 py-0 text-sm text-white"
                    bind:value={keptFile}
                >
                    {#each keptGames as game (game.file)}
                        <option value={game.file}>{describe(game)}</option>
                    {/each}
                </select>
                <Button
                    size="xs"
                    disabled={!keptFile || working !== undefined}
                    onclick={openKeptGame}>Open</Button
                >
                <span class="ms-4">Play</span>
                <select
                    aria-label="Players"
                    class="rounded bg-gray-700 py-0 text-sm text-white"
                    bind:value={playPlayers}
                >
                    {#each [3, 4, 5] as count (count)}
                        <option value={count}>{count} players</option>
                    {/each}
                </select>
                <label class="flex items-center gap-1"
                    >seed <input
                        type="number"
                        class="w-24 rounded bg-gray-700 py-0 text-sm text-white"
                        bind:value={playSeed}
                    /></label
                >
                <label class="flex items-center gap-1"
                    >bots <input
                        type="text"
                        list="two-crowns-bot-specs"
                        title="Seat specs by seat, comma separated, repeated round the table"
                        class="w-56 rounded bg-gray-700 py-0 text-sm text-white"
                        bind:value={playBots}
                    /></label
                >
                <datalist id="two-crowns-bot-specs">
                    {#each specs.specs as spec (spec)}
                        <option value={spec}></option>
                    {/each}
                </datalist>
                <Button size="xs" disabled={working !== undefined} onclick={playBotGame}
                    >Play</Button
                >
                {#if working}
                    <span role="status">{working}</span>
                {/if}
            </div>
        </details>
    {/if}
</div>
