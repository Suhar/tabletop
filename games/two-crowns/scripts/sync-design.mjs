// Copies the design authorities from the design repo (Suhar/two-crowns-1874) into design/, records
// which version and commit they came from in design/SOURCE.json, then runs the import. Run with
// `pnpm sync`; `--no-pull` skips the pull, `--build` also rebuilds the package.
// The clone defaults to <main checkout>/design/two-crowns-1874; TWO_CROWNS_DESIGN overrides it.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
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

const files = ['1874design.md', 'TwoCrowns1874.json']
const missing = [...files, 'VERSION'].filter((file) => !existsSync(join(clone, file)))
if (missing.length > 0) {
    console.error(`The design repo at ${clone} has no ${missing.join(', ')}`)
    process.exit(1)
}
for (const file of files) copyFileSync(join(clone, file), join(root, 'design', file))

const dirty = git(clone, 'status', '--porcelain', '--', ...files, 'VERSION') !== ''
const source = {
    repo: 'Suhar/two-crowns-1874',
    version: readFileSync(join(clone, 'VERSION'), 'utf8').trim(),
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

const importArgs = ['scripts/import-maker.mjs']
if (process.argv.includes('--build')) importArgs.push('--build')
execFileSync('node', importArgs, { cwd: root, stdio: 'inherit' })
