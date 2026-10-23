<script lang="ts">
    let { seed }: { seed: number } = $props()

    // mulberry32, seeded so every player at the table sees the same sky.
    function makeRandom(from: number) {
        let state = from >>> 0
        return () => {
            state = (state + 0x6d2b79f5) >>> 0
            let t = state
            t = Math.imul(t ^ (t >>> 15), t | 1)
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
    }

    // Wider than 16:9 so an ultrawide window does not run out of sky.
    const W = 2400
    const H = 1350

    const BAND_TILT = -27
    const BAND_Y = H * 0.52

    type Star = { x: number; y: number; r: number; o: number; twinkle: boolean; delay: number; duration: number }

    const sky = $derived.by(() => {
        const random = makeRandom(seed)
        const stars: Star[] = []

        const bandCount = 900
        for (let i = 0; i < bandCount; i++) {
            const spread = ((random() + random() + random()) / 3 - 0.5) * 2
            stars.push({
                x: random() * W,
                y: BAND_Y + spread * H * 0.3,
                r: 0.5 + random() * 1.1,
                o: 0.25 + random() * 0.45,
                twinkle: random() < 0.04,
                delay: random() * 7,
                duration: 3.5 + random() * 4
            })
        }

        const fieldCount = 320
        for (let i = 0; i < fieldCount; i++) {
            stars.push({
                x: random() * W,
                y: random() * H,
                r: 0.6 + random() * 1.6,
                o: 0.35 + random() * 0.6,
                twinkle: random() < 0.12,
                delay: random() * 7,
                duration: 3.5 + random() * 4
            })
        }

        const lanes = Array.from({ length: 7 }, () => ({
            x: random() * W,
            y: BAND_Y + (random() - 0.5) * H * 0.22,
            rx: 180 + random() * 420,
            ry: 26 + random() * 70,
            o: 0.3 + random() * 0.4
        }))

        const clouds = Array.from({ length: 4 }, (_unused, i) => ({
            x: random() * W,
            y: random() * H,
            rx: 320 + random() * 520,
            ry: 240 + random() * 420,
            hue: ['#3d6bd4', '#8b5cc4', '#2f7f9e', '#c4603d'][i % 4],
            o: 0.05 + random() * 0.07
        }))

        return { stars, lanes, clouds }
    })
</script>

<svg
    class="starfield"
    viewBox="0 0 {W} {H}"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
>
    <defs>
        <radialGradient id="sky-band-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="#cdd9ff" stop-opacity="0.15" />
            <stop offset="55%" stop-color="#8ea4d8" stop-opacity="0.06" />
            <stop offset="100%" stop-color="#8ea4d8" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="sky-cloud" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="currentColor" stop-opacity="1" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="sky-lane" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="#050912" stop-opacity="1" />
            <stop offset="100%" stop-color="#050912" stop-opacity="0" />
        </radialGradient>
    </defs>

    <rect x="0" y="0" width={W} height={H} fill="#070b16" />

    {#each sky.clouds as cloud, i (i)}
        <ellipse
            cx={cloud.x}
            cy={cloud.y}
            rx={cloud.rx}
            ry={cloud.ry}
            fill="url(#sky-cloud)"
            color={cloud.hue}
            opacity={cloud.o}
        />
    {/each}

    <g transform="rotate({BAND_TILT} {W / 2} {H / 2})">
        <ellipse cx={W / 2} cy={BAND_Y} rx={W * 0.62} ry={H * 0.17} fill="url(#sky-band-glow)" />
        <ellipse cx={W / 2} cy={BAND_Y} rx={W * 0.45} ry={H * 0.09} fill="url(#sky-band-glow)" />

        {#each sky.stars as star, i (i)}
            <circle
                cx={star.x}
                cy={star.y}
                r={star.r}
                fill="#ffffff"
                opacity={star.o}
                class={star.twinkle ? 'sky-twinkle' : ''}
                style={star.twinkle
                    ? `animation-delay: ${star.delay}s; animation-duration: ${star.duration}s;`
                    : ''}
            />
        {/each}

        {#each sky.lanes as lane, i (i)}
            <ellipse
                cx={lane.x}
                cy={lane.y}
                rx={lane.rx}
                ry={lane.ry}
                fill="url(#sky-lane)"
                opacity={lane.o}
            />
        {/each}
    </g>
</svg>

<style>
    .starfield {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        pointer-events: none;
    }

    @keyframes sky-twinkle-frames {
        0%,
        100% {
            opacity: 0.25;
        }
        50% {
            opacity: 1;
        }
    }

    /* Use the `animation` shorthand: Svelte rewrites scoped @keyframes names only there. */
    .sky-twinkle {
        animation: sky-twinkle-frames 4s ease-in-out infinite;
    }
</style>
