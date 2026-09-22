import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { analyzeMeal, saveAnalyzedMeal, type AnalyzeMealResult } from '../../lib/gemini'
import { blobToBase64 } from '../../lib/media'
import { lookupBarcode, type BarcodeProduct } from '../../lib/openFoodFacts'
import { addPendingMeal } from '../../lib/outbox'
import { supabase } from '../../lib/supabase'
import type { MealSlot } from '../../lib/types'

const BarcodeScanner = lazy(() => import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })))

type Tab = 'manual' | 'barcode' | 'photo' | 'voice' | 'recent'
type ResultSource = 'manual' | 'barcode' | 'ai' | 'voice' | 'saved'

interface AddMealSheetProps {
  userId: string
  date: string
  defaultSlot: MealSlot
  onSaved: () => void
}

interface DraftMeal {
  name: string
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
  fiber_g: string
  grams: string
}

const EMPTY_DRAFT: DraftMeal = { name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '', grams: '' }

function productToDraft(p: BarcodeProduct): DraftMeal {
  return {
    name: p.name,
    calories: String(p.calories),
    protein_g: String(p.protein_g),
    carbs_g: String(p.carbs_g),
    fat_g: String(p.fat_g),
    fiber_g: String(p.fiber_g),
    grams: p.gramsPerServing ? String(p.gramsPerServing) : '',
  }
}

function resultToDraft(r: AnalyzeMealResult): DraftMeal {
  return {
    name: r.name,
    calories: String(Math.round(r.calories)),
    protein_g: String(r.protein_g),
    carbs_g: String(r.carbs_g),
    fat_g: String(r.fat_g),
    fiber_g: String(r.fiber_g),
    grams: String(r.grams),
  }
}

const TAB_LABEL: Record<Tab, string> = { manual: 'Manual', barcode: 'Barcode', photo: 'Photo', voice: 'Voice', recent: 'Recent' }

