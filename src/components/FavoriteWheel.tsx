import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { preferred } from '../data/choices'
import { formatPoints, toPoints } from '../lib/calc'
import { haptic } from '../store/ui'
import { allFoods, FAVORITE_GROUPS, itemsOf, mealKcal, useStore, type FavoriteGroup, type QuickItem } from '../store/useStore'
import { FoodIcon } from './FoodIcon'

type Props = {
  budgetKcal: number
  onAdd: (item: QuickItem) => void
  onEdit: (group: FavoriteGroup) => void
}

/** Så länge man håller inne innan hjulet öppnas för att dra och släppa. */
const HOLD_MS = 280

/** Avstånd mellan platserna i ringen, så att etiketterna inte krockar. */
const SPACING = 92

/**
 * Platserna runt mitten, med början högst upp. Upp till åtta får plats för två rader text;
 * fler läggs i en större ring med en rad. Bara äldre data kan ha fler än 14, och då blir det två ringar.
 */
function wheelLayout(n: number): { spots: { x: number; y: number }[]; compact: boolean } {
  const ring = (count: number, r: number, offset = 0) =>
    Array.from({ length: count }, (_, i) => {
      const a = -Math.PI / 2 + ((i + offset) / count) * 2 * Math.PI
      return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) }
    })
  const fit = (count: number) => (SPACING * count) / (2 * Math.PI)
  if (n <= 8) return { spots: ring(n, n <= 5 ? 112 : 122), compact: false }
  if (n <= 14) return { spots: ring(n, Math.max(150, fit(n))), compact: true }
  return { spots: [...ring(6, 100), ...ring(n - 6, Math.max(200, fit(n - 6)), 0.5)], compact: true }
}

/** Hjulet krymps så att det ryms på skärmen, med etiketterna (84 × ~38 px under platsen). */
function wheelScale(spots: { x: number; y: number }[]): number {
  const w = Math.max(...spots.map((p) => Math.abs(p.x))) + 42
  const h = Math.max(...spots.map((p) => Math.abs(p.y))) + 70
  return Math.min(1, (window.innerWidth - 16) / (2 * w), (window.innerHeight * 0.8) / (2 * h))
}

/**
 * Favoriternas fyra kategorier som knappar. Ett tryck öppnar ett hjul med kategorins favoriter,
 * och ett tryck i hjulet lägger till. Håller man inne öppnas hjulet direkt: dra till en favorit och släpp.
 */
