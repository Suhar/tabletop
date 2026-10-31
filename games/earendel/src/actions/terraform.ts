import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, hexKey } from '../model/board.js'
import { PlanetColor } from '../model/planetColor.js'

export type TerraformMetadata = Type.Static<typeof TerraformMetadata>
export const TerraformMetadata = Type.Object({
    fromColor: Type.Optional(Type.Enum(PlanetColor)),
    toColor: Type.Optional(Type.Enum(PlanetColor)),
    declined: Type.Optional(Type.Boolean())
})

// A terraformer just placed recolours one planet beside it, or the player leaves them all be.
export type Terraform = Type.Static<typeof Terraform>
export const Terraform = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Terraform),
            playerId: Type.String(),
            planet: Type.Optional(AxialCoordinates),
            color: Type.Optional(Type.Enum(PlanetColor)),
            metadata: Type.Optional(TerraformMetadata)
        })
    ])
)

export const TerraformValidator = Compile(Terraform)

export function isTerraform(action?: GameAction): action is Terraform {
    return action?.type === ActionType.Terraform
}

export class HydratedTerraform extends HydratableAction<typeof Terraform> implements Terraform {
    declare type: ActionType.Terraform
    declare playerId: string
    declare planet?: AxialCoordinates
    declare color?: PlanetColor
    declare metadata?: TerraformMetadata

    constructor(data: Terraform) {
        super(data, TerraformValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidTerraformReason(state)
        if (invalidReason) {
            throw Error(`Invalid Terraform action: ${invalidReason}`)
        }

        state.pendingTerraform = undefined
        if (!this.planet || !this.color) {
            this.metadata = { declined: true }
            return
        }

        const hex = state.board.hexes[hexKey(this.planet)]
        const fromColor = hex.color
        hex.color = this.color
        this.metadata = { ...(fromColor ? { fromColor } : {}), toColor: this.color }
    }

    isValidTerraform(state: HydratedEarendelGameState): boolean {
        return this.invalidTerraformReason(state) === undefined
    }

    invalidTerraformReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingTerraform
        if (!pending || pending.playerId !== this.playerId) {
            return 'No terraformer of yours is waiting to act.'
        }
        const target = this.planet
        if (!target && !this.color) return undefined
        if (!target || !this.color) {
            return 'Terraforming names both the planet and its new colour.'
        }
        if (!pending.planets.some((planet) => sameCoordinates(planet, target))) {
            return 'That planet is not beside the terraformer, or another terraformer already touches it.'
        }
        if (getHex(state.board, target)?.color === this.color) {
            return 'A terraformer changes a planet to another colour.'
        }
        return undefined
    }
}
