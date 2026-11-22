import type { TrainTokens } from '../session/titlePresentation.js'

export function labelledTrainName(name: string, tokens: TrainTokens | undefined): string {
    return tokens?.label ? `${name} (${tokens.label})` : name
}
