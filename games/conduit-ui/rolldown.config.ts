import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { importGlobPlugin } from 'rolldown/experimental'
import { createGameUiRolldownConfig } from '@tabletop/rolldown-config'

const packageRootUrl = new URL('.', import.meta.url)
const base = createGameUiRolldownConfig({ packageRootUrl })

// The in-game rules are the designer's Markdown file, imported as text the way Vite's ?raw does.
const rawText = {
    name: 'conduit-raw-text',
    resolveId(source: string) {
        if (!source.endsWith('?raw')) return null
        const file = source.slice(0, -'?raw'.length).replace(/^\$lib\//, 'src/lib/')
        return `${fileURLToPath(new URL(file, packageRootUrl))}?raw`
    },
    load(id: string) {
        if (!id.endsWith('?raw')) return null
        const text = readFileSync(id.slice(0, -'?raw'.length), 'utf8')
        return `export default ${JSON.stringify(text)}`
    }
}

// The tile art is collected with import.meta.glob, which only Vite expands on its own.
export default { ...base, plugins: [rawText, importGlobPlugin(), ...base.plugins] }
