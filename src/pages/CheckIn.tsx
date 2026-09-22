import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { localDateISO as todayISO } from '../lib/date'
import { ensureTodayQuests } from '../lib/quests'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { useAuthStore } from '../store/useAuthStore'

function Slider({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  lowLabel: string
  highLabel: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-ink-soft">{label}</span>
        <span className="font-display text-lg tabular-nums">{value}/5</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-ink-soft">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

export function CheckIn() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const userId = session!.user.id

  const [sleepQuality, setSleepQuality] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [mood, setMood] = useState(3)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const checkin = {
      user_id: userId,
      checkin_date: todayISO(),
      sleep_quality: sleepQuality,
      energy,
      mood,
      note: note || null,
    }

    const { error: checkinError } = await supabase
      .from('daily_checkins')
      .upsert(checkin, { onConflict: 'user_id,checkin_date' })

    if (checkinError) {
      setError(checkinError.message)
      setSaving(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError) {
      setError(profileError.message)
      setSaving(false)
      return
    }

    try {
      await ensureTodayQuests(userId, profile as Profile, checkin)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate today’s quests')
      setSaving(false)
      return
    }

    setSaving(false)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex-1 px-5 py-8 max-w-lg mx-auto w-full">
      <h1 className="font-display text-3xl mb-1">Morning check-in</h1>
      <p className="text-ink-soft mb-6">A bad night means a lighter day — quests adjust to how you're actually doing.</p>

      <form onSubmit={submit} className="flex flex-col gap-5">
        <Card className="flex flex-col gap-6">
          <Slider label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} lowLabel="Rough" highLabel="Great" />
          <Slider label="Energy" value={energy} onChange={setEnergy} lowLabel="Drained" highLabel="Energised" />
          <Slider label="Mood" value={mood} onChange={setMood} lowLabel="Low" highLabel="Great" />
        </Card>

        <Card>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Anything else? (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="rounded-xl border border-ink-soft/20 px-3.5 py-2.5 outline-none focus:border-you resize-none"
              placeholder="Sore legs, traveling today, feeling good…"
            />
          </label>
        </Card>

        {error && <p className="text-sm text-her-deep">{error}</p>}

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Saving…' : "Save & see today's quests"}
        </Button>
      </form>
    </div>
  )
}
