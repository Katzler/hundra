// Mätning av appstarten, för att se var tiden går på telefonen när den öppnas kallt på morgonen.
// Allt hålls i minnet och skrivs aldrig till lagringen. Modulen importeras först i main.tsx,
// så att jsStart blir tiden då JS-paketet börjar köras.
const jsStart = performance.now()
let loaded = 0
let firstFrame = 0

/** Efter att all kod körts och sparad data lästs in. */
export const markLoaded = () => {
  loaded = performance.now()
}

/** När appen ritats första gången. */
export const markFirstFrame = () => {
  if (!firstFrame) firstFrame = performance.now()
}

/**
 * En rad som "Start 07:12 · sida 0,31 · kod 0,45 · data 0,52 · klar 0,63 s · från cache".
 * Tiderna räknas från att webbläsaren började öppna sidan. Är alla små fast det tog lång tid
 * innan appen syntes, så gick tiden innan sidan ens började laddas, alltså i iOS.
 */
export function startupText(): string {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const s = (ms: number) => (ms / 1000).toFixed(2).replace('.', ',')
    const at = new Date(performance.timeOrigin).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    const parts = [
      nav?.workerStart ? `tjänst ${s(nav.workerStart)}` : '',
      nav?.responseEnd ? `sida ${s(nav.responseEnd)}` : '',
      `kod ${s(jsStart)}`,
      loaded ? `data ${s(loaded)}` : '',
      firstFrame ? `klar ${s(firstFrame)}` : '',
    ].filter(Boolean)
    const from = navigator.serviceWorker?.controller ? 'från cache' : 'från nätet'
    const reloaded = nav?.type === 'reload' ? ' · omladdad' : ''
    return `Start ${at}: ${parts.join(' · ')} s · ${from}${reloaded}`
  } catch {
    return ''
  }
}
