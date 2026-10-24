import { useUI } from '../store/ui'
import { exportData, parseImport, useStore, type Data } from '../store/useStore'
import { todayKey } from './dates'

const BEFORE_IMPORT_KEY = 'hundra-fore-import'

/** Delar eller laddar ner en backup av all data. På mobilen är dela-menyn smidigast. */
export async function exportBackup(text = exportData(useStore.getState())): Promise<void> {
  const name = `hundra-${todayKey()}.json`
  const file = new File([text], name, { type: 'application/json' })
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

/**
 * Läser in en backup och ersätter all data. Det som fanns innan sparas först, så att importen
 * kan ångras. Returnerar false om användaren avbröt eller filen inte gick att läsa.
 */
export async function importBackup(file: File): Promise<boolean> {
  let data: Data & { dropped: number }
  try {
    data = parseImport(await file.text())
  } catch (e) {
    alert((e as Error).message)
    return false
  }
  const { dropped, ...clean } = data
  const current = useStore.getState()
  const hasData = current.entries.length > 0 || current.profile !== null
  const skipped = dropped ? ` ${dropped} trasiga rader hoppas över.` : ''
  if (hasData && !confirm(`Ersätta all data på den här enheten med ${clean.entries.length} rader från filen?${skipped}`)) return false

  const before = exportData(current)
  try {
    localStorage.setItem(BEFORE_IMPORT_KEY, before)
  } catch {
    // Får kopian inte plats är ångra-knappen nedan ändå kvar så länge appen är öppen.
  }
  useStore.getState().importData(clean)
  useUI.getState().showToast(
    `Backup återställd · ${clean.entries.length} rader`,
    hasData ? { label: 'Ångra', run: () => useStore.getState().importData(parseImport(before)) } : undefined,
  )
  return true
}
