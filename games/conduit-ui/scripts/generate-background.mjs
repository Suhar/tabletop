// Writes src/lib/images/circuit-board.webp, the table's background: a dim one-layer circuit board
// of parallel traces with 45° bends and through-hole pads, generated (seeded) rather than drawn.
// The router is the one that drew the cover. It ships as a lossy WebP, not SVG: WebKit draws an SVG
// background at the device's pixel density, and at 3x this one was a 57 MB bitmap.
//
// Prerequisite: Playwright's Chromium (pnpm exec playwright install chromium).
// Usage: node scripts/generate-background.mjs
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const Width = 1600
const Height = 1000
const Seed = 7
const Ground = '#050c18'
const Dim = 0.3

function board(W, H, seed, box) {
    let s = seed
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
    const unit = Math.min(W, H) / 60
    const p = unit * 2.3
    const cols = Math.ceil(W / p) + 1
    const rows = Math.ceil(H / p) + 1
    const D = [
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [-1, -1],
        [0, -1],
        [1, -1]
    ]
    const owner = new Map()
    const mids = new Set()
    const key = (c, r) => c + ',' + r
    const offBoard = (c, r) => c < 0 || r < 0 || c > cols || r > rows
    const inBox = (c, r) => {
        const x = c * p,
            y = r * p
        return x > box.x - p && x < box.x + box.w + p && y > box.y - p && y < box.y + box.h + p
    }
    const free = (c, r, id, parent) => {
        if (owner.has(key(c, r)) || inBox(c, r)) return false
        for (let dc = -1; dc <= 1; dc++)
            for (let dr = -1; dr <= 1; dr++) {
                const o = owner.get(key(c + dc, r + dr))
                if (o !== undefined && o !== id && o !== parent) return false
            }
        return true
    }
    const canStep = (c, r, h, id, parent) => {
        const [dx, dy] = D[h]
        if (!free(c + dx, r + dy, id, parent)) return false
        return !(dx && dy && mids.has(key(2 * c + dx, 2 * r + dy)))
    }
    const claim = (c, r, h, id) => {
        owner.set(key(c, r), id)
        if (h !== undefined) {
            const [dx, dy] = D[h]
            if (dx && dy) mids.add(key(2 * c - dx, 2 * r - dy))
        }
    }
    const traces = []
    const pads = []
    // Walks a trace from (c, r) along the given headings, stopping when blocked or off the board.
    function walk(c, r, headings, id, parent) {
        const cells = [[c, r]]
        claim(c, r, undefined, id)
        for (const h of headings) {
            if (!canStep(c, r, h, id, parent)) break
            c += D[h][0]
            r += D[h][1]
            claim(c, r, h, id)
            cells.push([c, r])
            if (offBoard(c, r)) break
        }
        return cells
    }
    function finish(cells, level) {
        if (cells.length < 3) return
        traces.push({ cells, level })
        const [c0, r0] = cells[0],
            [c1, r1] = cells[cells.length - 1]
        if (!offBoard(c1, r1)) pads.push([c1, r1, level])
        if (!offBoard(c0, r0) && rnd() < 0.7) pads.push([c0, r0, level])
    }
    let id = 0
    const bundles = Math.round((cols * rows) / 9)
    for (let b = 0; b < bundles; b++, id++) {
        // A heading sequence: mostly straight, with jogs of 45° that come back straight.
        const h0 = rnd() < 0.75 ? Math.floor(rnd() * 4) * 2 : Math.floor(rnd() * 4) * 2 + 1
        const length = 12 + Math.floor(rnd() * 34)
        const headings = []
        let h = h0,
            since = 0
        for (let k = 0; k < length; k++) {
            if (since > 3 && rnd() < 0.16) {
                h = h === h0 ? (h0 + (rnd() < 0.5 ? 1 : 7)) % 8 : h0
                since = 0
            }
            headings.push(h)
            since++
        }
        // Start at a board edge (as if coming from off the board) or anywhere free.
        let c, r
        if (rnd() < 0.55) {
            const [dx, dy] = D[h0]
            c = dx > 0 ? 0 : dx < 0 ? cols : Math.floor(rnd() * cols)
            r = dy > 0 ? 0 : dy < 0 ? rows : Math.floor(rnd() * rows)
        } else {
            c = Math.floor(rnd() * cols)
            r = Math.floor(rnd() * rows)
        }
        if (!free(c, r, id)) continue
        const level = rnd()
        finish(walk(c, r, headings, id), level)
        // Followers, each a track further to one side of the first heading.
        const side = D[(h0 + (rnd() < 0.5 ? 2 : 6)) % 8]
        const step = h0 % 2 ? [Math.sign(side[0] - side[1]) || side[0], 0] : side
        const extra = 1 + Math.floor(rnd() * 4)
        for (let k = 1; k <= extra; k++) {
            const fc = c + step[0] * k,
                fr = r + step[1] * k
            if (!free(fc, fr, id)) break
            const lag = Math.floor(rnd() * 3)
            finish(walk(fc, fr, headings.slice(lag), id), level)
        }
    }
    // A few branches: a trace leaving another at a right angle or 45°, a T junction.
    for (let i = 0; i < Math.round(bundles / 8); i++, id++) {
        const parent = traces[Math.floor(rnd() * traces.length)]
        if (!parent || parent.cells.length < 6) continue
        const at = 2 + Math.floor(rnd() * (parent.cells.length - 4))
        const [c, r] = parent.cells[at]
        const parentId = owner.get(key(c, r))
        const h0 = Math.floor(rnd() * 8)
        const headings = Array.from({ length: 4 + Math.floor(rnd() * 10) }, (_, k) =>
            k > 3 && rnd() < 0.2 ? (h0 + 1) % 8 : h0
        )
        const cells = [[c, r]]
        let cc = c,
            rr = r
        for (const h of headings) {
            if (!canStep(cc, rr, h, id, parentId)) break
            cc += D[h][0]
            rr += D[h][1]
            claim(cc, rr, h, id)
            cells.push([cc, rr])
            if (offBoard(cc, rr)) break
        }
        if (cells.length > 2) {
            traces.push({ cells, level: parent.level })
            if (!offBoard(cc, rr)) pads.push([cc, rr, parent.level])
        }
    }
    // Loose vias in clear spots.
    for (let i = 0; i < (cols * rows) / 18; i++, id++) {
        const c = Math.floor(rnd() * cols),
            r = Math.floor(rnd() * rows)
        if (free(c, r, id)) {
            claim(c, r, undefined, id)
            pads.push([c, r, rnd(), true])
        }
    }
    const colour = (level) =>
        level < 0.5 ? ['#123b7c', 0.8] : level < 0.85 ? ['#1f6fe0', 0.9] : ['#56b0ff', 1]
    // One path per colour: the same drawing in far fewer elements.
    const runs = new Map()
    for (const { cells, level } of traces) {
        const [col, op] = colour(level)
        const d =
            'M' + cells.map(([c, r]) => (c * p).toFixed(1) + ' ' + (r * p).toFixed(1)).join('L')
        const run = runs.get(col) ?? { op, lit: level >= 0.5, d: '' }
        run.d += d
        runs.set(col, run)
    }
    let dim = '',
        lit = ''
    for (const [col, run] of runs) {
        const path =
            '<path d="' +
            run.d +
            '" fill="none" stroke="' +
            col +
            '" stroke-width="' +
            (unit * 0.45).toFixed(2) +
            '" stroke-linecap="round" stroke-linejoin="round" opacity="' +
            run.op +
            '"/>'
        if (run.lit) lit += path
        else dim += path
    }
    let rings = ''
    for (const [c, r, level, via] of pads) {
        const [col] = colour(level)
        const rad = p * (via ? 0.26 : 0.36)
        rings +=
            '<circle cx="' +
            (c * p).toFixed(1) +
            '" cy="' +
            (r * p).toFixed(1) +
            '" r="' +
            rad.toFixed(1) +
            '" fill="' +
            col +
            '"/>' +
            '<circle cx="' +
            (c * p).toFixed(1) +
            '" cy="' +
            (r * p).toFixed(1) +
            '" r="' +
            (rad * 0.45).toFixed(1) +
            '" fill="#02050b"/>'
    }
    return dim + '<g filter="url(#trace)">' + lit + rings + '</g>'
}

const traces = board(Width, Height, Seed, { x: -9999, y: -9999, w: 0, h: 0 })
const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Width}" height="${Height}" viewBox="0 0 ${Width} ${Height}">` +
    `<defs><filter id="trace" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
    `<rect width="100%" height="100%" fill="${Ground}"/><g opacity="${Dim}">${traces}</g></svg>`

// Chromium draws the SVG onto a canvas and encodes it.
const browser = await chromium.launch()
const page = await browser.newPage()
const webp = await page.evaluate(
    async ({ svg, width, height }) => {
        const image = new Image()
        image.src = `data:image/svg+xml;base64,${btoa(svg)}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(image, 0, 0)
        return canvas.toDataURL('image/webp', 0.8)
    },
    { svg, width: Width, height: Height }
)
await browser.close()
if (!webp.startsWith('data:image/webp')) throw new Error('Chromium did not encode WebP')
const bytes = Buffer.from(webp.slice(webp.indexOf(',') + 1), 'base64')
writeFileSync(new URL('../src/lib/images/circuit-board.webp', import.meta.url), bytes)
console.log(`circuit-board.webp: ${bytes.length} bytes`)
