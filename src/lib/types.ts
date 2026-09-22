import type { ActivityLevel, GoalType, Sex } from './tdee'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  timezone: string
  sex: Sex | null
  birth_date: string | null
  height_cm: number | null
  activity_level: ActivityLevel | null
  goal_type: GoalType | null
  weekly_rate_kg: number | null
  target_calories: number | null
  target_protein_g: number | null
  target_carbs_g: number | null
  target_fat_g: number | null
  target_fiber_g: number | null
  water_target_ml: number
  weight_visible: boolean
  combat_class: string
  cold_start_done: boolean
  onboarded: boolean
  created_at: string
}

export interface Streak {
  user_id: string
  current_streak: number
  longest_streak: number
  freezes_available: number
  last_active_date: string | null
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MealSource = 'ai' | 'manual' | 'voice' | 'barcode' | 'saved'

export interface Meal {
  id: string
  user_id: string
  meal_slot: MealSlot
  photo_url: string | null
  barcode: string | null
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g: number | null
  sodium_mg: number | null
  portion_note: string | null
  grams: number | null
  source: MealSource
  ai_raw: unknown
  logged_at: string
}

export type WorkoutType = 'strength' | 'cardio' | 'mobility' | 'rest'

export interface SetEntry {
  exercise: string
  weight: number
  reps: number
}

export interface Workout {
  id: string
  user_id: string
  workout_type: WorkoutType
  duration_min: number | null
  sets: SetEntry[] | null
  calories_burned: number | null
  done_on: string
  logged_at: string
}

export interface DailyCheckin {
  id: string
  user_id: string
  checkin_date: string
  sleep_quality: number
  energy: number
  mood: number
  note: string | null
}

export type PhotoAngle = 'front' | 'side' | 'back'

export interface ProgressPhoto {
  id: string
  user_id: string
  photo_url: string // storage path within the progress-photos bucket
  angle: PhotoAngle
  taken_at: string
  week_no: number | null
  revealed: boolean
}

export interface WeightLog {
  id: string
  user_id: string
  weight_kg: number
  logged_on: string
}

export interface Measurement {
  id: string
  user_id: string
  measured_on: string
  waist_cm: number | null
  hip_cm: number | null
  chest_cm: number | null
  arm_cm: number | null
  thigh_cm: number | null
}

export interface SharingPrefs {
  user_id: string
  weight_visible: boolean
  measurements_visible: boolean
  photos_visible: boolean
  diary_visible: boolean
}

export type QuestKind = 'steps' | 'protein' | 'workout' | 'rest' | 'water' | 'photo'
export type QuestCategory = 'strength' | 'agility' | 'recovery' | 'shield' | 'recon'

export interface Quest {
  id: string
  user_id: string
  quest_date: string
  kind: QuestKind
  quest_category: QuestCategory | null
  target: number
  progress: number
  completed: boolean
  xp_reward: number
}
