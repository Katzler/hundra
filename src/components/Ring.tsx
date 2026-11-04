import { MACRO_NAMES, type Macros } from '../lib/calc'
import { useAnimatedNumber } from '../lib/hooks'

/** Dagens näring mot målen i gram. */
export type RingMacros = { value: Macros; target: Macros }

type Props = { value: number; size?: number; stroke?: number; caption?: string; goal?: number; macros?: RingMacros | null }

/** Klasserna som ger varje näringsring sin färg, i samma ordning som Macros. */
export const MACRO_CLASSES = ['macro-protein', 'macro-fat', 'macro-carbs'] as const

const MACRO_STROKE = 7
const MACRO_GAP = 3

/**
 * Aktivitetsring: ett varv är 100 poäng. Över 100 fortsätter ett andra varv i --accent-deep.
 * Med näring på ligger tre tunna ringar innanför, protein ytterst, och var och en fylls mot sitt mål.
 */
export function Ring({ value, size = 220, stroke = 24, caption = 'av 100', goal = 100, macros }: Props) {
  const animated = useAnimatedNumber(value)
  // Krokarna anropas alltid, även när näringen är av.
  const fractions = [0, 1, 2].map((i) => (macros && macros.target[i] > 0 ? macros.value[i] / macros.target[i] : 0))
  const animatedMacros = [useAnimatedNumber(fractions[0]), useAnimatedNumber(fractions[1]), useAnimatedNumber(fractions[2])]
  const r = (size - stroke) / 2
  const center = size / 2

  const arc = (radius: number, width: number, fraction: number, color: string, extra?: string) => {
    const c = 2 * Math.PI * radius
    return (
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - fraction)}
        // Tonar in under första procenten så att ringen inte visar en prick vid 0.
        opacity={Math.min(1, fraction * 100)}
        className={extra}
      />
    )
  }

  /** Ett varv och, över 100 %, ett andra varv i en mörkare ton. */
  const laps = (radius: number, width: number, fraction: number, colors: [string, string, string], overflowClass: string) => {
    const first = Math.min(Math.max(fraction, 0), 1)
    const second = Math.min(Math.max(fraction - 1, 0), 1)
    return (
      <>
        <circle cx={center} cy={center} r={radius} fill="none" stroke={colors[2]} strokeWidth={width} />
        {arc(radius, width, first, colors[0])}
        {second > 0 && arc(radius, width, second, colors[1], overflowClass)}
      </>
    )
  }

  const macroLabel = macros
    ? ', ' + MACRO_NAMES.map((name, i) => `${name.toLowerCase()} ${Math.round(macros.value[i])} av ${macros.target[i]} gram`).join(', ')
    : ''

  return (
    <div
      className={`ring ${macros ? 'has-macros' : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(value)} av 100 poäng${goal < 100 ? `, mål ${goal}` : ''}${macroLabel}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${center} ${center})`}>
          {laps(r, stroke, animated / 100, ['var(--accent)', 'var(--accent-deep)', 'var(--accent-soft)'], 'ring-overflow')}
          {goal < 100 && (
            // Målet som ett litet streck tvärs över ringen.
            <line
              x1={center + (r - stroke / 2 - 3) * Math.cos((goal / 100) * 2 * Math.PI)}
              y1={center + (r - stroke / 2 - 3) * Math.sin((goal / 100) * 2 * Math.PI)}
              x2={center + (r + stroke / 2 + 3) * Math.cos((goal / 100) * 2 * Math.PI)}
              y2={center + (r + stroke / 2 + 3) * Math.sin((goal / 100) * 2 * Math.PI)}
              className="ring-goal"
            />
          )}
          {macros &&
            MACRO_CLASSES.map((cls, i) => (
              <g key={cls} className={cls}>
                {laps(
                  r - stroke / 2 - MACRO_GAP - MACRO_STROKE / 2 - i * (MACRO_STROKE + MACRO_GAP),
                  MACRO_STROKE,
                  animatedMacros[i],
                  ['var(--c)', 'var(--c-deep)', 'var(--c-soft)'],
                  'macro-overflow',
                )}
              </g>
            ))}
        </g>
      </svg>
      <div className="ring-center">
        <div className="ring-value">{Math.round(animated)}</div>
        <div className="ring-caption">{caption}</div>
      </div>
    </div>
  )
}

/** Förklaringen under ringen: gram mot målet för varje ring, och det som saknar näringsvärden. */
export function MacroLegend({ macros, unknown }: { macros: RingMacros; unknown?: string }) {
  return (
    <div className="macro-legend">
      <div className="macro-items">
        {MACRO_NAMES.map((name, i) => (
          <div key={name} className={`macro-item ${MACRO_CLASSES[i]}`}>
            <span className="macro-label">
              <span className="macro-dot" aria-hidden />
              {name}
            </span>
            <span className="macro-value">
              <strong>{Math.round(macros.value[i])}</strong> / {macros.target[i]} g
            </span>
          </div>
        ))}
      </div>
      {unknown && <p className="macro-unknown">{unknown}</p>}
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
