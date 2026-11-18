import { SecretsService } from '../secrets/secretsService.js'
// SuharTabletop's Ably account is on MAU pricing, which accepts only Ably's new SDK packages.
import { createHttpClient, type PubSubHttpClient, type TokenRequest } from '@ably/pubsub-server'

export const ABLY_CLIENT_OPERATIONS = ['subscribe'] as const

export type AblyClientCapability = Record<string, (typeof ABLY_CLIENT_OPERATIONS)[number][]>

export function ablyClientCapability(topics: string[]): AblyClientCapability {
    return Object.fromEntries(topics.map((topic) => [topic, [...ABLY_CLIENT_OPERATIONS]]))
}

export class AblyService {
    private ably: PubSubHttpClient

    static async createAblyService(secretsService: SecretsService): Promise<AblyService> {
        const ablyApiKey = await secretsService.getSecret('ABLY_API_KEY')
        return new AblyService(ablyApiKey)
    }

    constructor(private readonly ablyApiKey: string) {
        this.ably = createHttpClient(ablyApiKey)
    }

    async createTokenRequest({
        userId,
        topics
    }: {
        userId: string
        topics: string[]
    }): Promise<TokenRequest> {
        return await this.ably.auth.createTokenRequest({
            clientId: userId,
            capability: ablyClientCapability(topics)
        })
    }
}
