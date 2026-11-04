import { useState } from 'react'
import { FOODS, REFERENCE_FOOD_IDS, type Food, type Per100 } from '../data/foods'
import { formatPoints, toKcal, toPoints } from '../lib/calc'
import { defaultMeasure, packagedBase } from '../lib/packaged'
import { FoodIcon } from './FoodIcon'
import { MinusIcon, PlusIcon } from './icons'
import { Segmented } from './Segmented'

const EMOJIS = ['🍽️', '🥘', '🍲', '🍝', '🍛', '🥗', '🥪', '🌯', '🍕', '🍔', '🍗', '🐟', '🥩', '🥚', '🧀', '🍞', '🥔', '🍚', '🥦', '🍎', '🍌', '🫐', '🥛', '☕', '🍵', '🧃', '🍺', '🍷', '🍫', '🍪', '🍰', '🍦', '🍿', '🥜']

export type CustomFoodFields = { name: string; emoji: string; unit: string; kcal: number; per100?: Per100 }

type Props = {
  budgetKcal: number
  initial?: Partial<Food>
  /** Det som är känt om förpackningen, t.ex. från en skannad vara utan kcal. Formuläret börjar då per 100 g. */
  per100?: Partial<Per100>
  submitLabel: string
  onSubmit: (f: CustomFoodFields) => void
  onDelete?: () => void
}

type Mode = 'points' | 'kcal' | 'per100'

const references = REFERENCE_FOOD_IDS.map((id) => FOODS.find((f) => f.id === id)!).filter(Boolean)

const text = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','))

/**
 * Ny vara på några sekunder. Poäng är standard – kcal finns för den som vet, och kcal per 100 g
 * för den som läser på förpackningen.
 */
export function CustomFoodForm({ budgetKcal, initial, per100: known, submitLabel, onSubmit, onDelete }: Props) {
  const start = { ...initial?.per100, ...known }
  const [name, setName] = useState(initial?.name ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '1 portion')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🍽️')
  const [mode, setMode] = useState<Mode>(initial?.per100 || known ? 'per100' : 'points')
  const [measure, setMeasure] = useState<Per100['measure']>(start.measure ?? 'g')
  const [kcal100, setKcal100] = useState(text(start.kcal))
  const [serving, setServing] = useState(text(start.serving))
  const [pack, setPack] = useState(text(start.pack))
  const startPoints = initial?.kcal !== undefined ? Math.round(toPoints(initial.kcal, budgetKcal)) : 5
  const [points, setPoints] = useState(String(startPoints))
  const [kcal, setKcal] = useState(initial?.kcal !== undefined ? String(Math.round(initial.kcal)) : '')
  // Det exakta värdet som sparas. Det ändras bara när man själv ändrar poäng eller kcal,
  // så att ett namnbyte eller ett byte mellan poäng och kcal aldrig avrundar om värdet.
  const [exactKcal, setExactKcal] = useState<number | null>(initial?.kcal ?? toKcal(startPoints, budgetKcal))

  const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')))
  const size = (s: string) => {
    const n = num(s)
    return Number.isFinite(n) && n > 0 && n <= 100_000 ? n : undefined
  }
  const per100: Per100 | null =
    Number.isFinite(num(kcal100)) && num(kcal100) >= 0 && num(kcal100) <= 900
      ? {
          kcal: num(kcal100),
          measure,
          ...(size(serving) ? { serving: size(serving) } : {}),
          ...(size(pack) ? { pack: size(pack) } : {}),
        }
      : null
  const valid =
    name.trim().length > 0 &&
    (mode === 'per100' ? per100 !== null : exactKcal !== null && Number.isFinite(exactKcal) && exactKcal >= 0)

  const changePoints = (value: string) => {
    setPoints(value)
    setExactKcal(Number.isFinite(num(value)) ? toKcal(num(value), budgetKcal) : null)
  }
  const changeKcal = (value: string) => {
    setKcal(value)
    setExactKcal(Number.isFinite(num(value)) ? num(value) : null)
  }
  const bump = (d: number) => changePoints(String(Math.max(0, Math.round(num(points) || 0) + d)))
  const switchMode = (next: Mode) => {
    // Från förpackningen: det förvalda måttet blir portionen, så att inget av det man skrivit går förlorat.
    let kcalNow = exactKcal
    if (mode === 'per100' && per100) {
      const base = packagedBase(per100)
      kcalNow = base.kcal
      setExactKcal(base.kcal)
      setUnit(base.unit)
    }
    if (next === 'kcal') setKcal(kcalNow === null ? '' : String(Math.round(kcalNow)))
    if (next === 'points') setPoints(kcalNow === null ? '' : String(Math.round(toPoints(kcalNow, budgetKcal))))
    setMode(next)
  }
  const base = per100 ? defaultMeasure(per100) : null

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        if (mode === 'per100' && per100) onSubmit({ name: name.trim(), emoji, ...packagedBase(per100), per100 })
        else onSubmit({ name: name.trim(), emoji, unit: unit.trim() || '1 portion', kcal: Math.round(exactKcal!), per100: undefined })
      }}
    >
      <div className="group">
        <label className="field">
          <span className="field-label">Namn</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Mammas lasagne" autoComplete="off" enterKeyHint="next" />
        </label>
        {mode !== 'per100' && (
          <label className="field">
            <span className="field-label">Portion</span>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="1 portion" autoComplete="off" />
          </label>
        )}
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

      {mode === 'per100' ? (
        <>
          <Segmented
            label="Mått"
            value={measure}
            onChange={setMeasure}
            options={[
              { value: 'g', label: 'Gram' },
              { value: 'ml', label: 'Milliliter' },
            ]}
          />
          <div className="group">
            <label className="field field-inline">
              <span className="field-label">Kcal per 100 {measure}</span>
              <input
                value={kcal100}
                onChange={(e) => setKcal100(e.target.value.replace(/[^0-9,.]/g, ''))}
                inputMode="decimal"
                placeholder="t.ex. 380"
              />
            </label>
            <label className="field field-inline">
              <span className="field-label">Portion</span>
              <input value={serving} onChange={(e) => setServing(e.target.value.replace(/[^0-9,.]/g, ''))} inputMode="decimal" placeholder="valfri" />
              <span className="field-unit">{measure}</span>
            </label>
            <label className="field field-inline">
              <span className="field-label">Förpackning</span>
              <input value={pack} onChange={(e) => setPack(e.target.value.replace(/[^0-9,.]/g, ''))} inputMode="decimal" placeholder="valfri" />
              <span className="field-unit">{measure}</span>
            </label>
            {base && (
              <div className="field-hint">
                {base.unit} ≈ {formatPoints(toPoints(base.kcal, budgetKcal))} poäng för dig
              </div>
            )}
          </div>
          <p className="hint-text form-hint">Skriv av från förpackningen. Med portion och förpackning ifyllda kan du välja mått när du lägger till varan.</p>
        </>
      ) : mode === 'points' ? (
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

      <div className="mode-links">
        {mode !== 'points' && (
          <button type="button" className="link-btn" onClick={() => switchMode('points')}>
            Ange poäng i stället
          </button>
        )}
        {mode !== 'kcal' && (
          <button type="button" className="link-btn" onClick={() => switchMode('kcal')}>
            Jag vet kcal per portion
          </button>
        )}
        {mode !== 'per100' && (
          <button type="button" className="link-btn" onClick={() => switchMode('per100')}>
            Kcal per 100 g från förpackningen
          </button>
        )}
      </div>

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
