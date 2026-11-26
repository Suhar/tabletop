import { describe, expect, it } from 'vitest'
import { parseMarkdown } from './markdown.js'

describe('the rules Markdown', () => {
    it('reads headings, emphasis, lists and escapes as plain blocks', () => {
        expect(
            parseMarkdown('# Conduit\n\nPay **\\$1** to *each* player.\n\n* one\n* two\n')
        ).toEqual([
            { kind: 'heading', depth: 1, inline: [{ kind: 'text', text: 'Conduit' }] },
            {
                kind: 'paragraph',
                inline: [
                    { kind: 'text', text: 'Pay ' },
                    {
                        kind: 'strong',
                        children: [
                            { kind: 'text', text: '$' },
                            { kind: 'text', text: '1' }
                        ]
                    },
                    { kind: 'text', text: ' to ' },
                    { kind: 'em', children: [{ kind: 'text', text: 'each' }] },
                    { kind: 'text', text: ' player.' }
                ]
            },
            {
                kind: 'list',
                ordered: false,
                items: [
                    [{ kind: 'paragraph', inline: [{ kind: 'text', text: 'one' }] }],
                    [{ kind: 'paragraph', inline: [{ kind: 'text', text: 'two' }] }]
                ]
            }
        ])
    })

    it('keeps apostrophes and ampersands readable', () => {
        expect(parseMarkdown("owners' cash & cubes")).toEqual([
            { kind: 'paragraph', inline: [{ kind: 'text', text: "owners' cash & cubes" }] }
        ])
    })
})
