export const MIN_DAILY_DATE = '2026-01-01'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function getEasternDateString(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d)
}

export function isValidDailyDate(date: string): boolean {
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) return false
  if (date < MIN_DAILY_DATE) return false
  if (date > getEasternDateString()) return false
  return true
}
