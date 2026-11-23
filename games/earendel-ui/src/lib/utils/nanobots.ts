// A salvage drone's nanobots: specks that wander outward from the drone to the edge of its reach,
// each on its own jagged track, like a search, and then carry what they found back along it. The
// tracks are fixed, not random at run time, so every client draws the same swarm.

export type NanobotTrail = {
    // The track, from the drone at the origin outward, as an SVG path.
    path: string
    // When in the cycle (0 to 1) the speck sets out, reaches the end of its track, and is home.
    start: number
    turn: number
    end: number
    size: number
}

// A small seeded generator (mulberry32): the same numbers every time.
function seeded(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
        mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
    }
}

const STEPS = 11

export function nanobotTrails(reach: number, count = 18): NanobotTrail[] {
    const random = seeded(7919)
    const stride = reach / STEPS

    return Array.from({ length: count }, (_unused, index) => {
        // Each speck has a heading of its own, spread round the drone, and strays from it.
        let heading = ((index + random() * 0.8) / count) * Math.PI * 2
        let x = 0
        let y = 0
        const points: string[] = ['M0,0']
        for (let step = 1; step <= STEPS; step++) {
            heading += (random() - 0.5) * 1.5
            x += Math.cos(heading) * stride + (random() - 0.5) * stride * 0.9
            y += Math.sin(heading) * stride + (random() - 0.5) * stride * 0.9
            // Wherever it has strayed, it is this far out by now: the swarm spreads as a front.
            const out = (reach * step) / STEPS
            const from = Math.hypot(x, y) || 1
            x = (x / from) * out
            y = (y / from) * out
            // Turn it back toward its own side so the search does not collapse into a ray.
            heading = Math.atan2(y, x) + (random() - 0.5) * 1.1
            points.push(`L${x.toFixed(1)},${y.toFixed(1)}`)
        }
        const start = random() * 0.05
        const turn = start + 0.24 + random() * 0.08
        return {
            path: points.join(' '),
            start,
            turn,
            // The way home is quicker: it knows where it is going.
            end: turn + 0.17 + random() * 0.05,
            size: 1.3 + random() * 0.9
        }
    })
}
