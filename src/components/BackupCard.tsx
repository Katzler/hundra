import { exportBackup } from '../lib/backup'
import { useStore } from '../store/useStore'

const DAY = 86_400_000

/** True när det är dags att påminna om backup: minst 14 loggade dagar och ingen backup på 30 dagar. */
export function backupDue(s: { entries: { date: string }[]; lastBackupAt: number | null; backupSnoozedUntil: number | null }, now = Date.now()) {
  if (s.backupSnoozedUntil && s.backupSnoozedUntil > now) return false
  if (s.lastBackupAt && now - s.lastBackupAt < 30 * DAY) return false
  return new Set(s.entries.map((e) => e.date)).size >= 14
}

/** Ett diskret kort – aldrig en dialog – som påminner om att spara en backup. */
export function BackupCard() {
  const snooze = useStore((s) => s.snoozeBackup)
  return (
    <section className="card backup-card" aria-label="Påminnelse om backup">
      <div className="tip-title">Dags för en backup</div>
      <p className="muted small">
        Allt du loggat finns bara på den här telefonen. Tar du bort appen från hemskärmen eller byter telefon försvinner det, om du inte har en backup.
      </p>
      <div className="backup-actions">
        <button type="button" className="secondary-btn" onClick={() => exportBackup()}>
          Exportera backup
        </button>
        <button type="button" className="link-btn" onClick={snooze}>
          Senare
        </button>
      </div>
    </section>
  )
}
