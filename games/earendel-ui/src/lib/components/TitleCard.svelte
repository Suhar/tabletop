<script lang="ts">
    import { fade } from 'svelte/transition'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // The game's name over the board on a first opening: it arrives letter by letter while the
    // board builds, and once the board is built offers Play and the rules overview. Local
    // presentation: nothing in the game changes until Play.
    const gameSession = getGameSession()
    const LETTERS = [...'EARENDEL']
    let ready = $derived(gameSession.titleStage === 'ready')
</script>

<div
    class="title-card absolute inset-0 z-20 flex flex-col items-center justify-center"
    out:fade={{ duration: 400 }}
>
    <!-- The star the game is named for, over the name. -->
    <svg class="star" viewBox="-20 -20 40 40" aria-hidden="true">
        <path d="M0,-18 L2.2,-2.2 L18,0 L2.2,2.2 L0,18 L-2.2,2.2 L-18,0 L-2.2,-2.2 Z" />
    </svg>
    <h1 class="name" aria-label="Earendel">
        {#each LETTERS as letter, index (index)}
            <span aria-hidden="true" style="animation-delay: {0.25 + index * 0.14}s">{letter}</span>
        {/each}
    </h1>
    <div class="rule" aria-hidden="true"></div>
    <!-- The buttons' room is kept from the start, so the name does not move when they come. -->
    <div class="mt-6 flex h-11 items-center gap-4">
        {#if ready}
            <button
                type="button"
                class="rounded-md border-2 border-white bg-white/15 px-7 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-white hover:bg-white/30"
                in:fade={{ duration: 500 }}
                onclick={() => gameSession.beginPlay()}
            >
                Play
            </button>
            <button
                type="button"
                class="rounded-md border-2 border-[#8fb6ff]/80 bg-[#8fb6ff]/10 px-5 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#c9dcff] hover:bg-[#8fb6ff]/25"
                in:fade={{ duration: 500, delay: 120 }}
                onclick={() => (gameSession.overviewShown = true)}
            >
                Overview
            </button>
        {/if}
    </div>
</div>

<style>
    /* Darker behind the name alone, so it reads over whatever the board is doing. */
    .title-card {
        background: radial-gradient(ellipse 60% 45% at center, rgb(5 8 18 / 0.72), transparent 75%);
    }

    .name {
        display: flex;
        margin: 0;
        /* The last letter's spacing would push the name off center. */
        padding-left: 0.42em;
        color: white;
        font-size: clamp(2rem, 9vw, 6rem);
        font-weight: 200;
        letter-spacing: 0.42em;
        line-height: 1;
        text-shadow:
            0 0 18px rgb(143 182 255 / 0.55),
            0 0 2px rgb(255 255 255 / 0.6);
    }

    /* Each letter comes out of a blur, a little low, and settles. */
    .name span {
        opacity: 0;
        animation: letter-frames 1.1s ease-out forwards;
    }

    @keyframes letter-frames {
        from {
            opacity: 0;
            filter: blur(10px);
            transform: translateY(0.18em);
        }
        to {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0);
        }
    }

    /* A line drawn out from the middle under the name. */
    .rule {
        width: min(70%, 34rem);
        height: 1px;
        margin-top: 1.1rem;
        background: linear-gradient(to right, transparent, rgb(201 220 255 / 0.9), transparent);
        transform: scaleX(0);
        animation: rule-frames 1.4s ease-out 1.2s forwards;
    }

    @keyframes rule-frames {
        to {
            transform: scaleX(1);
        }
    }

    /* The star opens out, then goes on twinkling as it slowly turns. */
    .star {
        width: clamp(1.5rem, 4vw, 2.75rem);
        height: clamp(1.5rem, 4vw, 2.75rem);
        margin-bottom: 0.9rem;
        fill: #fff6d6;
        filter: drop-shadow(0 0 8px rgb(255 225 77 / 0.8));
        opacity: 0;
        animation:
            star-open-frames 1.2s ease-out 0.1s forwards,
            star-twinkle-frames 3.2s ease-in-out 1.3s infinite;
    }

    @keyframes star-open-frames {
        from {
            opacity: 0;
            transform: scale(0.2) rotate(-45deg);
        }
        to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
        }
    }

    @keyframes star-twinkle-frames {
        0%,
        100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
        }
        50% {
            opacity: 0.6;
            transform: scale(0.82) rotate(12deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .name span,
        .rule,
        .star {
            animation: none;
            opacity: 1;
            transform: none;
        }
    }
</style>
