import DailyPuzzlePlayer from '../components/DailyPuzzlePlayer'
import { getEasternDateString } from '../lib/date'

export default function DailyPage() {
  return <DailyPuzzlePlayer date={getEasternDateString()} title="Daily Puzzle" />
}
