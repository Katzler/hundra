import { useEffect, useState } from 'react'
import { amountsFor, amountText, applyPicks, preferred, questionsFor, usualQty, type Picks } from '../data/choices'
import type { Food } from '../data/foods'
import { budgetFor, formatInt, formatPoints, formatQty, toPoints } from '../lib/calc'
import type { DateKey } from '../lib/dates'
import { haptic } from '../store/ui'
import { useStore } from '../store/useStore'
import { MinusIcon, PlusIcon } from './icons'
import { Sheet } from './Sheet'

type Props = {
  /** Varan att välja för. null stänger arket. */
  food: Food | null
  /** Mängd från sökningen, t.ex. "2 kycklingfilé". */
  qty?: number
  date: DateKey
  onClose: () => void
}

/** Snabbval när man trycker på en vara: storlek, tillagning, fetthalt, enhet och mängd på en gång. */
export function ChoiceSheet({ food, qty: startQty, date, onClose }: Props) {
  const history = useStore((s) => s.budgetHistory)
  const addFood = useStore((s) => s.addFood)
  // Varan ligger kvar medan arket glider ut.
  const [base, setBase] = useState<Food | null>(food)
  const [picks, setPicks] = useState<Picks>({})
  const [qty, setQty] = useState(1)

  useEffect(() => {
    if (!food) return
    const p = preferred(food, useStore.getState().lastChoices[food.id])
    setBase(food)
    setPicks(p.picks)
    setQty(startQty && startQty !== 1 ? startQty : p.qty)
  }, [food, startQty])

  if (!base) return null
  const questions = questionsFor(base)
  const variant = applyPicks(base, picks)
  const amounts = amountsFor(base, picks)
  const kcal = variant.kcal * qty
  const points = toPoints(kcal, budgetFor(date, history))

  const pick = (questionId: string, optionId: string) => {
    haptic()
    const next = { ...picks, [questionId]: optionId }
    // Byts enheten börjar mängden om på det man brukar ta av den, t.ex. 2 msk.
    if (questionId === 'enhet' && optionId !== picks.enhet) setQty(usualQty(base, next))
    setPicks(next)
  }
  const step = (d: number) => {
    haptic()
    setQty((q) => (d < 0 ? (q > 1 ? q - 1 : 0.5) : q < 1 ? 1 : q + 1))
  }
  const add = () => {
    haptic()
    addFood(variant, date, qty, picks)
    onClose()
  }

  return (
    <Sheet
      open={!!food}
      onClose={onClose}
      compact
      label={`Välj ${base.name}`}
      title={base.name}
      right={
        <button type="button" className="bar-btn" onClick={onClose}>
          Avbryt
        </button>
      }
      footer={
        <div className="sheet-footer choice-footer">
          <p className="choice-sum">
            {amountText(qty, variant.unit)} ≈ {formatInt(kcal)} kcal
          </p>
          <button type="button" className="primary-btn" onClick={add}>
            Lägg till · {formatPoints(points)} p
          </button>
        </div>
      }
    >
      <div className="choice">
        {questions.map((q) => (
          <section key={q.id} className="choice-group">
            <h3 className="choice-title">{q.title}</h3>
            <div
              className={`choice-options ${q.options.length <= 4 ? 'is-grid' : ''}`}
              style={{ '--n': q.options.length } as React.CSSProperties}
              role="radiogroup"
              aria-label={q.title}
            >
              {q.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={picks[q.id] === o.id}
                  className={`choice-option ${picks[q.id] === o.id ? 'is-active' : ''}`}
                  onClick={() => pick(q.id, o.id)}
                >
                  <span className="choice-label">{o.label}</span>
                  {o.note && <span className="choice-note">{o.note}</span>}
                </button>
              ))}
            </div>
          </section>
        ))}

        <section className="choice-group">
          <h3 className="choice-title">Mängd</h3>
          <div className="choice-amount">
            <button type="button" className="choice-step" onClick={() => step(-1)} aria-label="Mindre">
              <MinusIcon size={18} />
            </button>
            <span className="choice-qty" aria-live="polite">
              {amountText(qty, variant.unit)}
            </span>
            <button type="button" className="choice-step" onClick={() => step(1)} aria-label="Mer">
              <PlusIcon size={18} />
            </button>
          </div>
          <div className="choice-quick" role="radiogroup" aria-label="Snabbval för mängd">
            {amounts.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={a === qty}
                className={`choice-chip ${a === qty ? 'is-active' : ''}`}
                onClick={() => {
                  haptic()
                  setQty(a)
                }}
              >
                {formatQty(a)}
              </button>
            ))}
          </div>
        </section>
      </div>
    </Sheet>
  )
}
