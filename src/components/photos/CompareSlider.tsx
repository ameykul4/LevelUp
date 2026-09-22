import { useRef, useState } from 'react'

export function CompareSlider({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [pct, setPct] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  function updateFromClientX(clientX: number) {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const next = ((clientX - rect.left) / rect.width) * 100
    setPct(Math.min(100, Math.max(0, next)))
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-3/4 rounded-2xl overflow-hidden select-none touch-none bg-ink/5"
      onMouseDown={(e) => {
        dragging.current = true
        updateFromClientX(e.clientX)
      }}
      onMouseMove={(e) => dragging.current && updateFromClientX(e.clientX)}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchStart={(e) => updateFromClientX(e.touches[0].clientX)}
      onTouchMove={(e) => updateFromClientX(e.touches[0].clientX)}
    >
      <img src={afterUrl} alt="After" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
        <img src={beforeUrl} alt="Before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${pct}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-xs">
          ↔
        </div>
      </div>
      <span className="absolute bottom-2 left-2 text-xs bg-ink/60 text-white px-2 py-0.5 rounded-full">Before</span>
      <span className="absolute bottom-2 right-2 text-xs bg-ink/60 text-white px-2 py-0.5 rounded-full">After</span>
    </div>
  )
}
