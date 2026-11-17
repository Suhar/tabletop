// Turns 18xx Maker's token export into the station tokens the table draws, so they look as they
// do in the 18xx Maker sheets. Export the tokens first, from an 18xx Maker checkout:
//   node ./bin/maker.js export <TwoCrowns1874.json> --format svg --docs tokens --out <folder>
// then run, from this package:
//   node scripts/maker-tokens.mjs <folder>/TwoCrowns1874/svg <18xx Maker checkout>
// Each export file holds a company's token sheet; its first token is the station token. The labels
// are turned into paths in Bitter Bold, the font 18xx Maker draws them in, because a token is shown
// as an image and an image can't load the page's fonts.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { create } from 'fontkit'

const [exportFolder, makerCheckout] = process.argv.slice(2)
if (!exportFolder || !makerCheckout) {
    console.error('Usage: node scripts/maker-tokens.mjs <token svg folder> <18xx Maker checkout>')
    process.exit(1)
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'images', 'tokens')

// 18xx Maker ships Bitter in its stylesheet as the "display" face, one woff2 per character range;
// the last weight-700 face is the Latin one.
const fonts = readFileSync(join(makerCheckout, 'src', 'styles', 'fonts.css'), 'utf8')
const bold = fonts
    .split('@font-face')
    .filter((face) => /font-family:\s*"display"/.test(face) && /font-weight:\s*700/.test(face))
    .map((face) => /base64,([^)]+)\)/.exec(face)?.[1])
    .at(-1)
if (!bold) throw new Error('No Bitter Bold face in 18xx Maker’s fonts.css')
const font = create(Buffer.from(bold, 'base64'))

const round = (value) => Number(value.toFixed(3))
function textPath(attributes, label) {
    const size = parseFloat(attr(attributes, 'font-size'))
    const scale = size / font.unitsPerEm
    const run = font.layout(label)
    const width = run.positions.reduce((sum, position) => sum + position.xAdvance, 0) * scale
    let x = parseFloat(attr(attributes, 'x') ?? '0')
    if (attr(attributes, 'text-anchor') === 'middle') x -= width / 2
    const y = parseFloat(attr(attributes, 'y') ?? '0')
    const parts = run.glyphs.map((glyph, index) => {
        const position = run.positions[index]
        const d = glyph.path
            .scale(scale, -scale)
            .translate(round(x + position.xOffset * scale), round(y - position.yOffset * scale))
            .toSVG()
        x += position.xAdvance * scale
        return d
    })
    const stroke = attr(attributes, 'stroke')
    const strokeAttributes =
        stroke && stroke !== 'none'
            ? ` stroke="${stroke}" stroke-width="${attr(attributes, 'stroke-width')}"`
            : ''
    return `<path d="${parts.join('')}" fill="${attr(attributes, 'fill')}"${strokeAttributes}/>`
}
function attr(attributes, name) {
    return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attributes)?.[1]
}

// The Austrian and Hungarian Banks have no stations, so the table never draws their tokens.
const Stationless = new Set(['AB', 'HB'])
const written = []
for (const file of readdirSync(exportFolder).sort()) {
    const match = /-token-\d+-([A-Za-z]+)\.svg$/.exec(file)
    if (!match || Stationless.has(match[1])) continue
    const svg = readFileSync(join(exportFolder, file), 'utf8')
    // The station token is the sheet's first token: <svg viewBox="-25 -25 50 50" ...>...</svg>.
    const token = /<svg version="1\.1" viewBox="-25 -25 50 50"[^>]*>([\s\S]*?)<\/svg>/.exec(svg)
    if (!token) throw new Error(`${file} has no full-size token`)
    const body = token[1]
        .replace(/<text ([^>]*)>([^<]*)<\/text>/g, (_, attributes, label) =>
            textPath(attributes, label)
        )
        .replace(/<defs\/>/, '')
    // The outline is a 1-unit stroke on the edge, so the view reaches half a unit past it.
    writeFileSync(
        join(out, `${match[1]}.svg`),
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25.5 -25.5 51 51">${body}</svg>\n`
    )
    written.push(match[1])
}
console.log(`Wrote ${written.length} tokens: ${written.join(', ')}`)
