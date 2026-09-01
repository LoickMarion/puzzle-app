import cors from 'cors'
import express from 'express'
import { generateDailyPuzzle } from './generator.js'

const PORT = process.env.PORT || 3001

const app = express()
app.use(cors())
app.use(express.json())

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MIN_DAILY_DATE = '2026-01-01'

function getEasternDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date)
}

app.get('/api/daily-puzzle', (req, res) => {
  const { date } = req.query

  if (typeof date !== 'string' || !DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: 'A valid date query param (YYYY-MM-DD) is required' })
  }

  if (date < MIN_DAILY_DATE) {
    return res.status(400).json({ error: `Date cannot be before ${MIN_DAILY_DATE}` })
  }

  if (date > getEasternDateString()) {
    return res.status(400).json({ error: 'Date cannot be in the future' })
  }

  res.json(generateDailyPuzzle(date))
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
