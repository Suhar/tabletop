import { Notification } from '@tabletop/common'
import { SecretsService } from '../../secrets/secretsService.js'
import { TopicTransport, TopicTransportType } from './topicTransport.js'
import { nanoid } from 'nanoid'
// SuharTabletop's Ably account is on MAU pricing, which accepts only Ably's new SDK packages.
import { createHttpClient, type PubSubHttpClient } from '@ably/pubsub-server'

export class AblyTransport implements TopicTransport {
    type = TopicTransportType.Ably
    private ably: PubSubHttpClient

    static async createAblyTransport(secretsService: SecretsService): Promise<AblyTransport> {
        const ablyApiKey = await secretsService.getSecret('ABLY_API_KEY')

        const transport = new AblyTransport(ablyApiKey)
        await transport.initialize()
        return transport
    }

    constructor(private readonly ablyApiKey: string) {
        this.ably = createHttpClient(ablyApiKey)
    }

    private async initialize(): Promise<void> {}

    async sendNotification({
        notification,
        topic
    }: {
        notification: Notification
        topic: string
    }): Promise<void> {
        const channel = this.ably.channels.get(topic)
        await channel.publish(nanoid(), JSON.stringify(notification))
    }
}
