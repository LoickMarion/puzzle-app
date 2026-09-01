import { useState } from 'react'
import DailyPuzzlePlayer from '../components/DailyPuzzlePlayer'
import { getEasternDateString, MIN_DAILY_DATE } from '../lib/date'

export default function DailyArchivePage() {
  const today = getEasternDateString()
  const [selectedDate, setSelectedDate] = useState('')

  const picker = (
    <label className="flex flex-col items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
      Pick a date to replay that day's puzzle
      <input
        type="date"
        min={MIN_DAILY_DATE}
        max={today}
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="rounded-lg bg-neutral-100 px-3 py-2 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
      />
    </label>
  )

  if (!selectedDate) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Daily Archive</h1>
        {picker}
      </main>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-center border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        {picker}
      </div>
      <div className="flex-1 overflow-hidden">
        <DailyPuzzlePlayer key={selectedDate} date={selectedDate} title="Daily Archive" />
      </div>
    </div>
  )
}
