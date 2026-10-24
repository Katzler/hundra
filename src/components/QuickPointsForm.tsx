import { useState } from 'react'
import { FOODS, REFERENCE_FOOD_IDS } from '../data/foods'
import { formatPoints, toKcal, toPoints } from '../lib/calc'
import { FoodIcon } from './FoodIcon'
import { MinusIcon, PlusIcon } from './icons'

type Props = { budgetKcal: number; onSubmit: (kcal: number, name: string) => void }

const references = REFERENCE_FOOD_IDS.map((id) => FOODS.find((f) => f.id === id)!).filter(Boolean)

/** Ungefärliga poäng utan att leta upp en vara – för t.ex. en restauranglunch. */
export function QuickPointsForm({ budgetKcal, onSubmit }: Props) {
  const [points, setPoints] = useState(15)
  const [name, setName] = useState('')
  const step = (d: number) => setPoints((p) => Math.max(1, Math.min(150, p + d)))

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(toKcal(points, budgetKcal), name)
      }}
    >
      <div className="group points-picker">
        <span className="field-label">Ungefär hur många poäng?</span>
        <div className="points-control">
          <button type="button" className="round-btn" onClick={() => step(-1)} aria-label="En poäng mindre">
            <MinusIcon />
          </button>
          <input
            className="points-input"
            value={points}
            onChange={(e) => setPoints(Math.max(0, Math.min(150, Number(e.target.value.replace(/\D/g, '')) || 0)))}
            inputMode="numeric"
            aria-label="Poäng"
          />
          <button type="button" className="round-btn" onClick={() => step(1)} aria-label="En poäng till">
            <PlusIcon />
          </button>
        </div>
        <div className="references">
          {references.map((f) => (
            <span key={f.id} className="reference">
              <FoodIcon id={f.id} emoji={f.emoji} size={18} /> {f.name.replace('Smörgås med ost', 'Macka')}{' '}
              <strong>{formatPoints(toPoints(f.kcal, budgetKcal))} p</strong>
            </span>
          ))}
        </div>
      </div>
      <div className="group">
        <label className="field">
          <span className="field-label">Vad?</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Restauranglunch (valfritt)" autoComplete="off" />
        </label>
      </div>
      <button type="submit" className="primary-btn" disabled={points <= 0}>
        Lägg till {points} p
      </button>
    </form>
  )
}
