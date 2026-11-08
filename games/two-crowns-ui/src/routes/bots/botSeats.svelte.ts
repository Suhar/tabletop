import type { Seats } from './botServer.js'

interface StoredSeats {
    bots: Seats
    plays: Record<string, boolean>
}

const storageKey = (gameId: string) => `two-crowns-bot-seats:${gameId}`

/** Each seat's bot, and whether it plays its own turns, kept per harness game. */
export class BotSeats {
    private bots: Seats = $state({})
    private plays: Record<string, boolean> = $state({})
    private readonly gameId: string
    private readonly preferred: string

    constructor(gameId: string, preferred: string) {
        this.gameId = gameId
        this.preferred = preferred
        const stored = localStorage.getItem(storageKey(gameId))
        if (!stored) return
        const seats: StoredSeats = JSON.parse(stored)
        this.bots = seats.bots
        this.plays = seats.plays
    }

    static seat(gameId: string, bots: Seats) {
        const seats: StoredSeats = { bots, plays: {} }
        localStorage.setItem(storageKey(gameId), JSON.stringify(seats))
    }

    bot(playerId: string): string {
        return this.bots[playerId] ?? this.preferred
    }

    playsItself(playerId: string): boolean {
        return this.plays[playerId] ?? false
    }

    setBot(playerId: string, spec: string) {
        this.bots[playerId] = spec
        this.save()
    }

    setPlaysItself(playerId: string, plays: boolean) {
        this.plays[playerId] = plays
        this.save()
    }

    all(playerIds: string[]): Seats {
        return Object.fromEntries(playerIds.map((playerId) => [playerId, this.bot(playerId)]))
    }

    private save() {
        const seats: StoredSeats = { bots: this.bots, plays: this.plays }
        localStorage.setItem(storageKey(this.gameId), JSON.stringify(seats))
    }
}
