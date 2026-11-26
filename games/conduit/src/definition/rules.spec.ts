import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { MachineState } from './states.js'
import { ActionType } from './actions.js'
import { isBuyTile } from '../actions/buyTile.js'
import { isPayRevenue } from '../actions/payRevenue.js'
import { isPlaceTile } from '../actions/placeTile.js'
import { isLoseInfrastructure } from '../actions/loseInfrastructure.js'
import { stationTile } from '../components/tiles.js'
import type { ConduitProjectedState } from '../model/gameState.js'
import { BidTrackSpaces, Rounds } from '../model/rules.js'
import { startTestGame, type TestSession } from '../testing/table.js'

const letters = (tileIds: (number | undefined)[]) =>
    tileIds.map((tileId) => (tileId === undefined ? '-' : stationTile(tileId).letter))

// Each bidder in turn bids on the next spot along, wrapping around, and passes as soon as the
// rules allow, until bidding ends.
function bidAround(session: TestSession) {
    let spot = 0
    while (session.state.machineState === MachineState.Bidding) {
        if (session.hydrated().canPassBid(session.activePlayerId())) {
            session.passBid()
        } else {
            session.bid((spot % session.state.market.length) + 1)
            spot += 1
        }
    }
}

// Rewrites the track of the tile on offer and hands the offer to its new bottom cube.
function setOfferTrack(session: TestSession, bids: string[]) {
    session.edit((draft) => {
        const slot = draft.market.findIndex((candidate) => candidate.tileId !== undefined)
        draft.market[slot].bids = bids
        draft.activePlayerIds = [bids[0]]
        const turn = draft.turnManager.series.at(-1)
        assertExists(turn, 'The offer is a turn')
        turn.playerId = bids[0]
    })
}

function player(state: ConduitProjectedState, playerId: string) {
    const found = state.players.find((candidate) => candidate.playerId === playerId)
    assertExists(found, `Player ${playerId} is in the game`)
    return found
}

function firstLegalPlacement(session: TestSession) {
    const state = session.hydrated()
    const placement = state.pendingPlacement()
    assertExists(placement, 'A tile is waiting to be placed')
    const [option] = state.grid().legalPlacements(placement.tileId, placement.faceUp)
    return { cell: option.cell, rotation: option.rotations[0] }
}

function placeAnywhere(session: TestSession, extraCubes = 0) {
    const { cell, rotation } = firstLegalPlacement(session)
    session.place(cell, rotation, extraCubes)
}

// Buys or passes every remaining tile and places it, until the round's revenue has been paid.
function resolveAll(session: TestSession, decide: (session: TestSession) => 'buy' | 'pass') {
    while (
        session.state.machineState === MachineState.Offering ||
        session.state.machineState === MachineState.Placing
    ) {
        if (session.state.machineState === MachineState.Offering) {
            const choice = decide(session)
            if (choice === 'buy' && session.hydrated().canAfford(session.activePlayerId())) {
                session.buy()
            } else {
                session.pass()
            }
        } else {
            placeAnywhere(session)
        }
    }
}

describe('setup', () => {
    it('builds the cross, deals cubes and $5 each, and fills the market from one stack', () => {
        const state = startTestGame(4).state
        expect(letters(state.board.stations.map((station) => station.tileId))).toEqual([
            'A',
            'B',
            'C',
            'D'
        ])
        expect(state.market).toHaveLength(4)
        // Every tile left after the cross goes into one shuffled stack.
        expect(state.deck.remaining).toBe(60 - 4)
        expect(
            state.turnManager.turnOrder.map((playerId) => {
                const seat = player(state, playerId)
                return [seat.cash, seat.supply, seat.reserve]
            })
        ).toEqual([
            [5, 5, 10],
            [5, 5, 10],
            [5, 5, 10],
            [5, 5, 10]
        ])
        expect(state.machineState).toBe(MachineState.Bidding)
        expect(state.activePlayerIds).toEqual([state.turnManager.turnOrder[0]])
    })

    it('puts one tile per player in the first market and one more after that', () => {
        expect(startTestGame(3).state.market).toHaveLength(3)
        expect(startTestGame(5).state.market).toHaveLength(5)
        expect(startTestGame(5).hydrated().fillMarket()).toHaveLength(6)
    })
})

