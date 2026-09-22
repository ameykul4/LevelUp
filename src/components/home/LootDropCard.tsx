import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { LootDrop } from '../../lib/types'

const CONFETTI_COLORS = ['#14B8C4', '#FB6F92', '#F5B841', '#2FBF87', '#9B8CFF']

const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2
  const distance = 60 + ((i * 37) % 40) // deterministic jitter — looks random, stays pure
  return { angle, distance, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }
})

function Confetti() {
  return (
    <>
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
          style={{ backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance,
            opacity: 0,
            scale: 0.5,
          }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

export function LootDropCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const [claiming, setClaiming] = useState<string | null>(null)
  const [burst, setBurst] = useState(false)

  const { data: drops = [] } = useQuery({
    queryKey: ['loot-drops', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loot_drops')
        .select('*')
        .eq('user_id', userId)
        .eq('claimed', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as LootDrop[]
    },
  })

  async function claim(id: string) {
    setClaiming(id)
    setBurst(true)
    await supabase.from('loot_drops').update({ claimed: true }).eq('id', id)
    setTimeout(async () => {
      setBurst(false)
      setClaiming(null)
      queryClient.invalidateQueries({ queryKey: ['loot-drops', userId] })
    }, 700)
  }

  const drop = drops[0]

  return (
    <AnimatePresence>
      {drop && (
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="relative rounded-(--radius) p-5 bg-loot/15 border border-loot/30 overflow-hidden"
        >
          {burst && claiming === drop.id && <Confetti />}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg">🎁 Loot drop!</p>
              <p className="text-sm text-ink-soft">
                You hit every target on {drop.payload?.date ?? 'that day'} — a full house.
              </p>
            </div>
            <button
              type="button"
              onClick={() => claim(drop.id)}
              disabled={claiming === drop.id}
              className="shrink-0 rounded-full bg-loot text-ink px-4 py-2 text-sm font-semibold"
            >
              Claim
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
