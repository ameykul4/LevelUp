// sync-steps — called from a daily Shortcuts automation that reads Apple
// Health and posts the count (§9 Phase 6). iOS throttles background
// automations, so the app also has a manual "Refresh steps" pull (§8.5C) —
// no streak/quest ever depends on this background job actually firing.

import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts'
import { adminClient, userIdFromToken } from '../_shared/tokenAuth.ts'

function localDateISO(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz }) // en-CA locale formats as YYYY-MM-DD
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const supabase = adminClient()
  const userId = await userIdFromToken(req, supabase)
  if (!userId) return jsonResponse({ error: 'Invalid or missing token' }, 401)

  const body = await req.json().catch(() => ({}))
  const steps = Number(body.steps)
  if (!Number.isFinite(steps) || steps < 0) return jsonResponse({ error: 'Provide a non-negative "steps" number.' }, 400)

  let stepDate: string = body.date
  if (!stepDate) {
    const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', userId).single()
    stepDate = localDateISO(profile?.timezone ?? 'Asia/Kolkata')
  }

  const { error } = await supabase
    .from('steps')
    .upsert({ user_id: userId, step_date: stepDate, step_count: Math.round(steps), synced_at: new Date().toISOString() }, { onConflict: 'user_id,step_date' })
  if (error) return jsonResponse({ error: error.message }, 500)

  return jsonResponse({ ok: true, step_date: stepDate, steps: Math.round(steps) })
})
