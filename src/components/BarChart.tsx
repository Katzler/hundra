import { useState } from 'react'
import type { DayStat } from '../lib/calc'
import { dayLong, dayOfMonth, weekdayLetter } from '../lib/dates'

type Props = { days: DayStat[]; avg: number | null }

const W = 340
const H = 190
const PAD_TOP = 22
const PAD_BOTTOM = 22
const PAD_RIGHT = 30

/** Staplar per dag med en streckad linje vid 100. Tryck och dra för att se en dag. */
export function BarChart({ days, avg }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const n = days.length
  const max = Math.max(130, ...days.map((d) => d.points ?? 0)) * 1.05
  const plotW = W - PAD_RIGHT
  const plotH = H - PAD_TOP - PAD_BOTTOM
  const slot = plotW / n
  const barW = Math.max(2, slot * (n <= 7 ? 0.56 : n <= 30 ? 0.64 : 0.7))
  const y = (v: number) => PAD_TOP + plotH * (1 - v / max)
  const labelEvery = n <= 7 ? 1 : n <= 30 ? 5 : 15

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.floor(px / slot)
    setActive(i >= 0 && i < n ? i : null)
  }

  const sel = active !== null ? days[active] : null

  return (
    <div className="chart">
      <div className="chart-readout" aria-live="polite">
        {sel ? (
          <>
            <span className="chart-readout-value">{sel.points === null ? '–' : Math.round(sel.points)}</span>
            <span className="chart-readout-date">{dayLong(sel.date)}</span>
          </>
        ) : (
          <span className="chart-readout-date">Tryck på en stapel för att se dagen</span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label="Poäng per dag"
        onPointerDown={pick}
        onPointerMove={(e) => e.buttons && pick(e)}
        // Vid touch kommer pointerleave direkt efter att fingret lyfts, så då ligger valet kvar.
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
      >
        <line x1={0} x2={plotW} y1={y(0)} y2={y(0)} className="chart-axis" />
        {days.map((d, i) => {
          const cx = slot * i + slot / 2
          if (d.points === null) {
            return <circle key={d.date} cx={cx} cy={y(0) - 3} r={Math.min(2, barW / 2)} className="chart-empty" />
          }
          const h = Math.max(2, y(0) - y(d.points))
          return (
            <rect
              key={d.date}
              x={cx - barW / 2}
              y={y(0) - h}
              width={barW}
              height={h}
              rx={Math.min(4, barW / 2)}
              className={`chart-bar ${d.points > 100 ? 'is-over' : ''} ${active === i ? 'is-active' : ''} ${
                active !== null && active !== i ? 'is-dim' : ''
              }`}
            />
          )
        })}
        <line x1={0} x2={plotW} y1={y(100)} y2={y(100)} className="chart-goal" />
        <text x={plotW + 4} y={y(100) + 4} className="chart-goal-label">
          100
        </text>
        {avg !== null && (
          <>
            <line x1={0} x2={plotW} y1={y(avg)} y2={y(avg)} className="chart-avg" />
            <text x={plotW + 4} y={y(avg) + (Math.abs(avg - 100) < 9 ? (avg < 100 ? 14 : -6) : 4)} className="chart-avg-label">
              snitt
            </text>
          </>
        )}
        {days.map((d, i) =>
          (n - 1 - i) % labelEvery === 0 ? (
            <text key={d.date} x={slot * i + slot / 2} y={H - 6} className="chart-x" textAnchor="middle">
              {n <= 7 ? weekdayLetter(d.date) : dayOfMonth(d.date)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}
