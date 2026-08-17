import { addDays, seoulDateFromInstant, seoulToday } from './week'

export interface DayCount {
  date: string
  count: number
}

export function buildDailySeries(committedAts: string[], days = 84): DayCount[] {
  const counts = new Map<string, number>()
  for (const iso of committedAts) {
    const key = seoulDateFromInstant(iso)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const today = seoulToday()
  const start = addDays(today, -(days - 1))
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i)
    return { date, count: counts.get(date) ?? 0 }
  })
}

export function buildWeeklySeries(
  committedAts: string[],
  weeks = 12,
  endMonday: string,
): { weekStart: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const iso of committedAts) {
    const key = seoulDateFromInstant(iso)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const start = addDays(endMonday, -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(start, i * 7)
    let count = 0
    for (let d = 0; d < 7; d++) count += counts.get(addDays(weekStart, d)) ?? 0
    return { weekStart, count }
  })
}

export function smoothLine(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}
