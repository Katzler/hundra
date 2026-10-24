import { create } from 'zustand'

export type Toast = { id: number; text: string; action?: { label: string; run: () => void } }

type UI = {
  toast: Toast | null
  /** Felet om sparad data inte gick att läsa in när appen startade. */
  hydrationError: string | null
  showToast: (text: string, action?: Toast['action']) => void
  hideToast: () => void
  /** Pausar nedräkningen medan man har fingret eller fokus på rutan, så att Ångra hinns med. */
  pauseToast: () => void
  resumeToast: () => void
}

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

export const useUI = create<UI>()((set, get) => {
  const schedule = (id: number, ms: number) => {
    clearTimeout(timer)
    timer = setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), ms)
  }
  return {
    toast: null,
    hydrationError: null,
    showToast: (text, action) => {
      const id = ++seq
      set({ toast: { id, text, action } })
      schedule(id, action ? 6000 : 2200)
    },
    hideToast: () => set({ toast: null }),
    pauseToast: () => clearTimeout(timer),
    resumeToast: () => {
      const t = get().toast
      if (t) schedule(t.id, 3000)
    },
  }
})

/** Kort vibration där det stöds (Android). iOS Safari ignorerar det. */
export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // ignoreras
  }
}
