import { expect, test, type Page } from '@playwright/test'
import type { SarGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        sarSession: SarGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function createGame(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.sarSession = getContext();')
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('SAR')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.sarSession)).toBe(true)
}

function machineState(page: Page) {
    return page.evaluate(() => window.sarSession.gameState.machineState)
}

async function screenshot(page: Page, name: string) {
    await page.screenshot({ path: test.info().outputPath(`${name}.png`) })
}

// Hotseat play: every seat is local, so whoever is active can act through the panel.
async function playInitialOffering(page: Page) {
    for (let step = 0; step < 40 && (await machineState(page)) !== 'ChoosingAction'; step++) {
        if ((await machineState(page)) === 'Bidding') {
            const bid = page.getByRole('button', { name: /^Bid \$/ })
            if (step % 3 === 0 && (await bid.count()) > 0) {
                // Bids fund the treasuries; $1 bids leave every railroad unable to build.
                for (let raise = 0; raise < 15; raise++) {
                    await page.getByRole('button', { name: '+', exact: true }).click()
                }
                await bid.click()
            } else {
                await page.getByRole('button', { name: 'Pass', exact: true }).click()
            }
        } else {
            await page
                .getByRole('button', { name: /^Build / })
                .first()
                .locator('.hit-box')
                .click()
        }
        await page.waitForTimeout(150)
    }
}

test('plays the initial offering and a construction turn on the board', async ({ page }) => {
    await createGame(page)
    await expect(page.getByText('Initial offering:')).toBeVisible()
    await screenshot(page, '01-initial-auction')

    await playInitialOffering(page)
    await expect.poll(() => machineState(page)).toBe('ChoosingAction')
    const open = await page.evaluate(
        () => window.sarSession.gameState.railroads.filter((railroad) => railroad.open).length
    )
    expect(open).toBe(5)
    await screenshot(page, '02-first-turn')

    await page.getByRole('button', { name: 'Choose Construct Track' }).click()
    await expect.poll(() => machineState(page)).toBe('ConstructingTrack')
    await screenshot(page, '03-constructing')
    const tracks = await page.evaluate(() => window.sarSession.gameState.track.length)
    const railroadCard = page.getByRole('button', { name: /^Choose the / })
    if ((await railroadCard.count()) > 0) {
        await railroadCard.first().click()
    }
    await page
        .getByRole('button', { name: /^Build / })
        .first()
        .locator('.hit-box')
        .click()
    const oneLink = page.getByRole('button', { name: 'Build one link · $5' })
    if ((await oneLink.count()) > 0) {
        await screenshot(page, '04-double-choice')
        await oneLink.click()
    }
    await expect
        .poll(() => page.evaluate(() => window.sarSession.gameState.track.length))
        .toBeGreaterThan(tracks)
    await screenshot(page, '05-after-build')
})

test('develops a settlement through the board', async ({ page }) => {
    await createGame(page)
    await playInitialOffering(page)
    await page.getByRole('button', { name: 'Choose Develop Settlements' }).click()
    await expect.poll(() => machineState(page)).toBe('DevelopingSettlements')
    await screenshot(page, '06-developing')
    await page
        .getByRole('button', { name: /^Develop / })
        .first()
        .click()
    await expect
        .poll(() => page.evaluate(() => window.sarSession.gameState.developmentsThisTurn))
        .toBe(1)
})

test('fits a phone screen without sideways scrolling in the action area', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 })
    await createGame(page)
    await screenshot(page, '07-phone')
    const overflow = await page.evaluate(() => {
        const area = document.querySelector('.action-area')
        return area ? area.scrollWidth - area.clientWidth : 0
    })
    expect(overflow).toBeLessThanOrEqual(1)
})
