import type { Game, GameState, ScenarioData } from '@tabletop/common'
import { scenarioData } from '@tabletop/frontend-components'

export type Seats = Record<string, string>

export interface BotSpecs {
    specs: string[]
    preferred: string
}

export interface KeptRun {
    run: string
    games: number
}

export interface KeptGame {
    file: string
    players: number
    seed: number
    policies: Record<string, string>
    winners: string[]
    ending?: string
    final: boolean
}

export interface BotMove {
    spec: string
    action: { type: string; playerId: string } & Record<string, unknown>
}

export interface BotGame {
    scenario: ScenarioData
    seats: Seats
}

export const BotServerCommand = 'node src/botServer.ts (in lab/sims/1874)'

export const botServer = {
    specs: () => request<BotSpecs>('specs'),
    runs: () => request<KeptRun[]>('runs'),
    games: (run: string) => request<KeptGame[]>(`games?run=${encodeURIComponent(run)}`),
    game: (file: string) => botGame(request(`game?file=${encodeURIComponent(file)}`)),
    play: (players: number, seed: number, seats: string[]) =>
        botGame(post('play', { players, seed, seats })),
    move: (game: Game, state: GameState, seats: Seats) =>
        post<BotMove>('move', { game, state, seats })
}

async function botGame(response: Promise<{ scenario: unknown; seats: Seats }>): Promise<BotGame> {
    const { scenario, seats } = await response
    return { scenario: scenarioData(scenario), seats }
}

function post<T>(path: string, body: unknown): Promise<T> {
    return request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    })
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/bots/${path}`, init)
    if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error(`The bot server is not running; start it with ${BotServerCommand}`)
    }
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ?? response.statusText)
    return body
}
