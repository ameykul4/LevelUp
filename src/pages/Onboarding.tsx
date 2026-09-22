import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { supabase } from '../lib/supabase'
import {
  ageFromBirthDate,
  computeTargets,
  MAX_WEEKLY_GAIN_KG,
  MAX_WEEKLY_LOSS_KG,
  type ActivityLevel,
  type GoalType,
  type Sex,
} from '../lib/tdee'
import { useAuthStore } from '../store/useAuthStore'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary — desk job, little exercise' },
  { value: 'light', label: 'Light — exercise 1–3 days/week' },
  { value: 'moderate', label: 'Moderate — exercise 3–5 days/week' },
  { value: 'active', label: 'Active — exercise 6–7 days/week' },
  { value: 'very_active', label: 'Very active — hard training or physical job' },
]

export function Onboarding() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)

  const [sex, setSex] = useState<Sex>('male')
  const [birthDate, setBirthDate] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activity, setActivity] = useState<ActivityLevel>('moderate')
  const [goal, setGoal] = useState<GoalType>('maintain')
  const [weeklyRate, setWeeklyRate] = useState(0.5)
  const [waterTargetMl, setWaterTargetMl] = useState(2500)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxRate = goal === 'lose' ? MAX_WEEKLY_LOSS_KG : goal === 'gain' ? MAX_WEEKLY_GAIN_KG : 0

  const targets = useMemo(() => {
    const h = Number(heightCm)
    const w = Number(weightKg)
    if (!birthDate || !h || !w) return null
    return computeTargets({
      sex,
      weightKg: w,
      heightCm: h,
      age: ageFromBirthDate(birthDate),
      activity,
      goal,
      requestedWeeklyRateKg: goal === 'maintain' ? 0 : weeklyRate,
    })
  }, [sex, birthDate, heightCm, weightKg, activity, goal, weeklyRate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !targets) return
    setSaving(true)
    setError(null)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        sex,
        birth_date: birthDate,
        height_cm: Number(heightCm),
        activity_level: activity,
        goal_type: goal,
        weekly_rate_kg: targets.weeklyRateKg,
        target_calories: targets.targetCalories,
        target_protein_g: targets.proteinG,
        target_carbs_g: targets.carbsG,
        target_fat_g: targets.fatG,
        target_fiber_g: targets.fiberG,
        water_target_ml: waterTargetMl,
        onboarded: true,
      })
      .eq('id', session.user.id)

    if (profileError) {
      setError(profileError.message)
      setSaving(false)
      return
    }

    const { error: weightError } = await supabase.from('weight_logs').insert({
      user_id: session.user.id,
      weight_kg: Number(weightKg),
      logged_on: new Date().toISOString().slice(0, 10),
    })

    setSaving(false)
    if (weightError) {
      setError(weightError.message)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="flex-1 px-6 py-10 max-w-lg mx-auto w-full">
      <h1 className="font-display text-3xl mb-1">Let's set your baseline</h1>
      <p className="text-ink-soft mb-6">
        A few numbers so LevelUp can compute your calorie & macro targets — editable anytime.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Card className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
            <span className="text-sm text-ink-soft">Sex</span>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
              className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
            <span className="text-sm text-ink-soft">Birth date</span>
            <input
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Height (cm)</span>
            <input
              type="number"
              required
              min={100}
              max={250}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Current weight (kg)</span>
            <input
              type="number"
              required
              min={30}
              max={300}
              step={0.1}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
            />
          </label>
        </Card>

        <Card>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Activity level</span>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value as ActivityLevel)}
              className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
            >
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </Card>

        <Card className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Goal</span>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as GoalType)}
              className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
            >
              <option value="lose">Lose weight</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain weight</option>
            </select>
          </label>

          {goal !== 'maintain' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">
                Weekly {goal === 'lose' ? 'loss' : 'gain'} rate — capped at {maxRate} kg/week for safety
              </span>
              <input
                type="range"
                min={0.1}
                max={maxRate}
                step={0.05}
                value={Math.min(weeklyRate, maxRate)}
                onChange={(e) => setWeeklyRate(Number(e.target.value))}
              />
              <span className="text-sm font-display tabular-nums">{Math.min(weeklyRate, maxRate).toFixed(2)} kg/week</span>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Daily water target (ml)</span>
            <input
              type="number"
              min={1000}
              max={6000}
              step={100}
              value={waterTargetMl}
              onChange={(e) => setWaterTargetMl(Number(e.target.value))}
              className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
            />
          </label>
        </Card>

        {targets && (
          <Card tint="you">
            <p className="text-sm text-ink-soft mb-2">Your computed targets (editable later)</p>
            <p className="font-display text-3xl mb-3 tabular-nums">{targets.targetCalories} kcal/day</p>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div>
                <p className="font-display text-lg tabular-nums">{targets.proteinG}g</p>
                <p className="text-ink-soft">Protein</p>
              </div>
              <div>
                <p className="font-display text-lg tabular-nums">{targets.carbsG}g</p>
                <p className="text-ink-soft">Carbs</p>
              </div>
              <div>
                <p className="font-display text-lg tabular-nums">{targets.fatG}g</p>
                <p className="text-ink-soft">Fat</p>
              </div>
              <div>
                <p className="font-display text-lg tabular-nums">{targets.fiberG}g</p>
                <p className="text-ink-soft">Fiber</p>
              </div>
            </div>
          </Card>
        )}

        {error && <p className="text-sm text-her-deep">{error}</p>}

        <Button type="submit" disabled={!targets || saving} className="w-full">
          {saving ? 'Saving…' : "Let's go"}
        </Button>
      </form>
    </div>
  )
}
