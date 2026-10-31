/** Där en ikon flyger ifrån: elementet som håller ikonen, t.ex. bubblan i hjulet. */
export type FlyOrigin = HTMLElement

/** Flygturens längd. Hela banan är en kastparabel, så tiden går linjärt. */
const FLIGHT_MS = 520

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Ikonen i en behållare: bilden om det finns en, annars behållaren själv (emoji). */
const iconIn = (el: HTMLElement) => el.querySelector<HTMLElement>('img') ?? el

/** En kopia av ikonen som kan flyga fritt ovanpå allt annat. */
function cloneIcon(origin: HTMLElement): HTMLElement {
  const picture = origin.querySelector('picture')
  if (picture) return picture.cloneNode(true) as HTMLElement
  const span = document.createElement('span')
  span.textContent = origin.firstChild?.textContent ?? ''
  span.style.fontSize = getComputedStyle(origin).fontSize
  return span
}

/** Raden studsar till när ikonen landar. Klassen tas bort igen så att det kan hända flera gånger. */
function land(row: HTMLElement) {
  row.classList.remove('is-incoming', 'is-landed')
  void row.offsetWidth
  row.classList.add('is-landed')
  row.addEventListener('animationend', () => row.classList.remove('is-landed'), { once: true })
}

/**
 * Kastar ikonen från `origin` ner till raderna i dagens lista. Den första raden är målet, och alla
 * rader studsar när ikonen landar. Raderna ritas av React efter tillägget, därför väntar vi två bildrutor.
 */
export function flyToEntries(origin: FlyOrigin | undefined, entryIds: string[]) {
  if (!entryIds.length) return
  // Bubblan i hjulet försvinner när hjulet stängs, så måtten och kopian tas direkt.
  const from = origin?.isConnected ? origin.getBoundingClientRect() : null
  const fromIcon = origin?.isConnected ? iconIn(origin).getBoundingClientRect() : null
  const icon = origin?.isConnected ? cloneIcon(origin) : null

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const rows = entryIds
        .map((id) => document.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(id)}"]`))
        .filter((r): r is HTMLElement => !!r)
      const target = rows[0]?.querySelector<HTMLElement>('.emoji')
      if (!from || !fromIcon || !icon || !target || reducedMotion()) {
        rows.forEach(land)
        return
      }
      rows.forEach((r) => r.classList.add('is-incoming'))

      const to = target.getBoundingClientRect()
      const toIcon = iconIn(target).getBoundingClientRect()
      const x0 = from.left + from.width / 2
      const y0 = from.top + from.height / 2
      const x1 = to.left + to.width / 2
      // Ligger raden utanför skärmen landar ikonen vid kanten och tonar bort.
      const offscreen = to.bottom > window.innerHeight || to.top < 0
      const y1 = Math.min(Math.max(to.top + to.height / 2, 40), window.innerHeight - 40)
      // Toppen på bågen: en bit ovanför startpunkten, som ett kast uppåt.
      const cx = x0 + (x1 - x0) * 0.35
      const cy = Math.min(y0, y1) - 90
      const endScale = fromIcon.width ? toIcon.width / fromIcon.width : 1

      const wrap = document.createElement('div')
      wrap.className = 'fly-icon'
      wrap.setAttribute('aria-hidden', 'true')
      Object.assign(wrap.style, {
        left: `${x0 - fromIcon.width / 2}px`,
        top: `${y0 - fromIcon.height / 2}px`,
        width: `${fromIcon.width}px`,
        height: `${fromIcon.height}px`,
      })
      wrap.append(icon)
      document.body.append(wrap)

      const frames: Keyframe[] = []
      const steps = 16
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const u = 1 - t
        // Kvadratisk Bézier med linjär tid är samma bana som ett kast med tyngdkraft.
        const x = u * u * x0 + 2 * u * t * cx + t * t * x1
        const y = u * u * y0 + 2 * u * t * cy + t * t * y1
        // Lyfter lite i början och krymper sedan till radens storlek.
        const scale = 1 + 0.15 * Math.sin(Math.PI * Math.min(t * 1.6, 1)) + (endScale - 1) * t * t
        const rotate = -18 * Math.sin(Math.PI * t)
        frames.push({
          transform: `translate(${x - x0}px, ${y - y0}px) scale(${scale}) rotate(${rotate}deg)`,
          opacity: offscreen && t > 0.75 ? 1 - (t - 0.75) * 4 : 1,
        })
      }
      const anim = wrap.animate(frames, { duration: FLIGHT_MS, easing: 'linear', fill: 'forwards' })
      const done = () => {
        wrap.remove()
        rows.forEach(land)
      }
      anim.onfinish = done
      anim.oncancel = done
    }),
  )
}
