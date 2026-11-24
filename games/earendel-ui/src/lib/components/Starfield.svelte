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

    // The band and its stars are tilted about the middle of the sky.
    const tilt = (x: number, y: number) => {
        const angle = (BAND_TILT * Math.PI) / 180
        const dx = x - W / 2
        const dy = y - H / 2
        return {
            x: W / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: H / 2 + dx * Math.sin(angle) + dy * Math.cos(angle)
        }
    }

    const round = (value: number) => Math.round(value * 100) / 100

    // The still sky is one image, drawn once: browsers keep an image as a bitmap, where a live
    // SVG of this many shapes is drawn again under every animation that crosses it, which
    // brought Firefox to under a frame a second.
    const image = $derived.by(() => {
        const ellipse = (
            at: { x: number; y: number; rx: number; ry: number; o: number },
            fill: string,
            color = ''
        ) =>
            `<ellipse cx="${round(at.x)}" cy="${round(at.y)}" rx="${round(at.rx)}" ry="${round(at.ry)}" fill="url(#${fill})" opacity="${round(at.o)}"${color ? ` color="${color}"` : ''}/>`

        const markup = [
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
            '<defs>',
            '<radialGradient id="glow"><stop offset="0%" stop-color="#cdd9ff" stop-opacity="0.15"/><stop offset="55%" stop-color="#8ea4d8" stop-opacity="0.06"/><stop offset="100%" stop-color="#8ea4d8" stop-opacity="0"/></radialGradient>',
            '<radialGradient id="cloud"><stop offset="0%" stop-color="currentColor" stop-opacity="1"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient>',
            '<radialGradient id="lane"><stop offset="0%" stop-color="#050912" stop-opacity="1"/><stop offset="100%" stop-color="#050912" stop-opacity="0"/></radialGradient>',
            '</defs>',
            `<rect width="${W}" height="${H}" fill="#070b16"/>`,
            ...sky.clouds.map((cloud) => ellipse(cloud, 'cloud', cloud.hue)),
            `<g transform="rotate(${BAND_TILT} ${W / 2} ${H / 2})">`,
            ellipse(
                { x: W / 2, y: BAND_Y, rx: W * 0.62, ry: H * 0.17, o: BAND_BRIGHTNESS },
                'glow'
            ),
            ...sky.strands.flatMap((pools) => pools.map((pool) => ellipse(pool, 'glow'))),
            ...sky.stars
                .filter((star) => !star.twinkle)
                .map(
                    (star) =>
                        `<circle cx="${round(star.x)}" cy="${round(star.y)}" r="${round(star.r)}" fill="#fff" opacity="${round(star.o)}"/>`
                ),
            ...sky.lanes.map((lane) => ellipse(lane, 'lane')),
            '</g></svg>'
        ].join('')

        return `data:image/svg+xml,${encodeURIComponent(markup)}`
    })

    // The stars that twinkle are small elements of their own over the image, so a twinkle
    // repaints one star and never the sky.
    const twinkles = $derived(
        sky.stars
            .filter((star) => star.twinkle)
            .map((star) => ({ ...star, ...tilt(star.x, star.y) }))
    )
</script>

<div class="starfield" aria-hidden="true">
    <div class="sky">
        <img src={image} alt="" />
        {#each twinkles as star, i (i)}
            <span
                class="sky-twinkle"
                style="left: {(star.x / W) * 100}%; top: {(star.y / H) * 100}%; width: {((2 *
                    star.r) /
                    W) *
                    100}%; animation-delay: {star.delay}s; animation-duration: {star.duration}s;"
            ></span>
        {/each}
    </div>
</div>

<style>
    .starfield {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        container-type: size;
        background: #070b16;
    }

    /* Covers the table whatever its shape, as the sky's own 16:9 cropped to fit. */
    .sky {
        position: absolute;
        left: 50%;
        top: 50%;
        width: max(100cqw, 100cqh * 16 / 9);
        height: max(100cqh, 100cqw * 9 / 16);
        transform: translate(-50%, -50%);
    }

    .sky img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
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
        position: absolute;
        aspect-ratio: 1;
        border-radius: 50%;
        background: #ffffff;
        transform: translate(-50%, -50%);
        animation: sky-twinkle-frames 4s ease-in-out infinite;
    }
</style>
