import { BrowserMultiFormatReader } from '@zxing/browser'
import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerProps {
  onDetected: (code: string) => void
}

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls: { stop: () => void } | undefined
    let cancelled = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (cancelled) return
        if (result) onDetected(result.getText())
        // NotFoundException fires continuously while no barcode is in frame — expected, not an error.
        if (err && err.name !== 'NotFoundException') setError('Could not access the camera.')
      })
      .then((c) => {
        controls = c
      })
      .catch(() => setError('Could not access the camera.'))

    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [onDetected])

  return (
    <div className="rounded-2xl overflow-hidden bg-ink aspect-[3/4] relative">
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/80 text-white text-sm text-center px-6">
          {error}
        </div>
      )}
      <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-24 border-2 border-white/70 rounded-xl" />
    </div>
  )
}
