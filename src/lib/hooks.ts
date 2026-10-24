import { useEffect, useRef, useState } from 'react'
import { todayKey } from './dates'

/** Räknar mjukt fram till nytt värde när det ändras. */
export function useAnimatedNumber(target: number, ms = 450): number {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  const current = useRef(target)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      current.current = target
      setValue(target)
      return
    }
    from.current = current.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from.current + (target - from.current) * eased
      current.current = v
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])

  return value
}

/** Dagens datum, som uppdateras när appen kommer tillbaka efter midnatt. */
export function useToday(): string {
  const [today, setToday] = useState(todayKey)
  useEffect(() => {
    const check = () => setToday(todayKey())
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    const id = setInterval(check, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      clearInterval(id)
    }
  }, [])
  return today
}

/** Höjden på det synliga området, som krymper när tangentbordet är uppe i iOS. */
export function useVisualViewport(): { height: number; offsetTop: number } {
  const read = () => ({
    height: window.visualViewport?.height ?? window.innerHeight,
    offsetTop: window.visualViewport?.offsetTop ?? 0,
  })
  const [vv, setVv] = useState(read)
  useEffect(() => {
    const vp = window.visualViewport
    const update = () => setVv(read())
    vp?.addEventListener('resize', update)
    vp?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vp?.removeEventListener('resize', update)
      vp?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return vv
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
