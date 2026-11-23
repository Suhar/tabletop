import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, HexKind, hexKey, neighborsOf } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import {
    JAMMER_RANGE,
    NEBULA_PER_SEEDER,
    type Piece,
    PieceType,
    SALVAGE_RANGE
} from '../model/pieces.js'

export function hexDistance(a: AxialCoordinates, b: AxialCoordinates): number {
    const dq = a.q - b.q
    const dr = a.r - b.r
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr))
}

// The hexes within range of coords, by offset rather than a scan of the board: these checks run
// inside every sight line, so they must stay cheap.
function hexesWithin(coords: AxialCoordinates, range: number): AxialCoordinates[] {
    const within: AxialCoordinates[] = []
    for (let dq = -range; dq <= range; dq++) {
        for (let dr = -range; dr <= range; dr++) {
            if (Math.abs(dq + dr) > range) continue
            within.push({ q: coords.q + dq, r: coords.r + dr })
        }
    }
    return within
}

function piecesWithin(
    board: EarendelBoard,
    coords: AxialCoordinates,
    range: number,
    type: PieceType
): { piece: Piece; coords: AxialCoordinates }[] {
    return hexesWithin(coords, range).flatMap((at) => {
        const piece = getHex(board, at)?.piece
        return piece?.type === type ? [{ piece, coords: at }] : []
    })
}

// Nebula Seeding: the empty hexes a seeder with laying left could turn into nebula. The cloud
// grows from the seeder: a hex beside it, or beside any nebula joined to it through nebula,
// whoever laid that nebula.
export function seedableHexes(board: EarendelBoard, seeder: AxialCoordinates): AxialCoordinates[] {
    const piece = getHex(board, seeder)?.piece
    if (piece?.type !== PieceType.NebulaSeeder) return []
    if ((piece.seeded ?? 0) >= NEBULA_PER_SEEDER) return []

    const seen = new Set([hexKey(seeder)])
    const frontier = [seeder]
    const seedable: AxialCoordinates[] = []
    for (let from = frontier.pop(); from; from = frontier.pop()) {
        for (const neighbor of neighborsOf(from)) {
            const key = hexKey(neighbor)
            if (seen.has(key)) continue
            seen.add(key)
            const hex = getHex(board, neighbor)
            if (hex?.kind === HexKind.Nebula) frontier.push(neighbor)
            else if (hex?.kind === HexKind.Open && !hex.piece) seedable.push(neighbor)
        }
    }
    return seedable
}

// The player's seeders that could still lay nebula.
export function seedersReady(board: EarendelBoard, playerId: string): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter(
            (hex) =>
                hex.piece?.type === PieceType.NebulaSeeder &&
                hex.piece.playerId === playerId &&
                seedableHexes(board, hex.coords).length > 0
        )
        .map((hex) => hex.coords)
}

// Interdiction: an enemy interdictor beside the hex closes it to the player's ships, for
// placement and every move that lands (rules.md, Granted pieces).
export function interdictedFor(
    board: EarendelBoard,
    coords: AxialCoordinates,
    playerId: string
): boolean {
    return neighborsOf(coords).some((neighbor) => {
        const piece = getHex(board, neighbor)?.piece
        return piece?.type === PieceType.Interdictor && piece.playerId !== playerId
    })
}

export function hexesInterdictedFor(board: EarendelBoard, playerId: string): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.kind === HexKind.Open && !hex.piece)
        .filter((hex) => interdictedFor(board, hex.coords, playerId))
        .map((hex) => hex.coords)
}

// Quarantine: a beacon beside the planet, anyone's, stops surveys and holds claims.
export function quarantined(board: EarendelBoard, planet: AxialCoordinates): boolean {
    return neighborsOf(planet).some(
        (neighbor) => getHex(board, neighbor)?.piece?.type === PieceType.QuarantineBeacon
    )
}

// Jammer Array: a station or relay within reach of any jammer has no sight at all.
export function jammedAt(board: EarendelBoard, coords: AxialCoordinates): boolean {
    return piecesWithin(board, coords, JAMMER_RANGE, PieceType.Jammer).length > 0
}

// A friendly bastion beside the piece shields it, No Quarter or not.
export function shieldedByBastion(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const piece = getHex(board, coords)?.piece
    if (!piece) return false
    return neighborsOf(coords).some((neighbor) => {
        const guard = getHex(board, neighbor)?.piece
        return guard?.type === PieceType.Bastion && guard.playerId === piece.playerId
    })
}

// Deep Scan: one more ship drawn, and one more thrown out, per scanner the player has standing.
// Capped at one so two scanners do not run the bag down faster.
export function scannerBonus(board: EarendelBoard, playerId: string): number {
    return Object.values(board.hexes).some(
        (hex) => hex.piece?.type === PieceType.DeepScanner && hex.piece.playerId === playerId
    )
        ? 1
        : 0
}

// Salvage Operations: whose bag a ship destroyed at coords falls into, if any drone is in reach.
// The nearest drone claims it; among drones equally near, the destroyer's own first, then the
// earliest in turn order.
export function salvageClaimant(
    state: HydratedEarendelGameState,
    coords: AxialCoordinates,
    destroyerId: string | undefined
): string | undefined {
    const drones = piecesWithin(state.board, coords, SALVAGE_RANGE, PieceType.SalvageDrone)
    if (drones.length === 0) return undefined
    const nearest = Math.min(...drones.map((drone) => hexDistance(drone.coords, coords)))
    const owners = drones
        .filter((drone) => hexDistance(drone.coords, coords) === nearest)
        .map((drone) => drone.piece.playerId)
    if (destroyerId && owners.includes(destroyerId)) return destroyerId
    const seats = state.turnManager.turnOrder
    return owners.sort((a, b) => seats.indexOf(a) - seats.indexOf(b))[0]
}
