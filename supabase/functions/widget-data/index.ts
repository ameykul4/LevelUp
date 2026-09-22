// widget-data — read-only JSON for the Scriptable Home Screen widget (§9
// Phase 6): your water % and your partner's streak, at a glance, no app open.

import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts'
import { adminClient, userIdFromToken } from '../_shared/tokenAuth.ts'

function localDateISO(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz }) // en-CA formats as YYYY-MM-DD
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const supabase = adminClient()
  const userId = await userIdFromToken(req, supabase)
  if (!userId) return jsonResponse({ error: 'Invalid or missing token' }, 401)

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, water_target_ml, timezone')
    .eq('id', userId)
    .single()
  if (!profile) return jsonResponse({ error: 'Profile not found' }, 404)

  const { data: streak } = await supabase.from('streaks').select('current_streak, freezes_available').eq('user_id', userId).single()

  const tz = profile.timezone ?? 'Asia/Kolkata'
  const today = localDateISO(tz)

  const { data: bounds } = await supabase.rpc('local_day_bounds', { for_date: today, tz }).single()
  const { data: waterLogs } = await supabase
    .from('water_logs')
    .select('amount_ml')
    .eq('user_id', userId)
    .gte('logged_at', bounds!.day_start)
    .lt('logged_at', bounds!.day_end)
  const waterMl = (waterLogs ?? []).reduce((sum, r) => sum + r.amount_ml, 0)

  let partner: { display_name: string; current_streak: number } | null = null
  const { data: membership } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId).maybeSingle()
  if (membership) {
    const { data: partnerRow } = await supabase
      .from('couple_members')
      .select('user_id')
      .eq('couple_id', membership.couple_id)
      .neq('user_id', userId)
      .maybeSingle()
    if (partnerRow) {
      const [{ data: partnerProfile }, { data: partnerStreak }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', partnerRow.user_id).single(),
        supabase.from('streaks').select('current_streak').eq('user_id', partnerRow.user_id).single(),
      ])
      if (partnerProfile) {
        partner = { display_name: partnerProfile.display_name, current_streak: partnerStreak?.current_streak ?? 0 }
      }
    }
  }

  return jsonResponse({
    display_name: profile.display_name,
    current_streak: streak?.current_streak ?? 0,
    freezes_available: streak?.freezes_available ?? 0,
    water_ml: waterMl,
    water_target_ml: profile.water_target_ml ?? 2500,
    partner,
  })
})
