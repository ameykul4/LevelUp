import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AddMealSheet } from '../components/diary/AddMealSheet'
import { AddWorkoutSheet } from '../components/diary/AddWorkoutSheet'
import { PendingMealsBanner } from '../components/diary/PendingMealsBanner'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Sheet } from '../components/ui/Sheet'
import { endOfLocalDayISO, localDateISO as todayISO, startOfLocalDayISO } from '../lib/date'
import { supabase } from '../lib/supabase'
import type { Meal, MealSlot, Profile, Workout } from '../lib/types'
import { useAuthStore } from '../store/useAuthStore'

const SLOTS: { key: MealSlot; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch', label: 'Lunch', emoji: '☀️' },
  { key: 'dinner', label: 'Dinner', emoji: '🌙' },
  { key: 'snack', label: 'Snacks', emoji: '🍎' },
]

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return todayISO(d)
}

function formatDateLabel(date: string) {
  if (date === todayISO()) return 'Today'
  if (date === shiftDate(todayISO(), -1)) return 'Yesterday'
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function Diary() {
  const session = useAuthStore((s) => s.session)
  const userId = session!.user.id
  const queryClient = useQueryClient()

  const [date, setDate] = useState(todayISO())
  const [addMealSlot, setAddMealSlot] = useState<MealSlot | null>(null)
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      return data as Profile
    },
  })

  const { data: meals = [] } = useQuery({
    queryKey: ['meals', userId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', startOfLocalDayISO(date))
        .lt('logged_at', endOfLocalDayISO(date))
        .order('logged_at', { ascending: true })
      if (error) throw error
      return data as Meal[]
    },
  })

  const { data: workouts = [] } = useQuery({
    queryKey: ['workouts', userId, date],
    queryFn: async () => {
      const { data, error } = await supabase.from('workouts').select('*').eq('user_id', userId).eq('done_on', date)
      if (error) throw error
      return data as Workout[]
    },
  })

  async function invalidate() {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['meals', userId, date], exact: true }),
      queryClient.refetchQueries({ queryKey: ['workouts', userId, date], exact: true }),
    ])
    setAddMealSlot(null)
    setAddWorkoutOpen(false)
  }

  async function deleteMeal(id: string) {
    await supabase.from('meals').delete().eq('id', id)
    invalidate()
  }

  async function deleteWorkout(id: string) {
    await supabase.from('workouts').delete().eq('id', id)
    invalidate()
  }

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein_g: acc.protein_g + m.protein_g,
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
      fiber_g: acc.fiber_g + m.fiber_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  )

  const remaining = (profile?.target_calories ?? 0) - totals.calories

  return (
    <div className="flex-1 px-5 py-8 max-w-lg mx-auto w-full flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <button onClick={() => setDate(shiftDate(date, -1))} className="w-9 h-9 rounded-full bg-ink/5 text-ink-soft">
          ‹
        </button>
        <h1 className="font-display text-xl">{formatDateLabel(date)}</h1>
        <button
          onClick={() => setDate(shiftDate(date, 1))}
          disabled={date >= todayISO()}
          className="w-9 h-9 rounded-full bg-ink/5 text-ink-soft disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <PendingMealsBanner />

      <Card tint="you">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-sm text-ink-soft">Remaining</span>
          <span className="font-display text-3xl tabular-nums">
            {remaining} <span className="text-base text-ink-soft">kcal</span>
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <ProgressBar label="Calories" current={totals.calories} target={profile?.target_calories ?? 0} unit=" kcal" color="loot" />
          <ProgressBar label="Protein" current={totals.protein_g} target={profile?.target_protein_g ?? 0} unit="g" color="you" />
          <ProgressBar label="Carbs" current={totals.carbs_g} target={profile?.target_carbs_g ?? 0} unit="g" color="grow" />
          <ProgressBar label="Fat" current={totals.fat_g} target={profile?.target_fat_g ?? 0} unit="g" color="calm" />
          <ProgressBar label="Fiber" current={totals.fiber_g} target={profile?.target_fiber_g ?? 0} unit="g" color="her" />
        </div>
      </Card>

      {SLOTS.map((slot) => {
        const slotMeals = meals.filter((m) => m.meal_slot === slot.key)
        const slotCalories = slotMeals.reduce((sum, m) => sum + m.calories, 0)
        return (
          <Card key={slot.key}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                {slot.emoji} {slot.label}
              </span>
              <div className="flex items-center gap-3">
                {slotCalories > 0 && <span className="text-sm text-ink-soft tabular-nums">{slotCalories} kcal</span>}
                <button
                  onClick={() => setAddMealSlot(slot.key)}
                  className="w-7 h-7 rounded-full bg-you text-white text-lg leading-none flex items-center justify-center"
                  aria-label={`Add ${slot.label}`}
                >
                  +
                </button>
              </div>
            </div>
            {slotMeals.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing logged yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {slotMeals.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-ink">{m.name}</p>
                      <p className="text-ink-soft tabular-nums">
                        {m.calories} kcal · P{Math.round(m.protein_g)} C{Math.round(m.carbs_g)} F{Math.round(m.fat_g)}
                      </p>
                    </div>
                    <button onClick={() => deleteMeal(m.id)} className="text-ink-soft px-2" aria-label="Delete">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}

      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">🏋️ Exercise</span>
          <button
            onClick={() => setAddWorkoutOpen(true)}
            className="w-7 h-7 rounded-full bg-you text-white text-lg leading-none flex items-center justify-center"
            aria-label="Add workout"
          >
            +
          </button>
        </div>
        {workouts.length === 0 ? (
          <p className="text-sm text-ink-soft">Rest, or nothing logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {workouts.map((w) => (
              <li key={w.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-ink capitalize">{w.workout_type}</p>
                  <p className="text-ink-soft tabular-nums">
                    {w.duration_min ? `${w.duration_min} min` : ''}
                    {w.calories_burned ? ` · ${w.calories_burned} kcal burned` : ''}
                  </p>
                </div>
                <button onClick={() => deleteWorkout(w.id)} className="text-ink-soft px-2" aria-label="Delete">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={addMealSlot !== null} onClose={() => setAddMealSlot(null)} title="Log a meal">
        {addMealSlot && <AddMealSheet userId={userId} date={date} defaultSlot={addMealSlot} onSaved={invalidate} />}
      </Sheet>

      <Sheet open={addWorkoutOpen} onClose={() => setAddWorkoutOpen(false)} title="Log a workout">
        <AddWorkoutSheet userId={userId} date={date} onSaved={invalidate} />
      </Sheet>
    </div>
  )
}
