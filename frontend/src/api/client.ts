import type {
  BlogPostDetail,
  BlogPostSummary,
  CommitRecord,
  GithubRepo,
  Habit,
  LiveFinding,
  Me,
  Plan,
  LocalGitResponse,
  OverlayProcessStatus,
  PortfolioDraft,
  PortfolioSection,
  SyncState,
  TrackedRepo,
  WeekView,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `요청에 실패했습니다 (${res.status})`)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}

async function wait(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms))
}

export const api = {
  loginUrl: () => `${API_BASE_URL}/oauth2/authorization/github`,
  logout: () => apiFetch<void>('/logout', { method: 'POST' }),
  me: () => apiFetch<Me>('/api/me'),
  githubRepos: () => apiFetch<GithubRepo[]>('/api/github/repos'),
  trackedRepos: () => apiFetch<TrackedRepo[]>('/api/tracked-repos'),
  trackRepo: (
    owner: string,
    name: string,
    language: string | null,
    description: string | null,
    isPrivate = false,
  ) =>
    apiFetch<TrackedRepo>('/api/tracked-repos', {
      method: 'POST',
      body: JSON.stringify({ owner, name, language, description, isPrivate }),
    }),
  untrackRepo: (id: number) =>
    apiFetch<void>(`/api/tracked-repos/${id}`, { method: 'DELETE' }),
  setPortfolioInclusion: (id: number, include: boolean) =>
    apiFetch<TrackedRepo>(`/api/tracked-repos/${id}/portfolio-selection`, {
      method: 'PUT',
      body: JSON.stringify({ include }),
    }),
  setAiScope: (id: number, enabled: boolean) =>
    apiFetch<TrackedRepo>(`/api/tracked-repos/${id}/ai-scope`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),
  syncRepo: (id: number) =>
    apiFetch<{ savedCount: number }>(`/api/tracked-repos/${id}/sync`, { method: 'POST' }),
  syncAllRepos: () =>
    apiFetch<{ repoCount: number; savedCount: number }>('/api/tracked-repos/sync-all', { method: 'POST' }),
  syncStatus: () => apiFetch<SyncState>('/api/sync/status'),
  startSync: () => apiFetch<SyncState>('/api/sync', { method: 'POST' }),
  setAutoSync: (enabled: boolean) =>
    apiFetch<SyncState>('/api/sync/auto', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),
  waitForSync: async (timeoutMs = 120_000) => {
    let state = await api.startSync()
    const started = Date.now()
    while (state.kind === 'syncing' && Date.now() - started < timeoutMs) {
      await wait(1000)
      state = await api.syncStatus()
    }
    return state
  },
  commits: (id: number) => apiFetch<CommitRecord[]>(`/api/tracked-repos/${id}/commits`),
  blogPosts: () => apiFetch<BlogPostSummary[]>('/api/blog-posts'),
  drafts: (status?: string) =>
    apiFetch<BlogPostSummary[]>(status ? `/api/drafts?status=${encodeURIComponent(status)}` : '/api/drafts'),
  createDraft: (weekStart: string) =>
    apiFetch<BlogPostDetail>('/api/drafts', {
      method: 'POST',
      body: JSON.stringify({ weekStart }),
    }),
  createDraftFromLocal: (weekStart: string, summaries: string[]) =>
    apiFetch<BlogPostDetail>('/api/drafts/from-local', {
      method: 'POST',
      body: JSON.stringify({ weekStart, summaries }),
    }),
  localGit: () => apiFetch<LocalGitResponse>('/api/local-git'),
  watchLocalGit: (path: string) =>
    apiFetch<LocalGitResponse>('/api/local-git', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  unwatchLocalGit: (id: number) => apiFetch<void>(`/api/local-git/${id}`, { method: 'DELETE' }),
  overlayStatus: () => apiFetch<OverlayProcessStatus>('/api/overlay'),
  startOverlay: () => apiFetch<OverlayProcessStatus>('/api/overlay/start', { method: 'POST' }),
  stopOverlay: () => apiFetch<OverlayProcessStatus>('/api/overlay/stop', { method: 'POST' }),
  retryPublish: (id: number) =>
    apiFetch<BlogPostDetail>(`/api/drafts/${id}/publish/retry`, { method: 'POST' }),
  generateWeekPack: (weekStart: string) =>
    apiFetch<BlogPostDetail>('/api/blog-posts/generate-week', {
      method: 'POST',
      body: JSON.stringify({ weekStart }),
    }),
  blogPost: (id: number) => apiFetch<BlogPostDetail>(`/api/blog-posts/${id}`),
  updateBlogPost: (
    id: number,
    title: string,
    content: string,
    linkedinContent?: string | null,
    twitterContent?: string | null,
  ) =>
    apiFetch<BlogPostDetail>(`/api/blog-posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, content, linkedinContent, twitterContent }),
    }),
  publishBlogPost: (id: number) => apiFetch<BlogPostDetail>(`/api/blog-posts/${id}/publish`, { method: 'POST' }),
  deleteBlogPost: (id: number) => apiFetch<void>(`/api/blog-posts/${id}`, { method: 'DELETE' }),
  week: (weekStart?: string) =>
    apiFetch<WeekView>(weekStart ? `/api/week?weekStart=${weekStart}` : '/api/week'),
  liveFindings: () => apiFetch<LiveFinding[]>('/api/findings/live'),
  weeks: (start?: string) =>
    apiFetch<{
      days: { date: string; commitCount: number; planCount: number }[]
      weekly: { weekStart: string; count: number }[]
      unwrittenCommitCount: number
    }>(start ? `/api/weeks?start=${start}&tz=Asia/Seoul` : '/api/weeks?tz=Asia/Seoul'),
  updateHabitTarget: (key: string, target: number) =>
    apiFetch<Habit>(`/api/habits/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ target }),
    }),
  checkPublishOutside: (weekStart: string, checked: boolean) =>
    apiFetch<Habit>('/api/habits/PUBLISH_OUTSIDE/check', {
      method: 'PUT',
      body: JSON.stringify({ weekStart, checked }),
    }),
  createPlan: (title: string, dueOn: string) =>
    apiFetch<Plan>('/api/plans', {
      method: 'POST',
      body: JSON.stringify({ title, dueOn }),
    }),
  updatePlan: (
    id: number,
    patch: { title?: string; dueOn?: string; done?: boolean; linkedCommitIds?: number[] },
  ) =>
    apiFetch<Plan>(`/api/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  deletePlan: (id: number) => apiFetch<void>(`/api/plans/${id}`, { method: 'DELETE' }),
  connectDevTo: (apiKey: string) =>
    apiFetch<{ username: string }>('/api/devto/connection', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),
  disconnectDevTo: () => apiFetch<void>('/api/devto/connection', { method: 'DELETE' }),
  publishToDevTo: (id: number) =>
    apiFetch<BlogPostDetail>(`/api/blog-posts/${id}/publish-to-devto`, { method: 'POST' }),
  portfolioDraft: () => apiFetch<PortfolioDraft>('/api/portfolio-draft'),
  generatePortfolioDraft: (sections: PortfolioSection[]) =>
    apiFetch<PortfolioDraft>('/api/portfolio-draft/generate', {
      method: 'POST',
      body: JSON.stringify({ sections }),
    }),
  updatePortfolioDraft: (content: string) =>
    apiFetch<PortfolioDraft>('/api/portfolio-draft', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  portfolioPdfUrl: () => `${API_BASE_URL}/api/portfolio-pdf`,
}
