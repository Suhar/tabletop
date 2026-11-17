import { redirect } from '@sveltejs/kit'
import type { LayoutLoad } from './$types'

// SuharTabletop hides tournaments and leagues, so their pages lead back to the library.
export const load: LayoutLoad = () => {
    redirect(307, '/library')
}
