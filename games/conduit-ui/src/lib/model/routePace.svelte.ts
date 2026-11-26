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
