import type { WeightPoint } from '../lib/calc'
import { dayLong, dayOfMonth } from '../lib/dates'

const W = 340
const H = 150
const PAD = 18
const PAD_RIGHT = 34

/** Vikten som prickar och den utjämnade trenden som en lugn linje. */
export function WeightChart({ points }: { points: WeightPoint[] }) {
  if (points.length < 2) return null
  const values = points.flatMap((p) => (p.kg === null ? [p.trend] : [p.kg, p.trend]))
  const lo = Math.floor(Math.min(...values) - 0.5)
  const hi = Math.ceil(Math.max(...values) + 0.5)
  const plotW = W - PAD_RIGHT
  const x = (i: number) => (i / (points.length - 1)) * plotW
  const y = (kg: number) => PAD + (H - PAD * 2) * (1 - (kg - lo) / (hi - lo))
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.trend).toFixed(1)}`).join('')
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="chart-svg weight-chart"
      role="img"
      aria-label={`Vikttrend från ${first.trend.toFixed(1)} kg ${dayLong(first.date)} till ${last.trend.toFixed(1)} kg ${dayLong(last.date)}.`}
    >
      {[hi, (hi + lo) / 2, lo].map((v) => (
        <g key={v}>
          <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} className="chart-axis" />
          <text x={plotW + 4} y={y(v) + 4} className="chart-goal-label">
            {String(Math.round(v * 10) / 10).replace('.', ',')}
          </text>
        </g>
      ))}
      {points.map((p, i) => (p.kg === null ? null : <circle key={p.date} cx={x(i)} cy={y(p.kg)} r={2.6} className="weight-dot" />))}
      <path d={path} className="weight-trend" />
      <text x={0} y={H - 2} className="chart-x">
        {dayOfMonth(first.date)}/{Number(first.date.slice(5, 7))}
      </text>
      <text x={plotW} y={H - 2} className="chart-x" textAnchor="end">
        {dayOfMonth(last.date)}/{Number(last.date.slice(5, 7))}
      </text>
    </svg>
  )
}
