import { useState } from 'react'
import { FOODS, REFERENCE_FOOD_IDS, type Food } from '../data/foods'
import { formatPoints, MACRO_NAMES, toKcal, toPoints, type Macros } from '../lib/calc'
import { useStore } from '../store/useStore'
import { FoodIcon } from './FoodIcon'
import { MinusIcon, PlusIcon } from './icons'

const EMOJIS = ['🍽️', '🥘', '🍲', '🍝', '🍛', '🥗', '🥪', '🌯', '🍕', '🍔', '🍗', '🐟', '🥩', '🥚', '🧀', '🍞', '🥔', '🍚', '🥦', '🍎', '🍌', '🫐', '🥛', '☕', '🍵', '🧃', '🍺', '🍷', '🍫', '🍪', '🍰', '🍦', '🍿', '🥜']

type Props = {
  budgetKcal: number
  initial?: Partial<Food>
  submitLabel: string
  /** `macros` är alltid med, undefined om varan inte har någon näring. */
  onSubmit: (f: { name: string; emoji: string; unit: string; kcal: number; macros: Macros | undefined }) => void
  onDelete?: () => void
}

const references = REFERENCE_FOOD_IDS.map((id) => FOODS.find((f) => f.id === id)!).filter(Boolean)

/** Ny vara på några sekunder. Poäng är standard – kcal finns för den som vet. */
export function CustomFoodForm({ budgetKcal, initial, submitLabel, onSubmit, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '1 portion')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🍽️')
  const [mode, setMode] = useState<'points' | 'kcal'>('points')
  const startPoints = initial?.kcal !== undefined ? Math.round(toPoints(initial.kcal, budgetKcal)) : 5
  const [points, setPoints] = useState(String(startPoints))
  const [kcal, setKcal] = useState(initial?.kcal !== undefined ? String(Math.round(initial.kcal)) : '')
  // Det exakta värdet som sparas. Det ändras bara när man själv ändrar poäng eller kcal,
  // så att ett namnbyte eller ett byte mellan poäng och kcal aldrig avrundar om värdet.
  const [exactKcal, setExactKcal] = useState<number | null>(initial?.kcal ?? toKcal(startPoints, budgetKcal))
  // Näringen visas bara när den är påslagen i Profil. Annars behåller varan det den hade.
  const showMacros = useStore((s) => s.showMacros)
  const [grams, setGrams] = useState<string[]>(() => (initial?.macros ? initial.macros.map((g) => String(g).replace('.', ',')) : ['', '', '']))

  const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')))
  const valid = name.trim().length > 0 && exactKcal !== null && Number.isFinite(exactKcal) && exactKcal >= 0

  const changePoints = (value: string) => {
    setPoints(value)
    setExactKcal(Number.isFinite(num(value)) ? toKcal(num(value), budgetKcal) : null)
  }
  const changeKcal = (value: string) => {
    setKcal(value)
    setExactKcal(Number.isFinite(num(value)) ? num(value) : null)
  }
  /** Tomma fält betyder ingen näring alls. Fyller man i något räknas de tomma som 0. */
  const macros = (): Macros | undefined => {
    if (!showMacros) return initial?.macros
    if (grams.every((g) => g.trim() === '')) return undefined
    return grams.map((g) => {
      const n = num(g)
      return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0
    }) as Macros
  }
  const bump = (d: number) => changePoints(String(Math.max(0, Math.round(num(points) || 0) + d)))
  const switchMode = () => {
    if (mode === 'points') setKcal(exactKcal === null ? '' : String(Math.round(exactKcal)))
    else setPoints(exactKcal === null ? '' : String(Math.round(toPoints(exactKcal, budgetKcal))))
    setMode(mode === 'points' ? 'kcal' : 'points')
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit({ name: name.trim(), emoji, unit: unit.trim() || '1 portion', kcal: Math.round(exactKcal), macros: macros() })
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
              onChange={(e) => changePoints(e.target.value.replace(/[^0-9,.]/g, ''))}
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
            <input value={kcal} onChange={(e) => changeKcal(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="t.ex. 450" />
          </label>
          {kcal !== '' && <div className="field-hint">≈ {formatPoints(toPoints(num(kcal), budgetKcal))} poäng för dig</div>}
        </div>
      )}

      <button type="button" className="link-btn" onClick={switchMode}>
        {mode === 'points' ? 'Jag vet antal kcal' : 'Ange poäng i stället'}
      </button>

      {showMacros && (
        <>
          <div className="group">
            {MACRO_NAMES.map((label, i) => (
              <label key={label} className="field field-inline">
                <span className="field-label">{label}</span>
                <input
                  value={grams[i]}
                  onChange={(e) => setGrams(grams.map((g, j) => (j === i ? e.target.value.replace(/[^0-9,.]/g, '') : g)))}
                  inputMode="decimal"
                  placeholder="–"
                  aria-label={`${label} i gram per portion`}
                />
                <span className="field-unit">g</span>
              </label>
            ))}
          </div>
          <p className="hint-text">Valfritt, per portion. Utan värden räknas varan inte med i protein, fett och kolhydrater.</p>
        </>
      )}

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
