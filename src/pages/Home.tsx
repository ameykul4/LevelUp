import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { supabase } from '../lib/supabase'
import type { Profile, Streak } from '../lib/types'
import { useAuthStore } from '../store/useAuthStore'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function Home() {
  const session = useAuthStore((s) => s.session)
  const userId = session!.user.id
  const queryClient = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      return data as Profile
    },
  })

  const { data: streak } = useQuery({
    queryKey: ['streak', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('streaks').select('*').eq('user_id', userId).single()
      if (error) throw error
      return data as Streak
    },
  })

  const { data: waterMl = 0 } = useQuery({
    queryKey: ['water', userId, todayISO()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_id', userId)
        .gte('logged_at', `${todayISO()}T00:00:00`)
      if (error) throw error
      return data.reduce((sum, row) => sum + row.amount_ml, 0)
    },
  })

  async function logGlass() {
    await supabase.from('water_logs').insert({ user_id: userId, amount_ml: 250 })
    queryClient.invalidateQueries({ queryKey: ['water', userId] })
  }

  const firstName = profile?.display_name?.split(' ')[0] ?? ''
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex-1 px-5 py-8 max-w-lg mx-auto w-full flex flex-col gap-5">
      <div>
        <p className="text-ink-soft">
          {greeting}, {firstName}
        </p>
        <div className="flex items-center gap-4 mt-1">
          <p className="font-display text-3xl">
            🔥 {streak?.current_streak ?? 0} <span className="text-lg text-ink-soft">day streak</span>
          </p>
        </div>
        <p className="text-sm text-ink-soft">❄️ {streak?.freezes_available ?? 0} freezes available</p>
      </div>

      <Card tint="you">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-ink-soft">💧 Water</span>
          <Button variant="you" onClick={logGlass} className="!px-4 !py-1.5 text-sm">
            +1 glass
          </Button>
        </div>
        <ProgressBar
          label="Today"
          current={waterMl}
          target={profile?.water_target_ml ?? 2500}
          unit="ml"
          color="you"
        />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-ink-soft">🍽 Today</span>
          <span className="text-sm text-ink-soft">Meal logging arrives in Phase 2</span>
        </div>
        <div className="flex flex-col gap-3">
          <ProgressBar label="Calories" current={0} target={profile?.target_calories ?? 0} unit=" kcal" color="loot" />
          <ProgressBar label="Protein" current={0} target={profile?.target_protein_g ?? 0} unit="g" color="you" />
          <ProgressBar label="Carbs" current={0} target={profile?.target_carbs_g ?? 0} unit="g" color="grow" />
          <ProgressBar label="Fat" current={0} target={profile?.target_fat_g ?? 0} unit="g" color="calm" />
          <ProgressBar label="Fiber" current={0} target={profile?.target_fiber_g ?? 0} unit="g" color="her" />
        </div>
      </Card>

      <Card className="bg-together text-white">
        <p className="font-display text-lg mb-1">LevelUp together</p>
        <p className="text-sm text-white/90">
          Pair with your partner to unlock the shared feed, streak and campaign map.
        </p>
      </Card>
    </div>
  )
}
