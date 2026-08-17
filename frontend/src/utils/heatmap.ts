import { addDays, mondayOf, seoulDateFromInstant, seoulToday } from './week'

export interface HeatmapCell {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

function levelFor(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 7) return 3
  return 4
}

export function buildHeatmap(committedAts: string[], weeks = 26): HeatmapCell[][] {
  const counts = new Map<string, number>()
  for (const iso of committedAts) {
    const key = seoulDateFromInstant(iso)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const today = seoulToday()
  const [year, month, day] = today.split('-').map(Number)
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const end = addDays(today, (6 - utcDay + 7) % 7)
  const start = addDays(end, -(weeks * 7 - 1))

  const columns: HeatmapCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: HeatmapCell[] = []
    for (let d = 0; d < 7; d++) {
      const key = addDays(start, w * 7 + d)
      const count = counts.get(key) ?? 0
      col.push({ date: key, count, level: levelFor(count) })
    }
    columns.push(col)
  }
  return columns
}

export function countThisWeek(committedAts: string[]): number {
  const start = mondayOf(seoulToday())
  return committedAts.filter((iso) => seoulDateFromInstant(iso) >= start).length
}
