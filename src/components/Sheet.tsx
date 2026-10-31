import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useVisualViewport } from '../lib/hooks'

type Props = {
  open: boolean
  onClose: () => void
  title: ReactNode
  left?: ReactNode
  right?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Monteras även när arket är stängt, så att sökfältet kan få fokus direkt vid tryck (krävs i iOS). */
  keepMounted?: boolean
  label?: string
  /** Bara så högt som innehållet, nerifrån, t.ex. för snabbval ovanpå ett annat ark. */
  compact?: boolean
}

// Ark kan ligga ovanpå varandra. Flaggan på body ska finnas kvar tills det sista stängs.
let openSheets = 0

/** Bottenark i iOS-stil. Dra ner i handtaget eller rubriken för att stänga. */
export function Sheet({ open, onClose, title, left, right, children, footer, keepMounted, label, compact }: Props) {
  const vv = useVisualViewport()
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)
  const start = useRef<{ y: number; id: number; t: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    setEntered(false)
    const t = setTimeout(() => setMounted(false), 450)
    return () => clearTimeout(t)
  }, [open])

  // Ett nymonterat ark behöver en ruta i stängt läge för att glida in.
  useEffect(() => {
    if (!open || !mounted) return
    let r2 = 0
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setEntered(true))))
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
    }
  }, [open, mounted])

  const shown = keepMounted ? open : open && entered

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    openSheets++
    document.body.dataset.sheetOpen = '1'
    // Fokus flyttas in i arket (om inget där redan har det) och tillbaka när det stängs – för VoiceOver och tangentbord.
    const returnTo = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => {
      // Ett textfält som har fokus får behålla det, annars fälls tangentbordet ner innan arkets sökfält hunnit ta över.
      const active = document.activeElement
      if (!dialogRef.current?.contains(active) && !(active instanceof HTMLInputElement)) dialogRef.current?.focus({ preventScroll: true })
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]')].filter(
        (el) => el.offsetParent !== null,
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.body.style.overflow = prev
      if (--openSheets === 0) delete document.body.dataset.sheetOpen
      window.removeEventListener('keydown', onKey)
      // Inte tillbaka till ett textfält: det skulle öppna tangentbordet igen.
      if (returnTo?.isConnected && !(returnTo instanceof HTMLInputElement)) returnTo.focus({ preventScroll: true })
    }
  }, [open, onClose])

  if (!mounted && !keepMounted) return null

  // Under statusraden/notchen och ovanför tangentbordet.
  const extra = 10 + (window.matchMedia('(min-width: 640px)').matches ? 40 : 0)
  const top = `calc(${vv.offsetTop}px + var(--safe-top) + ${extra}px)`
  const height = `max(300px, calc(${vv.height}px - var(--safe-top) - ${extra}px))`

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, a')) return
    start.current = { y: e.clientY, id: e.pointerId, t: performance.now() }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onMove = (e: React.PointerEvent) => {
    if (start.current?.id !== e.pointerId) return
    setDragY(Math.max(0, e.clientY - start.current.y))
  }
  const onUp = (e: React.PointerEvent) => {
    if (start.current?.id !== e.pointerId) return
    const velocity = dragY / Math.max(1, performance.now() - start.current.t)
    start.current = null
    setDragging(false)
    if (dragY > 120 || (dragY > 30 && velocity > 0.6)) onClose()
    setDragY(0)
  }

  return createPortal(
    <div className={`sheet-root ${shown ? 'is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        className="sheet"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{
          ...(compact ? { bottom: 0, maxHeight: height } : { top, height }),
          transform: shown ? `translate3d(0, ${dragY}px, 0)` : 'translate3d(0, 110%, 0)',
          transition: dragging ? 'none' : undefined,
        }}
      >
        <div className="sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="sheet-grabber" />
          <div className="sheet-bar">
            <div className="sheet-bar-side">{left}</div>
            <h2 className="sheet-title">{title}</h2>
            <div className="sheet-bar-side sheet-bar-right">{right}</div>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer}
      </div>
    </div>,
    document.body,
  )
}
