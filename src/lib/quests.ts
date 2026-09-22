// Daily quest scaffold (BUILD_PLAN §6g, §9 Phase 2). Generates today's quest
// list from targets + the morning check-in — a bad night means a lighter day.
// Progress/XP wiring happens in Phase 5; this just decides *what* today's
// quests are and stores them so the list is stable once generated.

import { supabase } from './supabase'
import type { DailyCheckin, Profile, QuestCategory, QuestKind } from './types'

const DEFAULT_STEPS_TARGET = 8000 // cold-start "Adventurer" loadout (§7.4D) until per-user steps targets exist

interface QuestSeed {
  kind: QuestKind
  quest_category: QuestCategory
  target: number
}

export function planTodayQuests(profile: Profile, checkin: Pick<DailyCheckin, 'sleep_quality'>): QuestSeed[] {
  const lowSleep = checkin.sleep_quality <= 2

  return [
    { kind: 'water', quest_category: 'shield', target: profile.water_target_ml ?? 2500 },
    { kind: 'protein', quest_category: 'strength', target: profile.target_protein_g ?? 0 },
    { kind: 'steps', quest_category: 'agility', target: DEFAULT_STEPS_TARGET },
    lowSleep
      ? { kind: 'rest', quest_category: 'recovery', target: 1 }
      : { kind: 'workout', quest_category: 'strength', target: 1 },
  ]
}

export async function ensureTodayQuests(
  userId: string,
  profile: Profile,
  checkin: Pick<DailyCheckin, 'checkin_date' | 'sleep_quality'>,
) {
  const { data: existing, error: existingError } = await supabase
    .from('quests')
    .select('id')
    .eq('user_id', userId)
    .eq('quest_date', checkin.checkin_date)
    .limit(1)

  if (existingError) throw existingError
  if (existing.length > 0) return // already generated for today — don't duplicate

  const seeds = planTodayQuests(profile, checkin)
  const { error: insertError } = await supabase.from('quests').insert(
    seeds.map((s) => ({
      user_id: userId,
      quest_date: checkin.checkin_date,
      kind: s.kind,
      quest_category: s.quest_category,
      target: s.target,
    })),
  )
  if (insertError) throw insertError
}
