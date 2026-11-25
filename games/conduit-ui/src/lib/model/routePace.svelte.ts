// How revenue shows each route: one station at a time with its search drawn out, or all routes
// at once. A viewer's preference, kept in their browser.
export type Pace = 'steps' | 'quick'

const PaceKey = 'conduit-route-pace'

export class RoutePace {
    current: Pace = $state(readPace())

    set(pace: Pace) {
        this.current = pace
        try {
            localStorage.setItem(PaceKey, pace)
        } catch {
            // Without storage the choice lasts for this page only.
        }
    }
}

function readPace(): Pace {
    try {
        return localStorage.getItem(PaceKey) === 'quick' ? 'quick' : 'steps'
    } catch {
        return 'steps'
    }
}
