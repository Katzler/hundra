import { useState } from 'react'
import { FOODS, REFERENCE_FOOD_IDS, type Food } from '../data/foods'
import { formatPoints, toKcal, toPoints } from '../lib/calc'
import { FoodIcon } from './FoodIcon'
import { MinusIcon, PlusIcon } from './icons'

const EMOJIS = ['🍽️', '🥘', '🍲', '🍝', '🍛', '🥗', '🥪', '🌯', '🍕', '🍔', '🍗', '🐟', '🥩', '🥚', '🧀', '🍞', '🥔', '🍚', '🥦', '🍎', '🍌', '🫐', '🥛', '☕', '🍵', '🧃', '🍺', '🍷', '🍫', '🍪', '🍰', '🍦', '🍿', '🥜']

type Props = {
  budgetKcal: number
  initial?: Partial<Food>
  submitLabel: string
  onSubmit: (f: { name: string; emoji: string; unit: string; kcal: number }) => void
  onDelete?: () => void
}

const references = REFERENCE_FOOD_IDS.map((id) => FOODS.find((f) => f.id === id)!).filter(Boolean)

/** Ny vara på några sekunder. Poäng är standard – kcal finns för den som vet. */
export function CustomFoodForm({ budgetKcal, initial, submitLabel, onSubmit, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '1 portion')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🍽️')
  const [mode, setMode] = useState<'points' | 'kcal'>('points')
  const startPoints = initial?.kcal !== undefined ? Math.max(1, Math.round(toPoints(initial.kcal, budgetKcal))) : 5
  const [points, setPoints] = useState(String(startPoints))
  const [kcal, setKcal] = useState(initial?.kcal !== undefined ? String(Math.round(initial.kcal)) : '')

  const num = (s: string) => Number(s.replace(',', '.'))
  const kcalValue = mode === 'points' ? toKcal(num(points), budgetKcal) : num(kcal)
  const valid = name.trim().length > 0 && Number.isFinite(kcalValue) && kcalValue >= 0 && (mode === 'points' ? points !== '' : kcal !== '')

  const bump = (d: number) => setPoints(String(Math.max(0, Math.round(num(points) || 0) + d)))

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit({ name: name.trim(), emoji, unit: unit.trim() || '1 portion', kcal: Math.round(kcalValue) })
      }}
    >
      <div className="group">
        <label className="field">
          <span className="field-label">Namn</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Mammas lasagne" autoComplete="off" enterKeyHint="next" />
        </label>
        <label className="field">
          <span className="field-label">Portion</span>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="1 portion" autoComplete="off" />
        </label>
      </div>

      <div className="emoji-picker" role="radiogroup" aria-label="Ikon">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={emoji === e}
            className={`emoji-option ${emoji === e ? 'is-active' : ''}`}
            onClick={() => setEmoji(e)}
          >
            {e}
          </button>
        ))}
      </div>

      {mode === 'points' ? (
        <div className="group points-picker">
          <span className="field-label">Poäng per portion</span>
          <div className="points-control">
            <button type="button" className="round-btn" onClick={() => bump(-1)} aria-label="En poäng mindre">
              <MinusIcon />
            </button>
            <input
              className="points-input"
              value={points}
              onChange={(e) => setPoints(e.target.value.replace(/[^0-9,.]/g, ''))}
              inputMode="decimal"
              aria-label="Poäng"
            />
            <button type="button" className="round-btn" onClick={() => bump(1)} aria-label="En poäng till">
              <PlusIcon />
            </button>
          </div>
          <div className="references">
            {references.map((f) => (
              <span key={f.id} className="reference">
                <FoodIcon id={f.id} emoji={f.emoji} size={18} /> {f.name.replace('Smörgås med ost', 'Macka')} <strong>{formatPoints(toPoints(f.kcal, budgetKcal))} p</strong>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="group">
          <label className="field">
            <span className="field-label">Kcal per portion</span>
            <input value={kcal} onChange={(e) => setKcal(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="t.ex. 450" />
          </label>
          {kcal !== '' && <div className="field-hint">≈ {formatPoints(toPoints(num(kcal), budgetKcal))} poäng för dig</div>}
        </div>
      )}

      <button type="button" className="link-btn" onClick={() => setMode(mode === 'points' ? 'kcal' : 'points')}>
        {mode === 'points' ? 'Jag vet antal kcal' : 'Ange poäng i stället'}
      </button>

      <button type="submit" className="primary-btn" disabled={!valid}>
        {submitLabel}
      </button>
      {onDelete && (
        <button type="button" className="danger-btn" onClick={onDelete}>
          Ta bort varan
        </button>
      )}
    </form>
  )
}
