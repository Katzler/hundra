import { useSyncExternalStore } from 'react'

// Ikonerna ritas med bläcket var(--ink). De visas som <img>, så bläckfärgen
// byts in i SVG-koden innan den blir en data-URL: mörkt bläck i ljust läge, ljust i mörkt.
const INK = { light: '#2b2118', dark: '#F2EDE4' }

let icons: Record<string, string> | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const urls = new Map<string, string>()

export function loadIcons(): Promise<void> {
  loading ??= import('../icons/riso').then((m) => {
    icons = m.ICONS
    listeners.forEach((l) => l())
  })
  return loading
}

const subscribeIcons = (l: () => void) => {
  listeners.add(l)
  loadIcons()
  return () => listeners.delete(l)
}

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)')

const subscribeDark = (l: () => void) => {
  const q = darkQuery()
  q?.addEventListener('change', l)
  return () => q?.removeEventListener('change', l)
}

export function hasIcon(id: string): boolean {
  return !!icons?.[id]
}

/** Data-URL för ikonen i rätt läge, eller null om ikonen saknas (eller inte laddats än). */
export function useIconUrl(id: string): string | null {
  const loaded = useSyncExternalStore(subscribeIcons, () => icons)
  const dark = useSyncExternalStore(subscribeDark, () => darkQuery()?.matches ?? false)
  const svg = loaded?.[id]
  if (!svg) return null
  const key = `${id}:${dark ? 'd' : 'l'}`
  let url = urls.get(key)
  if (!url) {
    const inked = svg.replaceAll('var(--ink, #2b2118)', dark ? INK.dark : INK.light)
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(inked)}`
    urls.set(key, url)
  }
  return url
}
