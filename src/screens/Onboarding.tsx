import { useRef, useState } from 'react'
import { FoodIcon } from '../components/FoodIcon'
import { ChevronLeft } from '../components/icons'
import { RecoveryCard } from '../components/RecoveryCard'
import { AboutFields, ActivityPicker, aboutValid, emptyForm, toProfile } from '../components/ProfileFields'
import { Ring } from '../components/Ring'
import { EXAMPLE_FOOD_IDS, FOODS } from '../data/foods'
import { importBackup } from '../lib/backup'
import { formatInt, formatPoints, tdee, toPoints } from '../lib/calc'
import { isStandalone } from '../lib/hooks'
import { useStore } from '../store/useStore'

const EXAMPLES = EXAMPLE_FOOD_IDS.map((id) => FOODS.find((f) => f.id === id)!)

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const fileRef = useRef<HTMLInputElement>(null)
  const setProfile = useStore((s) => s.setProfile)
  const profile = toProfile(form)
  const budget = profile ? tdee(profile) : 0

  const canContinue = step === 0 || (step === 1 && aboutValid(form)) || (step === 2 && form.activity !== null) || step === 3

  const next = () => {
    if (step < 3) setStep(step + 1)
    else if (profile) setProfile(profile)
  }

  return (
    <div className="onboarding">
      <div className="onboarding-top">
        {step > 0 ? (
          <button type="button" className="bar-btn bar-btn-back" onClick={() => setStep(step - 1)}>
            <ChevronLeft size={18} />
            Tillbaka
          </button>
        ) : (
          <span />
        )}
        <div className="dots" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <span />
      </div>

      <div className="onboarding-body" key={step}>
        {step === 0 && <RecoveryCard />}
        {step === 0 && (
          <div className="welcome">
            <Ring value={100} size={180} stroke={22} caption="poäng" />
            <h1 className="hero-title">Hundra</h1>
            <p className="hero-text">
              Hela din dag är <strong>100 poäng</strong>. Logga det du äter med ett par tryck. Du behöver varken väga eller räkna kalorier.
            </p>
            <p className="hero-text muted">Det är snittet över tid som räknas, inte varje enskild dag.</p>
            <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
              Har du en backup? Återställ
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importBackup(f)
                e.target.value = ''
              }}
            />
            {!isStandalone() && (
              <p className="hint-text welcome-tip">
                Tips: lägg till appen på hemskärmen innan du börjar (dela-knappen → Lägg till på hemskärmen). Appen där har egen lagring.
              </p>
            )}
          </div>
        )}

        {step === 1 && (
          <>
            <h1 className="step-title">Om dig</h1>
            <p className="step-text">Vi använder det för att räkna ut vad 100 poäng betyder för just dig.</p>
            <AboutFields form={form} onChange={setForm} />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="step-title">Hur mycket rör du dig?</h1>
            <p className="step-text">Tänk på en vanlig vecka. Välj hellre en nivå för lite än för mycket.</p>
            <ActivityPicker form={form} onChange={setForm} />
          </>
        )}

        {step === 3 && profile && (
          <>
            <h1 className="step-title">Din dag är 100 poäng</h1>
            <p className="step-text">Så här mycket kostar några vanliga saker för dig:</p>
            <div className="group">
              {EXAMPLES.map((f) => (
                <div key={f.id} className="row">
                  <span className="emoji" aria-hidden>
                    <FoodIcon id={f.id} emoji={f.emoji} />
                  </span>
                  <span className="row-text">
                    <span className="row-title">{f.name}</span>
                    <span className="row-sub">{f.unit}</span>
                  </span>
                  <span className="row-points big">{formatPoints(toPoints(f.kcal, budget))} p</span>
                </div>
              ))}
            </div>
            <div className="explain">
              <p>
                <strong>Under 100 i snitt</strong> betyder att du går ner i vikt. <strong>Över 100</strong> betyder att du går upp.
              </p>
              <p className="muted small">100 poäng ≈ {formatInt(budget)} kcal för dig, men det behöver du aldrig tänka på.</p>
            </div>
          </>
        )}
      </div>

      <div className="onboarding-footer">
        <button type="button" className="primary-btn" disabled={!canContinue} onClick={next}>
          {step === 0 ? 'Kom igång' : step === 3 ? 'Börja logga' : 'Fortsätt'}
        </button>
        <p className="footer-text onboarding-version">Version {__APP_VERSION__}</p>
      </div>
    </div>
  )
}
