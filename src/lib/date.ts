// Local-calendar-day helpers. `Date#toISOString()` converts to UTC first, so
// naively slicing it (or hand-building "date+time" strings with no offset)
// silently shifts anything logged late night/early morning in IST — fixed by
// always going through the local-time Date constructor before converting.

export function localDateISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function startOfLocalDayISO(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

export function endOfLocalDayISO(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString()
}

/** An unambiguous timestamptz for "right now, but on this local calendar date" — for backfilling a past/selected diary day. */
export function loggedAtForDate(dateStr: string): string {
  const now = new Date()
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString()
}