export function AddMealSheet({ userId, date, defaultSlot, onSaved }: AddMealSheetProps) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('photo')
  const [slot, setSlot] = useState<MealSlot>(defaultSlot)
  const [draft, setDraft] = useState<DraftMeal>(EMPTY_DRAFT)
  const [resultSource, setResultSource] = useState<ResultSource>('manual')
  const [barcode, setBarcode] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [saveAsFavorite, setSaveAsFavorite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // photo/voice capture state
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null)
  const [capturedMimeType, setCapturedMimeType] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [queuedOffline, setQueuedOffline] = useState(false)
  const [refineNote, setRefineNote] = useState('')
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const { data: recentMeals = [] } = useQuery({
    queryKey: ['recent-meals', userId],
    enabled: tab === 'recent',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('name, calories, protein_g, carbs_g, fat_g, fiber_g, grams')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(30)
      if (error) throw error
      const seen = new Set<string>()
      return data.filter((m) => {
        if (seen.has(m.name)) return false
        seen.add(m.name)
        return true
      })
    },
  })

  async function onBarcodeDetected(code: string) {
    if (barcode) return
    setBarcode(code)
    setScanError(null)
    const product = await lookupBarcode(code)
    if (!product) {
      setScanError("Couldn't find that product — try manual entry instead.")
      setBarcode(null)
      return
    }
    setDraft(productToDraft(product))
    setResultSource('barcode')
  }

  async function runAnalysis(kind: 'photo' | 'voice', base64: string, mimeType: string, note?: string) {
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const result = await analyzeMeal({
        imageBase64: kind === 'photo' ? base64 : undefined,
        imageMimeType: kind === 'photo' ? mimeType : undefined,
        audioBase64: kind === 'voice' ? base64 : undefined,
        audioMimeType: kind === 'voice' ? mimeType : undefined,
        note,
      })
      setDraft(resultToDraft(result))
      setResultSource(kind === 'voice' ? 'voice' : 'ai')
      setRefineNote('')
    } catch {
      // offline, or Gemini's temporarily down — never lose the capture (§8.5B)
      await addPendingMeal({
        id: crypto.randomUUID(),
        userId,
        date,
        mealSlot: slot,
        kind,
        base64,
        mimeType,
        note,
        createdAt: Date.now(),
      })
      queryClient.invalidateQueries({ queryKey: ['outbox-count'] })
      setQueuedOffline(true)
    } finally {
      setAnalyzing(false)
    }
  }

  async function onPhotoSelected(file: File) {
    const base64 = await blobToBase64(file)
    setCapturedBase64(base64)
    setCapturedMimeType(file.type)
    await runAnalysis('photo', base64, file.type)
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    audioChunksRef.current = []
    recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const base64 = await blobToBase64(blob)
      setCapturedBase64(base64)
      setCapturedMimeType('audio/webm')
      await runAnalysis('voice', base64, 'audio/webm')
    }
    recorder.start()
    mediaRecorderRef.current = recorder
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function refine() {
    if (!capturedBase64 || !capturedMimeType || !refineNote.trim()) return
    const kind = tab === 'voice' ? 'voice' : 'photo'
    await runAnalysis(kind, capturedBase64, capturedMimeType, refineNote)
  }

  async function saveMeal() {
    setSaving(true)
    setError(null)

    try {
      if (resultSource === 'ai' || resultSource === 'voice') {
        await saveAnalyzedMeal({
          userId,
          date,
          mealSlot: slot,
          source: resultSource,
          result: {
            name: draft.name,
            grams: Number(draft.grams) || 0,
            calories: Number(draft.calories) || 0,
            protein_g: Number(draft.protein_g) || 0,
            carbs_g: Number(draft.carbs_g) || 0,
            fat_g: Number(draft.fat_g) || 0,
            fiber_g: Number(draft.fiber_g) || 0,
          },
        })
      } else {
        const { error: insertError } = await supabase.from('meals').insert({
          user_id: userId,
          meal_slot: slot,
          name: draft.name,
          calories: Math.round(Number(draft.calories) || 0),
          protein_g: Number(draft.protein_g) || 0,
          carbs_g: Number(draft.carbs_g) || 0,
          fat_g: Number(draft.fat_g) || 0,
          fiber_g: Number(draft.fiber_g) || 0,
          grams: draft.grams ? Number(draft.grams) : null,
          barcode: resultSource === 'barcode' ? barcode : null,
          source: resultSource,
          logged_at: `${date}T${new Date().toTimeString().slice(0, 8)}`,
        })
        if (insertError) throw insertError
      }

      if (saveAsFavorite && resultSource !== 'saved') {
        await supabase.from('saved_foods').insert({
          user_id: userId,
          name: draft.name,
          per_serving: {
            calories: Number(draft.calories) || 0,
            protein_g: Number(draft.protein_g) || 0,
            carbs_g: Number(draft.carbs_g) || 0,
            fat_g: Number(draft.fat_g) || 0,
            fiber_g: Number(draft.fiber_g) || 0,
            grams: draft.grams ? Number(draft.grams) : null,
          },
        })
      }

      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save meal')
    } finally {
      setSaving(false)
    }
  }

  const canSave = draft.name.trim().length > 0 && draft.calories !== ''
  const showResultForm = tab === 'manual' || (draft.name && ['barcode', 'photo', 'voice'].includes(tab))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 flex-wrap">
        {(['photo', 'voice', 'barcode', 'manual', 'recent'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t)
              setQueuedOffline(false)
            }}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${tab === t ? 'bg-you text-white' : 'bg-ink/5 text-ink-soft'}`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">Meal</span>
        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value as MealSlot)}
          className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
        >
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </label>

      {tab === 'recent' && (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {recentMeals.length === 0 && <p className="text-sm text-ink-soft">No meals logged yet.</p>}
          {recentMeals.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setDraft({
                  name: m.name,
                  calories: String(m.calories),
                  protein_g: String(m.protein_g),
                  carbs_g: String(m.carbs_g),
                  fat_g: String(m.fat_g),
                  fiber_g: String(m.fiber_g),
                  grams: m.grams ? String(m.grams) : '',
                })
                setResultSource('saved')
                setTab('manual')
              }}
              className="flex items-center justify-between rounded-xl bg-ink/5 px-3.5 py-2.5 text-left"
            >
              <span className="font-medium">{m.name}</span>
              <span className="text-sm text-ink-soft tabular-nums">{m.calories} kcal</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'barcode' && !draft.name && (
        <div className="flex flex-col gap-3">
          <Suspense fallback={<div className="rounded-2xl bg-ink/5 aspect-3/4 animate-pulse" />}>
            <BarcodeScanner onDetected={onBarcodeDetected} />
          </Suspense>
          {barcode && !scanError && <p className="text-sm text-ink-soft text-center">Looking up {barcode}…</p>}
          {scanError && <p className="text-sm text-her-deep text-center">{scanError}</p>}
        </div>
      )}

      {tab === 'photo' && !draft.name && (
        <div className="flex flex-col gap-3">
          {capturedBase64 && (
            <img
              src={`data:${capturedMimeType};base64,${capturedBase64}`}
              alt="Captured meal"
              className="rounded-2xl w-full aspect-3/4 object-cover"
            />
          )}
          {!capturedBase64 && (
            <label className="rounded-2xl bg-ink/5 aspect-3/4 flex flex-col items-center justify-center gap-2 cursor-pointer text-ink-soft">
              <span className="text-3xl">📷</span>
              <span className="text-sm font-medium">Take a photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onPhotoSelected(e.target.files[0])}
              />
            </label>
          )}
          {analyzing && <p className="text-sm text-ink-soft text-center">Reading your plate…</p>}
          {queuedOffline && (
            <p className="text-sm text-calm text-center">
              Couldn't reach Gemini right now — saved and queued. It'll analyze automatically once you're back online.
            </p>
          )}
        </div>
      )}

      {tab === 'voice' && !draft.name && (
        <div className="flex flex-col items-center gap-3 py-6">
          <button
            type="button"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl ${
              recording ? 'bg-her text-white scale-110' : 'bg-you text-white'
            } transition-transform`}
          >
            🎤
          </button>
          <p className="text-sm text-ink-soft">{recording ? 'Recording… release to send' : 'Hold to record — "2 roti aur dal"'}</p>
          {analyzing && <p className="text-sm text-ink-soft">Listening…</p>}
          {queuedOffline && (
            <p className="text-sm text-calm text-center">
              Couldn't reach Gemini right now — saved and queued. It'll analyze automatically once you're back online.
            </p>
          )}
        </div>
      )}

      {analyzeError && <p className="text-sm text-her-deep">{analyzeError}</p>}

      {showResultForm && (
        <div className="flex flex-col gap-3">
          {(tab === 'photo' || tab === 'voice') && draft.name && (
            <div className="flex gap-2">
              <input
                value={refineNote}
                onChange={(e) => setRefineNote(e.target.value)}
                placeholder='Correction, e.g. "extra roti, more oil"'
                className="flex-1 rounded-xl border border-ink-soft/20 px-3.5 py-2.5 text-sm"
              />
              <Button type="button" variant="ghost" disabled={analyzing || !refineNote.trim()} onClick={refine}>
                Refine
              </Button>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Food name</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5"
              placeholder="e.g. 2 roti + dal"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Calories</span>
              <input
                type="number"
                value={draft.calories}
                onChange={(e) => setDraft({ ...draft, calories: e.target.value })}
                className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Grams (optional)</span>
              <input
                type="number"
                value={draft.grams}
                onChange={(e) => setDraft({ ...draft, grams: e.target.value })}
                className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Protein (g)</span>
              <input
                type="number"
                value={draft.protein_g}
                onChange={(e) => setDraft({ ...draft, protein_g: e.target.value })}
                className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Carbs (g)</span>
              <input
                type="number"
                value={draft.carbs_g}
                onChange={(e) => setDraft({ ...draft, carbs_g: e.target.value })}
                className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Fat (g)</span>
              <input
                type="number"
                value={draft.fat_g}
                onChange={(e) => setDraft({ ...draft, fat_g: e.target.value })}
                className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Fiber (g)</span>
              <input
                type="number"
                value={draft.fiber_g}
                onChange={(e) => setDraft({ ...draft, fiber_g: e.target.value })}
                className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={saveAsFavorite} onChange={(e) => setSaveAsFavorite(e.target.checked)} />
            Save as a favorite for quick re-log
          </label>

          {error && <p className="text-sm text-her-deep">{error}</p>}

          <Button type="button" disabled={!canSave || saving} onClick={saveMeal} className="w-full">
            {saving ? 'Saving…' : 'Log meal'}
          </Button>
        </div>
      )}
    </div>
  )
}
