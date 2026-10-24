import { haptic } from '../store/ui'
import { MinusIcon, PlusIcon } from './icons'

type Props = { value: number; onChange: (v: number) => void; label: string }

/** − 3 + som i en webbshop. Att gå under 1 betyder att raden tas bort. */
export function Stepper({ value, onChange, label }: Props) {
  const step = (d: number) => {
    haptic()
    onChange(value + d)
  }
  return (
    <div className="stepper" role="group" aria-label={`Antal ${label}`}>
      <button type="button" className="stepper-btn" onClick={() => step(-1)} aria-label={`En ${label} mindre`}>
        <MinusIcon size={16} />
      </button>
      <span className="stepper-value" aria-live="polite">
        {value}
      </span>
      <button type="button" className="stepper-btn" onClick={() => step(1)} aria-label={`En ${label} till`}>
        <PlusIcon size={16} />
      </button>
    </div>
  )
}
