import { ACTIVITY, type ActivityLevel, type Profile, type Sex } from '../lib/calc'
import { Segmented } from './Segmented'

export type ProfileForm = {
  sex: Sex | null
  age: string
  height: string
  weight: string
  activity: ActivityLevel | null
}

export const emptyForm: ProfileForm = { sex: null, age: '', height: '', weight: '', activity: null }

export const formFromProfile = (p: Profile): ProfileForm => ({
  sex: p.sex,
  age: String(p.age),
  height: String(p.heightCm),
  weight: String(p.weightKg).replace('.', ','),
  activity: p.activity,
})

const num = (s: string) => Number(s.replace(',', '.'))

const LIMITS = {
  age: [13, 100],
  height: [120, 230],
  weight: [30, 300],
} as const

const inRange = (s: string, [min, max]: readonly [number, number]) => s !== '' && num(s) >= min && num(s) <= max

export const aboutValid = (f: ProfileForm) =>
  f.sex !== null && inRange(f.age, LIMITS.age) && inRange(f.height, LIMITS.height) && inRange(f.weight, LIMITS.weight)

export function toProfile(f: ProfileForm): Profile | null {
  if (!aboutValid(f) || f.activity === null) return null
  return {
    sex: f.sex!,
    age: Math.round(num(f.age)),
    heightCm: Math.round(num(f.height)),
    weightKg: Math.round(num(f.weight) * 10) / 10,
    activity: f.activity,
  }
}

type FieldsProps = { form: ProfileForm; onChange: (f: ProfileForm) => void }

export function AboutFields({ form, onChange }: FieldsProps) {
  const field = (key: 'age' | 'height' | 'weight', label: string, unit: string, decimals = false) => {
    const value = form[key]
    const invalid = value !== '' && !inRange(value, LIMITS[key])
    return (
      <label className={`field field-inline ${invalid ? 'is-invalid' : ''}`}>
        <span className="field-label">{label}</span>
        <input
          value={value}
          onChange={(e) => onChange({ ...form, [key]: e.target.value.replace(decimals ? /[^0-9,.]/g : /[^0-9]/g, '') })}
          inputMode={decimals ? 'decimal' : 'numeric'}
          placeholder="0"
          aria-invalid={invalid}
        />
        <span className="field-unit">{unit}</span>
      </label>
    )
  }

  return (
    <>
      <Segmented
        label="Kön"
        value={form.sex}
        onChange={(sex) => onChange({ ...form, sex })}
        options={[
          { value: 'kvinna', label: 'Kvinna' },
          { value: 'man', label: 'Man' },
        ]}
      />
      <div className="group">
        {field('age', 'Ålder', 'år')}
        {field('height', 'Längd', 'cm')}
        {field('weight', 'Vikt', 'kg', true)}
      </div>
    </>
  )
}

export function ActivityPicker({ form, onChange }: FieldsProps) {
  return (
    <div className="activity-list" role="radiogroup" aria-label="Aktivitetsnivå">
      {([1, 2, 3, 4, 5] as ActivityLevel[]).map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={form.activity === level}
          className={`activity ${form.activity === level ? 'is-active' : ''}`}
          onClick={() => onChange({ ...form, activity: level })}
        >
          <span className="activity-dots" aria-hidden>
            {[1, 2, 3, 4, 5].map((d) => (
              <i key={d} className={d <= level ? 'on' : ''} />
            ))}
          </span>
          <span className="activity-text">
            <span className="activity-title">{ACTIVITY[level].title}</span>
            <span className="activity-sub">{ACTIVITY[level].text}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
