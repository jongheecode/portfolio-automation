export interface Me {
  username: string
  avatarUrl: string | null
}

interface WeekDaySummary {
  date: string
  commitCount?: number
  commits: { id: number }[]
}

export interface WeekViewSummary {
  weekStart: string
  days: WeekDaySummary[]
  plans?: { done: boolean }[]
  unwrittenCommitCount?: number
}

interface LocalWipFileDto {
  tag: string
  path: string
  additions: number
  deletions: number
}

interface LocalTodayCommitDto {
  sha: string
  message: string
  committedAt: string
  additions: number
  deletions: number
  written: boolean
}

export interface LocalGitSnapshotDto {
  id: number
  path: string
  name: string
  branch?: string | null
  ok: boolean
  headSha?: string | null
  unpushedCount: number
  changedFileCount: number
  additions: number
  deletions: number
  files: LocalWipFileDto[]
  lastCommitAge?: string | null
  todayCommits: LocalTodayCommitDto[]
  branchCommitCount: number
  branchCommitMessages: string[]
}

interface LocalGitResponseDto {
  active: LocalGitSnapshotDto | null
}

export interface DiffHunk {
  path: string
  staged: boolean
  additions: number
  deletions: number
  patch: string
}

export interface LocalDiffReview {
  files: DiffHunk[]
  notes: string[]
}

const API_BASE = ''

export class UnauthorizedError extends Error {}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
  return res.json() as Promise<T>
}

export function fetchMe(): Promise<Me> {
  return apiFetch<Me>('/api/me')
}

export function fetchWeek(): Promise<WeekViewSummary> {
  return apiFetch<WeekViewSummary>('/api/week')
}

export function fetchLocalGit(): Promise<LocalGitResponseDto> {
  return apiFetch<LocalGitResponseDto>('/api/local-git')
}

export function fetchLocalDiff(): Promise<LocalDiffReview> {
  return apiFetch<LocalDiffReview>('/api/local-git/diff')
}

export function createDraftFromLocal(weekStart: string, summaries: string[]): Promise<unknown> {
  return apiFetch('/api/drafts/from-local', {
    method: 'POST',
    body: JSON.stringify({ weekStart, summaries }),
  })
}

export interface NextAction {
  message: string
  tier: 'SECURITY' | 'STRUCTURE' | 'BACKLOG' | 'CLEAR'
  evidence: string | null
  findingId: number | null
}

export function fetchNextAction(): Promise<NextAction> {
  return apiFetch<NextAction>('/api/findings/next-action')
}

export function updateFindingStatus(id: number, status: 'DISMISSED' | 'USED_IN_POST'): Promise<unknown> {
  return apiFetch(`/api/findings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

export function seoulToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export function weekdayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return WEEKDAYS[utcDay === 0 ? 6 : utcDay - 1]
}

export function formatHm(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
}
