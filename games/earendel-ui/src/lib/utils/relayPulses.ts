import { assertExists, type AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, hexKey, PieceType, type SightLine } from '@tabletop/earendel'

// Seconds a pulse takes to run along one link.
export const RELAY_HOP = 0.6

export type RelayPulse = {
    key: string
    from: AxialCoordinates
    to: AxialCoordinates
    playerId: string
    delay: number
}

export type RelayBurst = { key: string; at: AxialCoordinates; playerId: string; delay: number }

const isRelayAt = (board: EarendelBoard, coords: AxialCoordinates) =>
    getHex(board, coords)?.piece?.type === PieceType.Relay

// A sight line with a relay at either end, which is drawn as a signal rather than a beam.
export function isRelayLine(board: EarendelBoard, line: SightLine): boolean {
    return isRelayAt(board, line.from) || isRelayAt(board, line.to)
}

// How a signal crosses each relay network: it bursts from one station, runs to the relays it
// sees, and each relay bursts it on to the rest, one link per RELAY_HOP. Links that would carry
// the signal back to a piece it has already reached carry no pulse.
export function relaySignal(
    board: EarendelBoard,
    lines: SightLine[]
): { pulses: RelayPulse[]; bursts: RelayBurst[] } {
    const relayLines = lines.filter((line) => isRelayLine(board, line))
    const nodes = new Map<number, { coords: AxialCoordinates; playerId: string }>()
    const links = new Map<number, AxialCoordinates[]>()
    for (const line of relayLines) {
        for (const [a, b] of [
            [line.from, line.to],
            [line.to, line.from]
        ]) {
            nodes.set(hexKey(a), { coords: a, playerId: line.playerId })
            links.set(hexKey(a), [...(links.get(hexKey(a)) ?? []), b])
        }
    }

    const node = (key: number) => {
        const found = nodes.get(key)
        assertExists(found, `No piece at hex ${key} in a relay network`)
        return found
    }

    // Stations start a network's signal, the lowest hex first so it is the same every time.
    const order = [...nodes.keys()].sort((a, b) => {
        const relayFirst =
            Number(isRelayAt(board, node(a).coords)) - Number(isRelayAt(board, node(b).coords))
        return relayFirst || a - b
    })

    const pulses: RelayPulse[] = []
    const bursts: RelayBurst[] = []
    const depth = new Map<number, number>()

    for (const root of order) {
        if (depth.has(root)) continue
        depth.set(root, 0)
        const start = node(root)
        bursts.push({ key: `burst-${root}`, at: start.coords, playerId: start.playerId, delay: 0 })

        const queue = [root]
        for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
            const here = node(at)
            const hops = depth.get(at) ?? 0
            for (const next of links.get(at) ?? []) {
                const key = hexKey(next)
                if (depth.has(key)) continue
                depth.set(key, hops + 1)
                queue.push(key)
                pulses.push({
                    key: `pulse-${at}-${key}`,
                    from: here.coords,
                    to: next,
                    playerId: here.playerId,
                    delay: hops * RELAY_HOP
                })
                if (isRelayAt(board, next)) {
                    bursts.push({
                        key: `burst-${key}`,
                        at: next,
                        playerId: here.playerId,
                        delay: (hops + 1) * RELAY_HOP
                    })
                }
            }
        }
    }

    return { pulses, bursts }
}
