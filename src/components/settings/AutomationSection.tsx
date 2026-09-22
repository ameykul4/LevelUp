import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

const FUNCTIONS_BASE = 'https://yysoevmtllpbbhhhwrmf.supabase.co/functions/v1'

export function AutomationSection() {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data: token } = useQuery({
    queryKey: ['api-token'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_or_create_api_token')
      if (error) throw error
      return data as string
    },
  })

  async function copy() {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm font-medium">Widgets & Shortcuts</p>
      <p className="text-sm text-ink-soft">
        This token lets your Home Screen widget and Shortcuts act on your account without opening the app. Keep it
        private — anyone with it can log water/steps as you.
      </p>

      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-xl bg-ink/5 px-3.5 py-2.5 text-sm font-mono truncate">
          {token ? (revealed ? token : '•'.repeat(24)) : 'Generating…'}
        </code>
        <Button type="button" variant="ghost" onClick={() => setRevealed(!revealed)} className="px-3! py-2! text-sm">
          {revealed ? 'Hide' : 'Show'}
        </Button>
        <Button type="button" variant="ghost" onClick={copy} disabled={!token} className="px-3! py-2! text-sm">
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <p className="text-xs text-ink-soft">Function endpoints (used inside your Shortcuts):</p>
      <ul className="text-xs text-ink-soft font-mono flex flex-col gap-0.5">
        <li>{FUNCTIONS_BASE}/log-water</li>
        <li>{FUNCTIONS_BASE}/sync-steps</li>
        <li>{FUNCTIONS_BASE}/widget-data</li>
      </ul>
    </Card>
  )
}
