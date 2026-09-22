import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { lookupBarcode, type BarcodeProduct } from '../../lib/openFoodFacts'
import { supabase } from '../../lib/supabase'
import type { MealSlot } from '../../lib/types'

const BarcodeScanner = lazy(() => import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })))

type Tab = 'manual' | 'barcode' | 'recent'

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

export function AddMealSheet({ userId, date, defaultSlot, onSaved }: AddMealSheetProps) {
  const [tab, setTab] = useState<Tab>('manual')
  const [slot, setSlot] = useState<MealSlot>(defaultSlot)
  const [draft, setDraft] = useState<DraftMeal>(EMPTY_DRAFT)
  const [barcode, setBarcode] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [saveAsFavorite, setSaveAsFavorite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (barcode) return // already resolving one
    setBarcode(code)
    setScanError(null)
    const product = await lookupBarcode(code)
    if (!product) {
      setScanError("Couldn't find that product — try manual entry instead.")
      setBarcode(null)
      return
    }
    setDraft(productToDraft(product))
  }

  async function saveMeal(source: 'manual' | 'barcode' | 'saved') {
    setSaving(true)
    setError(null)

    const payload = {
      user_id: userId,
      meal_slot: slot,
      name: draft.name,
      calories: Math.round(Number(draft.calories) || 0),
      protein_g: Number(draft.protein_g) || 0,
      carbs_g: Number(draft.carbs_g) || 0,
      fat_g: Number(draft.fat_g) || 0,
      fiber_g: Number(draft.fiber_g) || 0,
      grams: draft.grams ? Number(draft.grams) : null,
      barcode: source === 'barcode' ? barcode : null,
      source,
      logged_at: `${date}T${new Date().toTimeString().slice(0, 8)}`,
    }

    const { error: insertError } = await supabase.from('meals').insert(payload)
    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    if (saveAsFavorite && source !== 'saved') {
      await supabase.from('saved_foods').insert({
        user_id: userId,
        name: draft.name,
        per_serving: {
          calories: payload.calories,
          protein_g: payload.protein_g,
          carbs_g: payload.carbs_g,
          fat_g: payload.fat_g,
          fiber_g: payload.fiber_g,
          grams: payload.grams,
        },
      })
    }

    setSaving(false)
    onSaved()
  }

  const canSave = draft.name.trim().length > 0 && draft.calories !== ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(['manual', 'barcode', 'recent'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium capitalize ${
              tab === t ? 'bg-you text-white' : 'bg-ink/5 text-ink-soft'
            }`}
          >
            {t}
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

      {(tab === 'manual' || (tab === 'barcode' && draft.name)) && (
        <div className="flex flex-col gap-3">
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

          <Button
            type="button"
            disabled={!canSave || saving}
            onClick={() => saveMeal(tab === 'barcode' ? 'barcode' : 'manual')}
            className="w-full"
          >
            {saving ? 'Saving…' : 'Log meal'}
          </Button>
        </div>
      )}
    </div>
  )
}
