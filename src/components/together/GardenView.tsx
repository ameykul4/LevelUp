import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface GardenPlant {
  id: string
  species: string
  stage: 'seed' | 'sprout' | 'bud' | 'bloom'
  planted_for: string | null
  your_water: number
  her_water: number
  wilting: boolean
  created_at: string
}

const SPECIES_EMOJI: Record<string, string> = {
  rose: '🌹',
  marigold: '🌼',
  lotus: '🪷',
  sunflower: '🌻',
  tulip: '🌷',
  jasmine: '🌸',
}

const STAGE_SCALE: Record<GardenPlant['stage'], number> = { seed: 0.5, sprout: 0.7, bud: 0.85, bloom: 1 }

export function GardenView({ userId, coupleId }: { userId: string; coupleId: string }) {
  const queryClient = useQueryClient()
  const [watering, setWatering] = useState<string | null>(null)

  const { data: plants = [] } = useQuery({
    queryKey: ['garden-plants', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('garden_plants')
        .select('*')
        .eq('couple_id', coupleId)
        .order('position')
      if (error) throw error
      return data as GardenPlant[]
    },
  })

  const { data: balance = 0 } = useQuery({
    queryKey: ['water-drops', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('water_drops').select('balance').eq('user_id', userId).single()
      if (error) throw error
      return data.balance as number
    },
  })

  async function water(plantId: string) {
    setWatering(plantId)
    const { error } = await supabase.rpc('water_plant', { target_plant_id: plantId, drops: Math.min(5, balance) })
    setWatering(null)
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['garden-plants', coupleId] })
      queryClient.invalidateQueries({ queryKey: ['water-drops', userId] })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card tint="you" className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">💧 Your water drops</span>
        <span className="font-display text-2xl tabular-nums">{balance}</span>
      </Card>

      {plants.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-soft text-center py-8">
            Your first plant arrives after a week of you both showing up. Keep going.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {plants.map((p) => (
            <Card key={p.id} className="flex flex-col items-center gap-2 text-center">
              <motion.span
                className="text-5xl"
                animate={{
                  scale: STAGE_SCALE[p.stage],
                  rotate: p.wilting ? [-2, 2, -2] : 0,
                  filter: p.wilting ? 'saturate(0.5) brightness(0.9)' : 'saturate(1) brightness(1)',
                }}
                transition={{ rotate: { repeat: p.wilting ? Infinity : 0, duration: 2 } }}
              >
                {p.stage === 'seed' ? '🌱' : SPECIES_EMOJI[p.species] ?? '🌱'}
              </motion.span>
              <p className="text-xs text-ink-soft capitalize">
                {p.species} · {p.stage}
                {p.wilting && ' · 🥀 thirsty'}
              </p>
              <p className="text-xs text-ink-soft">
                💧 you {p.your_water} · they {p.her_water}
              </p>
              {p.stage !== 'bloom' && (
                <Button
                  type="button"
                  variant="you"
                  onClick={() => water(p.id)}
                  disabled={balance <= 0 || watering === p.id}
                  className="px-3! py-1.5! text-xs w-full"
                >
                  {watering === p.id ? 'Watering…' : `Water (${Math.min(5, balance)})`}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