describe('bidding', () => {
    const passBid = (session: TestSession) =>
        session.act(session.activePlayerId(), ActionType.PassBid)

    it('goes clockwise from the Start Player, one cube from supply at a time', () => {
        const session = startTestGame(3)
        const order = session.state.turnManager.turnOrder
        session.bid(1)
        expect(session.activePlayerId()).toBe(order[1])
        session.bid(1)
        session.bid(2)
        expect(session.state.market[0].bids).toEqual([order[0], order[1]])
        expect(player(session.state, order[0]).supply).toBe(4)
        expect(session.activePlayerId()).toBe(order[0])
    })

    it('ends once every player has passed', () => {
        const session = startTestGame(3)
        bidAround(session)
        expect(session.state.market.map((slot) => slot.bids.length)).toEqual([2, 2, 2])
        expect(session.state.bidPasses).toHaveLength(3)
        expect(session.state.machineState).toBe(MachineState.Offering)
    })

    it('skips a player with an empty supply, who is then done bidding', () => {
        const session = startTestGame(3)
        const [first, second, third] = session.state.turnManager.turnOrder
        session.edit((draft) => {
            player(draft, second).supply = 0
        })
        session.bid(1)
        expect(session.activePlayerId()).toBe(third)
        session.bid(2)
        expect(session.activePlayerId()).toBe(first)
        expect(session.hydrated().canBid(second)).toBe(false)
    })

    it('refuses a pass before the player has placed two cubes', () => {
        const session = startTestGame(3)
        session.bid(1)
        session.bid(1)
        session.bid(1)
        expect(() => passBid(session)).toThrow()
    })

    it('lets players pass with tiles still unbid, which then go face down', () => {
        const session = startTestGame(3)
        for (let bid = 0; bid < 6; bid++) session.bid(1)
        for (let pass = 0; pass < 3; pass++) passBid(session)
        expect(session.state.machineState).toBe(MachineState.Offering)
        expect(session.state.market.map((slot) => slot.bids.length)).toEqual([6, 0, 0])
        for (let pass = 0; pass < 6; pass++) session.pass()
        expect(session.hydrated().pendingPlacement()).toMatchObject({ faceUp: false })
    })

    it('goes on past two bids until everyone has passed', () => {
        const session = startTestGame(3)
        const [first, second, third] = session.state.turnManager.turnOrder
        for (let bid = 0; bid < 6; bid++) session.bid((bid % 3) + 1)
        expect(session.state.machineState).toBe(MachineState.Bidding)
        expect(session.activePlayerId()).toBe(first)
        passBid(session)
        session.bid(1)
        passBid(session)
        expect(session.activePlayerId()).toBe(second)
        session.bid(2)
        expect(session.activePlayerId()).toBe(second)
        passBid(session)
        expect(session.state.machineState).toBe(MachineState.Offering)
        expect(session.state.market.map((slot) => slot.bids.length)).toEqual([3, 3, 2])
        expect(session.state.bidPasses).toEqual([first, third, second])
    })

    it('lets a passed player back into bidding next round', () => {
        const session = startTestGame(3)
        for (let bid = 0; bid < 6; bid++) session.bid((bid % 3) + 1)
        for (let pass = 0; pass < 3; pass++) passBid(session)
        resolveAll(session, () => 'pass')
        expect(session.state.machineState).toBe(MachineState.Bidding)
        expect(session.state.bidPasses).toEqual([])
    })

    it('names each auction spot by its printed number, which stays as its tile resolves', () => {
        const session = startTestGame(4)
        expect(session.state.market.map((spot) => spot.spot)).toEqual([1, 2, 3, 4])
        session.bid(3)
        expect(session.state.market[2].bids).toEqual([session.state.turnManager.turnOrder[0]])
        expect(() => session.bid(5)).toThrow()
        bidAround(session)
        resolveAll(session, () => 'pass')
        expect(session.state.market.map((spot) => spot.spot)).toEqual([1, 2, 3, 4, 5])
    })

    it('refuses a full track', () => {
        const session = startTestGame(3)
        session.edit((draft) => {
            draft.market[0].bids = Array.from({ length: BidTrackSpaces }, () => 'p1')
        })
        expect(() => session.bid(1)).toThrow()
    })
})

