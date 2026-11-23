import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type AccountParams = Static<typeof AccountParams>
const AccountParams = Type.Object({ userId: Type.String() }, { additionalProperties: false })

export default async function (fastify: FastifyInstance) {
    const onRequest = fastify.auth([fastify.verifyActiveUser, fastify.verifySignUpApprover], {
        relation: 'and'
    })

    fastify.get('/awaitingApproval', { onRequest }, async function () {
        const users = await fastify.userService.findSignUpsAwaitingApproval()
        return { status: 'ok', payload: { users } }
    })

    fastify.post<{ Params: AccountParams }>(
        '/:userId/approve',
        { schema: { params: AccountParams }, onRequest },
        async function (request) {
            const { userId } = request.params
            const user = await fastify.userService.approveSignUp(userId)
            request.log.info({ approverId: request.user?.id, userId }, 'Approved sign-up')
            return { status: 'ok', payload: { user } }
        }
    )
}
