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
