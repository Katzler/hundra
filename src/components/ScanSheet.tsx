import { useEffect, useRef, useState } from 'react'
import { normalizeBarcode } from '../lib/barcode'
import { cropOf, loadReader, readCode, readPhoto } from '../lib/scanner'
import { haptic } from '../store/ui'
import { BoltIcon } from './icons'
import { Sheet } from './Sheet'

type Props = {
  open: boolean
  onClose: () => void
  /** En giltig kod, som EAN-13 eller EAN-8. */
  onCode: (code: string) => void
}

type Status = 'starting' | 'scanning' | 'paused' | 'denied' | 'unavailable' | 'failed'

/** Så här ofta läses en bildruta. Läsningen tar själv en stund, så det blir några gånger i sekunden. */
const INTERVAL = 120
/** Bredare bildrutor än så här gör inte läsningen säkrare, bara långsammare. */
const FRAME_MAX = 1280

const STATUS_TEXT: Record<Exclude<Status, 'scanning'>, string> = {
  starting: 'Startar kameran …',
  paused: 'Kameran är pausad.',
  denied: 'Appen fick inte använda kameran. Ta en bild i stället, eller skriv in siffrorna under streckkoden.',
  unavailable: 'Kameran går inte att starta. Ta en bild i stället, eller skriv in siffrorna under streckkoden.',
  failed: 'Streckkodsläsaren kunde inte laddas. Den behöver nät första gången. Skriv in siffrorna under streckkoden i stället.',
}

type Torch = MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number } }

