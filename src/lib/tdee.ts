// Mifflin–St Jeor TDEE + target calculator (BUILD_PLAN §6c), with the §2.3
// safety guardrails baked in: weekly rate is capped to a sustainable range
// and the target never drops below a safe calorie floor.

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type GoalType = 'lose' | 'maintain' | 'gain'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const KCAL_PER_KG_FAT = 7700
const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 }

// §2.3: cap the weekly rate to a sustainable range regardless of what the user enters.
export const MAX_WEEKLY_LOSS_KG = 1.0
export const MAX_WEEKLY_GAIN_KG = 0.5

export function ageFromBirthDate(birthDate: string, today = new Date()): number {
  const dob = new Date(birthDate)
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function tdee(sex: Sex, weightKg: number, heightCm: number, age: number, activity: ActivityLevel): number {
  return bmr(sex, weightKg, heightCm, age) * ACTIVITY_MULTIPLIERS[activity]
}

export function clampWeeklyRate(goal: GoalType, requestedKg: number): number {
  const magnitude = Math.abs(requestedKg)
  if (goal === 'lose') return -Math.min(magnitude, MAX_WEEKLY_LOSS_KG)
  if (goal === 'gain') return Math.min(magnitude, MAX_WEEKLY_GAIN_KG)
  return 0
}

export interface Targets {
  maintenanceCalories: number
  targetCalories: number
  weeklyRateKg: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
}

export function computeTargets(params: {
  sex: Sex
  weightKg: number
  heightCm: number
  age: number
  activity: ActivityLevel
  goal: GoalType
  requestedWeeklyRateKg: number
}): Targets {
  const { sex, weightKg, heightCm, age, activity, goal, requestedWeeklyRateKg } = params

  const maintenance = tdee(sex, weightKg, heightCm, age, activity)
  const weeklyRateKg = clampWeeklyRate(goal, requestedWeeklyRateKg)
  const dailyDelta = (weeklyRateKg * KCAL_PER_KG_FAT) / 7

  const floor = CALORIE_FLOOR[sex]
  const targetCalories = Math.max(Math.round(maintenance + dailyDelta), floor)

  // Protein ~1.8g/kg (supports both fat loss and muscle gain), fat 25% of
  // calories, carbs fill the remainder — editable by the user afterwards (§6c).
  const proteinG = Math.round(weightKg * 1.8)
  const fatG = Math.round((targetCalories * 0.25) / 9)
  const carbsG = Math.max(Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4), 0)
  const fiberG = Math.round((targetCalories / 1000) * 14)

  return {
    maintenanceCalories: Math.round(maintenance),
    targetCalories,
    weeklyRateKg,
    proteinG,
    carbsG,
    fatG,
    fiberG,
  }
}
