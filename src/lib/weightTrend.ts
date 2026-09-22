// 7-day rolling average (guardrail §2.2) — the app never shows the jumpy
// daily weight number, only the trend. Daily 1-2kg swings are water, not fat.

import type { WeightLog } from './types'

export interface TrendPoint {
  date: string
  raw: number
  rollingAvg: number
}

export function rollingWeightAverage(logs: WeightLog[]): TrendPoint[] {
  const sorted = [...logs].sort((a, b) => a.logged_on.localeCompare(b.logged_on))

  return sorted.map((log, i) => {
    const windowStart = new Date(`${log.logged_on}T00:00:00`)
    windowStart.setDate(windowStart.getDate() - 6)
    const windowStartISO = windowStart.toISOString().slice(0, 10)

    const inWindow = sorted.slice(0, i + 1).filter((l) => l.logged_on >= windowStartISO)
    const avg = inWindow.reduce((sum, l) => sum + l.weight_kg, 0) / inWindow.length

    return { date: log.logged_on, raw: log.weight_kg, rollingAvg: Math.round(avg * 10) / 10 }
  })
}
