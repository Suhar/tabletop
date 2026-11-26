import { marked, type Token } from 'marked'

// Drawn by Svelte from plain blocks, so no HTML string ever reaches the page.
export type Inline =
    | { kind: 'text'; text: string }
    | { kind: 'strong'; children: Inline[] }
    | { kind: 'em'; children: Inline[] }
    | { kind: 'code'; text: string }
    | { kind: 'break' }

export type Block =
    | { kind: 'heading'; depth: number; inline: Inline[] }
    | { kind: 'paragraph'; inline: Inline[] }
    | { kind: 'list'; ordered: boolean; items: Block[][] }
    | { kind: 'rule' }

export function parseMarkdown(text: string): Block[] {
    return blocks(marked.lexer(text))
}

function blocks(tokens: Token[]): Block[] {
    return tokens.flatMap((token): Block[] => {
        switch (token.type) {
            case 'heading':
                return [
                    {
                        kind: 'heading',
                        depth: Number(token.depth),
                        inline: inline(token.tokens ?? [])
                    }
                ]
            case 'paragraph':
                return [{ kind: 'paragraph', inline: inline(token.tokens ?? []) }]
            case 'text':
                return [{ kind: 'paragraph', inline: inline(token.tokens ?? [token]) }]
            case 'list':
                return [
                    {
                        kind: 'list',
                        ordered: Boolean(token.ordered),
                        items: listItems(token.items)
                    }
                ]
            case 'hr':
                return [{ kind: 'rule' }]
            case 'blockquote':
                return blocks(token.tokens ?? [])
            default:
                return []
        }
    })
}

function listItems(items: unknown): Block[][] {
    if (!Array.isArray(items)) return []
    return items.map((item: { tokens?: Token[] }) => blocks(item.tokens ?? []))
}

function inline(tokens: Token[]): Inline[] {
    return tokens.flatMap((token): Inline[] => {
        switch (token.type) {
            case 'strong':
                return [{ kind: 'strong', children: inline(token.tokens ?? []) }]
            case 'em':
                return [{ kind: 'em', children: inline(token.tokens ?? []) }]
            case 'codespan':
                return [{ kind: 'code', text: String(token.text) }]
            case 'br':
                return [{ kind: 'break' }]
            case 'text':
                return token.tokens
                    ? inline(token.tokens)
                    : [{ kind: 'text', text: decode(String(token.text)) }]
            case 'escape':
                return [{ kind: 'text', text: String(token.text) }]
            case 'link':
                return inline(token.tokens ?? [])
            default:
                return 'text' in token ? [{ kind: 'text', text: decode(String(token.text)) }] : []
        }
    })
}

const Entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
}

function decode(text: string): string {
    return text.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => Entities[entity] ?? entity)
}
