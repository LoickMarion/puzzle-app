export const MIN_DAILY_DATE = '2026-01-01'

export function getEasternDateString(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d)
}
