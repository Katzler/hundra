import { useEffect, useState } from 'react'
import { todayKey } from '../lib/dates'
import { haptic } from '../store/ui'
import { MinusIcon, PlusIcon } from './icons'
import { Sheet } from './Sheet'

type Props = { open: boolean; lastKg: number | null; onSave: (kg: number) => void; onClose: () => void }

/** Väg in när du vill – ett fält förifyllt med senaste vikten och knappar för ±0,1. */
export function WeightSheet({ open, lastKg, onSave, onClose }: Props) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) setText(lastKg ? lastKg.toFixed(1).replace('.', ',') : '')
  }, [open, lastKg])

  const kg = Number(text.replace(',', '.'))
  const valid = Number.isFinite(kg) && kg >= 30 && kg <= 300
  const step = (d: number) => {
    haptic()
    const base = valid ? kg : (lastKg ?? 70)
    setText((Math.round((base + d) * 10) / 10).toFixed(1).replace('.', ','))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Väg in"
      title="Väg in"
      left={
        <button type="button" className="bar-btn" onClick={onClose}>
          Avbryt
        </button>
      }
      right={
        <button type="button" className="bar-btn bar-btn-strong" disabled={!valid} onClick={() => onSave(Math.round(kg * 10) / 10)}>
          Spara
        </button>
      }
    >
      <div className="form">
        <div className="group points-picker">
          <span className="field-label">Vikt idag ({todayKey().slice(5).replace('-', '/')})</span>
          <div className="points-control">
            <button type="button" className="round-btn" onClick={() => step(-0.1)} aria-label="0,1 kg mindre">
              <MinusIcon />
            </button>
            <input
              className="points-input weight-input"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^0-9,.]/g, ''))}
              inputMode="decimal"
              aria-label="Vikt i kg"
              placeholder="0,0"
            />
            <button type="button" className="round-btn" onClick={() => step(0.1)} aria-label="0,1 kg mer">
              <PlusIcon />
            </button>
          </div>
          <span className="field-label">kg</span>
        </div>
        <p className="hint-text">
          Väg dig gärna på morgonen, men så ofta eller sällan du vill. Appen visar en utjämnad trend, så att dagliga hopp i vätska inte spelar någon roll.
        </p>
      </div>
    </Sheet>
  )
}
