import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, HexKind, hexKey } from '../model/board.js'
import { seedableHexes } from '../util/specials.js'

export type SeedNebulaMetadata = Type.Static<typeof SeedNebulaMetadata>
export const SeedNebulaMetadata = Type.Object({
    declined: Type.Optional(Type.Boolean())
})

// A nebula seeder of the player's turns one empty hex beside it into nebula, or the player leaves
// them all be this turn (rules.md, Granted pieces).
export type SeedNebula = Type.Static<typeof SeedNebula>
export const SeedNebula = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SeedNebula),
            playerId: Type.String(),
            seeder: Type.Optional(AxialCoordinates),
            hex: Type.Optional(AxialCoordinates),
            metadata: Type.Optional(SeedNebulaMetadata)
        })
    ])
)

export const SeedNebulaValidator = Compile(SeedNebula)

export function isSeedNebula(action?: GameAction): action is SeedNebula {
    return action?.type === ActionType.SeedNebula
}

export class HydratedSeedNebula extends HydratableAction<typeof SeedNebula> implements SeedNebula {
    declare type: ActionType.SeedNebula
    declare playerId: string
    declare seeder?: AxialCoordinates
    declare hex?: AxialCoordinates
    declare metadata?: SeedNebulaMetadata

    constructor(data: SeedNebula) {
        super(data, SeedNebulaValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidSeedNebulaReason(state)
        if (invalidReason) {
            throw Error(`Invalid SeedNebula action: ${invalidReason}`)
        }
        const pending = state.pendingSeeding
        assertExists(pending, 'Validated: seeding is pending')

        if (!this.seeder || !this.hex) {
            state.pendingSeeding = undefined
            this.metadata = { declined: true }
            return
        }

        const hex = state.board.hexes[hexKey(this.hex)]
        hex.kind = HexKind.Nebula
        const seeder = getHex(state.board, this.seeder)?.piece
        assertExists(seeder, 'Validated: the seeder stands there')
        seeder.seeded = (seeder.seeded ?? 0) + 1

        pending.seeders = pending.seeders.filter((at) => !sameCoordinates(at, this.seeder!))
        if (pending.seeders.length === 0) state.pendingSeeding = undefined
        this.metadata = {}
    }

    isValidSeedNebula(state: HydratedEarendelGameState): boolean {
        return this.invalidSeedNebulaReason(state) === undefined
    }

    invalidSeedNebulaReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingSeeding
        if (!pending || pending.playerId !== this.playerId) {
            return 'No nebula seeder of yours is waiting to act.'
        }
        if (!this.seeder && !this.hex) return undefined
        if (!this.seeder || !this.hex) return 'Seeding names both the seeder and the hex.'
        if (!pending.seeders.some((at) => sameCoordinates(at, this.seeder!))) {
            return 'That seeder has already acted this turn, or is not yours.'
        }
        if (!seedableHexes(state.board, this.seeder).some((at) => sameCoordinates(at, this.hex!))) {
            return 'A seeder lays nebula on an empty hex beside it or beside its nebula.'
        }
        return undefined
    }
}
