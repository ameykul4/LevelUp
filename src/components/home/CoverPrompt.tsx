import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useCouple } from '../../hooks/useCouple'
import { localDateISO } from '../../lib/date'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

function startOfWeekISO(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDay() === 0 ? 7 : d.getDay() // ISO week: Monday = 1
  d.setDate(d.getDate() - day + 1)
  return localDateISO(d)
}

export function CoverPrompt({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const { partner } = useCouple(userId)
  const [dismissed, setDismissed] = useState(false)
  const [spending, setSpending] = useState(false)
  const today = localDateISO()
  const weekOf = startOfWeekISO(today)

  const { data: partnerLowEnergy = false } = useQuery({
    queryKey: ['partner-checkin', partner?.id, today],
    enabled: !!partner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('sleep_quality, energy')
        .eq('user_id', partner!.id)
        .eq('checkin_date', today)
        .maybeSingle()
      if (error) throw error
      return !!data && (data.sleep_quality <= 2 || data.energy <= 2)
    },
  })

  const { data: alreadyUsedThisWeek = false } = useQuery({
    queryKey: ['my-cover-used', userId, weekOf],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cover_events')
        .select('id')
        .eq('covered_by', userId)
        .eq('week_of', weekOf)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
  })

  const { data: alreadyCoveredToday = false } = useQuery({
    queryKey: ['partner-covered-today', partner?.id, today],
    enabled: !!partner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cover_events')
        .select('id')
        .eq('covered_for', partner!.id)
        .eq('for_date', today)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
  })

  async function confirm() {
    if (!partner) return
    setSpending(true)
    await supabase.rpc('spend_cover', { covered_for_user: partner.id, cover_for_date: today })
    setSpending(false)
    queryClient.invalidateQueries({ queryKey: ['my-cover-used'] })
    queryClient.invalidateQueries({ queryKey: ['partner-covered-today'] })
  }

  if (!partner || dismissed || !partnerLowEnergy || alreadyUsedThisWeek || alreadyCoveredToday) return null

  return (
    <Card tint="her" className="flex flex-col gap-2">
      <p className="font-medium">
        {partner.display_name.split(' ')[0]}'s running on empty today
      </p>
      <p className="text-sm text-ink-soft">Spend your weekly Cover to protect the shared streak?</p>
      <div className="flex gap-2 mt-1">
        <Button type="button" variant="her" onClick={confirm} disabled={spending} className="flex-1">
          {spending ? 'Covering…' : 'Confirm'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setDismissed(true)} className="flex-1">
          Not today
        </Button>
      </div>
    </Card>
  )
}
