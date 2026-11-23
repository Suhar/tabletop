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

    const BAND_TILT = -16
    // How bright the band is against the rest of the sky: its glow and its strands' stars.
    const BAND_BRIGHTNESS = 0.9
    const BAND_Y = H * 0.52
    const STRANDS = 3
    // Tried per strand; a strand keeps about three in five, most where it runs thick.
    const STARS_PER_STRAND = 420
    const HAZE_STARS = 280
    // The band is tilted, so its strands run on past the sky's sides to reach the corners.
    const BAND_OVERRUN = 300
    // How far apart a strand's pools of glow are strung.
    const GLOW_STEP = 230

    type Star = {
        x: number
        y: number
        r: number
        o: number
        twinkle: boolean
        delay: number
        duration: number
    }

    const sky = $derived.by(() => {
        const random = makeRandom(seed)
        const stars: Star[] = []

        // The bright band is three loose strands that wind around one another. Each follows a
        // shared wave roughly a third of a turn behind the last, which is what braids them, but
        // none follows it exactly: every strand has its own height on that wave, its own slow
        // drift and its own small wander, so the crossings come unevenly and the dark gaps
        // between strands differ in size and shape, as rifts in a real band of stars do.
        const wavelength = 1100 + random() * 900
        const phase = random() * 2 * Math.PI
        const wave = (x: number, length: number, shift: number) =>
            Math.sin((2 * Math.PI * x) / length + shift)
        const courses = Array.from({ length: STRANDS }, (_unused, strand) => ({
            shift: phase + (strand * 2 * Math.PI) / 3 + (random() - 0.5) * 1.2,
            height: H * (0.03 + random() * 0.035),
            drift: { length: 1700 + random() * 1400, shift: random() * 7, height: H * 0.03 },
            wander: { length: 380 + random() * 420, shift: random() * 7, height: H * 0.012 },
            width: H * (0.04 + random() * 0.03)
        }))
        const strandY = (strand: number, x: number) => {
            const course = courses[strand]
            return (
                BAND_Y +
                course.height * wave(x, wavelength, course.shift) +
                course.drift.height * wave(x, course.drift.length, course.drift.shift) +
                course.wander.height * wave(x, course.wander.length, course.wander.shift)
            )
        }

        const strands = Array.from({ length: STRANDS }, (_unused, strand) => {
            // Each strand thickens and thins along its length, at its own pace.
            const swell = 700 + random() * 900
            const swellPhase = random() * 2 * Math.PI
            for (let i = 0; i < STARS_PER_STRAND; i++) {
                const x = -BAND_OVERRUN + random() * (W + 2 * BAND_OVERRUN)
                const thick = 0.5 + 0.5 * Math.sin((2 * Math.PI * x) / swell + swellPhase)
                const spread = ((random() + random() + random()) / 3 - 0.5) * 2
                const keep = random() < 0.2 + 0.8 * thick
                const star = {
                    x,
                    y: strandY(strand, x) + spread * courses[strand].width * (1.5 + thick),
                    r: 0.5 + random() * 1.1,
                    o: (0.25 + random() * 0.45) * BAND_BRIGHTNESS,
                    twinkle: random() < 0.04,
                    delay: random() * 7,
                    duration: 3.5 + random() * 4
                }
                if (keep) stars.push(star)
            }
            // The strand's glow: soft pools of light strung along it, brightest where it runs
            // thick, each fading to nothing at its edge so no line of light is ever drawn.
            const pools = []
            for (let x = -BAND_OVERRUN; x <= W + BAND_OVERRUN; x += GLOW_STEP) {
                const at = x + (random() - 0.5) * GLOW_STEP
                const thick = 0.5 + 0.5 * Math.sin((2 * Math.PI * at) / swell + swellPhase)
                pools.push({
                    x: at,
                    y: strandY(strand, at),
                    rx: 200 + random() * 160,
                    ry: courses[strand].width * (1.4 + random() * 0.9),
                    o: (0.25 + 0.75 * thick) * (0.5 + random() * 0.4) * BAND_BRIGHTNESS
                })
            }
            return pools
        })

        // A thin haze of stars across the whole band, so the strands read as one river.
        for (let i = 0; i < HAZE_STARS; i++) {
            const spread = ((random() + random() + random()) / 3 - 0.5) * 2
            stars.push({
                x: random() * W,
                y: BAND_Y + spread * H * 0.3,
                r: 0.5 + random() * 0.9,
                o: 0.2 + random() * 0.35,
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

        const lanes = Array.from({ length: 4 }, () => ({
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

        return { stars, strands, lanes, clouds }
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
            <stop offset="0%" stop-color="#cdd9ff" stop-opacity="0.15"></stop>
            <stop offset="55%" stop-color="#8ea4d8" stop-opacity="0.06"></stop>
            <stop offset="100%" stop-color="#8ea4d8" stop-opacity="0"></stop>
        </radialGradient>
        <radialGradient id="sky-cloud" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="currentColor" stop-opacity="1"></stop>
            <stop offset="100%" stop-color="currentColor" stop-opacity="0"></stop>
        </radialGradient>
        <radialGradient id="sky-lane" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="#050912" stop-opacity="1"></stop>
            <stop offset="100%" stop-color="#050912" stop-opacity="0"></stop>
        </radialGradient>
    </defs>

    <rect x="0" y="0" width={W} height={H} fill="#070b16"></rect>

    {#each sky.clouds as cloud, i (i)}
        <ellipse
            cx={cloud.x}
            cy={cloud.y}
            rx={cloud.rx}
            ry={cloud.ry}
            fill="url(#sky-cloud)"
            color={cloud.hue}
            opacity={cloud.o}
        ></ellipse>
    {/each}

    <g transform="rotate({BAND_TILT} {W / 2} {H / 2})">
        <ellipse
            cx={W / 2}
            cy={BAND_Y}
            rx={W * 0.62}
            ry={H * 0.17}
            fill="url(#sky-band-glow)"
            opacity={BAND_BRIGHTNESS}
        ></ellipse>

        {#each sky.strands as pools, strand (strand)}
            {#each pools as pool, i (i)}
                <ellipse
                    cx={pool.x}
                    cy={pool.y}
                    rx={pool.rx}
                    ry={pool.ry}
                    fill="url(#sky-band-glow)"
                    opacity={pool.o}
                ></ellipse>
            {/each}
        {/each}

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
            ></circle>
        {/each}

        {#each sky.lanes as lane, i (i)}
            <ellipse
                cx={lane.x}
                cy={lane.y}
                rx={lane.rx}
                ry={lane.ry}
                fill="url(#sky-lane)"
                opacity={lane.o}
            ></ellipse>
        {/each}
    </g>
</svg>

<style>
    .starfield {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
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
