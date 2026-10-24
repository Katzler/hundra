import { create } from 'zustand'

export type Toast = { id: number; text: string; action?: { label: string; run: () => void } }

type UI = {
  toast: Toast | null
  showToast: (text: string, action?: Toast['action']) => void
  hideToast: () => void
}

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

export const useUI = create<UI>()((set) => ({
  toast: null,
  showToast: (text, action) => {
    clearTimeout(timer)
    const id = ++seq
    set({ toast: { id, text, action } })
    timer = setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), action ? 5000 : 2000)
  },
  hideToast: () => set({ toast: null }),
}))

/** Kort vibration där det stöds (Android). iOS Safari ignorerar det. */
export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // ignoreras
  }
}
