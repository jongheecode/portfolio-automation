import type {
  BlogPostDetail,
  BlogPostSummary,
  CommitRecord,
  GithubRepo,
  Me,
  PortfolioDraft,
  PortfolioSection,
  TrackedRepo,
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

export const api = {
  loginUrl: () => `${API_BASE_URL}/oauth2/authorization/github`,
  logout: () => apiFetch<void>('/logout', { method: 'POST' }),
  me: () => apiFetch<Me>('/api/me'),
  githubRepos: () => apiFetch<GithubRepo[]>('/api/github/repos'),
  trackedRepos: () => apiFetch<TrackedRepo[]>('/api/tracked-repos'),
  trackRepo: (owner: string, name: string, language: string | null, description: string | null) =>
    apiFetch<TrackedRepo>('/api/tracked-repos', {
      method: 'POST',
      body: JSON.stringify({ owner, name, language, description }),
    }),
  untrackRepo: (id: number) =>
    apiFetch<void>(`/api/tracked-repos/${id}`, { method: 'DELETE' }),
  setPortfolioInclusion: (id: number, include: boolean) =>
    apiFetch<TrackedRepo>(`/api/tracked-repos/${id}/portfolio-selection`, {
      method: 'PUT',
      body: JSON.stringify({ include }),
    }),
  syncRepo: (id: number) =>
    apiFetch<{ savedCount: number }>(`/api/tracked-repos/${id}/sync`, { method: 'POST' }),
  commits: (id: number) => apiFetch<CommitRecord[]>(`/api/tracked-repos/${id}/commits`),
  blogPosts: () => apiFetch<BlogPostSummary[]>('/api/blog-posts'),
  generateBlogPost: () => apiFetch<BlogPostDetail>('/api/blog-posts/generate', { method: 'POST' }),
  blogPost: (id: number) => apiFetch<BlogPostDetail>(`/api/blog-posts/${id}`),
  updateBlogPost: (id: number, title: string, content: string) =>
    apiFetch<BlogPostDetail>(`/api/blog-posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, content }),
    }),
  publishBlogPost: (id: number) => apiFetch<BlogPostDetail>(`/api/blog-posts/${id}/publish`, { method: 'POST' }),
  deleteBlogPost: (id: number) => apiFetch<void>(`/api/blog-posts/${id}`, { method: 'DELETE' }),
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
