import { Card } from '../ui/Card'
import { usePendingOutbox } from '../../hooks/usePendingOutbox'

export function PendingMealsBanner() {
  const { count, processing, processNow } = usePendingOutbox()

  if (count === 0) return null

  return (
    <Card tint="her" className="flex items-center justify-between gap-3">
      <p className="text-sm">
        {count} meal{count > 1 ? 's' : ''} waiting to be analyzed
      </p>
      <button
        type="button"
        onClick={processNow}
        disabled={processing}
        className="text-sm font-medium text-her-deep underline disabled:opacity-50"
      >
        {processing ? 'Analyzing…' : 'Analyze now'}
      </button>
    </Card>
  )
}
