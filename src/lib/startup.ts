// Mätning av appstarten, för att se var tiden går när appen kallstartas på telefonen på morgonen.
// Allt hålls i minnet och skrivs aldrig till lagringen. Modulen importeras först i main.tsx,
// så att jsStart blir tiden då JS-paketet börjar köras.
const jsStart = performance.now()
let loaded = 0
let firstFrame = 0
// Laddades sidan om i bakgrunden (en ny version när man lämnade appen), eller lämnades appen
// innan den hann ritas, säger klar-tiden inget: en dold sida ritas inte förrän den syns igen.
let hiddenAtStart = typeof document !== 'undefined' && document.visibilityState === 'hidden'
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!firstFrame && document.visibilityState === 'hidden') hiddenAtStart = true
  })
}

/** Efter att all kod körts och sparad data lästs in. */
export const markLoaded = () => {
  loaded = performance.now()
}

/** När appen ritats första gången. */
export const markFirstFrame = () => {
  if (!firstFrame) firstFrame = performance.now()
}

/**
 * En rad som "Start 07:12: tjänst 0,05 · sida 0,31 · kod 0,45 · data 0,52 · klar 0,63 s · från cache".
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
      firstFrame && !hiddenAtStart ? `klar ${s(firstFrame)}` : '',
    ].filter(Boolean)
    const from = navigator.serviceWorker?.controller ? 'från cache' : 'från nätet'
    const reloaded = nav?.type === 'reload' ? ' · omladdad' : ''
    const background = hiddenAtStart ? ' · i bakgrunden' : ''
    return `Start ${at}: ${parts.join(' · ')} s · ${from}${reloaded}${background}`
  } catch {
    return ''
  }
}
