import { loggedAtForDate } from './date'
import { supabase } from './supabase'
import type { MealSlot } from './types'

export interface AnalyzeMealResult {
  name: string
  grams: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g?: number
  sodium_mg?: number
  ai_raw?: unknown
}

interface AnalyzeMealParams {
  imageBase64?: string
  imageMimeType?: string
  audioBase64?: string
  audioMimeType?: string
  note?: string
  grams?: number
}

export async function analyzeMeal(params: AnalyzeMealParams): Promise<AnalyzeMealResult> {
  const { data, error } = await supabase.functions.invoke<AnalyzeMealResult & { error?: string }>('analyze-meal', {
    body: params,
  })
  if (error) throw error
  if (!data || data.error) throw new Error(data?.error ?? 'Analysis failed')
  return data
}

export async function saveAnalyzedMeal(params: {
  userId: string
  date: string
  mealSlot: MealSlot
  source: 'ai' | 'voice'
  result: AnalyzeMealResult
}) {
  const { userId, date, mealSlot, source, result } = params
  const { error } = await supabase.from('meals').insert({
    user_id: userId,
    meal_slot: mealSlot,
    name: result.name,
    grams: result.grams,
    calories: Math.round(result.calories),
    protein_g: result.protein_g,
    carbs_g: result.carbs_g,
    fat_g: result.fat_g,
    fiber_g: result.fiber_g,
    sugar_g: result.sugar_g ?? null,
    sodium_mg: result.sodium_mg ?? null,
    source,
    ai_raw: result.ai_raw ?? null,
    logged_at: loggedAtForDate(date),
  })
  if (error) throw error
}