/** Kameran i ett ark: rikta mot streckkoden så läses den av. Foto och inskriven kod som reserv. */
export function ScanSheet({ open, onClose, onCode }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [status, setStatus] = useState<Status>('starting')
  // Kameran startas om när den här räknas upp, t.ex. efter ett foto som inte gick att läsa.
  const [session, setSession] = useState(0)
  const [torch, setTorch] = useState<boolean | null>(null)
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const [message, setMessage] = useState('')
  const [reading, setReading] = useState(false)
  // Senaste versionerna av funktionerna, så att kameran inte startas om när föräldern ritas om.
  const callbacks = useRef({ onClose, onCode })
  callbacks.current = { onClose, onCode }
  const done = useRef(false)
  const picking = useRef(false)

  const finish = (code: string) => {
    if (done.current) return
    done.current = true
    haptic(20)
    callbacks.current.onCode(code)
  }

  // Allt nollställs när arket öppnas.
  useEffect(() => {
    if (!open) return
    done.current = false
    picking.current = false
    setTyping(false)
    setTyped('')
    setMessage('')
    setReading(false)
  }, [open])

  useEffect(() => {
    if (!open || picking.current) return
    let cancelled = false
    let stream: MediaStream | null = null
    let timer = 0
    let last = ''
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    setStatus('starting')
    setTorch(null)

    const stop = () => {
      cancelled = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      trackRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }

    const tick = async () => {
      if (cancelled) return
      const video = videoRef.current
      const view = viewRef.current
      if (video && view && ctx && video.readyState >= 2 && video.videoWidth > 0) {
        const crop = cropOf({ w: video.videoWidth, h: video.videoHeight }, { w: view.clientWidth, h: view.clientHeight })
        const scale = Math.min(1, FRAME_MAX / crop.w)
        canvas.width = Math.round(crop.w * scale)
        canvas.height = Math.round(crop.h * scale)
        ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height)
        try {
          const code = await readCode(ctx.getImageData(0, 0, canvas.width, canvas.height))
          if (cancelled) return
          // Samma kod två gånger innan den räknas, så att en suddig bildruta aldrig ger fel vara.
          if (code && code === last) {
            stop()
            finish(code)
            return
          }
          if (code) last = code
        } catch {
          // En bildruta som inte gick att läsa hoppas över.
        }
      }
      timer = window.setTimeout(tick, INTERVAL)
    }

    void (async () => {
      // Läsaren laddas medan kameran startar, så att väntan blir kortare.
      const ready = loadReader()
      ready.catch(() => {})
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
      } catch (e) {
        if (!cancelled) setStatus((e as Error).name === 'NotAllowedError' ? 'denied' : 'unavailable')
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play().catch(() => {})
      const track = stream.getVideoTracks()[0]
      trackRef.current = track ?? null
      const caps = track?.getCapabilities?.() as Torch | undefined
      if (caps?.torch) setTorch(false)
      // Huvudkameran på de större iPhone-modellerna ställer inte skärpan på nära håll. Med 2× zoom
      // håller man telefonen en bit ifrån och får ändå en stor, skarp streckkod.
      if (caps?.zoom && caps.zoom.max >= 2) {
        track.applyConstraints({ advanced: [{ zoom: 2 } as MediaTrackConstraintSet] }).catch(() => {})
      }
      try {
        await ready
      } catch {
        if (!cancelled) setStatus('failed')
        return
      }
      if (cancelled) return
      setStatus('scanning')
      void tick()
    })()

    // Kameran stängs när man lämnar appen. Utom när man tar en bild: då lämnar man den en stund.
    const onHide = () => {
      if (document.visibilityState === 'hidden' && !picking.current) callbacks.current.onClose()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [open, session])

  const toggleTorch = () => {
    const track = trackRef.current
    if (!track || torch === null) return
    haptic()
    const on = !torch
    track
      .applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      .then(() => setTorch(on))
      .catch(() => setTorch(null))
  }

  const takePhoto = () => {
    // Kameran släpps medan iPhones vanliga kamera är öppen.
    picking.current = true
    setMessage('')
    fileRef.current?.click()
    setStatus('paused')
    setSession((n) => n + 1)
  }

  const resume = () => {
    picking.current = false
    setMessage('')
    setSession((n) => n + 1)
  }

  const onPhoto = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setReading(true)
    setMessage('Läser bilden …')
    try {
      const code = await readPhoto(file)
      if (code) {
        finish(code)
        return
      }
      setMessage('Hittade ingen streckkod i bilden. Ta en ny bild där streckkoden fyller mer, eller skriv in siffrorna.')
    } catch {
      setMessage(STATUS_TEXT.failed)
    } finally {
      setReading(false)
    }
  }

  const submitTyped = () => {
    const code = normalizeBarcode(typed)
    if (!code) {
      setMessage('Siffrorna stämmer inte med en streckkod. Kontrollera dem och försök igen.')
      return
    }
    finish(code)
  }

  const live = status === 'scanning' || status === 'starting'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Skanna streckkod"
      title="Skanna streckkod"
      left={
        <button type="button" className="bar-btn" onClick={onClose}>
          Avbryt
        </button>
      }
    >
      <div className="scan">
        <div className={`scan-view ${live ? 'is-live' : ''}`} ref={viewRef}>
          <video ref={videoRef} playsInline muted autoPlay aria-hidden />
          <div className="scan-frame" aria-hidden />
          {status !== 'scanning' && (
            <div className="scan-status" role="status">
              <p>{STATUS_TEXT[status]}</p>
              {status === 'paused' && (
                <button type="button" className="scan-resume" onClick={resume}>
                  Använd kameran
                </button>
              )}
            </div>
          )}
          {torch !== null && status === 'scanning' && (
            <button type="button" className={`scan-torch ${torch ? 'is-on' : ''}`} onClick={toggleTorch} aria-pressed={torch} aria-label="Lampa">
              <BoltIcon filled={torch} />
            </button>
          )}
        </div>

        <p className="scan-hint">Rikta kameran mot streckkoden. Håll telefonen en bit ifrån, så blir den skarp.</p>

        <div className="scan-actions">
          <button type="button" className="secondary-btn" onClick={takePhoto} disabled={reading}>
            Ta en bild
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setTyping(true)
              setMessage('')
            }}
          >
            Skriv in koden
          </button>
        </div>

        {typing && (
          <form
            className="group scan-type"
            onSubmit={(e) => {
              e.preventDefault()
              submitTyped()
            }}
          >
            <div className="field">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value.replace(/[^0-9 ]/g, ''))}
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Siffrorna under streckkoden"
                aria-label="Streckkodens siffror"
                autoFocus
              />
              <button type="submit" className="bar-btn bar-btn-strong" disabled={typed.replace(/\D/g, '').length < 8}>
                Sök
              </button>
            </div>
          </form>
        )}

        {message && (
          <p className="scan-message" role="status">
            {message}
          </p>
        )}

        <p className="hint-text scan-privacy">Bara streckkoden skickas till Open Food Facts för att hitta varan. Inget annat lämnar telefonen.</p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            picking.current = false
            void onPhoto(e.target.files?.[0])
          }}
        />
      </div>
    </Sheet>
  )
}
