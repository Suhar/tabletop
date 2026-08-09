import type { AxialCoordinates } from '@tabletop/common'
import {
    type EarendelBoard,
    getHex,
    HexKind,
    hexKey,
    neighborsOf,
    type PlanetColor,
    sameHex
} from '../model/board.js'
import type { ScoredChain } from '../model/chains.js'
import { connectedGroup } from './groups.js'

// T(n) = 1 + 2 + ... + n. Chains pay superlinearly, so joining two DISTANT planets of a
// colour is worth far more than joining two that nearly touch - and costs the ships and the
// turns to match, which is also the game's clock.
export function triangular(n: number): number {
    return (n * (n + 1)) / 2
}

// A pair of planets, named in a way that doesn't depend on which was reached first, so a pair
// already scored can be recognised however it is approached.
export function planetPairKey(a: AxialCoordinates, b: AxialCoordinates): string {
    return [hexKey(a), hexKey(b)].sort((left, right) => left - right).join(':')
}

// Every hex holding one of this player's ships that is reachable from `start` through their
// own ships, of any type - unlike a station group, a chain is happy to run through a probe.
function componentContaining(
    board: EarendelBoard,
    playerId: string,
    start: AxialCoordinates
): AxialCoordinates[] {
    return connectedGroup(board, start, (hex) => hex.piece?.playerId === playerId)
}

function planetsTouching(
    board: EarendelBoard,
    component: AxialCoordinates[]
): Map<PlanetColor, AxialCoordinates[]> {
    const byColor = new Map<PlanetColor, AxialCoordinates[]>()
    const seen = new Set<number>()

    for (const coords of component) {
        for (const neighbor of neighborsOf(coords)) {
            const hex = getHex(board, neighbor)
            if (hex?.kind !== HexKind.Planet || hex.color === undefined) continue
            if (seen.has(hexKey(neighbor))) continue
            seen.add(hexKey(neighbor))

            const planets = byColor.get(hex.color) ?? []
            planets.push(neighbor)
            byColor.set(hex.color, planets)
        }
    }

    return byColor
}

// How many ships stand between the two planets, by the shortest run through this component.
// Several routes may exist once a player's ships bunch up; the shortest is the one that is
// well-defined and cheap to find, and it's the only measure that doesn't reward wandering.
function chainLength(
    component: AxialCoordinates[],
    from: AxialCoordinates,
    to: AxialCoordinates
): number | undefined {
    const inComponent = new Set(component.map(hexKey))
    const touches = (coords: AxialCoordinates, planet: AxialCoordinates) =>
        neighborsOf(coords).some((neighbor) => sameHex(neighbor, planet))

    const distances = new Map<number, number>()
    const queue: AxialCoordinates[] = []

    // Every ship touching the first planet is one link in, so they all start at 1.
    for (const coords of component) {
        if (touches(coords, from)) {
            distances.set(hexKey(coords), 1)
            queue.push(coords)
        }
    }

    while (queue.length > 0) {
        const coords = queue.shift()!
        const distance = distances.get(hexKey(coords))!
        if (touches(coords, to)) return distance

        for (const neighbor of neighborsOf(coords)) {
            const key = hexKey(neighbor)
            if (!inComponent.has(key) || distances.has(key)) continue
            distances.set(key, distance + 1)
            queue.push(neighbor)
        }
    }

    return undefined
}

export type CompletedChain = ScoredChain & { pairKey: string }

// The chains a placement just completed. A placement scores when the ships it belongs to now
// join two planets of the same colour that weren't joined before - `alreadyScored` is what
// "before" means, since a pair pays out once and then is spent.
//
// One placement can complete several pairs at once (three planets of a colour joined at once
// is three pairs), and each is measured and paid separately.
export function chainsCompletedBy(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates,
    alreadyScored: string[]
): CompletedChain[] {
    const component = componentContaining(board, playerId, coords)
    if (component.length === 0) return []

    const scored = new Set(alreadyScored)
    const completed: CompletedChain[] = []

    for (const [color, planets] of planetsTouching(board, component)) {
        for (let i = 0; i < planets.length; i++) {
            for (let j = i + 1; j < planets.length; j++) {
                const pairKey = planetPairKey(planets[i], planets[j])
                if (scored.has(pairKey)) continue

                const length = chainLength(component, planets[i], planets[j])
                if (length === undefined) continue

                scored.add(pairKey)
                completed.push({
                    planets: [planets[i], planets[j]],
                    color,
                    length,
                    points: triangular(length),
                    pairKey
                })
            }
        }
    }

    return completed
}
