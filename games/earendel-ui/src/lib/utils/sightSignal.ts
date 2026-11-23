import { assertExists, type AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, hexKey, PieceType, type SightLine } from '@tabletop/earendel'

// Seconds a pulse takes to run along one link.
export const SIGNAL_HOP = 0.6

export type SignalPulse = {
    key: string
    from: AxialCoordinates
    to: AxialCoordinates
    playerId: string
    delay: number
}

export type SignalBurst = { key: string; at: AxialCoordinates; playerId: string; delay: number }

const isRelayAt = (board: EarendelBoard, coords: AxialCoordinates) =>
    getHex(board, coords)?.piece?.type === PieceType.Relay

// How a signal crosses each network of sight links: it bursts from one station and runs along the
// links one hop per SIGNAL_HOP, bursting again from every station or relay that passes it on.
// Links that would carry it back to a piece it has already reached carry no pulse.
export function sightSignal(
    board: EarendelBoard,
    lines: SightLine[]
): { pulses: SignalPulse[]; bursts: SignalBurst[] } {
    const nodes = new Map<number, { coords: AxialCoordinates; playerId: string }>()
    const links = new Map<number, AxialCoordinates[]>()
    for (const line of lines) {
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
        assertExists(found, `No piece at hex ${key} in a sight network`)
        return found
    }

    // A network's signal starts from a station, the lowest hex first so it is the same every time.
    const order = [...nodes.keys()].sort((a, b) => {
        const relayLast =
            Number(isRelayAt(board, node(a).coords)) - Number(isRelayAt(board, node(b).coords))
        return relayLast || a - b
    })

    const pulses: SignalPulse[] = []
    const bursts: SignalBurst[] = []
    const depth = new Map<number, number>()

    for (const root of order) {
        if (depth.has(root)) continue
        depth.set(root, 0)

        const queue = [root]
        for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
            const here = node(at)
            const hops = depth.get(at) ?? 0
            let passedOn = false
            for (const next of links.get(at) ?? []) {
                const key = hexKey(next)
                if (depth.has(key)) continue
                depth.set(key, hops + 1)
                queue.push(key)
                passedOn = true
                pulses.push({
                    key: `pulse-${at}-${key}`,
                    from: here.coords,
                    to: next,
                    playerId: here.playerId,
                    delay: hops * SIGNAL_HOP
                })
            }
            if (passedOn) {
                bursts.push({
                    key: `burst-${at}`,
                    at: here.coords,
                    playerId: here.playerId,
                    delay: hops * SIGNAL_HOP
                })
            }
        }
    }

    return { pulses, bursts }
}
