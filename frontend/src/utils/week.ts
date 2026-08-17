const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

export function seoulToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export function seoulDateFromInstant(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export function mondayOf(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const diff = utcDay === 0 ? -6 : 1 - utcDay
  return addDays(isoDate, diff)
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function weekdayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const index = utcDay === 0 ? 6 : utcDay - 1
  return WEEKDAYS[index]
}

export function formatMonthDay(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${Number(month)}.${Number(day)}`
}

export function formatOverlayDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${Number(month)}월 ${Number(day)}일 ${weekdayLabel(isoDate)}`
}

export function overlayShortcutLabel(): string {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌥⌘W' : 'Alt+Ctrl+W'
}

export function isOverlayShortcut(event: KeyboardEvent): boolean {
  if (event.key !== 'w' && event.key !== 'W') return false
  if (!event.altKey) return false
  return event.metaKey || event.ctrlKey
}

export function formatSeoulTime(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function splitTweets(twitter: string | null | undefined): string[] {
  if (!twitter?.trim()) return []
  return twitter
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
}
