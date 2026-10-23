import { type RandomFunction, shuffle } from '@tabletop/common'

// Earendel's hidden piles - each player's bag, the technology deck and the tile supply - are
// stored as the platform's DrawBag: the items are protected, so no client sees what is in them or
// in what order, and `remaining` is the public count that rules and the UI read instead.
//
// Drawn from the front, in the order the items are held.
export type Bag<T> = { items: T[]; remaining: number }

export function bagOf<T>(items: T[]): Bag<T> {
    return { items, remaining: items.length }
}

export function drawFrom<T>(bag: Bag<T>): T | undefined {
    if (bag.remaining === 0) return undefined
    bag.remaining -= 1
    return bag.items.shift()
}

// Puts items back and reshuffles, so a returned piece cannot be tracked to where it went.
export function returnTo<T>(bag: Bag<T>, items: T[], random: RandomFunction) {
    bag.items.push(...items)
    bag.remaining += items.length
    shuffle(bag.items, random)
}
