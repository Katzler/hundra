import { useRef, useState } from 'react'
import { CustomFoodForm } from '../components/CustomFoodForm'
import { ChevronRight } from '../components/icons'
import { AboutFields, ActivityPicker, formFromProfile, toProfile } from '../components/ProfileFields'
import { Sheet } from '../components/Sheet'
import type { Food } from '../data/foods'
import { ACTIVITY, budgetFor, formatInt, formatPoints, kcalPerPoint, toPoints } from '../lib/calc'
import { todayKey } from '../lib/dates'
import { demoEntries } from '../lib/demo'
import { isStandalone } from '../lib/hooks'
import { useUI } from '../store/ui'
import { exportData, parseImport, useStore } from '../store/useStore'

export function Profile() {
  const profile = useStore((s) => s.profile)!
  const history = useStore((s) => s.budgetHistory)
  const custom = useStore((s) => s.customFoods)
  const setProfile = useStore((s) => s.setProfile)
  const updateCustomFood = useStore((s) => s.updateCustomFood)
  const deleteCustomFood = useStore((s) => s.deleteCustomFood)
  const importData = useStore((s) => s.importData)
  const resetAll = useStore((s) => s.resetAll)
  const showToast = useUI((s) => s.showToast)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => formFromProfile(profile))
  const [editFood, setEditFood] = useState<Food | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const budget = budgetFor(todayKey(), history)
  const draft = toProfile(form)

  const doExport = async () => {
    const text = exportData(useStore.getState())
    const name = `hundra-${todayKey()}.json`
    const file = new File([text], name, { type: 'application/json' })
    // På mobilen är dela-menyn smidigast (spara i Filer, skicka till sig själv osv.).
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Hundra backup' })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const doImport = async (file: File) => {
    try {
      const data = parseImport(await file.text())
      if (!confirm(`Ersätta all data på den här enheten med ${data.entries.length} rader från filen?`)) return
      importData(data)
      showToast('Data importerad')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <main className="screen profile">
      <header className="page-header">
        <span className="large-title">Profil</span>
      </header>

      <section className="card day-card">
        <div className="day-card-big">
          100 poäng <span className="muted">≈ {formatInt(budget)} kcal</span>
        </div>
        <div className="muted small">1 poäng ≈ {formatInt(kcalPerPoint(budget))} kcal</div>
      </section>

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
      <p className="hint-text">Uppdatera vikten då och då. Gamla dagar räknas fortfarande mot det som gällde då.</p>

      <h2 className="section-title">Mina varor</h2>
      {custom.length > 0 ? (
        <div className="group">
          {custom.map((f) => (
            <button key={f.id} type="button" className="row nav-row" onClick={() => setEditFood(f)}>
              <span className="emoji" aria-hidden>
                {f.emoji}
              </span>
              <span className="row-text">
                <span className="row-title">{f.name}</span>
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
        <button type="button" className="row nav-row" onClick={doExport}>
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
          if (f) doImport(f)
          e.target.value = ''
        }}
      />
      <p className="hint-text">Allt sparas bara på den här enheten. Exportera en backup ibland.</p>

      {!isStandalone() && (
        <section className="card tip-card">
          <div className="tip-title">Lägg Hundra på hemskärmen</div>
          <p className="muted small">
            I Safari: tryck på dela-knappen och välj <strong>Lägg till på hemskärmen</strong>. Då öppnas appen i helskärm, fungerar offline och din data
            sparas säkrare. Safari kan annars radera data för sidor du inte besökt på 7 dagar.
          </p>
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

      <p className="footer-text">Hundra · version 0.1</p>

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
              setProfile(draft)
              setEditing(false)
              showToast('Uppgifterna sparade')
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
        </div>
      </Sheet>

      <Sheet open={editFood !== null} onClose={() => setEditFood(null)} title="Ändra vara" label="Ändra vara">
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
    </main>
  )
}
