import fastifyAuth from '@fastify/auth'
import { Role, type User, UserStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import approvalsRoute from './approvals.js'

const approver: User = {
    id: 'approver-1',
    status: UserStatus.Active,
    roles: [Role.User, Role.Approver],
    externalIds: []
}

const signUp: User = {
    id: 'user-2',
    status: UserStatus.Incomplete,
    roles: [Role.User],
    email: 'new@example.com',
    externalIds: []
}

async function createServer(mayApprove = true) {
    const server = Fastify()
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = approver
    })
    Reflect.set(server, 'verifySignUpApprover', async () => {
        if (!mayApprove) throw new Error('User may not approve sign-ups')
    })
    const userService = {
        findSignUpsAwaitingApproval: vi.fn(async () => [signUp]),
        approveSignUp: vi.fn(async () => ({ ...signUp, status: UserStatus.Active }))
    }
    Reflect.set(server, 'userService', userService)
    await server.register(approvalsRoute)
    return { server, userService }
}

describe('sign-up approval routes', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()
    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('lists the sign-ups awaiting approval', async () => {
        const { server } = await createServer()
        servers.add(server)
        const response = await server.inject({ method: 'GET', url: '/awaitingApproval' })
        expect(response.statusCode).toBe(200)
        expect(response.json().payload.users).toEqual([signUp])
    })

    it('approves a sign-up', async () => {
        const { server, userService } = await createServer()
        servers.add(server)
        const response = await server.inject({ method: 'POST', url: '/user-2/approve' })
        expect(response.statusCode).toBe(200)
        expect(userService.approveSignUp).toHaveBeenCalledExactlyOnceWith('user-2')
        expect(response.json().payload.user.status).toBe(UserStatus.Active)
    })

    it('refuses a user who may not approve sign-ups', async () => {
        const { server, userService } = await createServer(false)
        servers.add(server)
        const response = await server.inject({ method: 'POST', url: '/user-2/approve' })
        expect(response.statusCode).toBe(401)
        expect(userService.approveSignUp).not.toHaveBeenCalled()
    })
})
