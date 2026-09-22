import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { localDateISO } from '../../lib/date'
import { uploadProgressPhoto } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type { PhotoAngle } from '../../lib/types'

const ANGLES: { value: PhotoAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
]

export function CapturePhotoSheet({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [angle, setAngle] = useState<PhotoAngle>('front')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onFileSelected(f: File) {
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  async function save() {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const path = await uploadProgressPhoto(userId, file, file.type)
      const { error: insertError } = await supabase.from('progress_photos').insert({
        user_id: userId,
        photo_url: path,
        angle,
        taken_at: new Date().toISOString(),
        week_no: null,
      })
      if (insertError) throw insertError
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save photo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {ANGLES.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => setAngle(a.value)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium ${
              angle === a.value ? 'bg-you text-white' : 'bg-ink/5 text-ink-soft'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {previewUrl ? (
        <img src={previewUrl} alt="Preview" className="rounded-2xl w-full aspect-3/4 object-cover" />
      ) : (
        <label className="rounded-2xl bg-ink/5 aspect-3/4 flex flex-col items-center justify-center gap-2 cursor-pointer text-ink-soft">
          <span className="text-3xl">📸</span>
          <span className="text-sm font-medium">Take a {angle} photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFileSelected(e.target.files[0])}
          />
        </label>
      )}

      <p className="text-xs text-ink-soft text-center">
        Private, locked to you — never sent to any AI. {localDateISO()}
      </p>

      {error && <p className="text-sm text-her-deep">{error}</p>}

      <Button type="button" disabled={!file || uploading} onClick={save} className="w-full">
        {uploading ? 'Saving…' : 'Save photo'}
      </Button>
    </div>
  )
}
