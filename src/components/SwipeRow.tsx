import { useRef, useState, type ReactNode } from 'react'
import { haptic } from '../store/ui'

type Props = { children: ReactNode; onDelete: () => void; deleteLabel?: string }

const OPEN = -88
const FULL = 0.5 // andel av bredden som tar bort direkt

/** Svep åt vänster för att visa "Ta bort", eller svep hela vägen för att ta bort direkt. */
export function SwipeRow({ children, onDelete, deleteLabel = 'Ta bort' }: Props) {
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const g = useRef({ startX: 0, startY: 0, base: 0, lock: '' as '' | 'x' | 'y', moved: false, id: -1 })

  const remove = () => {
    haptic(12)
    setLeaving(true)
    setX(-(ref.current?.offsetWidth ?? 400))
    setTimeout(onDelete, 220)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    g.current = { startX: e.clientX, startY: e.clientY, base: x, lock: '', moved: false, id: e.pointerId }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current
    if (s.id !== e.pointerId) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY
    if (!s.lock) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        s.lock = 'x'
        setDragging(true)
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } else if (Math.abs(dy) > 8) {
        s.lock = 'y'
      }
    }
    if (s.lock === 'x') {
      s.moved = true
      const next = Math.min(0, s.base + dx)
      // Gummiband åt höger
      setX(next > 0 ? next / 4 : next)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const s = g.current
    if (s.id !== e.pointerId) return
    s.id = -1
    if (s.lock !== 'x') return
    setDragging(false)
    const width = ref.current?.offsetWidth ?? 400
    if (x < -width * FULL) remove()
    else if (x < OPEN / 2) setX(OPEN)
    else setX(0)
  }

  return (
    <div className={`swipe ${leaving ? 'swipe-leaving' : ''}`} ref={ref}>
      <button
        type="button"
        className="swipe-action"
        onClick={remove}
        tabIndex={x === 0 ? -1 : 0}
        style={{ width: Math.max(-x, 0) }}
      >
        <span>{deleteLabel}</span>
      </button>
      <div
        className="swipe-content"
        style={{
          transform: `translate3d(${x}px,0,0)`,
          transition: dragging ? 'none' : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          // Ett svep ska inte räknas som tryck på knapparna i raden.
          if (g.current.moved) {
            e.stopPropagation()
            e.preventDefault()
            g.current.moved = false
          } else if (x !== 0) {
            e.stopPropagation()
            setX(0)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
