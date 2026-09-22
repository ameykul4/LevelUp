import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useCouple } from '../../hooks/useCouple'
import { endOfLocalDayISO, localDateISO as todayISO, startOfLocalDayISO } from '../../lib/date'
import { supabase } from '../../lib/supabase'
import type { Streak } from '../../lib/types'
import { Card } from '../ui/Card'

export function TogetherCard({ userId }: { userId: string }) {
  const { isPaired, partner, loading } = useCouple(userId)

  const { data: partnerStreak } = useQuery({
    queryKey: ['streak', partner?.id],
    enabled: !!partner,
    queryFn: async () => {
      const { data, error } = await supabase.from('streaks').select('*').eq('user_id', partner!.id).single()
      if (error) throw error
      return data as Streak
    },
  })

  const { data: partnerWaterMl = 0 } = useQuery({
    queryKey: ['water', partner?.id, todayISO()],
    enabled: !!partner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_id', partner!.id)
        .gte('logged_at', startOfLocalDayISO(todayISO()))
        .lt('logged_at', endOfLocalDayISO(todayISO()))
      if (error) throw error
      return data.reduce((sum, row) => sum + row.amount_ml, 0)
    },
  })

  const { data: partnerWorkedOut = false } = useQuery({
    queryKey: ['workouts', partner?.id, todayISO()],
    enabled: !!partner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', partner!.id)
        .eq('done_on', todayISO())
        .neq('workout_type', 'rest')
      if (error) throw error
      return data.length > 0
    },
  })

  const { data: partnerCheckedIn = false } = useQuery({
    queryKey: ['checkin', partner?.id, todayISO()],
    enabled: !!partner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('user_id', partner!.id)
        .eq('checkin_date', todayISO())
        .maybeSingle()
      if (error) throw error
      return !!data
    },
  })

  if (loading) return null

  if (!isPaired) {
    return (
      <Card className="bg-together text-white">
        <p className="font-display text-lg mb-1">LevelUp together</p>
        <p className="text-sm text-white/90 mb-3">Pair with your partner to unlock the shared feed and streak.</p>
        <Link to="/settings" className="text-sm font-medium underline">
          Invite your partner →
        </Link>
      </Card>
    )
  }

  const waterPct = partnerWaterMl > 0 ? Math.min(Math.round((partnerWaterMl / 2500) * 100), 100) : 0

  return (
    <Card className="bg-together text-white">
      <p className="font-display text-lg mb-3">{partner?.display_name?.split(' ')[0] ?? 'Your partner'}'s day</p>
      <div className="flex flex-col gap-1.5 text-sm text-white/90">
        <p>🔥 {partnerStreak?.current_streak ?? 0} day streak</p>
        <p>💧 {partnerWaterMl > 0 ? `${waterPct}% of water target` : 'No water logged yet'}</p>
        <p>{partnerCheckedIn ? '☀️ Checked in this morning' : '💤 Hasn\'t checked in yet'}</p>
        <p>{partnerWorkedOut ? '🏋️ Logged a workout today' : '🌱 No workout logged yet'}</p>
      </div>
    </Card>
  )
}
