import { useEffect, useRef, useState } from 'react'
import { formatQty } from '../lib/calc'
import { haptic } from '../store/ui'
import { MinusIcon, PlusIcon } from './icons'

type Props = { value: number; onChange: (v: number) => void; label: string }

const AMOUNTS = [0.5, 1, 1.5, 2, 3]

/**
 * − 3 + som i en webbshop. Att gå under 1 betyder att raden tas bort.
 * Ett tryck på siffran visar snabbval för halva portioner: ½ · 1 · 1½ · 2 · 3.
 */
export function Stepper({ value, onChange, label }: Props) {
  const [choosing, setChoosing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!choosing) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setChoosing(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [choosing])

  const step = (d: number) => {
    haptic()
    onChange(value + d)
  }

  return (
    <div className="stepper" role="group" aria-label={`Antal ${label}`} ref={ref}>
      <button type="button" className="stepper-btn" onClick={() => step(-1)} aria-label={`En ${label} mindre`}>
        <MinusIcon size={16} />
      </button>
      <button
        type="button"
        className="stepper-value"
        aria-live="polite"
        aria-label={`${formatQty(value)} st, välj antal`}
        aria-expanded={choosing}
        onClick={() => setChoosing(!choosing)}
      >
        {formatQty(value)}
      </button>
      <button type="button" className="stepper-btn" onClick={() => step(1)} aria-label={`En ${label} till`}>
        <PlusIcon size={16} />
      </button>
      {choosing && (
        <div className="amounts" role="listbox" aria-label="Antal">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              role="option"
              aria-selected={a === value}
              className={`amount ${a === value ? 'is-active' : ''}`}
              onClick={() => {
                haptic()
                onChange(a)
                setChoosing(false)
              }}
            >
              {formatQty(a)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
