import type { Average } from '../lib/calc'
import { weekdayLetter } from '../lib/dates'
import { ChevronRight } from './icons'

type Props = { week: Average; goal: number; onOpen: () => void }

/** Snittet för de senaste sju hela dagarna, där man tittar varje dag. Ett tryck öppnar Trend. */
export function WeekStrip({ week, goal, onOpen }: Props) {
  const max = Math.max(130, ...week.days.map((d) => d.points ?? 0))
  return (
    <button type="button" className="week-strip" onClick={onOpen} aria-label={`Snitt senaste 7 dagarna ${Math.round(week.avg ?? 0)}. Öppna Trend.`}>
      <span className="week-text">
        <span className="week-label">7 dagar</span>
        <span className="week-avg">
          Snitt <strong>{Math.round(week.avg ?? 0)}</strong>
          {goal < 100 && <span className="week-goal"> · mål {goal}</span>}
        </span>
      </span>
      <span className="week-bars" aria-hidden>
        {week.days.map((d) => (
          <span key={d.date} className="week-bar">
            <span
              className={`week-fill ${d.points === null || d.excluded ? 'is-empty' : d.points > 100 ? 'is-over' : ''}`}
              style={{ height: d.points === null || d.excluded ? 3 : `${Math.max(8, (d.points / max) * 100)}%` }}
            />
            <span className="week-day">{weekdayLetter(d.date)}</span>
          </span>
        ))}
      </span>
      <ChevronRight size={16} className="row-chevron" />
    </button>
  )
}
