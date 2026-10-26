import { useRef, useState } from 'react'
import { CustomFoodForm } from '../components/CustomFoodForm'
import { FoodIcon } from '../components/FoodIcon'
import { ChevronRight } from '../components/icons'
import { MealSheet } from '../components/MealSheet'
import { Segmented } from '../components/Segmented'
import { AboutFields, ActivityPicker, formFromProfile, toProfile } from '../components/ProfileFields'
import { Sheet } from '../components/Sheet'
import type { Food } from '../data/foods'
import { ACTIVITY, budgetFor, formatInt, formatPoints, kcalPerPoint, toPoints } from '../lib/calc'
import { todayKey } from '../lib/dates'
import { demoEntries } from '../lib/demo'
import { exportBackup, importBackup } from '../lib/backup'
import { isStandalone } from '../lib/hooks'
import { startupText } from '../lib/startup'
import { useUI } from '../store/ui'
import { GOALS, mealKcal, useStore, type Meal } from '../store/useStore'

export function Profile() {
  const profile = useStore((s) => s.profile)!
  const history = useStore((s) => s.budgetHistory)
  const custom = useStore((s) => s.customFoods)
  const setProfile = useStore((s) => s.setProfile)
  const updateCustomFood = useStore((s) => s.updateCustomFood)
  const deleteCustomFood = useStore((s) => s.deleteCustomFood)
  const resetAll = useStore((s) => s.resetAll)
  const meals = useStore((s) => s.meals)
  const goal = useStore((s) => s.goal)
  const setGoal = useStore((s) => s.setGoal)
  const calibration = useStore((s) => s.calibration)
  const setCalibration = useStore((s) => s.setCalibration)
  const lastBackupAt = useStore((s) => s.lastBackupAt)
  const showToast = useUI((s) => s.showToast)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => formFromProfile(profile))
  const [editFood, setEditFood] = useState<Food | null>(null)
  const [editMeal, setEditMeal] = useState<Meal | null>(null)
  const [fromStart, setFromStart] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const budget = budgetFor(todayKey(), history)
  const draft = toProfile(form)
  // Den som redan har lågt BMI erbjuds inte att gå ner i vikt.
  const bmi = profile.weightKg / (profile.heightCm / 100) ** 2
  const goals = bmi < 20 ? GOALS.filter((g) => g.value === 100) : GOALS
  const startup = startupText()

  return (
    <main className="screen profile">
      <header className="page-header">
        <h1 className="large-title">Profil</h1>
      </header>

      <section className="card day-card">
        <div className="day-card-big">
          100 poäng <span className="muted">≈ {formatInt(budget)} kcal</span>
        </div>
        <div className="muted small">1 poäng ≈ {formatInt(kcalPerPoint(budget))} kcal</div>
        {calibration !== 1 && (
          <div className="muted small calibration-note">
            Justerad efter din vikttrend ({calibration > 1 ? '+' : ''}
            {Math.round((calibration - 1) * 100)} %).{' '}
            <button type="button" className="inline-link" onClick={() => setCalibration(1)}>
              Återställ
            </button>
          </div>
        )}
      </section>

      <h2 className="section-title">Mål</h2>
      <Segmented
        label="Mål"
        value={goal}
        onChange={setGoal}
        options={goals.map((g) => ({ value: g.value, label: g.value === 100 ? 'Hålla' : String(g.value) }))}
      />
      <p className="hint-text">
        {GOALS.find((g) => g.value === goal)?.title}
        {goal < 100 ? ` – sikta på ett snitt runt ${goal}. Ringen visar målet som ett streck.` : ' – ett snitt runt 100 håller vikten.'}
        {bmi < 20 && ' Med ditt BMI rekommenderas inte viktnedgång.'}
      </p>

      <h2 className="section-title">Mina uppgifter</h2>
      <div className="group">
        <button
          type="button"
          className="row nav-row"
          onClick={() => {
            setForm(formFromProfile(profile))
            setEditing(true)
          }}
        >
          <span className="row-text">
            <span className="row-title">
              {profile.sex === 'man' ? 'Man' : 'Kvinna'}, {profile.age} år
            </span>
            <span className="row-sub">
              {profile.heightCm} cm · {String(profile.weightKg).replace('.', ',')} kg · {ACTIVITY[profile.activity].title.toLowerCase()}
            </span>
          </span>
          <span className="row-action">Ändra</span>
          <ChevronRight size={16} className="row-chevron" />
        </button>
      </div>
      <p className="hint-text">Väg in under Trend då och då, så följer dina 100 poäng med automatiskt. Gamla dagar räknas mot det som gällde då.</p>

      <h2 className="section-title">Mina måltider</h2>
      {meals.length > 0 ? (
        <div className="group">
          {meals.map((m) => (
            <button key={m.id} type="button" className="row nav-row" onClick={() => setEditMeal(m)}>
              <span className="emoji" aria-hidden>
                <FoodIcon id="maltid-egen" emoji="🍱" />
              </span>
              <span className="row-text">
                <span className="row-title">
                  <span className="row-name">{m.name}</span>
                </span>
                <span className="row-sub">{m.items.map((i) => i.name).join(', ')}</span>
              </span>
              <span className="row-points">{formatPoints(toPoints(mealKcal(m), budget))} p</span>
              <ChevronRight size={16} className="row-chevron" />
            </button>
          ))}
        </div>
      ) : (
        <p className="hint-text">Inga måltider än. Logga en måltid på Idag och välj ”Spara som måltid”.</p>
      )}

      <h2 className="section-title">Mina varor</h2>
      {custom.length > 0 ? (
        <div className="group">
          {custom.map((f) => (
            <button key={f.id} type="button" className="row nav-row" onClick={() => setEditFood(f)}>
              <span className="emoji" aria-hidden>
                <FoodIcon id={f.id} emoji={f.emoji} />
              </span>
              <span className="row-text">
                <span className="row-title">
                  <span className="row-name">{f.name}</span>
                </span>
                <span className="row-sub">{f.unit}</span>
              </span>
              <span className="row-points">{formatPoints(toPoints(f.kcal, budget))} p</span>
              <ChevronRight size={16} className="row-chevron" />
            </button>
          ))}
        </div>
      ) : (
        <p className="hint-text">Inga egna varor än. Sök efter något i Lägg till och välj ”Skapa”.</p>
      )}

      <h2 className="section-title">Data</h2>
      <div className="group">
        <button type="button" className="row nav-row" onClick={() => exportBackup()}>
          <span className="row-title tint">Exportera backup</span>
        </button>
        <button type="button" className="row nav-row" onClick={() => fileRef.current?.click()}>
          <span className="row-title tint">Importera backup</span>
        </button>
        <button
          type="button"
          className="row nav-row"
          onClick={() => {
            if (confirm('Radera all data på den här enheten? Det går inte att ångra.')) resetAll()
          }}
        >
          <span className="row-title danger">Radera all data</span>
        </button>
      </div>
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
      <p className="hint-text">
        Senaste backup: {lastBackupAt ? new Date(lastBackupAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' }) : 'aldrig'}. Allt sparas bara på den här
        telefonen. <strong>Ta aldrig bort Hundra från hemskärmen utan att först exportera en backup</strong> – då raderar iPhone all data.
      </p>

      {!isStandalone() && (
        <section className="card tip-card">
          <div className="tip-title">Lägg Hundra på hemskärmen</div>
          <p className="muted small">
            Där öppnas appen i helskärm och fungerar offline. Safari kan annars radera data för sidor du inte besökt på 7 dagar. Appen på hemskärmen har
            egen lagring, så ta med dig det du loggat:
          </p>
          <ol className="tip-steps small">
            <li>Exportera en backup här i Safari.</li>
            <li>Tryck på dela-knappen och välj <strong>Lägg till på hemskärmen</strong>.</li>
            <li>Öppna appen från hemskärmen och välj <strong>Återställ från backup</strong>.</li>
          </ol>
          <button type="button" className="secondary-btn" onClick={() => exportBackup()}>
            Exportera backup
          </button>
        </section>
      )}

      {import.meta.env.DEV && (
        <div className="group">
          <button
            type="button"
            className="row nav-row"
            onClick={() => {
              const s = useStore.getState()
              s.importData({ ...s, entries: [...s.entries.filter((e) => e.date >= todayKey()), ...demoEntries(todayKey(), s.budgetHistory)] })
              showToast('60 dagars testdata tillagd')
            }}
          >
            <span className="row-title tint">Fyll på med testdata (utveckling)</span>
          </button>
        </div>
      )}

      <h2 className="section-title">Om Hundra</h2>
      <section className="card about-card">
        <p className="muted small">
          Hundra är ett enkelt sätt att följa vad du äter utan att väga. Värdena är ungefärliga – det är snittet över tid som räknas. Appen ersätter inte
          råd från vården. Är du gravid, ammar, är under 18 eller har eller har haft en ätstörning: prata med vården innan du börjar räkna.
        </p>
        <p className="muted small">All data stannar på din telefon. Ingenting skickas någonstans.</p>
      </section>
      <div className="group feedback-group">
        <a className="row nav-row" href={feedbackLink()}>
          <span className="row-title tint">Skicka feedback</span>
          <ChevronRight size={16} className="row-chevron" />
        </a>
      </div>
      <p className="hint-text">Öppnar din mejlapp. Berätta gärna vad som saknas eller krånglar.</p>
      <p className="footer-text">
        Hundra · version {__APP_VERSION__} · {__BUILD_DATE__}
      </p>
      {startup && <p className="footer-text startup-text">{startup}</p>}

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Mina uppgifter"
        label="Ändra uppgifter"
        left={
          <button type="button" className="bar-btn" onClick={() => setEditing(false)}>
            Avbryt
          </button>
        }
        right={
          <button
            type="button"
            className="bar-btn bar-btn-strong"
            disabled={!draft}
            onClick={() => {
              if (!draft) return
              setProfile(draft, { fromStart })
              setEditing(false)
              setFromStart(false)
              showToast(fromStart ? 'Uppgifterna sparade och tidigare dagar räknade om' : 'Uppgifterna sparade')
            }}
          >
            Spara
          </button>
        }
      >
        <div className="form">
          <AboutFields form={form} onChange={setForm} />
          <h3 className="section-title">Aktivitet</h3>
          <ActivityPicker form={form} onChange={setForm} />
          <label className="toggle-row group">
            <span className="row-text">
              <span className="row-title">Rätta även tidigare dagar</span>
              <span className="row-sub">Använd om något var fel från början, t.ex. aktivitetsnivån. Annars gäller ändringen från idag.</span>
            </span>
            <input type="checkbox" className="switch" checked={fromStart} onChange={(e) => setFromStart(e.target.checked)} />
          </label>
        </div>
      </Sheet>

      <Sheet
        open={editFood !== null}
        onClose={() => setEditFood(null)}
        title="Ändra vara"
        label="Ändra vara"
        left={
          <button type="button" className="bar-btn" onClick={() => setEditFood(null)}>
            Avbryt
          </button>
        }
      >
        {editFood && (
          <CustomFoodForm
            key={editFood.id}
            budgetKcal={budget}
            initial={editFood}
            submitLabel="Spara"
            onSubmit={(f) => {
              updateCustomFood(editFood.id, f)
              setEditFood(null)
              showToast('Varan sparad')
            }}
            onDelete={() => {
              if (!confirm(`Ta bort ${editFood.name}? Redan loggade rader finns kvar.`)) return
              deleteCustomFood(editFood.id)
              setEditFood(null)
            }}
          />
        )}
      </Sheet>
      <MealSheet source={editMeal ? { meal: editMeal } : null} budgetKcal={budget} onClose={() => setEditMeal(null)} />
    </main>
  )
}

const FEEDBACK_EMAIL = 'jack.katzler@gmail.com'

/** Mejl med version och telefon ifyllt, så att det går att förstå felet. Inga loggdata skickas med. */
function feedbackLink(): string {
  const device = navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? navigator.userAgent
  const body = `\n\n\n---\nHundra ${__APP_VERSION__} (${__BUILD_DATE__})\n${device}`
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Feedback på Hundra')}&body=${encodeURIComponent(body)}`
}
