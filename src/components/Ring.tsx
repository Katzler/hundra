import { useAnimatedNumber } from '../lib/hooks'

type Props = { value: number; size?: number; stroke?: number; caption?: string; goal?: number }

/** Aktivitetsring: ett varv är 100 poäng. Över 100 fortsätter ett andra varv i mörkare grönt. */
export function Ring({ value, size = 220, stroke = 24, caption = 'av 100', goal = 100 }: Props) {
  const animated = useAnimatedNumber(value)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const first = Math.min(Math.max(animated, 0), 100) / 100
  const second = Math.min(Math.max(animated - 100, 0), 100) / 100

  const arc = (fraction: number, color: string, extra?: string) => (
    <circle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeDasharray={`${c} ${c}`}
      strokeDashoffset={c * (1 - fraction)}
      // Tonar in under första poängen så att ringen inte visar en prick vid 0.
      opacity={Math.min(1, fraction * 100)}
      className={extra}
    />
  )

  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(value)} av 100 poäng${goal < 100 ? `, mål ${goal}` : ''}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-soft)" strokeWidth={stroke} />
          {arc(first, 'var(--accent)')}
          {second > 0 && arc(second, 'var(--accent-deep)', 'ring-overflow')}
          {goal < 100 && (
            // Målet som ett litet streck tvärs över ringen.
            <line
              x1={size / 2 + (r - stroke / 2 - 3) * Math.cos((goal / 100) * 2 * Math.PI)}
              y1={size / 2 + (r - stroke / 2 - 3) * Math.sin((goal / 100) * 2 * Math.PI)}
              x2={size / 2 + (r + stroke / 2 + 3) * Math.cos((goal / 100) * 2 * Math.PI)}
              y2={size / 2 + (r + stroke / 2 + 3) * Math.sin((goal / 100) * 2 * Math.PI)}
              className="ring-goal"
            />
          )}
        </g>
      </svg>
      <div className="ring-center">
        <div className="ring-value">{Math.round(animated)}</div>
        <div className="ring-caption">{caption}</div>
      </div>
    </div>
  )
}

/** Liten, stillastående ring för kalendern och veckoremsan. */
export function MiniRing({ value, size = 30, stroke = 4, muted = false }: { value: number | null; size?: number; stroke?: number; muted?: boolean }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const first = Math.min(Math.max(value ?? 0, 0), 100) / 100
  const second = Math.min(Math.max((value ?? 0) - 100, 0), 100) / 100
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className={muted ? 'mini-ring is-muted' : 'mini-ring'}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-soft)" strokeWidth={stroke} />
        {first > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * first} ${c}`} />
        )}
        {second > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-deep)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * second} ${c}`} />
        )}
      </g>
    </svg>
  )
}
