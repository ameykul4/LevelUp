import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { endOfLocalDayISO, localDateISO, startOfLocalDayISO } from '../lib/date'
import { supabase } from '../lib/supabase'
import type { DailyCheckin, Meal, Profile, WeightLog, Workout } from '../lib/types'
import { rollingWeightAverage } from '../lib/weightTrend'
import { useAuthStore } from '../store/useAuthStore'

type RangeDays = 7 | 30 | 90

const HEATMAP_DAYS = 28

function daysAgoISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateISO(d)
}

function dateRangeArray(days: number): string[] {
  return Array.from({ length: days }, (_, i) => daysAgoISO(days - 1 - i))
}

export function Reports() {
  const session = useAuthStore((s) => s.session)
  const userId = session!.user.id
  const [range, setRange] = useState<RangeDays>(7)

  // Day-bucket coverage must span whichever is wider: the selected report
  // range or the (always-28-day) heatmap, so a 30/90-day view doesn't
  // silently truncate to 28 days of data while claiming to cover more.
  const coverageDays = Math.max(range, HEATMAP_DAYS)
  const earliestStart = daysAgoISO(coverageDays - 1)

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      return data as Profile
    },
  })

  const { data: meals = [] } = useQuery({
    queryKey: ['report-meals', userId, earliestStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', startOfLocalDayISO(earliestStart))
        .lt('logged_at', endOfLocalDayISO(localDateISO()))
      if (error) throw error
      return data as Meal[]
    },
  })

  const { data: waterLogs = [] } = useQuery({
    queryKey: ['report-water', userId, earliestStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('amount_ml, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', startOfLocalDayISO(earliestStart))
        .lt('logged_at', endOfLocalDayISO(localDateISO()))
      if (error) throw error
      return data as { amount_ml: number; logged_at: string }[]
    },
  })

  const { data: workouts = [] } = useQuery({
    queryKey: ['report-workouts', userId, earliestStart],
    queryFn: async () => {
      const { data, error } = await supabase.from('workouts').select('*').eq('user_id', userId).gte('done_on', earliestStart)
      if (error) throw error
      return data as Workout[]
    },
  })

  const { data: checkins = [] } = useQuery({
    queryKey: ['report-checkins', userId, earliestStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .gte('checkin_date', earliestStart)
      if (error) throw error
      return data as DailyCheckin[]
    },
  })

  const { data: weightLogs = [] } = useQuery({
    queryKey: ['report-weight', userId, earliestStart],
    queryFn: async () => {
      const { data, error } = await supabase.from('weight_logs').select('*').eq('user_id', userId).gte('logged_on', earliestStart).order('logged_on')
      if (error) throw error
      return data as WeightLog[]
    },
  })

  const dayKeyed = useMemo(() => {
    const byDay: Record<string, { calories: number; protein_g: number; waterMl: number; workedOut: boolean; checkedIn: boolean }> = {}
    for (const day of dateRangeArray(coverageDays)) {
      byDay[day] = { calories: 0, protein_g: 0, waterMl: 0, workedOut: false, checkedIn: false }
    }
    for (const m of meals) {
      const day = m.logged_at.slice(0, 10)
      if (byDay[day]) {
        byDay[day].calories += m.calories
        byDay[day].protein_g += m.protein_g
      }
    }
    for (const w of waterLogs) {
      const day = w.logged_at.slice(0, 10)
      if (byDay[day]) byDay[day].waterMl += w.amount_ml
    }
    for (const w of workouts) {
      if (byDay[w.done_on] && w.workout_type !== 'rest') byDay[w.done_on].workedOut = true
    }
    for (const c of checkins) {
      if (byDay[c.checkin_date]) byDay[c.checkin_date].checkedIn = true
    }
    return byDay
  }, [meals, waterLogs, workouts, checkins, coverageDays])

  const daysInRange = dateRangeArray(range)

  const loggedDays = daysInRange.filter((d) => dayKeyed[d] && dayKeyed[d].calories > 0)
  const avgCalories = loggedDays.length ? Math.round(loggedDays.reduce((s, d) => s + dayKeyed[d].calories, 0) / loggedDays.length) : 0
  const avgProtein = loggedDays.length ? Math.round(loggedDays.reduce((s, d) => s + dayKeyed[d].protein_g, 0) / loggedDays.length) : 0
  const proteinHitDays = daysInRange.filter((d) => dayKeyed[d] && profile?.target_protein_g && dayKeyed[d].protein_g >= profile.target_protein_g).length
  const waterHitDays = daysInRange.filter((d) => dayKeyed[d] && profile?.water_target_ml && dayKeyed[d].waterMl >= profile.water_target_ml).length
  const workoutDays = daysInRange.filter((d) => dayKeyed[d]?.workedOut).length

  const trend = rollingWeightAverage(weightLogs)
  const latestTrend = trend[trend.length - 1]

  const heatmapDays = dateRangeArray(HEATMAP_DAYS)

  return (
    <div className="flex-1 px-5 py-8 max-w-lg mx-auto w-full flex flex-col gap-5">
      <h1 className="font-display text-3xl">Reports</h1>

      <div className="flex gap-2">
        {([7, 30, 90] as RangeDays[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium ${range === r ? 'bg-you text-white' : 'bg-ink/5 text-ink-soft'}`}
          >
            {r} days
          </button>
        ))}
      </div>

      <Card tint="you">
        <p className="text-sm text-ink-soft mb-3">Nutrition — last {range} days</p>
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <p className="font-display text-2xl tabular-nums">{avgCalories}</p>
            <p className="text-xs text-ink-soft">avg kcal/day ({loggedDays.length} logged)</p>
          </div>
          <div>
            <p className="font-display text-2xl tabular-nums">{avgProtein}g</p>
            <p className="text-xs text-ink-soft">avg protein/day</p>
          </div>
        </div>
        <ProgressBar label="Days protein target hit" current={proteinHitDays} target={daysInRange.length} color="you" />
        <div className="h-2" />
        <ProgressBar label="Days water target hit" current={waterHitDays} target={daysInRange.length} color="calm" />
        <div className="h-2" />
        <ProgressBar label="Workout days" current={workoutDays} target={daysInRange.length} color="grow" />
      </Card>

      <Card>
        <p className="text-sm text-ink-soft mb-3">Adherence — last {HEATMAP_DAYS} days</p>
        <div className="grid grid-cols-7 gap-1.5">
          {heatmapDays.map((d) => {
            const day = dayKeyed[d]
            const hitProtein = !!(day && profile?.target_protein_g && day.protein_g >= profile.target_protein_g)
            const hitWater = !!(day && profile?.water_target_ml && day.waterMl >= profile.water_target_ml)
            const workedOut = !!day?.workedOut
            const score = [hitProtein, hitWater, workedOut].filter(Boolean).length
            const bg = score === 0 ? 'bg-ink/5' : score === 1 ? 'bg-you-tint' : score === 2 ? 'bg-you/50' : 'bg-you'
            return (
              <div
                key={d}
                title={`${d}: protein ${hitProtein ? '✓' : '·'} water ${hitWater ? '✓' : '·'} workout ${workedOut ? '✓' : '·'}`}
                className={`aspect-square rounded-md ${bg}`}
              />
            )
          })}
        </div>
        <p className="text-xs text-ink-soft mt-2">Darker = more targets hit that day (protein, water, workout).</p>
      </Card>

      {trend.length > 0 && (
        <Card>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-sm text-ink-soft">Weight trend (7-day avg)</p>
            {latestTrend && <p className="font-display text-xl tabular-nums">{latestTrend.rollingAvg} kg</p>}
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip
                  formatter={(value) => [`${value} kg`, 'Trend']}
                  labelFormatter={(label) => new Date(`${label}T00:00:00`).toLocaleDateString()}
                />
                <Line type="monotone" dataKey="rollingAvg" stroke="#14B8C4" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-ink-soft mt-1">
            Trend only — daily swings of 1–2kg are normal water fluctuation, not fat gained or lost.
          </p>
        </Card>
      )}

      <Card>
        <p className="text-sm text-ink-soft mb-3">Workouts — last {range} days</p>
        {workouts.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing logged in this range yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            {Object.entries(
              workouts.reduce<Record<string, number>>((acc, w) => {
                acc[w.workout_type] = (acc[w.workout_type] ?? 0) + 1
                return acc
              }, {}),
            ).map(([type, count]) => (
              <div key={type} className="flex justify-between">
                <span className="capitalize">{type}</span>
                <span className="tabular-nums text-ink-soft">{count}×</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
