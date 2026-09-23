// send-push — internal only, called by the reminder-scheduling SQL function
// via pg_net (never directly by the client). Protected by a shared secret
// instead of a user JWT since pg_net has neither.

import webpush from 'https://esm.sh/web-push@3.6.7'
import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts'
import { adminClient } from '../_shared/tokenAuth.ts'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  if (req.headers.get('x-internal-secret') !== Deno.env.get('INTERNAL_FUNCTION_SECRET')) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const { user_id, title, body, url } = await req.json()
  if (!user_id || !title) return jsonResponse({ error: 'user_id and title are required' }, 400)

  const supabase = adminClient()
  const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', user_id)
  if (!subs || subs.length === 0) return jsonResponse({ sent: 0 })

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url: url ?? '/' }),
      )
      sent++
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return jsonResponse({ sent })
})
