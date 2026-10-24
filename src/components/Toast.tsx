import { useUI } from '../store/ui'

export function Toast() {
  const toast = useUI((s) => s.toast)
  const hide = useUI((s) => s.hideToast)
  const pause = useUI((s) => s.pauseToast)
  const resume = useUI((s) => s.resumeToast)
  return (
    <div className={`toast-wrap ${toast ? 'is-visible' : ''}`} aria-live="polite">
      {toast && (
        <div
          className="toast"
          key={toast.id}
          onPointerEnter={pause}
          onPointerLeave={resume}
          onFocus={pause}
          onBlur={resume}
        >
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action!.run()
                hide()
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
