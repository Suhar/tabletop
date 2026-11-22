import { storedGameTests } from '../../../libs/18xx/test/storedGame.js'
import { Definition } from './definition/gameDefinition.js'

// A bot game as logic 0.15.1 stored it, before presidents were derived from their certificates.
storedGameTests(Definition, new URL('../test/fixtures/stored-game.json', import.meta.url))
