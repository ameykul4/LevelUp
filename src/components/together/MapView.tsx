import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import { supabase } from '../../lib/supabase'
import type { CampaignLandmark, CampaignMap, CoOpBoss } from '../../lib/types'

export function MapView({ coupleId }: { coupleId: string }) {
  const { data: map } = useQuery({
    queryKey: ['campaign-map', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('campaign_map').select('*').eq('couple_id', coupleId).single()
      if (error) throw error
      return data as CampaignMap
    },
  })

  const { data: landmarks = [] } = useQuery({
    queryKey: ['campaign-landmarks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('campaign_landmarks').select('*').order('distance_km')
      if (error) throw error
      return data as CampaignLandmark[]
    },
  })

  const { data: boss } = useQuery({
    queryKey: ['co-op-boss', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('co_op_bosses')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('status', 'active')
        .maybeSingle()
      if (error) throw error
      return data as CoOpBoss | null
    },
  })

  if (!map) return null

  const pct = Math.min((map.distance_covered_km / map.total_distance_km) * 100, 100)

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-soft">
        {map.distance_covered_km.toFixed(1)} / {map.total_distance_km} km closer — {map.season}
      </p>

      <Card tint="you">
        <div className="relative h-3 rounded-full bg-ink/5 overflow-hidden mb-6 mt-2">
          <motion.div
            className="absolute inset-y-0 left-0 bg-together rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
        </div>

        <div className="flex flex-col gap-4">
          {landmarks.map((l) => {
            const reached = map.distance_covered_km >= l.distance_km
            const isCurrent = map.current_landmark === l.name
            return (
              <div key={l.name} className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${reached ? 'bg-you' : 'bg-ink/15'} ${
                    isCurrent ? 'ring-4 ring-you-tint' : ''
                  }`}
                />
                <span className={`text-sm ${reached ? 'text-ink' : 'text-ink-soft'}`}>{l.name}</span>
                <span className="text-xs text-ink-soft ml-auto tabular-nums">{l.distance_km} km</span>
              </div>
            )
          })}
        </div>
      </Card>

      {boss && (
        <Card tint="her" className="flex flex-col gap-3">
          <div>
            <p className="font-display text-xl">🐉 {boss.name} blocks the path</p>
            <p className="text-sm text-ink-soft">
              Your steps have become combat — hit your daily targets together to break through.
            </p>
          </div>
          <ProgressBar label="Boss HP" current={boss.max_hp - boss.current_hp} target={boss.max_hp} color="her" />
          <div className="flex justify-between text-xs text-ink-soft">
            <span>Your damage: {boss.your_damage}</span>
            <span>Their damage: {boss.her_damage}</span>
          </div>
        </Card>
      )}

      {!boss && (
        <Card>
          <p className="text-sm text-ink-soft text-center py-2">
            The road is clear — combined steps move you both closer to{' '}
            {landmarks.find((l) => l.distance_km > map.distance_covered_km)?.name ?? 'the end'}.
          </p>
        </Card>
      )}
    </div>
  )
}
