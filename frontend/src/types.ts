export interface Me {
  username: string
  avatarUrl: string | null
  devtoConnected: boolean
  devtoUsername: string | null
  autoSync?: boolean
}

export interface GithubRepo {
  id: number
  name: string
  fullName: string
  htmlUrl: string
  isPrivate: boolean
  language: string | null
  description: string | null
}

export interface TrackedRepo {
  id: number
  owner: string
  name: string
  fullName: string
  htmlUrl: string
  language: string | null
  description: string | null
  commitCount: number
  includeInPortfolio: boolean
  lastSyncedAt: string | null
  isPrivate?: boolean
  aiScopeEnabled?: boolean
}

export interface CommitRecord {
  id: number
  sha: string
  message: string
  authorName: string
  committedAt: string
  htmlUrl: string
  additions?: number
  deletions?: number
  isMerge?: boolean
  isBot?: boolean
}

export type DraftStatus = 'draft' | 'published' | 'failed'
export type SyncErrorCode = 'token_expired' | 'rate_limited' | 'no_access'

export interface SyncState {
  kind: 'never' | 'syncing' | 'ok' | 'error'
  lastSyncedAt?: string | null
  lastAttemptAt?: string | null
  autoSync?: boolean | null
  code?: SyncErrorCode | null
}

export interface BlogPostSummary {
  id: number
  title: string
  published: boolean
  createdAt: string
  commitCount: number
  status?: DraftStatus
  publishedUrl?: string | null
}

export interface BlogCommitRef {
  repoName: string
  message: string
  sha: string
  htmlUrl: string
}

export interface BlogPostDetail {
  id: number
  title: string
  content: string
  published: boolean
  devtoUrl: string | null
  linkedinContent: string | null
  twitterContent: string | null
  weekStart: string | null
  createdAt: string
  commits: BlogCommitRef[]
  status?: DraftStatus
  publishedUrl?: string | null
  updatedAt?: string | null
}

export interface Habit {
  key: string
  title: string
  target: number
  current: number
  done: boolean
  doneDays?: boolean[]
}

export interface Plan {
  id: number
  title: string
  dueOn: string
  done: boolean
  dayIndex?: number
  linkedCommitCount?: number
  linkedCommitIds?: number[]
}

export interface FindingDto {
  id: number
  ruleId: string
  category: string
  tier: string | null
  message: string
  evidence: string | null
  status: string
}

export interface WeekCommit {
  id: number
  sha?: string
  repoName: string
  message: string
  htmlUrl: string
  committedAt?: string | null
  authorName?: string | null
  additions?: number
  deletions?: number
  isMerge?: boolean
  isBot?: boolean
  findings?: FindingDto[]
}

export interface WeekDay {
  date: string
  commits: WeekCommit[]
  commitExtra: number
  commitCount?: number
  planCount?: number
}

export interface WeekPack {
  id: number
  title: string
  content: string
  linkedinContent: string | null
  twitterContent: string | null
  published: boolean
  devtoUrl: string | null
  status?: DraftStatus
  publishedUrl?: string | null
  sourceCommitCount?: number
  updatedAt?: string | null
}

export interface WeeklyPoint {
  weekStart: string
  count: number
}

export interface RecurringFriction {
  ruleId: string
  label: string
  count: number
}

export interface WeekView {
  weekStart: string
  weekEnd: string
  habits: Habit[]
  plans: Plan[]
  days: WeekDay[]
  pack: WeekPack | null
  weekly?: WeeklyPoint[]
  unwrittenCommitCount?: number
  recurringFriction?: RecurringFriction[]
}

export interface PortfolioDraft {
  content: string
  includedRepoIds: number[]
  includedSections: string[]
  updatedAt: string | null
}

export type PortfolioSection = 'intro' | 'challenges' | 'strengths' | 'techstack'

export interface LocalWipFile {
  tag: string
  path: string
  additions: number
  deletions: number
}

export interface LocalTodayCommit {
  sha: string
  message: string
  committedAt: string
  files: number
  additions: number
  deletions: number
  written: boolean
}

export interface LocalGitSnapshot {
  id: number
  path: string
  name: string
  parentLabel?: string | null
  branch?: string | null
  ok: boolean
  error?: string | null
  unpushedCount: number
  changedFileCount: number
  additions: number
  deletions: number
  files: LocalWipFile[]
  extraFileCount: number
  lastCommitAt?: string | null
  lastCommitAge?: string | null
  headSha?: string | null
  todayCommits: LocalTodayCommit[]
  branchCommitCount: number
  branchCommitMessages: string[]
}

export interface LocalGitResponse {
  repos: LocalGitSnapshot[]
  active: LocalGitSnapshot | null
}

export interface OverlayToast {
  id: number
  title: string
  body: string
}

export interface OverlayProcessStatus {
  running: boolean
}
