// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    elevatedCardId,
    ElevatedChoice,
    focusedCardId,
    GRANTED_TYPES,
    HexKind,
    hexKey,
    PieceLevel,
    PieceType,
    PlanetColor,
    refreshPlanetControl,
    SPECIAL_PIECE_TECHNOLOGIES,
    TECHNOLOGY_CATEGORY,
    TechnologyEffectKind,
    TurnStyle
} from '@tabletop/earendel'
import { TestGame, stackedBag } from '@tabletop/earendel/testing'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')

let ids = 0
const piece = (playerId, type, level, extra = {}) => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {}),
    ...extra
})

// A rectangular field of open hexes, q 0 to 10, with the given planets: each a colour, or the
// planet's fields (its colour, and whether it is explored and what it holds).
function field(planets) {
    const hexes = {}
    for (let q = 0; q <= 10; q++) {
        const top = -Math.floor(q / 2)
        for (let r = top; r <= top + 6; r++) {
            const coords = { q, r }
            const planet = planets[`${q},${r}`]
            const fields = typeof planet === 'string' ? { color: planet } : planet
            hexes[hexKey(coords)] = fields
                ? { coords, tileId: 'tile-0', kind: HexKind.Planet, ...fields }
                : { coords, tileId: 'tile-0', kind: HexKind.Open }
        }
    }
    return { hexes }
}

