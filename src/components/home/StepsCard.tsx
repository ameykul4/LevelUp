import { useQuery, useQueryClient } from '@tanstack/react-query'
import { localDateISO } from '../../lib/date'
import { supabase } from '../../lib/supabase'
import type { StepsRow } from '../../lib/types'
import { Card } from '../ui/Card'

const STEPS_TARGET = 8000 // cold-start default (§7.4D) until per-user step targets exist

export function StepsCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const today = localDateISO()

  const { data: steps } = useQuery({
    queryKey: ['steps', userId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('steps')
        .select('*')
        .eq('user_id', userId)
        .eq('step_date', today)
        .maybeSingle()
      if (error) throw error
      return data as StepsRow | null
    },
  })

  function refresh() {
    // iOS throttles background automations (§8.5C) — this deep-links into the
    // named Shortcut so steps can be pulled on demand instead of waiting.
    window.location.href = 'shortcuts://run-shortcut?name=LevelUp%20Sync%20Steps'
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['steps', userId, today] }), 2000)
  }

  const count = steps?.step_count ?? 0
  const pct = Math.min(Math.round((count / STEPS_TARGET) * 100), 100)

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-ink-soft">🚶 Steps</span>
        <button type="button" onClick={refresh} className="text-sm text-you-deep font-medium">
          Refresh
        </button>
      </div>
      <p className="font-display text-2xl tabular-nums">
        {count.toLocaleString()} <span className="text-sm text-ink-soft font-sans">/ {STEPS_TARGET.toLocaleString()} ({pct}%)</span>
      </p>
      {!steps && <p className="text-xs text-ink-soft mt-1">No sync yet today — set up the Shortcut in Settings, or tap Refresh.</p>}
    </Card>
  )
}
