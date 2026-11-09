// Makes the private site's browser-tab and home-screen icons from one square image.
//
// Run from /workspace (VS Code commands terminal):
//   pnpm --filter @tabletop/napoleons-triumph-ui exec node /workspace/branding/make-icons.cjs /workspace/branding/icon.png
//
// It borrows the "sharp" image library that one of Justin's games already installs, which is
// why it runs through that game's package. It overwrites the icon files in
// apps/frontend/static. safari-pinned-tab.svg and the splash folder are left alone.

const path = require('node:path')
const fs = require('node:fs')
const { createRequire } = require('node:module')

const sharp = createRequire(path.join(process.cwd(), 'package.json'))('sharp')

const source = process.argv[2]
if (!source || !fs.existsSync(source)) {
    console.error('Give the path to your square icon, e.g. /workspace/branding/icon.png')
    process.exit(1)
}

const out = '/workspace/apps/frontend/static'
const background = '#101828' // the site's dark header colour, used where an icon can't be transparent
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

// A yellow dot in the top-right corner, like the original "it's your turn" tab icon.
const turnDot = (size) => {
    const r = Math.max(3, Math.round(size * 0.22))
    const cx = size - r
    const cy = r
    return Buffer.from(
        `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
            `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#facc15" stroke="#101828" stroke-width="${Math.max(1, Math.round(size / 16))}"/>` +
            `</svg>`
    )
}

const square = (size, bg = transparent) =>
    sharp(source).resize(size, size, { fit: 'contain', background: bg })

async function main() {
    const plain = {
        'favicon-16x16.png': 16,
        'favicon-32x32.png': 32,
        'android-chrome-192x192.png': 192,
        'android-chrome-512x512.png': 512,
        'mstile-150x150.png': 150
    }
    for (const [name, size] of Object.entries(plain)) {
        await square(size).png().toFile(path.join(out, name))
        console.log('wrote', name)
    }

    // iPhones fill transparent areas with black, so give this one the header colour.
    await square(180, background)
        .flatten({ background })
        .png()
        .toFile(path.join(out, 'apple-touch-icon.png'))
    console.log('wrote apple-touch-icon.png')

    // "Maskable" icons get cropped to a circle or rounded square on Android, so keep the
    // artwork inside the middle 80% on a solid background.
    const inner = await square(410).png().toBuffer()
    await sharp({ create: { width: 512, height: 512, channels: 4, background } })
        .composite([{ input: inner, gravity: 'centre' }])
        .png()
        .toFile(path.join(out, 'android-chrome-maskable-512x512.png'))
    console.log('wrote android-chrome-maskable-512x512.png')

    for (const size of [16, 32]) {
        const base = await square(size).png().toBuffer()
        await sharp(base)
            .composite([{ input: turnDot(size) }])
            .png()
            .toFile(path.join(out, `favicon-turn-${size}x${size}.png`))
        console.log(`wrote favicon-turn-${size}x${size}.png`)
    }

    // Browsers accept a PNG saved under the .ico name.
    await square(32).png().toFile(path.join(out, 'favicon.ico'))
    console.log('wrote favicon.ico')

    console.log('Done. Reload the site with Ctrl+Shift+R to see the new icons.')
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
