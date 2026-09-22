import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import type { SetEntry, WorkoutType } from '../../lib/types'

interface AddWorkoutSheetProps {
  userId: string
  date: string
  onSaved: () => void
}

const EMPTY_SET: SetEntry = { exercise: '', weight: 0, reps: 0 }

export function AddWorkoutSheet({ userId, date, onSaved }: AddWorkoutSheetProps) {
  const [type, setType] = useState<WorkoutType>('strength')
  const [durationMin, setDurationMin] = useState('')
  const [caloriesBurned, setCaloriesBurned] = useState('')
  const [sets, setSets] = useState<SetEntry[]>([{ ...EMPTY_SET }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateSet(i: number, patch: Partial<SetEntry>) {
    setSets(sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  async function submit() {
    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('workouts').insert({
      user_id: userId,
      workout_type: type,
      duration_min: durationMin ? Number(durationMin) : null,
      calories_burned: caloriesBurned ? Number(caloriesBurned) : null,
      sets: type === 'strength' ? sets.filter((s) => s.exercise.trim()) : null,
      done_on: date,
    })

    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    onSaved()
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">Type</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as WorkoutType)}
          className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
        >
          <option value="strength">Strength</option>
          <option value="cardio">Cardio</option>
          <option value="mobility">Mobility</option>
          <option value="rest">Rest day</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-soft">Duration (min)</span>
          <input
            type="number"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-soft">Calories burned</span>
          <input
            type="number"
            value={caloriesBurned}
            onChange={(e) => setCaloriesBurned(e.target.value)}
            className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5"
          />
        </label>
      </div>

      {type === 'strength' && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-soft">Sets</span>
          {sets.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_4rem] gap-2">
              <input
                placeholder="Exercise"
                value={s.exercise}
                onChange={(e) => updateSet(i, { exercise: e.target.value })}
                className="rounded-xl border border-ink-soft/20 px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="kg"
                value={s.weight || ''}
                onChange={(e) => updateSet(i, { weight: Number(e.target.value) })}
                className="rounded-xl border border-ink-soft/20 px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="reps"
                value={s.reps || ''}
                onChange={(e) => updateSet(i, { reps: Number(e.target.value) })}
                className="rounded-xl border border-ink-soft/20 px-3 py-2 text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSets([...sets, { ...EMPTY_SET }])}
            className="text-sm text-you-deep text-left"
          >
            + Add set
          </button>
        </div>
      )}

      {error && <p className="text-sm text-her-deep">{error}</p>}

      <Button type="button" disabled={saving} onClick={submit} className="w-full">
        {saving ? 'Saving…' : 'Log workout'}
      </Button>
    </div>
  )
}
