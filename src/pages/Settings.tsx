import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PartnerSection } from '../components/settings/PartnerSection'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { localDateISO } from '../lib/date'
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
import type { Profile } from '../lib/types'
import { useAuthStore } from '../store/useAuthStore'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light (1–3 days/week)' },
  { value: 'moderate', label: 'Moderate (3–5 days/week)' },
  { value: 'active', label: 'Active (6–7 days/week)' },
  { value: 'very_active', label: 'Very active' },
]

export function Settings() {
  const session = useAuthStore((s) => s.session)
  const userId = session!.user.id

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      return data as Profile
    },
  })

  return (
    <div className="flex-1 px-5 py-8 max-w-lg mx-auto w-full flex flex-col gap-5">
      <h1 className="font-display text-3xl">Settings</h1>
      {profile ? <SettingsForm profile={profile} userId={userId} /> : <p className="text-ink-soft">Loading…</p>}
    </div>
  )
}

function SettingsForm({ profile, userId }: { profile: Profile; userId: string }) {
  const queryClient = useQueryClient()

  const [sex, setSex] = useState<Sex>((profile.sex as Sex) ?? 'male')
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? '')
  const [heightCm, setHeightCm] = useState(profile.height_cm ? String(profile.height_cm) : '')
  const [currentWeightKg, setCurrentWeightKg] = useState('')
  const [activity, setActivity] = useState<ActivityLevel>((profile.activity_level as ActivityLevel) ?? 'moderate')
  const [goal, setGoal] = useState<GoalType>((profile.goal_type as GoalType) ?? 'maintain')
  const [weeklyRate, setWeeklyRate] = useState(profile.weekly_rate_kg ? Math.abs(profile.weekly_rate_kg) : 0.5)

  const [calories, setCalories] = useState(profile.target_calories ? String(profile.target_calories) : '')
  const [protein, setProtein] = useState(profile.target_protein_g ? String(profile.target_protein_g) : '')
  const [carbs, setCarbs] = useState(profile.target_carbs_g ? String(profile.target_carbs_g) : '')
  const [fat, setFat] = useState(profile.target_fat_g ? String(profile.target_fat_g) : '')
  const [fiber, setFiber] = useState(profile.target_fiber_g ? String(profile.target_fiber_g) : '')
  const [water, setWater] = useState(String(profile.water_target_ml ?? 2500))

  const [weighInKg, setWeighInKg] = useState('')
  const [weighInSaving, setWeighInSaving] = useState(false)
  const [weighInDone, setWeighInDone] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxRate = goal === 'lose' ? MAX_WEEKLY_LOSS_KG : goal === 'gain' ? MAX_WEEKLY_GAIN_KG : 0

  function recalculate() {
    const h = Number(heightCm)
    const w = Number(currentWeightKg) || Number(weighInKg)
    if (!birthDate || !h || !w) {
      setError('Enter height, birth date, and a current weight to recalculate.')
      return
    }
    const targets = computeTargets({
      sex,
      weightKg: w,
      heightCm: h,
      age: ageFromBirthDate(birthDate),
      activity,
      goal,
      requestedWeeklyRateKg: goal === 'maintain' ? 0 : weeklyRate,
    })
    setCalories(String(targets.targetCalories))
    setProtein(String(targets.proteinG))
    setCarbs(String(targets.carbsG))
    setFat(String(targets.fatG))
    setFiber(String(targets.fiberG))
    setError(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        sex,
        birth_date: birthDate || null,
        height_cm: heightCm ? Number(heightCm) : null,
        activity_level: activity,
        goal_type: goal,
        weekly_rate_kg: goal === 'maintain' ? 0 : goal === 'lose' ? -weeklyRate : weeklyRate,
        target_calories: Number(calories) || 0,
        target_protein_g: Number(protein) || 0,
        target_carbs_g: Number(carbs) || 0,
        target_fat_g: Number(fat) || 0,
        target_fiber_g: Number(fiber) || 0,
        water_target_ml: Number(water) || 2500,
      })
      .eq('id', userId)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSaved(true)
    queryClient.invalidateQueries({ queryKey: ['profile', userId] })
  }

  async function logWeighIn() {
    if (!weighInKg) return
    setWeighInSaving(true)
    await supabase.from('weight_logs').insert({
      user_id: userId,
      weight_kg: Number(weighInKg),
      logged_on: localDateISO(),
    })
    setWeighInSaving(false)
    setWeighInDone(true)
    setCurrentWeightKg(weighInKg)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <>
      <PartnerSection userId={userId} />

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-medium">Weigh in</p>
        <div className="flex gap-2">
          <input
            type="number"
            step={0.1}
            value={weighInKg}
            onChange={(e) => {
              setWeighInKg(e.target.value)
              setWeighInDone(false)
            }}
            placeholder="Weight (kg)"
            className="flex-1 rounded-xl border border-ink-soft/20 px-3.5 py-2.5"
          />
          <Button type="button" onClick={logWeighIn} disabled={!weighInKg || weighInSaving} className="whitespace-nowrap">
            {weighInSaving ? 'Saving…' : 'Log'}
          </Button>
        </div>
        {weighInDone && <p className="text-sm text-grow">Logged — remember, day-to-day swings are just water (§ trend).</p>}
      </Card>

      <Card className="flex flex-col gap-4">
        <p className="text-sm font-medium">Body & goal</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Sex</span>
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className="rounded-xl border border-ink-soft/20 px-3 py-2.5">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Birth date</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Height (cm)</span>
            <input
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Weight for calc (kg)</span>
            <input
              type="number"
              step={0.1}
              value={currentWeightKg}
              onChange={(e) => setCurrentWeightKg(e.target.value)}
              placeholder={weighInKg || 'e.g. 72'}
              className="rounded-xl border border-ink-soft/20 px-3 py-2.5"
            />
          </label>
        </div>

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

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-soft">Goal</span>
          <select value={goal} onChange={(e) => setGoal(e.target.value as GoalType)} className="rounded-xl border border-ink-soft/20 px-3 py-2.5">
            <option value="lose">Lose weight</option>
            <option value="maintain">Maintain</option>
            <option value="gain">Gain weight</option>
          </select>
        </label>

        {goal !== 'maintain' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">
              Weekly {goal === 'lose' ? 'loss' : 'gain'} rate — capped at {maxRate} kg/week
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

        <Button type="button" variant="ghost" onClick={recalculate} className="w-full">
          Recalculate targets from my stats
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-medium">Daily targets (editable)</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Calories</span>
            <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} className="rounded-xl border border-ink-soft/20 px-3 py-2.5" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Water (ml)</span>
            <input type="number" value={water} onChange={(e) => setWater(e.target.value)} className="rounded-xl border border-ink-soft/20 px-3 py-2.5" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Protein (g)</span>
            <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} className="rounded-xl border border-ink-soft/20 px-3 py-2.5" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Carbs (g)</span>
            <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} className="rounded-xl border border-ink-soft/20 px-3 py-2.5" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Fat (g)</span>
            <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} className="rounded-xl border border-ink-soft/20 px-3 py-2.5" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Fiber (g)</span>
            <input type="number" value={fiber} onChange={(e) => setFiber(e.target.value)} className="rounded-xl border border-ink-soft/20 px-3 py-2.5" />
          </label>
        </div>
      </Card>

      {error && <p className="text-sm text-her-deep">{error}</p>}
      {saved && <p className="text-sm text-grow">Saved.</p>}

      <Button type="button" onClick={save} disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Save changes'}
      </Button>

      <button type="button" onClick={signOut} className="text-sm text-ink-soft underline text-center">
        Sign out
      </button>
    </>
  )
}
