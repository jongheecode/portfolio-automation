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

// 최근 `weeks`주를 일요일 시작 7일 x weeks열로 채운 커밋 히트맵 데이터를 만듦.
export function buildHeatmap(committedAts: string[], weeks = 26): HeatmapCell[][] {
  const counts = new Map<string, number>()
  for (const iso of committedAts) {
    const key = new Date(iso).toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()))

  const totalDays = weeks * 7
  const start = new Date(endOfWeek)
  start.setDate(endOfWeek.getDate() - totalDays + 1)

  const columns: HeatmapCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: HeatmapCell[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(start)
      day.setDate(start.getDate() + w * 7 + d)
      const key = day.toISOString().slice(0, 10)
      const count = counts.get(key) ?? 0
      col.push({ date: key, count, level: levelFor(count) })
    }
    columns.push(col)
  }
  return columns
}

export function countThisWeek(committedAts: string[]): number {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return committedAts.filter((iso) => new Date(iso) >= startOfWeek).length
}
