export function showTurnFavicon() {
    setFavicons('favicon-turn')
}

export function restoreDefaultFavicon() {
    setFavicons('favicon')
}

function setFavicons(fileBaseName: string) {
    for (const icon of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][sizes]')) {
        // SuharTabletop: the query makes browsers that cached Tabletop's dice icons fetch the cowbell.
        icon.href = `/${fileBaseName}-${icon.getAttribute('sizes')}.png?v=cowbell`
    }
}
