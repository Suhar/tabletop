import { sameCoordinates } from '@tabletop/common'
import type { AxialCoordinates } from '@tabletop/common'
import {
    type EarendelBoard,
    getHex,
    HexKind,
    hexKey,
    neighborsOf,
    type PlanetColor
} from '../model/board.js'
import type { ScoredChain } from '../model/chains.js'
import { connectedGroup } from './groups.js'

export function triangular(n: number): number {
    return (n * (n + 1)) / 2
}

export function planetPairKey(a: AxialCoordinates, b: AxialCoordinates): string {
    return [hexKey(a), hexKey(b)].sort((left, right) => left - right).join(':')
}

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

function chainLength(
    component: AxialCoordinates[],
    from: AxialCoordinates,
    to: AxialCoordinates
): number | undefined {
    const inComponent = new Set(component.map(hexKey))
    const touches = (coords: AxialCoordinates, planet: AxialCoordinates) =>
        neighborsOf(coords).some((neighbor) => sameCoordinates(neighbor, planet))

    const reached = new Set<number>()
    const queue: { coords: AxialCoordinates; distance: number }[] = []

    for (const coords of component) {
        if (touches(coords, from)) {
            reached.add(hexKey(coords))
            queue.push({ coords, distance: 1 })
        }
    }

    for (let step = queue.shift(); step !== undefined; step = queue.shift()) {
        const { coords, distance } = step
        if (touches(coords, to)) return distance

        for (const neighbor of neighborsOf(coords)) {
            const key = hexKey(neighbor)
            if (!inComponent.has(key) || reached.has(key)) continue
            reached.add(key)
            queue.push({ coords: neighbor, distance: distance + 1 })
        }
    }

    return undefined
}

export type CompletedChain = ScoredChain & { pairKey: string }

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
