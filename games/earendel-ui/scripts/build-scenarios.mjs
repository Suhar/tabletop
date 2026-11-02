// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    focusedCardId,
    HexKind,
    hexKey,
    PieceLevel,
    PieceType,
    PlanetColor,
    refreshPlanetControl,
    TechnologyEffectKind,
    TurnStyle
} from '@tabletop/earendel'
import { TestGame } from '@tabletop/earendel/testing'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')

let ids = 0
const piece = (playerId, type, level) => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// A rectangular field of open hexes, q 0 to 10, with the given planets.
function field(planets) {
    const hexes = {}
    for (let q = 0; q <= 10; q++) {
        const top = -Math.floor(q / 2)
        for (let r = top; r <= top + 6; r++) {
            const coords = { q, r }
            const color = planets[`${q},${r}`]
            hexes[hexKey(coords)] = color
                ? { coords, tileId: 'tile-0', kind: HexKind.Planet, color }
                : { coords, tileId: 'tile-0', kind: HexKind.Open }
        }
    }
    return { hexes }
}

/** A drafted turn for Player 1 on a hand-made board, with only the pieces given. */
function draftedTurn({ planets, pieces, hand, technologies = {}, specials = {} }) {
    const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
    // Whoever the game seats first moves; in the layout, p1 is that player and p2 their rival.
    const mover = game.activePlayerId
    const rival = game.state.players.find((player) => player.playerId !== mover).playerId
    const owners = { p1: mover, p2: rival }

    game.state.board = field(planets)
    for (const [q, r, owner, type, level] of pieces) {
        game.state.board.hexes[hexKey({ q, r })].piece = piece(owners[owner], type, level)
    }
    // Technologies come from the single-technology cards, so none is also left in the deck.
    for (const [owner, kinds] of Object.entries(technologies)) {
        const player = game.state.players.find((p) => p.playerId === owners[owner])
        player.technologies = kinds.map((kind, copy) => focusedCardId(kind, PlanetColor.Teal, copy))
    }
    for (const [owner, types] of Object.entries(specials)) {
        const player = game.state.players.find((p) => p.playerId === owners[owner])
        player.specialPieces = types.map((type) => piece(owners[owner], type))
    }

    const hydrated = game.hydrated
    refreshPlanetControl(hydrated)
    game.state.planetControllers = hydrated.planetControllers

    // The hand is drawn first; the rest of a full bag follows so the game can go on.
    const rest = [
        ...Array.from({ length: 5 }, () => [PieceType.Station]),
        ...Array.from({ length: 6 }, (_, i) => [
            PieceType.Probe,
            i % 2 ? PieceLevel.Three : PieceLevel.Two
        ]),
        ...Array.from({ length: 6 }, (_, i) => [
            PieceType.Fighter,
            i % 2 ? PieceLevel.Three : PieceLevel.Two
        ])
    ]
    game.stackBags((playerId) =>
        [...hand, ...rest].map(([type, level]) => piece(playerId, type, level))
    )
    return game
}

function write(slug, name, game) {
    // Named for their part in the layout, so the player to move is always Player 1.
    const players = game.game.players.map((player) => ({
        ...player,
        name: player.id === game.activePlayerId ? 'Player 1' : 'Player 2'
    }))
    const file = startingPositionFile({
        slug,
        name,
        game: { ...game.game, players },
        state: game.state
    })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

mkdirSync(OUT, { recursive: true })

write(
    'relays',
    'Relays',
    draftedTurn({
        planets: {
            '4,-1': PlanetColor.Teal,
            '1,0': PlanetColor.Aqua,
            '7,-2': PlanetColor.Mint,
            '6,2': PlanetColor.Violet,
            '10,-3': PlanetColor.Periwinkle,
            '2,5': PlanetColor.Violet
        },
        pieces: [
            // Player 1's stations link through their relay, past Player 2's ships.
            [0, 1, 'p1', PieceType.Station],
            [2, 1, 'p2', PieceType.Fighter, PieceLevel.Two],
            [4, 1, 'p1', PieceType.Relay],
            [6, 1, 'p2', PieceType.Probe, PieceLevel.Two],
            [8, 1, 'p1', PieceType.Station],
            // A planet stands between Player 1's relay and this probe.
            [4, -2, 'p1', PieceType.Probe, PieceLevel.Two],
            // Player 2's probe is protected by their relay, past Player 1's station.
            [0, 3, 'p2', PieceType.Probe, PieceLevel.Two],
            [2, 3, 'p1', PieceType.Station],
            [5, 3, 'p2', PieceType.Relay],
            // Player 2's station and relay close the hexes between them to Player 1's probes,
            // past Player 1's fighter.
            [9, -4, 'p2', PieceType.Station],
            [9, -2, 'p1', PieceType.Fighter, PieceLevel.Two],
            [9, 2, 'p2', PieceType.Relay]
        ],
        // Both players earned their relays the usual way, and Player 1 has one more to place.
        technologies: {
            p1: [TechnologyEffectKind.RelayNetwork, TechnologyEffectKind.RelayNetwork],
            p2: [TechnologyEffectKind.RelayNetwork, TechnologyEffectKind.RelayNetwork]
        },
        specials: { p1: [PieceType.Relay] },
        hand: [
            [PieceType.Station],
            [PieceType.Probe, PieceLevel.Two],
            [PieceType.Fighter, PieceLevel.Three]
        ]
    })
)
