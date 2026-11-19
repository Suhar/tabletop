// Copies the design authorities and the player rulebook from the design repo (Suhar/two-crowns-1874) into design/, records
// which version and commit they came from in design/SOURCE.json, then runs the import. Run with
// `pnpm sync`; `--no-pull` skips the pull, `--build` also rebuilds the package.
// The clone defaults to <main checkout>/design/two-crowns-1874; TWO_CROWNS_DESIGN overrides it.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const mainCheckout = dirname(resolve(root, git(root, 'rev-parse', '--git-common-dir')))
const clone = process.env.TWO_CROWNS_DESIGN ?? join(mainCheckout, 'design', 'two-crowns-1874')
if (!existsSync(join(clone, '.git'))) {
    console.error(
        `No design repo at ${clone}. Clone it with\n` +
            `  git clone https://github.com/Suhar/two-crowns-1874.git ${clone}`
    )
    process.exit(1)
}

if (!process.argv.includes('--no-pull')) git(clone, 'pull', '--ff-only')

const authorities = ['1874design.md', 'TwoCrowns1874.json']
const version = existsSync(join(clone, 'VERSION'))
    ? readFileSync(join(clone, 'VERSION'), 'utf8').trim()
    : undefined
// The player rulebook carries the minor version it was written for in its name (a patch keeps it);
// the newest one is copied as design/1874rules.md.
const rulebookVersion = (file) =>
    /^1874rules-(\d+)\.(\d+)\.(\d+)\.md$/.exec(file)?.slice(1).map(Number)
const rulebook = existsSync(join(clone, 'rules'))
    ? readdirSync(join(clone, 'rules'))
          .filter((file) => rulebookVersion(file))
          .sort((a, b) => {
              const [x, y] = [rulebookVersion(a), rulebookVersion(b)]
              return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
          })
          .map((file) => `rules/${file}`)
          .at(-1)
    : undefined
const missing = [...authorities, 'VERSION', rulebook ?? 'rules/1874rules-<version>.md'].filter(
    (file) => !existsSync(join(clone, file))
)
if (missing.length > 0) {
    console.error(`The design repo at ${clone} has no ${missing.join(', ')}`)
    process.exit(1)
}
const copies = {
    ...Object.fromEntries(authorities.map((file) => [file, file])),
    '1874rules.md': rulebook
}
for (const [copy, file] of Object.entries(copies)) {
    copyFileSync(join(clone, file), join(root, 'design', copy))
}
// The private company cards the rulebook shows, exported from 18xx Maker into rules/cards.
const cardsFolder = join(root, 'design', 'cards')
rmSync(cardsFolder, { recursive: true, force: true })
mkdirSync(cardsFolder)
const cards = existsSync(join(clone, 'rules', 'cards'))
    ? readdirSync(join(clone, 'rules', 'cards')).filter((file) => file.endsWith('.png'))
    : []
for (const card of cards) copyFileSync(join(clone, 'rules', 'cards', card), join(cardsFolder, card))
const files = [...Object.keys(copies), ...cards.map((card) => `cards/${card}`)]

const dirty =
    git(
        clone,
        'status',
        '--porcelain',
        '--',
        ...Object.values(copies),
        'rules/cards',
        'VERSION'
    ) !== ''
const source = {
    repo: 'Suhar/two-crowns-1874',
    version,
    commit: git(clone, 'rev-parse', 'HEAD'),
    committedAt: git(clone, 'log', '-1', '--format=%cI'),
    dirty,
    files: Object.fromEntries(
        files.map((file) => [
            file,
            createHash('sha256')
                .update(readFileSync(join(root, 'design', file)))
                .digest('hex')
                .slice(0, 12)
        ])
    )
}
writeFileSync(join(root, 'design', 'SOURCE.json'), `${JSON.stringify(source, null, 4)}\n`)
console.log(
    `Synced design ${source.version} (${source.commit.slice(0, 9)}${dirty ? ', uncommitted edits' : ''})`
)

// The table's rules button shows the rulebook, rendered into the UI package.
execFileSync('node', ['scripts/rulebook.mjs'], {
    cwd: join(root, '..', 'two-crowns-ui'),
    stdio: 'inherit'
})

const importArgs = ['scripts/import-maker.mjs']
if (process.argv.includes('--build')) importArgs.push('--build')
execFileSync('node', importArgs, { cwd: root, stdio: 'inherit' })