export function FavoriteWheel({ budgetKcal, onAdd, onEdit }: Props) {
  const groups = useStore((s) => s.favoriteGroups)
  const custom = useStore((s) => s.customFoods)
  const meals = useStore((s) => s.meals)
  const lastChoices = useStore((s) => s.lastChoices)
  const foods = useMemo(() => allFoods(custom), [custom])
  const [open, setOpen] = useState<FavoriteGroup | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const press = useRef<{ group: FavoriteGroup; x: number; y: number; timer: ReturnType<typeof setTimeout>; dragging: boolean } | null>(null)
  // Klicket efter ett långtryck ska inte öppna hjulet en gång till.
  const skipClick = useRef(false)

  const items = useMemo(() => (open ? itemsOf(foods, groups[open], meals) : []), [open, foods, groups, meals])
  const { spots, compact } = useMemo(() => wheelLayout(items.length), [items.length])
  const scale = useMemo(() => (spots.length ? wheelScale(spots) : 1), [spots])
  const group = FAVORITE_GROUPS.find((g) => g.id === open)

  const close = () => {
    setOpen(null)
    setHover(null)
  }

  const pick = (item: QuickItem) => {
    close()
    onAdd(item)
  }

  const show = (g: FavoriteGroup) => setOpen(g)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Dra och släpp. Lyssnarna ligger på window, eftersom fingret lämnar knappen när hjulet öppnas.
  // De skapas en gång, så att samma funktioner kan tas bort igen; det som ändras läses via refs.
  const live = useRef({ items, hover, pick, show })
  live.current = { items, hover, pick, show }

  const drag = useMemo(() => {
    const end = () => {
      if (press.current) clearTimeout(press.current.timer)
      press.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('touchmove', block)
      window.removeEventListener('touchend', block)
    }
    // Medan man drar ska sidan inte rulla, och när man släpper ska inget klick hamna under fingret.
    const block = (e: TouchEvent) => {
      if (press.current?.dragging) e.preventDefault()
    }
    const move = (e: PointerEvent) => {
      const p = press.current
      if (!p) return
      if (!p.dragging) {
        // Rör man fingret innan hjulet öppnats är det en rullning, inte ett långtryck.
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) end()
        return
      }
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-wheel-index]')
      const i = el ? Number(el.dataset.wheelIndex) : null
      if (i !== live.current.hover) {
        if (i !== null) haptic(5)
        live.current.hover = i
        setHover(i)
      }
    }
    const up = () => {
      const dragging = press.current?.dragging
      end()
      if (!dragging) return
      // Släpper man utanför en favorit ligger hjulet kvar öppet, som efter ett vanligt tryck.
      const i = live.current.hover
      const item = i !== null ? live.current.items[i] : undefined
      if (item) live.current.pick(item)
      else setHover(null)
    }
    const cancel = () => {
      end()
      setHover(null)
    }
    const start = (group: FavoriteGroup, x: number, y: number) => {
      end()
      skipClick.current = false
      const timer = setTimeout(() => {
        if (!press.current) return
        press.current.dragging = true
        skipClick.current = true
        haptic(15)
        live.current.show(group)
      }, HOLD_MS)
      press.current = { group, x, y, timer, dragging: false }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', cancel)
      window.addEventListener('touchmove', block, { passive: false })
      window.addEventListener('touchend', block, { passive: false })
    }
    return { start, end }
  }, [])

  useEffect(() => drag.end, [drag])

  const counts = (g: FavoriteGroup) => itemsOf(foods, groups[g], meals).length

  const pointsOf = (item: QuickItem) => {
    if (item.kind === 'meal') return toPoints(mealKcal(item.meal), budgetKcal)
    const p = preferred(item.food, lastChoices[item.food.id])
    return toPoints(p.food.kcal * p.qty, budgetKcal)
  }

  return (
    <>
      <div className="fav-groups">
        {FAVORITE_GROUPS.map((g) => {
          const n = counts(g.id)
          return (
            <button
              key={g.id}
              type="button"
              className="fav-group"
              aria-label={n ? `${g.name}, ${n} favoriter` : `${g.name}, lägg till favoriter`}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                skipClick.current = false
                if (e.button === 0 && n > 0) drag.start(g.id, e.clientX, e.clientY)
              }}
              onClick={() => {
                if (skipClick.current) {
                  skipClick.current = false
                  return
                }
                haptic()
                if (n === 0) onEdit(g.id)
                else show(g.id)
              }}
            >
              <span className="fav-group-icon" aria-hidden>
                <FoodIcon id={g.icon} emoji={g.emoji} size={40} />
              </span>
              <span className="fav-group-name">{g.name}</span>
            </button>
          )
        })}
      </div>

      {open &&
        group &&
        createPortal(
          <div className="wheel-root" role="dialog" aria-modal="true" aria-label={group.name}>
            <button type="button" className="wheel-scrim" aria-label="Stäng" onClick={close} />
            <div className={`wheel ${compact ? 'is-compact' : ''}`} style={{ scale: String(scale) }}>
              <button type="button" className="wheel-center" onClick={close} aria-label={`Stäng ${group.name}`}>
                <FoodIcon id={group.icon} emoji={group.emoji} size={34} />
                <span>{group.name}</span>
              </button>
              {items.map((item, i) => {
                const id = item.kind === 'food' ? item.food.id : item.meal.id
                const name = item.kind === 'food' ? item.food.name : item.meal.name
                const { x, y } = spots[i]
                return (
                  <button
                    key={id}
                    type="button"
                    data-wheel-index={i}
                    className={`wheel-item ${hover === i ? 'is-hover' : ''}`}
                    style={{ left: x, top: y, ['--x' as string]: `${x}px`, ['--y' as string]: `${y}px`, ['--i' as string]: i }}
                    onClick={() => pick(item)}
                    aria-label={`Lägg till ${name}`}
                  >
                    <span className="wheel-bubble">
                      {item.kind === 'food' ? (
                        <FoodIcon id={item.food.id} emoji={item.food.emoji} size={34} />
                      ) : (
                        <FoodIcon id="maltid-egen" emoji="🍱" size={34} />
                      )}
                      <span className="wheel-points">{formatPoints(pointsOf(item))}</span>
                    </span>
                    <span className="wheel-label">{name}</span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="wheel-edit"
              onClick={() => {
                const g = open
                close()
                onEdit(g)
              }}
            >
              Ändra {group.name.toLowerCase()}
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