describe('offers', () => {
    it('charges $1 plus a dollar a cube, paying the other bidders and returning their cubes', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0', 'p1', 'p0', 'p2'])
        const before = session.state
        session.buy()
        const after = session.state
        expect(player(after, 'p0').cash).toBe(player(before, 'p0').cash - 5)
        expect(player(after, 'p1').cash).toBe(player(before, 'p1').cash + 1)
        expect(player(after, 'p2').cash).toBe(player(before, 'p2').cash + 1)
        expect(player(after, 'p0').supply).toBe(player(before, 'p0').supply + 1)
        expect(player(after, 'p1').supply).toBe(player(before, 'p1').supply + 1)
        const bought = session.actions.at(-1)
        expect(isBuyTile(bought) && bought.metadata).toMatchObject({
            price: 5,
            payments: [
                { playerId: 'p1', amount: 1 },
                { playerId: 'p2', amount: 1 }
            ]
        })
        expect(session.state.machineState).toBe(MachineState.Placing)
        expect(session.activePlayerId()).toBe('p0')
    })

    it('puts the winning cube and any extra cubes on the placed station', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0'])
        session.buy()
        const supply = player(session.state, 'p0').supply
        placeAnywhere(session, 2)
        const placed = session.state.board.stations.at(-1)
        expect(placed).toMatchObject({ ownerId: 'p0', cubes: 3, faceUp: true })
        expect(player(session.state, 'p0').supply).toBe(supply - 2)
    })

    it('cannot place more extra cubes than the supply holds', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0'])
        session.buy()
        const { cell, rotation } = firstLegalPlacement(session)
        const supply = player(session.state, 'p0').supply
        expect(() => session.place(cell, rotation, supply + 1)).toThrow()
    })

    it('charges $1, then $2, then $3 for extra cubes', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0'])
        session.buy()
        const cash = player(session.state, 'p0').cash
        placeAnywhere(session, 2)
        expect(player(session.state, 'p0').cash).toBe(cash - 3)
        const placed = session.actions.at(-1)
        expect(isPlaceTile(placed) && placed.metadata?.extraPrice).toBe(3)
    })

    it('refuses extra cubes the player cannot pay for', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0'])
        session.buy()
        session.edit((draft) => {
            player(draft, 'p0').cash = 2
        })
        const { cell, rotation } = firstLegalPlacement(session)
        expect(() => session.place(cell, rotation, 2)).toThrow()
        session.place(cell, rotation, 1)
        expect(player(session.state, 'p0').cash).toBe(1)
    })

    it('pays a dollar per pass, taking an unbroken run of the passer’s cubes together', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0', 'p0', 'p1', 'p0'])
        const cash = player(session.state, 'p0').cash
        const supply = player(session.state, 'p0').supply
        session.pass()
        expect(session.state.market[0].bids).toEqual(['p1', 'p0'])
        expect(player(session.state, 'p0').cash).toBe(cash + 1)
        expect(player(session.state, 'p0').supply).toBe(supply + 2)
        expect(session.activePlayerId()).toBe('p1')
        session.pass()
        expect(session.activePlayerId()).toBe('p0')
        session.pass()
        expect(player(session.state, 'p0').cash).toBe(cash + 2)
    })

    it('must pass a tile the player cannot afford', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0', 'p1', 'p2'])
        session.edit((draft) => {
            player(draft, 'p0').cash = 2
        })
        expect(() => session.buy()).toThrow()
        session.pass()
    })

    it('has the Start Player place a tile everyone passed, face down', () => {
        const session = startTestGame(3)
        bidAround(session)
        const startPlayer = session.state.turnManager.turnOrder[0]
        setOfferTrack(session, ['p1'])
        session.pass()
        expect(session.state.machineState).toBe(MachineState.Placing)
        expect(session.activePlayerId()).toBe(startPlayer)
        const { cell } = firstLegalPlacement(session)
        expect(() => session.place(cell, 0, 1)).toThrow()
        session.place(cell, 0)
        expect(session.state.board.stations.at(-1)).toMatchObject({ faceUp: false, cubes: 0 })
        expect(session.state.board.stations.at(-1)?.ownerId).toBeUndefined()
    })
})

