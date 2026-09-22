import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useCouple } from '../../hooks/useCouple'
import { supabase } from '../../lib/supabase'
import type { SharingPrefs } from '../../lib/types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

export function PartnerSection({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const { isPaired, partner, loading } = useCouple(userId)

  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [redeemInput, setRedeemInput] = useState('')
  const [inviting, setInviting] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [unpairing, setUnpairing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: prefs } = useQuery({
    queryKey: ['sharing-prefs', userId],
    enabled: isPaired,
    queryFn: async () => {
      const { data, error } = await supabase.from('sharing_prefs').select('*').eq('user_id', userId).single()
      if (error) throw error
      return data as SharingPrefs
    },
  })

  async function invite() {
    setInviting(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_invite_code')
    setInviting(false)
    if (error) {
      setError(error.message)
      return
    }
    setInviteCode(data as string)
  }

  async function redeem() {
    if (!redeemInput.trim()) return
    setRedeeming(true)
    setError(null)
    const { error } = await supabase.rpc('redeem_invite_code', { input_code: redeemInput.trim() })
    setRedeeming(false)
    if (error) {
      setError(error.message)
      return
    }
    setRedeemInput('')
    queryClient.invalidateQueries({ queryKey: ['couple-id', userId] })
  }

  async function unpair() {
    setUnpairing(true)
    await supabase.rpc('leave_couple')
    setUnpairing(false)
    queryClient.invalidateQueries({ queryKey: ['couple-id', userId] })
  }

  async function togglePref(key: keyof Omit<SharingPrefs, 'user_id'>, value: boolean) {
    await supabase.from('sharing_prefs').update({ [key]: value }).eq('user_id', userId)
    queryClient.invalidateQueries({ queryKey: ['sharing-prefs', userId] })
  }

  if (loading) return null

  if (!isPaired) {
    return (
      <Card className="flex flex-col gap-4">
        <p className="text-sm font-medium">Partner</p>

        {inviteCode ? (
          <div className="text-center py-2">
            <p className="text-sm text-ink-soft mb-1">Share this code — it expires in ~15 minutes</p>
            <p className="font-display text-4xl tracking-[0.2em]">{inviteCode}</p>
          </div>
        ) : (
          <Button type="button" onClick={invite} disabled={inviting} className="w-full">
            {inviting ? 'Generating…' : 'Invite my partner'}
          </Button>
        )}

        <div className="flex items-center gap-3 text-ink-soft text-xs">
          <div className="h-px flex-1 bg-ink-soft/15" />
          or
          <div className="h-px flex-1 bg-ink-soft/15" />
        </div>

        <div className="flex gap-2">
          <input
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
            placeholder="Enter their code"
            maxLength={6}
            className="flex-1 rounded-xl border border-ink-soft/20 px-3.5 py-2.5 text-center tracking-[0.2em] uppercase"
          />
          <Button type="button" variant="ghost" onClick={redeem} disabled={!redeemInput.trim() || redeeming}>
            {redeeming ? 'Pairing…' : 'Pair'}
          </Button>
        </div>

        {error && <p className="text-sm text-her-deep">{error}</p>}
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-sm font-medium">Partner</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-together flex items-center justify-center text-white font-display">
          {partner?.display_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <p className="font-medium">{partner?.display_name ?? 'Your partner'}</p>
      </div>

      {prefs && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-soft">Share with {partner?.display_name?.split(' ')[0] ?? 'your partner'}</p>
          {(
            [
              ['weight_visible', 'Weight'],
              ['measurements_visible', 'Measurements'],
              ['photos_visible', 'Progress photos'],
              ['diary_visible', "Today's diary detail"],
            ] as [keyof Omit<SharingPrefs, 'user_id'>, string][]
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between text-sm py-1">
              {label}
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => togglePref(key, e.target.checked)}
              />
            </label>
          ))}
        </div>
      )}

      <button type="button" onClick={unpair} disabled={unpairing} className="text-sm text-her-deep underline text-center">
        {unpairing ? 'Unpairing…' : 'Unpair'}
      </button>
    </Card>
  )
}
