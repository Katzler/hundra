// Datum hanteras som lokala nycklar "YYYY-MM-DD" så att en dag alltid är
// användarens egen dag, oavsett tidszon.

export type DateKey = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayKey(): DateKey {
  return toKey(new Date())
}

/** Lokal middag den dagen – undviker problem kring sommartid. */
export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** De n senaste dagarna fram till och med `end`, äldst först. */
export function lastNDays(end: DateKey, n: number): DateKey[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)))
}

const weekday = new Intl.DateTimeFormat('sv-SE', { weekday: 'long' })
const dayMonth = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long' })
const shortWeekday = new Intl.DateTimeFormat('sv-SE', { weekday: 'short' })

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Idag", "Igår" eller "Måndag". */
export function dayTitle(key: DateKey, today: DateKey = todayKey()): string {
  if (key === today) return 'Idag'
  if (key === addDays(today, -1)) return 'Igår'
  return capitalize(weekday.format(fromKey(key)))
}

/** "fredag 24 oktober" */
export function dayLong(key: DateKey): string {
  const d = fromKey(key)
  return `${weekday.format(d)} ${dayMonth.format(d)}`
}

/** "M", "T", "O" … för diagramaxlar. */
export function weekdayLetter(key: DateKey): string {
  return shortWeekday.format(fromKey(key)).charAt(0).toUpperCase()
}

export function dayOfMonth(key: DateKey): number {
  return fromKey(key).getDate()
}

/** En dag man bläddrat till, och vilken dag det var när man gjorde det. */
export type PickedDay = { date: DateKey; on: DateKey }

/** Den dag som visas. Ett val gäller bara samma kalenderdag – nästa morgon börjar appen på idag igen. */
export function resolveDay(picked: PickedDay | null, today: DateKey): DateKey {
  return picked && picked.on === today && picked.date < today ? picked.date : today
}