describe('revenue and infrastructure loss', () => {
    function roundWithOneStation() {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0'])
        session.buy()
        placeAnywhere(session)
        resolveAll(session, () => 'pass')
        return session
    }

    it('refills supplies, passes the Start Player marker and fills the next market', () => {
        const session = startTestGame(3)
        const [first, second] = session.state.turnManager.turnOrder
        bidAround(session)
        resolveAll(session, () => 'pass')
        expect(session.state.machineState).toBe(MachineState.Bidding)
        expect(session.state.turnManager.turnOrder[0]).toBe(second)
        expect(session.activePlayerId()).toBe(second)
        expect(player(session.state, first).reserve).toBe(7)
        expect(session.state.market).toHaveLength(4)
    })

    const ownStation = (session: TestSession) =>
        session.state.board.stations.find((station) => station.cubes > 0 || station.faceUp)

    it('pays the station, then takes its cube but leaves it face up with no owner', () => {
        const before = startTestGame(3).state
        const session = roundWithOneStation()
        const paid = session.actions.find(isPayRevenue)
        expect(paid?.metadata).toMatchObject({ revenues: [{ playerId: 'p0' }] })
        const faceUp = session.state.board.stations.filter((station) => station.faceUp)
        expect(faceUp).toHaveLength(1)
        expect(faceUp[0]).toMatchObject({ cubes: 0 })
        expect(faceUp[0].ownerId).toBeUndefined()
        // The setup cross had no cubes all round, so it flips now.
        expect(session.state.board.stations.filter((station) => !station.faceUp)).toHaveLength(
            session.state.board.stations.length - 1
        )
        // Infrastructure loss moved one cube to the reserve, then the refill took three to supply.
        expect(player(session.state, 'p0').reserve).toBe(player(before, 'p0').reserve + 1 - 3)
        expect(ownStation(session)).toBeDefined()
        const lost = session.actions.find(isLoseInfrastructure)
        expect(lost?.metadata).toMatchObject({ roundEnded: true })
    })

    it('flips the empty station at the end of the next round, paying it nothing', () => {
        const session = roundWithOneStation()
        const paidRounds = session.actions.filter(isPayRevenue).length
        bidAround(session)
        resolveAll(session, () => 'pass')
        const secondPayout = session.actions.filter(isPayRevenue)[paidRounds]
        expect(secondPayout?.metadata?.revenues).toEqual([])
        expect(session.state.board.stations.some((station) => station.faceUp)).toBe(false)
    })
})

describe('the end of the game', () => {
    function playRounds(session: TestSession) {
        while (session.state.machineState !== MachineState.EndOfGame) {
            bidAround(session)
            resolveAll(session, (offer) =>
                offer.activePlayerId() === offer.state.turnManager.turnOrder[0] ? 'buy' : 'pass'
            )
        }
    }

    it('pays out after the fifth round until no cubes remain', () => {
        const session = startTestGame(3)
        playRounds(session)
        const state = session.hydrated()
        expect(state.round).toBe(Rounds)
        expect(state.cubesOnBoard()).toBe(0)
        const refills = session.actions
            .filter(isLoseInfrastructure)
            .map((action) => action.metadata)
        expect(refills.filter((metadata) => metadata?.roundEnded)).toHaveLength(Rounds)
        expect(refills.at(Rounds - 1)).toMatchObject({ refills: [] })
    })

    it('ranks by cash, then by cubes in supply, sharing a tie that remains', () => {
        const session = startTestGame(3)
        const state = session.hydrated()
        state.players.forEach((seat, index) => {
            seat.cash = 10
            seat.supply = index === 2 ? 4 : 6
        })
        expect(state.leadingPlayerIds()).toEqual(['p0', 'p1'])
        state.getPlayerState('p2').cash = 11
        expect(state.leadingPlayerIds()).toEqual(['p2'])
    })
})

describe('the station-cube cap', () => {
    it('allows the winning cube and three extras, and no more', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0'])
        session.buy()
        session.edit((draft) => {
            player(draft, 'p0').cash = 20
            player(draft, 'p0').supply = 6
        })
        const { cell, rotation } = firstLegalPlacement(session)
        expect(() => session.place(cell, rotation, 4)).toThrow()
        session.place(cell, rotation, 3)
        expect(session.state.board.stations.at(-1)).toMatchObject({ ownerId: 'p0', cubes: 4 })
    })
})
