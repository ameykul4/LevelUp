// log-water — called from a Shortcut (Back Tap / Action button / widget tap)
// so "+1 glass" works without opening the app (§9 Phase 6).

import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts'
import { adminClient, userIdFromToken } from '../_shared/tokenAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const supabase = adminClient()
  const userId = await userIdFromToken(req, supabase)
  if (!userId) return jsonResponse({ error: 'Invalid or missing token' }, 401)

  const body = await req.json().catch(() => ({}))
  const amountMl = typeof body.amount_ml === 'number' ? body.amount_ml : 250

  const { error } = await supabase.from('water_logs').insert({ user_id: userId, amount_ml: amountMl })
  if (error) return jsonResponse({ error: error.message }, 500)

  return jsonResponse({ ok: true, amount_ml: amountMl })
})
