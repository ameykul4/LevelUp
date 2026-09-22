import { useQuery } from '@tanstack/react-query'
import { endOfLocalDayISO, localDateISO, startOfLocalDayISO } from '../../lib/date'
import { supabase } from '../../lib/supabase'
import type { Streak } from '../../lib/types'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function startOfWeek(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return localDateISO(d)
}

function formatHeaderLabel(dateStr: string): string {
  const today = localDateISO()
  if (dateStr === today) return 'Today'
  if (dateStr === shiftDays(today, -1)) return 'Yesterday'
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export function WeekStrip({
  userId,
  selectedDate,
  onSelect,
}: {
  userId: string
  selectedDate: string
  onSelect: (date: string) => void
}) {
  const today = localDateISO()
  const weekStart = localDateISO(startOfWeek(selectedDate))
  const weekEnd = shiftDays(weekStart, 6)
  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDays(weekStart, i))

  const { data: streak } = useQuery({
    queryKey: ['streak', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('streaks').select('*').eq('user_id', userId).single()
      if (error) throw error
      return data as Streak
    },
  })

  const { data: loggedDays = new Set<string>() } = useQuery({
    queryKey: ['week-logged-days', userId, weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('logged_at')
        .eq('user_id', userId)
        .gte('logged_at', startOfLocalDayISO(weekStart))
        .lt('logged_at', endOfLocalDayISO(weekEnd))
      if (error) throw error
      return new Set(data.map((m) => m.logged_at.slice(0, 10)))
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="relative flex items-center gap-1 font-display text-xl">
          {formatHeaderLabel(selectedDate)}
          <span className="text-sm text-ink-soft">▾</span>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => e.target.value && onSelect(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0"
            aria-label="Jump to date"
          />
        </div>
        <p className="font-display text-lg">
          {streak?.current_streak ?? 0} <span className="text-sm">🔥</span>
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSelect(shiftDays(weekStart, -7))}
          className="w-6 h-8 flex items-center justify-center text-ink-soft shrink-0"
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="flex-1 grid grid-cols-7 gap-1">
          {weekDates.map((d, i) => {
            const isFuture = d > today
            const isSelected = d === selectedDate
            const isDone = loggedDays.has(d)
            return (
              <button
                key={d}
                type="button"
                disabled={isFuture}
                onClick={() => onSelect(d)}
                className="flex flex-col items-center gap-1 disabled:opacity-30"
              >
                <span className="text-xs text-ink-soft">{DAY_LETTERS[i]}</span>
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    isDone
                      ? 'bg-ink text-white'
                      : isSelected
                        ? 'border-2 border-you text-ink'
                        : 'border border-ink-soft/25 text-ink-soft'
                  }`}
                >
                  {isDone ? '✓' : new Date(`${d}T00:00:00`).getDate()}
                </span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => onSelect(shiftDays(weekStart, 7))}
          disabled={shiftDays(weekStart, 7) > today}
          className="w-6 h-8 flex items-center justify-center text-ink-soft shrink-0 disabled:opacity-30"
          aria-label="Next week"
        >
          ›
        </button>
      </div>
    </div>
  )
}
