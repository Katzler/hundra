import { useRef } from 'react'
import type { Food } from '../data/foods'
import { formatPoints, type Entry } from '../lib/calc'
import { haptic } from '../store/ui'
import { PlusIcon, StarIcon } from './icons'
import { Stepper } from './Stepper'

type FoodRowProps = {
  food: Food
  points: number
  qty: number
  favorite: boolean
  onAdd: () => void
  onQty: (qty: number) => void
  onLongPress: () => void
}

/** En vara i Lägg till-listan: (+) blir en stegare när den ligger i dagens lista. */
export function FoodRow({ food, points, qty, favorite, onAdd, onQty, onLongPress }: FoodRowProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const longPressed = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  const cancel = () => clearTimeout(timer.current)

  return (
    <div
      className={`row food-row ${qty > 0 ? 'is-added' : ''}`}
      onPointerDown={(e) => {
        longPressed.current = false
        startPos.current = { x: e.clientX, y: e.clientY }
        timer.current = setTimeout(() => {
          longPressed.current = true
          haptic(15)
          onLongPress()
        }, 500)
      }}
      onPointerMove={(e) => {
        if (Math.hypot(e.clientX - startPos.current.x, e.clientY - startPos.current.y) > 8) cancel()
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="row-main"
        onClick={() => {
          if (longPressed.current) return
          haptic()
          onAdd()
        }}
      >
        <span className="emoji" aria-hidden>
          {food.emoji}
        </span>
        <span className="row-text">
          <span className="row-title">
            {food.name}
            {favorite && <StarIcon size={12} filled className="row-star" />}
          </span>
          <span className="row-sub">{food.unit}</span>
        </span>
        <span className="row-points">{formatPoints(points)} p</span>
      </button>
      {qty > 0 ? (
        <Stepper value={qty} onChange={onQty} label={food.name} />
      ) : (
        <button
          type="button"
          className="add-btn"
          aria-label={`Lägg till ${food.name}`}
          onClick={() => {
            haptic()
            onAdd()
          }}
        >
          <PlusIcon size={18} />
        </button>
      )}
    </div>
  )
}

type EntryRowProps = { entry: Entry; points: number; onQty: (qty: number) => void }

/** En rad i dagens lista: 🥔 Potatis · 3 × 1 st medel · 10 p   [ − 3 + ] */
export function EntryRow({ entry, points, onQty }: EntryRowProps) {
  return (
    <div className="row entry-row">
      <span className="emoji" aria-hidden>
        {entry.emoji}
      </span>
      <span className="row-text">
        <span className="row-title">{entry.name}</span>
        <span className="row-sub">
          {entry.unit} · <strong>{formatPoints(points)} p</strong>
        </span>
      </span>
      <Stepper value={entry.qty} onChange={onQty} label={entry.name} />
    </div>
  )
}
