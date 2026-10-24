import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatQty } from '../lib/calc'
import { haptic } from '../store/ui'
import { MinusIcon, PlusIcon } from './icons'

type Props = { value: number; onChange: (v: number) => void; label: string }

const AMOUNTS = [0.5, 1, 1.5, 2, 3]
const MENU_HEIGHT = 46

/**
 * − 3 + som i en webbshop. Att gå under 1 betyder att raden tas bort.
 * Ett tryck på siffran visar snabbval för halva portioner: ½ · 1 · 1½ · 2 · 3.
 */
export function Stepper({ value, onChange, label }: Props) {
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: Event) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setMenu(null)
    }
    const closeNow = () => setMenu(null)
    document.addEventListener('pointerdown', close)
    // Menyn ligger fast på skärmen, så den stängs om något scrollar.
    window.addEventListener('scroll', closeNow, true)
    window.addEventListener('resize', closeNow)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', closeNow, true)
      window.removeEventListener('resize', closeNow)
    }
  }, [menu])

  const toggleMenu = () => {
    if (menu || !ref.current) return setMenu(null)
    // Listorna klipper allt utanför raderna, så menyn ritas ovanpå allt annat (i body) med fast position.
    const r = ref.current.getBoundingClientRect()
    const above = r.top - MENU_HEIGHT - 6
    setMenu({ top: above > 60 ? above : r.bottom + 6, right: window.innerWidth - r.right })
  }

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
        aria-expanded={menu !== null}
        onClick={toggleMenu}
      >
        {formatQty(value)}
      </button>
      <button type="button" className="stepper-btn" onClick={() => step(1)} aria-label={`En ${label} till`}>
        <PlusIcon size={16} />
      </button>
      {menu &&
        createPortal(
          <div className="amounts" role="listbox" aria-label={`Antal ${label}`} ref={menuRef} style={{ top: menu.top, right: menu.right }}>
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
                  setMenu(null)
                }}
              >
                {formatQty(a)}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
