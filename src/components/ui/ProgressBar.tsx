import { motion } from 'framer-motion'

interface ProgressBarProps {
  label: string
  current: number
  target: number
  unit?: string
  color?: 'you' | 'her' | 'grow' | 'calm' | 'loot'
}

const COLOR_CLASSES: Record<NonNullable<ProgressBarProps['color']>, string> = {
  you: 'bg-you',
  her: 'bg-her',
  grow: 'bg-grow',
  calm: 'bg-calm',
  loot: 'bg-loot',
}

export function ProgressBar({ label, current, target, unit = '', color = 'you' }: ProgressBarProps) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="text-ink-soft">{label}</span>
        <span className="font-display tabular-nums">
          {Math.round(current)}
          <span className="text-ink-soft">
            /{Math.round(target)}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-ink/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${COLOR_CLASSES[color]}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}