/** A drafted turn for Player 1 on a hand-made board, with only the pieces given. */
function draftedTurn({
    planets,
    pieces,
    hand,
    technologies = {},
    cooldownEffects = {},
    specials = {},
    players = 2,
    config = {},
    deck,
    discard,
    claims = []
}) {
    const game = new TestGame(players, 1, { turnStyle: TurnStyle.DraftThree, ...config })
    // Whoever the game seats first moves; in the layout, p1 is that player and p2, p3... the
    // rivals in turn order after them.
    const mover = game.activePlayerId
    const order = game.state.turnManager.turnOrder
    const seated = [...order.slice(order.indexOf(mover)), ...order.slice(0, order.indexOf(mover))]
    const owners = Object.fromEntries(seated.map((playerId, index) => [`p${index + 1}`, playerId]))

    game.state.board = field(planets)
    for (const [q, r, owner, type, level, extra] of pieces) {
        game.state.board.hexes[hexKey({ q, r })].piece = piece(owners[owner], type, level, extra)
    }
    // Technologies come from the single-technology cards, so none is also left in the deck. A
    // power with a cooldown is ready to use, as it is the turn after the technology is gained.
    for (const owner of new Set([...Object.keys(technologies), ...Object.keys(cooldownEffects)])) {
        game.giveTechnology(
            owners[owner],
            ...(technologies[owner] ?? []),
            ...(cooldownEffects[owner] ?? [])
        )
    }
    // A special piece in hand: a type, or [type, extra fields] such as a gate's pair id.
    for (const [owner, types] of Object.entries(specials)) {
        const player = game.state.players.find((p) => p.playerId === owners[owner])
        player.specialPieces = types.map((entry) =>
            Array.isArray(entry)
                ? piece(owners[owner], entry[0], undefined, entry[1])
                : piece(owners[owner], entry)
        )
    }

    // Every special piece or special-piece technology the scenario uses is one in play, so the
    // row above the panels agrees with the table.
    const inPlay = game.state.pieceTechnologies
    if (inPlay) {
        const grants = (type, extra) =>
            type === PieceType.Gate
                ? TechnologyEffectKind.GateNetwork
                : type === PieceType.Station && extra?.hub
                  ? TechnologyEffectKind.StationUpgrade
                  : SPECIAL_PIECE_TECHNOLOGIES.find((kind) => GRANTED_TYPES[kind] === type)
        const used = [
            ...Object.values(technologies).flat(),
            ...Object.values(cooldownEffects).flat(),
            ...Object.values(specials)
                .flat()
                .map((entry) => (Array.isArray(entry) ? grants(entry[0], entry[1]) : grants(entry)))
        ]
        for (const kind of used) {
            if (kind && SPECIAL_PIECE_TECHNOLOGIES.includes(kind)) {
                inPlay[TECHNOLOGY_CATEGORY[kind]] = kind
            }
        }
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
    if (deck) game.state.technologyDeck = stackedBag(deck)
    if (discard) game.state.technologyDiscard = discard
    game.state.probeClaims = claims.map(([owner, q, r, technologyId]) => ({
        playerId: owners[owner],
        coords: { q, r },
        technologyId
    }))
    return game
}

function write(slug, name, game) {
    // Named for their part in the layout, so the player to move is always Player 1 and the
    // rest follow in turn order.
    const order = game.state.turnManager.turnOrder
    const start = order.indexOf(game.activePlayerId)
    const seat = (playerId) => (order.indexOf(playerId) - start + order.length) % order.length
    const players = game.game.players.map((player) => ({
        ...player,
        name: `Player ${seat(player.id) + 1}`
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
        // Each relay came from a Relay Network: two placed each, and Player 1 has a third to place.
        technologies: {
            p1: [
                TechnologyEffectKind.RelayNetwork,
                TechnologyEffectKind.RelayNetwork,
                TechnologyEffectKind.RelayNetwork
            ],
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

write(
    'terraformers',
    'Terraformers',
    draftedTurn({
        planets: {
            // Explored: its technology stays whatever colour it becomes.
            '1,2': {
                color: PlanetColor.Violet,
                explored: true,
                technologyId: focusedCardId(TechnologyEffectKind.Railgun, PlanetColor.Violet, 0)
            },
            // Two planets share the open hex between them.
            '4,-1': PlanetColor.Mint,
            '4,1': PlanetColor.Aqua,
            // Player 2's terraformer already touches this one.
            '7,-2': PlanetColor.Teal,
            // Reached by a Tactical Feint: Player 1's terraformer trades places with the station.
            '8,2': PlanetColor.Periwinkle
        },
        pieces: [
            [8, -3, 'p2', PieceType.Terraformer],
            [8, 0, 'p1', PieceType.Terraformer],
            [8, 1, 'p2', PieceType.Station]
        ],
        // Each terraformer came from a Terraforming; Player 1 has a second still to place, and
        // a Tactical Feint ready.
        technologies: {
            p1: [
                TechnologyEffectKind.Terraforming,
                TechnologyEffectKind.Terraforming,
                TechnologyEffectKind.TacticalFeint
            ],
            p2: [TechnologyEffectKind.Terraforming]
        },
        cooldownEffects: { p1: [TechnologyEffectKind.TacticalFeint] },
        specials: { p1: [PieceType.Terraformer] },
        hand: [
            [PieceType.Station],
            [PieceType.Probe, PieceLevel.Two],
            [PieceType.Fighter, PieceLevel.Three]
        ]
    })
)

write(
    'gamma-torpedo',
    'Gamma Torpedo',
    draftedTurn({
        planets: {
            '2,3': PlanetColor.Violet,
            '9,-1': PlanetColor.Mint
        },
        pieces: [
            // Player 2's station, escorted by their fighter: a shot cannot reach it, a torpedo can.
            [4, 0, 'p2', PieceType.Station],
            [5, 0, 'p2', PieceType.Fighter, PieceLevel.Three],
            // Two stations share the empty hex (7, 1): Player 2's and Player 1's own.
            [8, 1, 'p2', PieceType.Station],
            [7, 2, 'p1', PieceType.Station],
            // A relay is not a station: the hexes beside it are not offered.
            [1, 3, 'p2', PieceType.Relay]
        ],
        technologies: {
            p1: [TechnologyEffectKind.GammaTorpedo],
            p2: [TechnologyEffectKind.RelayNetwork]
        },
        cooldownEffects: { p1: [TechnologyEffectKind.GammaTorpedo] },
        hand: [
            [PieceType.Fighter, PieceLevel.Three],
            [PieceType.Station],
            [PieceType.Probe, PieceLevel.Two]
        ]
    })
)

// rules.md, Elevated technologies: one planet of each colour, the deck stacked so a level 2
// probe surveying a colour turns up its elevated card, with everything the events need in place.
const ELEVATED_PLANETS = {
    '2,0': PlanetColor.Violet,
    '4,-1': PlanetColor.Aqua,
    '6,-2': PlanetColor.Mint,
    '8,-3': PlanetColor.Periwinkle,
    '3,3': PlanetColor.Teal,
    // Explored and holding a technology: something for Signal Intercept to take.
    '9,0': {
        color: PlanetColor.Violet,
        explored: true,
        technologyId: focusedCardId(TechnologyEffectKind.Railgun, PlanetColor.Violet, 0)
    }
}
const ELEVATED_PIECES = [
    // Enemy ships for Orbital Targeting, and a station of Player 1's for the Wormhole Storm.
    [0, 2, 'p2', PieceType.Fighter, PieceLevel.Two],
    [1, 5, 'p3', PieceType.Probe, PieceLevel.Two],
    [6, 3, 'p1', PieceType.Station],
    [8, 1, 'p2', PieceType.Station]
]
const COLOURS_IN_DECK = [
    PlanetColor.Violet,
    PlanetColor.Aqua,
    PlanetColor.Mint,
    PlanetColor.Periwinkle,
    PlanetColor.Teal
]
const elevatedDeck = (pairs, which) =>
    COLOURS_IN_DECK.flatMap((color) => [
        elevatedCardId(pairs[color][which]),
        focusedCardId(TechnologyEffectKind.Railgun, color, 1)
    ])
const ELEVATED_PAIRS = {
    [PlanetColor.Violet]: {
        event: TechnologyEffectKind.OrbitalBombardment,
        rule: TechnologyEffectKind.NoQuarter
    },
    [PlanetColor.Aqua]: {
        event: TechnologyEffectKind.WormholeStorm,
        rule: TechnologyEffectKind.FreeDrift
    },
    [PlanetColor.Mint]: {
        event: TechnologyEffectKind.SalvageRights,
        rule: TechnologyEffectKind.Overdrive
    },
    [PlanetColor.Periwinkle]: {
        event: TechnologyEffectKind.SignalIntercept,
        rule: TechnologyEffectKind.SharedScience
    },
    [PlanetColor.Teal]: {
        event: TechnologyEffectKind.ShipyardWorld,
        rule: TechnologyEffectKind.Reinforcements
    }
}
const elevatedConfig = (choice) =>
    Object.fromEntries(COLOURS_IN_DECK.map((color) => [`elevated-${color}`, choice]))
const SALVAGE = [
    focusedCardId(TechnologyEffectKind.TacticalFeint, PlanetColor.Teal, 0),
    focusedCardId(TechnologyEffectKind.ImmediateDownload, PlanetColor.Teal, 0)
]
const THREE_PROBES = [
    [PieceType.Probe, PieceLevel.Two],
    [PieceType.Probe, PieceLevel.Two],
    [PieceType.Probe, PieceLevel.Two]
]

write(
    'elevated-events',
    'Elevated events',
    draftedTurn({
        planets: ELEVATED_PLANETS,
        pieces: ELEVATED_PIECES,
        hand: THREE_PROBES,
        players: 3,
        config: elevatedConfig(ElevatedChoice.Event),
        deck: elevatedDeck(ELEVATED_PAIRS, 'event'),
        discard: SALVAGE
    })
)

write(
    'elevated-globals',
    'Elevated globals',
    draftedTurn({
        planets: ELEVATED_PLANETS,
        pieces: ELEVATED_PIECES,
        hand: THREE_PROBES,
        players: 3,
        config: elevatedConfig(ElevatedChoice.Rule),
        deck: elevatedDeck(ELEVATED_PAIRS, 'rule'),
        discard: SALVAGE
    })
)

// rules.md, Granted pieces: the ten special pieces, two scenarios of five. Player 1 holds the
// pieces still to place; the board already shows what the placed ones do.
write(
    'special-pieces-map',
    'Special pieces: map and planets',
    draftedTurn({
        planets: {
            '2,0': PlanetColor.Violet,
            // Explored, with a technology Player 1's probe has claimed.
            '6,-2': {
                color: PlanetColor.Mint,
                explored: true,
                technologyId: focusedCardId(TechnologyEffectKind.Railgun, PlanetColor.Mint, 0)
            },
            '8,1': PlanetColor.Teal,
            '3,4': PlanetColor.Aqua
        },
        claims: [['p1', 6, -2, focusedCardId(TechnologyEffectKind.Railgun, PlanetColor.Mint, 0)]],
        pieces: [
            // Player 2's interdictor closes the hexes around it to Player 1's ships.
            [5, 0, 'p2', PieceType.Interdictor],
            // Player 1's seeder has laid once already; it may lay again this turn.
            [1, 3, 'p1', PieceType.NebulaSeeder, undefined, { seeded: 1 }],
            // One gate stands; its twin is still in hand.
            [7, 2, 'p1', PieceType.Gate, undefined, { pairId: 'p1-gates' }],
            [8, 2, 'p1', PieceType.Station],
            // Player 2's beacon quarantines the mint planet, where Player 1's probe has a claim.
            [7, -2, 'p2', PieceType.QuarantineBeacon],
            [5, -2, 'p1', PieceType.Probe, PieceLevel.Three],
            [0, 2, 'p1', PieceType.Station]
        ],
        technologies: {
            p1: [
                TechnologyEffectKind.NebulaSeeding,
                TechnologyEffectKind.GateNetwork,
                TechnologyEffectKind.ArtificialWorld
            ],
            p2: [TechnologyEffectKind.Interdiction, TechnologyEffectKind.Quarantine]
        },
        specials: { p1: [[PieceType.Gate, { pairId: 'p1-gates' }], PieceType.ArtificialPlanet] },
        hand: [
            [PieceType.Station],
            [PieceType.Probe, PieceLevel.Two],
            [PieceType.Fighter, PieceLevel.Three]
        ]
    })
)

write(
    'special-pieces-combat',
    'Special pieces: combat and the bag',
    draftedTurn({
        planets: {
            '2,0': PlanetColor.Violet,
            '6,-2': PlanetColor.Periwinkle,
            '3,4': PlanetColor.Teal
        },
        pieces: [
            // Player 2's probe beside the violet planet is shielded by their bastion.
            [1, 0, 'p2', PieceType.Probe, PieceLevel.Two],
            [1, 1, 'p2', PieceType.Bastion],
            // Player 1's carrier weighs 3 on the periwinkle planet against Player 2's level 2 probe.
            [7, -2, 'p1', PieceType.Carrier],
            [5, -2, 'p2', PieceType.Probe, PieceLevel.Two],
            // Player 2's jammer blinds their own two stations that would otherwise close the hex
            // between them.
            [4, 3, 'p2', PieceType.Station],
            [6, 3, 'p2', PieceType.Station],
            [5, 1, 'p2', PieceType.Jammer],
            // Player 1's scanner, and Player 2's drone with a probe of theirs beside it.
            [0, 3, 'p1', PieceType.DeepScanner],
            [2, 2, 'p2', PieceType.SalvageDrone],
            [3, 2, 'p2', PieceType.Probe, PieceLevel.Two]
        ],
        technologies: {
            p1: [TechnologyEffectKind.CarrierDoctrine, TechnologyEffectKind.DeepScan],
            p2: [
                TechnologyEffectKind.BastionWorks,
                TechnologyEffectKind.JammerArray,
                TechnologyEffectKind.SalvageOperations
            ]
        },
        hand: [
            [PieceType.Fighter, PieceLevel.Three],
            [PieceType.Probe, PieceLevel.Two],
            [PieceType.Station],
            [PieceType.Fighter, PieceLevel.Two]
        ]
    })
)
