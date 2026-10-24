import { useEffect, useState } from 'react'
import { formatPoints, toPoints } from '../lib/calc'
import { haptic, useUI } from '../store/ui'
import { MEAL_PREFIX, useStore, type Meal, type MealItem } from '../store/useStore'
import { FoodIcon } from './FoodIcon'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'

type Props = {
  /** Ny måltid från dagens rader, eller en befintlig måltid att ändra. */
  source: { items: MealItem[] } | { meal: Meal } | null
  budgetKcal: number
  onClose: () => void
}

/** Spara några rader som en måltid som läggs till med ett tryck, t.ex. "Min frukost". */
export function MealSheet({ source, budgetKcal, onClose }: Props) {
  const saveMeal = useStore((s) => s.saveMeal)
  const deleteMeal = useStore((s) => s.deleteMeal)
  const toggleQuickPick = useStore((s) => s.toggleQuickPick)
  const quickPicks = useStore((s) => s.quickPicks)
  const showToast = useUI((s) => s.showToast)
  const existing = source && 'meal' in source ? source.meal : null
  const [name, setName] = useState('')
  const [items, setItems] = useState<MealItem[]>([])
  const [asQuickPick, setAsQuickPick] = useState(true)

  useEffect(() => {
    if (!source) return
    setName(existing?.name ?? defaultName())
    setItems('meal' in source ? source.meal.items : source.items)
    setAsQuickPick(existing ? (quickPicks?.includes(MEAL_PREFIX + existing.id) ?? false) : true)
  }, [source])

  const total = items.reduce((s, i) => s + i.kcalPerUnit * i.qty, 0)
  const valid = items.length > 0

  const save = () => {
    const meal = saveMeal({ id: existing?.id, name, items })
    const id = MEAL_PREFIX + meal.id
    const isPicked = useStore.getState().quickPicks?.includes(id) ?? false
    if (asQuickPick !== isPicked) toggleQuickPick(id)
    haptic()
    showToast(existing ? 'Måltiden sparad' : `${meal.name} sparad${asQuickPick ? ' bland snabbvalen' : ''}`)
    onClose()
  }

  return (
    <Sheet
      open={source !== null}
      onClose={onClose}
      label={existing ? 'Ändra måltid' : 'Spara som måltid'}
      title={existing ? 'Ändra måltid' : 'Ny måltid'}
      left={
        <button type="button" className="bar-btn" onClick={onClose}>
          Avbryt
        </button>
      }
      right={
        <button type="button" className="bar-btn bar-btn-strong" disabled={!valid} onClick={save}>
          Spara
        </button>
      }
    >
      <div className="form">
        <div className="group">
          <label className="field">
            <span className="field-label">Namn</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Min frukost" autoComplete="off" />
          </label>
        </div>

        <div className="group">
          {items.map((item, i) => (
            <div key={item.foodId} className="row entry-row">
              <span className="emoji" aria-hidden>
                <FoodIcon id={item.foodId} emoji={item.emoji} />
              </span>
              <span className="row-text">
                <span className="row-title">
                  <span className="row-name">{item.name}</span>
                </span>
                <span className="row-sub">
                  {item.unit ? `${item.unit} · ` : ''}
                  <strong>{formatPoints(toPoints(item.kcalPerUnit * item.qty, budgetKcal))} p</strong>
                </span>
              </span>
              <Stepper
                value={item.qty}
                label={item.name}
                onChange={(q) => setItems(q <= 0 ? items.filter((_, j) => j !== i) : items.map((x, j) => (j === i ? { ...x, qty: q } : x)))}
              />
            </div>
          ))}
          {items.length === 0 && <p className="empty-text">Måltiden är tom.</p>}
        </div>
        <p className="hint-text">Totalt {formatPoints(toPoints(total, budgetKcal))} p. Poängen räknas om om du ändrar dina uppgifter.</p>

        <label className="toggle-row group">
          <span className="row-title">Visa bland snabbvalen</span>
          <input type="checkbox" className="switch" checked={asQuickPick} onChange={(e) => setAsQuickPick(e.target.checked)} />
        </label>

        {existing && (
          <button
            type="button"
            className="danger-btn"
            onClick={() => {
              if (!confirm(`Ta bort ${existing.name}? Redan loggade rader finns kvar.`)) return
              deleteMeal(existing.id)
              onClose()
            }}
          >
            Ta bort måltiden
          </button>
        )}
      </div>
    </Sheet>
  )
}

function defaultName(): string {
  const h = new Date().getHours()
  if (h < 10) return 'Min frukost'
  if (h < 14) return 'Min lunch'
  if (h < 17) return 'Mitt mellanmål'
  return 'Min middag'
}
