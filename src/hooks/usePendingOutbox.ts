import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getPendingMeals } from '../lib/outbox'
import { processOutbox } from '../lib/processOutbox'

export function usePendingOutbox() {
  const queryClient = useQueryClient()
  const [processing, setProcessing] = useState(false)

  const { data: count = 0 } = useQuery({
    queryKey: ['outbox-count'],
    queryFn: async () => (await getPendingMeals()).length,
    refetchInterval: 30_000,
  })

  async function processNow() {
    setProcessing(true)
    await processOutbox()
    setProcessing(false)
    queryClient.invalidateQueries({ queryKey: ['outbox-count'] })
    queryClient.invalidateQueries({ queryKey: ['meals'] })
  }

  useEffect(() => {
    function onOnline() {
      processNow()
    }
    function onVisible() {
      if (document.visibilityState === 'visible' && navigator.onLine) processNow()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { count, processing, processNow }
}
