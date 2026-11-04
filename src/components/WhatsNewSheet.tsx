import { useStore } from '../store/useStore'
import { useUI } from '../store/ui'
import { BarcodeIcon } from './icons'
import { Sheet } from './Sheet'

type Props = { open: boolean; onClose: () => void }

/** Tre ringar i näringsfärgerna, som innanför poängen på Idag. */
function MacroRingsIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 30 30" fill="none" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <circle cx="15" cy="15" r="12.5" className="news-ring protein" strokeDasharray="60 100" transform="rotate(-90 15 15)" />
      <circle cx="15" cy="15" r="8.5" className="news-ring fat" strokeDasharray="34 100" transform="rotate(-90 15 15)" />
      <circle cx="15" cy="15" r="4.5" className="news-ring carbs" strokeDasharray="21 100" transform="rotate(-90 15 15)" />
    </svg>
  )
}

/** Ark som presenterar nyheterna efter en uppdatering, i stil med "Nytt i" i Apples egna appar. */
export function WhatsNewSheet({ open, onClose }: Props) {
  const showMacros = useStore((s) => s.showMacros)
  const setShowMacros = useStore((s) => s.setShowMacros)

  const turnOnMacros = () => {
    setShowMacros(true)
    onClose()
    useUI.getState().showToast('Näringen visas nu i ringen')
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title=""
      label="Nytt i Hundra"
      compact
      footer={
        <div className="news-footer">
          <button type="button" className="primary-btn" onClick={onClose}>
            Fortsätt
          </button>
          {!showMacros && (
            <button type="button" className="link-btn news-link" onClick={turnOnMacros}>
              Slå på näring direkt
            </button>
          )}
        </div>
      }
    >
      <h1 className="news-title">
        Nytt i <span className="news-brand">Hundra</span>
      </h1>
      <ul className="news-list">
        <li className="news-item" style={{ animationDelay: '0.12s' }}>
          <span className="news-icon news-icon-macros">
            <MacroRingsIcon />
          </span>
          <span className="news-text">
            <span className="news-item-title">Protein, fett och kolhydrater</span>
            <span className="news-item-sub">
              Tunna ringar innanför poängen visar hur nära du är dagens mål. Följ alla tre eller bara det du bryr dig om. Slås på i
              Profil.
            </span>
          </span>
        </li>
        <li className="news-item" style={{ animationDelay: '0.22s' }}>
          <span className="news-icon news-icon-scan">
            <BarcodeIcon size={28} />
          </span>
          <span className="news-text">
            <span className="news-item-title">Skanna streckkoder</span>
            <span className="news-item-sub">
              Tryck på streckkoden i sökfältet och håll kameran mot förpackningen. Varan sparas bland dina egna, så nästa gång finns
              den direkt.
            </span>
          </span>
        </li>
      </ul>
    </Sheet>
  )
}
