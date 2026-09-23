import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getPushSubscription, pushSupported, subscribeToPush, unsubscribeFromPush } from '../../lib/push'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

export function NotificationsSection({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supported = pushSupported()

  const { data: subscribed = false } = useQuery({
    queryKey: ['push-subscribed'],
    enabled: supported,
    queryFn: async () => !!(await getPushSubscription()),
  })

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (subscribed) {
        await unsubscribeFromPush()
      } else {
        await subscribeToPush(userId)
      }
      queryClient.invalidateQueries({ queryKey: ['push-subscribed'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update notifications')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-2">
      <p className="text-sm font-medium">Notifications</p>
      <p className="text-sm text-ink-soft">
        Gentle nudges — behind on water in the afternoon, a photo reminder in the evening. Nothing between 9pm and
        9am.
      </p>
      {!supported ? (
        <p className="text-sm text-ink-soft">Not supported on this browser.</p>
      ) : (
        <Button type="button" variant={subscribed ? 'ghost' : 'you'} onClick={toggle} disabled={busy}>
          {busy ? 'Working…' : subscribed ? 'Turn off notifications' : 'Turn on notifications'}
        </Button>
      )}
      {error && <p className="text-sm text-her-deep">{error}</p>}
    </Card>
  )
}
