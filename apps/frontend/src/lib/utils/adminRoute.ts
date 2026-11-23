import { redirect } from '@sveltejs/kit'
import { AuthorizationCategory } from '@tabletop/frontend-components'
import { getAppContext } from '$lib/stores/appContext.svelte.js'
import type { AuthorizationService } from '$lib/services/authorizationService.svelte.js'

export async function authorizeAdminRoute(url: URL): Promise<boolean> {
    return authorizePrivilegedRoute(url, (authorization) => authorization.isAdmin)
}

export async function authorizeSignUpApprovalRoute(url: URL): Promise<boolean> {
    return authorizePrivilegedRoute(url, (authorization) => authorization.mayApproveSignUps)
}

async function authorizePrivilegedRoute(
    url: URL,
    isPermitted: (authorization: AuthorizationService) => boolean
): Promise<boolean> {
    const { authorizationService } = getAppContext()
    const authorized = await authorizationService.authorizeRoute({
        category: AuthorizationCategory.ActiveUser,
        intendedUrl: url
    })
    if (!authorized) {
        return false
    }
    await authorizationService.whenSessionVerified()
    if (!isPermitted(authorizationService)) {
        redirect(302, '/library')
    }
    return true
}
