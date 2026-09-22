import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PendingMealsBanner } from '../components/diary/PendingMealsBanner'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { supabase } from '../lib/supabase'
import type { DailyCheckin, Meal, Profile, Quest, Streak, Workout } from '../lib/types'
import { useAuthStore } from '../store/useAuthStore'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const QUEST_LABEL: Record<Quest['kind'], string> = {
  water: 'Hit your water target',
  protein: 'Hit your protein target',
  steps: 'Walk your steps',
  workout: 'Log a workout',
  rest: 'Rest & mobility',
  photo: 'Progress photo',
}

export function Home() {
  const session = useAuthStore((s) => s.session)
  const userId = session!.user.id
  const queryClient = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      return data as Profile
    },
  })

  const { data: streak } = useQuery({
    queryKey: ['streak', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('streaks').select('*').eq('user_id', userId).single()
      if (error) throw error
      return data as Streak
    },
  })

  const { data: waterMl = 0 } = useQuery({
    queryKey: ['water', userId, todayISO()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_id', userId)
        .gte('logged_at', `${todayISO()}T00:00:00`)
      if (error) throw error
      return data.reduce((sum, row) => sum + row.amount_ml, 0)
    },
  })

  const { data: meals = [] } = useQuery({
    queryKey: ['meals', userId, todayISO()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', `${todayISO()}T00:00:00`)
      if (error) throw error
      return data as Meal[]
    },
  })

  const { data: checkin } = useQuery({
    queryKey: ['checkin', userId, todayISO()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .eq('checkin_date', todayISO())
        .maybeSingle()
      if (error) throw error
      return data as DailyCheckin | null
    },
  })

  const { data: quests = [] } = useQuery({
    queryKey: ['quests', userId, todayISO()],
    enabled: !!checkin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quests')
        .select('*')
        .eq('user_id', userId)
        .eq('quest_date', todayISO())
      if (error) throw error
      return data as Quest[]
    },
  })

  const { data: workoutsToday = [] } = useQuery({
    queryKey: ['workouts', userId, todayISO()],
    enabled: !!checkin,
    queryFn: async () => {
      const { data, error } = await supabase.from('workouts').select('*').eq('user_id', userId).eq('done_on', todayISO())
      if (error) throw error
      return data as Workout[]
    },
  })

  async function logGlass() {
    await supabase.from('water_logs').insert({ user_id: userId, amount_ml: 250 })
    queryClient.invalidateQueries({ queryKey: ['water', userId] })
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

  function questDone(q: Quest): boolean {
    if (q.kind === 'protein') return totals.protein_g >= q.target
    if (q.kind === 'water') return waterMl >= q.target
    if (q.kind === 'workout') return workoutsToday.some((w) => w.workout_type !== 'rest')
    if (q.kind === 'rest') return workoutsToday.length > 0
    return false // steps/photo need Phase 6/4 wiring
  }

  const firstName = profile?.display_name?.split(' ')[0] ?? ''
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex-1 px-5 py-8 max-w-lg mx-auto w-full flex flex-col gap-5">
      <div>
        <p className="text-ink-soft">
          {greeting}, {firstName}
        </p>
        <div className="flex items-center gap-4 mt-1">
          <p className="font-display text-3xl">
            🔥 {streak?.current_streak ?? 0} <span className="text-lg text-ink-soft">day streak</span>
          </p>
        </div>
        <p className="text-sm text-ink-soft">❄️ {streak?.freezes_available ?? 0} freezes available</p>
      </div>

      <PendingMealsBanner />

      {!checkin ? (
        <Card tint="her" className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">Morning check-in</p>
            <p className="text-sm text-ink-soft">Sets today's quests to match how you slept.</p>
          </div>
          <Link to="/checkin">
            <Button variant="her" className="px-4! py-2! text-sm whitespace-nowrap">
              Check in
            </Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-ink-soft mb-3">Today's quests</p>
          <ul className="flex flex-col gap-2">
            {quests.map((q) => {
              const done = questDone(q)
              return (
                <li key={q.id} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      done ? 'bg-grow text-white' : 'bg-ink/10 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <span className={done ? 'text-ink-soft line-through' : 'text-ink'}>{QUEST_LABEL[q.kind]}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Card tint="you">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-ink-soft">💧 Water</span>
          <Button variant="you" onClick={logGlass} className="px-4! py-1.5! text-sm">
            +1 glass
          </Button>
        </div>
        <ProgressBar label="Today" current={waterMl} target={profile?.water_target_ml ?? 2500} unit="ml" color="you" />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-ink-soft">🍽 Today</span>
          <Link to="/diary" className="text-sm text-you-deep font-medium">
            Open diary →
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          <ProgressBar label="Calories" current={totals.calories} target={profile?.target_calories ?? 0} unit=" kcal" color="loot" />
          <ProgressBar label="Protein" current={totals.protein_g} target={profile?.target_protein_g ?? 0} unit="g" color="you" />
          <ProgressBar label="Carbs" current={totals.carbs_g} target={profile?.target_carbs_g ?? 0} unit="g" color="grow" />
          <ProgressBar label="Fat" current={totals.fat_g} target={profile?.target_fat_g ?? 0} unit="g" color="calm" />
          <ProgressBar label="Fiber" current={totals.fiber_g} target={profile?.target_fiber_g ?? 0} unit="g" color="her" />
        </div>
      </Card>

      <Card className="bg-together text-white">
        <p className="font-display text-lg mb-1">LevelUp together</p>
        <p className="text-sm text-white/90">
          Pair with your partner to unlock the shared feed, streak and campaign map.
        </p>
      </Card>
    </div>
  )
}
