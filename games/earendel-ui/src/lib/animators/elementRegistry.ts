export class ElementRegistry<E extends Element = SVGElement> {
    private elements = new Map<string, E>()

    get(key: string): E | undefined {
        return this.elements.get(key)
    }

    entries(): [string, E][] {
        return [...this.elements.entries()]
    }

    set(key: string, element: E) {
        this.elements.set(key, element)
    }

    // An outgoing node may be destroyed after its replacement under the same key registered.
    release(key: string, element: E) {
        if (this.elements.get(key) === element) this.elements.delete(key)
    }
}

export function registerElement<E extends Element>(
    node: E,
    params: { registry: ElementRegistry<E>; key: string }
) {
    let current = params
    current.registry.set(current.key, node)

    return {
        update(next: { registry: ElementRegistry<E>; key: string }) {
            if (next.key === current.key && next.registry === current.registry) return
            current.registry.release(current.key, node)
            current = next
            current.registry.set(current.key, node)
        },
        destroy() {
            current.registry.release(current.key, node)
        }
    }
}
