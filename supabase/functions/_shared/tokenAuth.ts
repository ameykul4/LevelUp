import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

// Shortcuts/Scriptable have no browser session, so they authenticate with a
// long-lived per-user token (api_tokens) instead of a Supabase JWT.
export async function userIdFromToken(req: Request, supabase: SupabaseClient): Promise<string | null> {
  const token = req.headers.get('x-api-token') ?? new URL(req.url).searchParams.get('token')
  if (!token) return null

  const { data } = await supabase.from('api_tokens').select('user_id').eq('token', token).single()
  return data?.user_id ?? null
}
