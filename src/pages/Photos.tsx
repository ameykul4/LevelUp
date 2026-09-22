import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { CapturePhotoSheet } from '../components/photos/CapturePhotoSheet'
import { CompareSlider } from '../components/photos/CompareSlider'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Sheet } from '../components/ui/Sheet'
import { signedProgressPhotoUrls } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { PhotoAngle, ProgressPhoto } from '../lib/types'
import { useAuthStore } from '../store/useAuthStore'

type ViewMode = 'gallery' | 'compare'

export function Photos() {
  const session = useAuthStore((s) => s.session)
  const userId = session!.user.id
  const queryClient = useQueryClient()

  const [captureOpen, setCaptureOpen] = useState(false)
  const [mode, setMode] = useState<ViewMode>('gallery')
  const [lightbox, setLightbox] = useState<ProgressPhoto | null>(null)
  const [compareAngle, setCompareAngle] = useState<PhotoAngle>('front')
  const [beforeId, setBeforeId] = useState<string | null>(null)
  const [afterId, setAfterId] = useState<string | null>(null)

  const { data: photos = [] } = useQuery({
    queryKey: ['progress-photos', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false })
      if (error) throw error
      return data as ProgressPhoto[]
    },
  })

  const { data: urlMap = {} } = useQuery({
    queryKey: ['progress-photo-urls', photos.map((p) => p.photo_url).join(',')],
    enabled: photos.length > 0,
    queryFn: () => signedProgressPhotoUrls(photos.map((p) => p.photo_url)),
  })

  const angleOptions = useMemo(() => photos.filter((p) => p.angle === compareAngle), [photos, compareAngle])

  function onSaved() {
    setCaptureOpen(false)
    queryClient.invalidateQueries({ queryKey: ['progress-photos', userId] })
  }

  const beforePhoto = angleOptions.find((p) => p.id === beforeId)
  const afterPhoto = angleOptions.find((p) => p.id === afterId)

  return (
    <div className="flex-1 px-5 py-8 max-w-lg mx-auto w-full flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Photos</h1>
        <Button type="button" onClick={() => setCaptureOpen(true)} className="px-4! py-2! text-sm">
          📸 Add
        </Button>
      </div>

      <div className="flex gap-2">
        {(['gallery', 'compare'] as ViewMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium capitalize ${
              mode === m ? 'bg-you text-white' : 'bg-ink/5 text-ink-soft'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {photos.length === 0 && (
        <Card>
          <p className="text-sm text-ink-soft text-center py-6">
            No photos yet — your journey starts with the first one. Private, locked to you, never sent to any AI.
          </p>
        </Card>
      )}

      {mode === 'gallery' && photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightbox(p)}
              className="aspect-square rounded-xl overflow-hidden bg-ink/5 relative"
            >
              {urlMap[p.photo_url] && (
                <img src={urlMap[p.photo_url]} alt={p.angle} className="w-full h-full object-cover" />
              )}
              <span className="absolute bottom-1 left-1 text-[10px] bg-ink/60 text-white px-1.5 py-0.5 rounded-full">
                {new Date(p.taken_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </button>
          ))}
        </div>
      )}

      {mode === 'compare' && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {(['front', 'side', 'back'] as PhotoAngle[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setCompareAngle(a)
                  setBeforeId(null)
                  setAfterId(null)
                }}
                className={`flex-1 rounded-xl py-2 text-sm font-medium capitalize ${
                  compareAngle === a ? 'bg-you text-white' : 'bg-ink/5 text-ink-soft'
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          {angleOptions.length < 2 ? (
            <Card>
              <p className="text-sm text-ink-soft text-center py-4">Need at least two "{compareAngle}" photos to compare.</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-soft">Before</span>
                  <select
                    value={beforeId ?? ''}
                    onChange={(e) => setBeforeId(e.target.value)}
                    className="rounded-xl border border-ink-soft/20 px-3 py-2.5 text-sm"
                  >
                    <option value="">Pick a date</option>
                    {angleOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {new Date(p.taken_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-soft">After</span>
                  <select
                    value={afterId ?? ''}
                    onChange={(e) => setAfterId(e.target.value)}
                    className="rounded-xl border border-ink-soft/20 px-3 py-2.5 text-sm"
                  >
                    <option value="">Pick a date</option>
                    {angleOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {new Date(p.taken_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {beforePhoto && afterPhoto && urlMap[beforePhoto.photo_url] && urlMap[afterPhoto.photo_url] && (
                <CompareSlider beforeUrl={urlMap[beforePhoto.photo_url]} afterUrl={urlMap[afterPhoto.photo_url]} />
              )}
            </>
          )}
        </div>
      )}

      <Sheet open={captureOpen} onClose={() => setCaptureOpen(false)} title="Add a progress photo">
        <CapturePhotoSheet userId={userId} onSaved={onSaved} />
      </Sheet>

      <Sheet open={!!lightbox} onClose={() => setLightbox(null)} title={lightbox ? new Date(lightbox.taken_at).toLocaleDateString() : ''}>
        {lightbox && urlMap[lightbox.photo_url] && (
          <img src={urlMap[lightbox.photo_url]} alt={lightbox.angle} className="rounded-2xl w-full" />
        )}
      </Sheet>
    </div>
  )
}
