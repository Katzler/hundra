import { useState } from 'react'
import { exportBackup } from '../lib/backup'
import { useUI } from '../store/ui'
import { STORAGE_KEY, useStore } from '../store/useStore'

/** Det som faktiskt ligger sparat på telefonen, oavsett om appen lyckats läsa in det. */
export function storedSummary(): { entries: number; profile: boolean; version: number | null } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const state = parsed?.state ?? {}
    const entries = Array.isArray(state.entries) ? state.entries.length : 0
    const profile = !!state.profile
    return entries > 0 || profile ? { entries, profile, version: typeof parsed.version === 'number' ? parsed.version : null } : null
  } catch {
    return { entries: 0, profile: false, version: null }
  }
}

/**
 * Visas i introt om det finns sparad data som appen inte kunde läsa in. Då ska man inte fylla i
 * introt igen – i stället kan man försöka läsa in på nytt eller spara datan som backup.
 */
export function RecoveryCard() {
  const error = useUI((s) => s.hydrationError)
  const [summary] = useState(storedSummary)
  if (!summary) return null

  const saveRaw = () => {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '{}'
    let data: unknown = {}
    try {
      data = JSON.parse(raw).state
    } catch {
      data = { raw }
    }
    exportBackup(JSON.stringify({ app: 'hundra', version: 1, exportedAt: new Date().toISOString(), data }, null, 2))
  }

  return (
    <section className="card recovery-card" role="alert">
      <div className="tip-title">Din data finns kvar</div>
      <p className="small">
        Det finns sparad data på telefonen ({summary.entries} loggade rader{summary.profile ? ' och din profil' : ''}), men appen kunde inte läsa in den.{' '}
        <strong>Fyll inte i introt</strong> – försök läsa in igen, eller spara datan som backup.
      </p>
      <div className="backup-actions">
        <button
          type="button"
          className="secondary-btn"
          onClick={async () => {
            await useStore.persist.rehydrate()
            if (!useStore.getState().profile) location.reload()
          }}
        >
          Försök igen
        </button>
        <button type="button" className="link-btn" onClick={saveRaw}>
          Spara backup
        </button>
      </div>
      <p className="hint-text recovery-detail">
        Version {__APP_VERSION__}
        {summary.version !== null ? ` · dataformat ${summary.version}` : ''}
        {error ? ` · ${error}` : ''}
      </p>
    </section>
  )
}
