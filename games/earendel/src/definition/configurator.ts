import { BaseConfigurator, type GameConfigurator } from '@tabletop/common'
import { EarendelGameConfig, EarendelGameConfigOptions } from './config.js'

export class EarendelConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = EarendelGameConfig
    options = EarendelGameConfigOptions
}
