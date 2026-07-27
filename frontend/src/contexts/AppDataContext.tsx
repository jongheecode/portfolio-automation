import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { CommitRecord, Me, TrackedRepo } from '../types'

interface AppDataContextValue {
  me: Me | null
  loading: boolean
  error: string | null
  trackedRepos: TrackedRepo[]
  commitsByRepo: Record<number, CommitRecord[]>
  trackRepo: (owner: string, name: string, language: string | null, description: string | null) => Promise<void>
  untrackRepo: (id: number) => Promise<void>
  syncRepo: (id: number) => Promise<number>
  logout: () => Promise<void>
  clearError: () => void
  isAddRepoOpen: boolean
  openAddRepo: () => void
  closeAddRepo: () => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trackedRepos, setTrackedRepos] = useState<TrackedRepo[]>([])
  const [commitsByRepo, setCommitsByRepo] = useState<Record<number, CommitRecord[]>>({})
  const [isAddRepoOpen, setAddRepoOpen] = useState(false)

  const loadCommits = useCallback(async (repos: TrackedRepo[]) => {
    const entries = await Promise.all(
      repos.map(async (repo) => [repo.id, await api.commits(repo.id)] as const),
    )
    setCommitsByRepo(Object.fromEntries(entries))
  }, [])

  const loadAll = useCallback(async () => {
    const repos = await api.trackedRepos()
    setTrackedRepos(repos)
    await loadCommits(repos)
  }, [loadCommits])

  useEffect(() => {
    api
      .me()
      .then(async (meResponse) => {
        setMe(meResponse)
        await loadAll()
      })
      .catch(() => setMe(null))
      .finally(() => setLoading(false))
  }, [loadAll])

  async function trackRepo(owner: string, name: string, language: string | null, description: string | null) {
    try {
      await api.trackRepo(owner, name, language, description)
      await loadAll()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function untrackRepo(id: number) {
    try {
      await api.untrackRepo(id)
      setTrackedRepos((prev) => prev.filter((repo) => repo.id !== id))
      setCommitsByRepo((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function syncRepo(id: number) {
    try {
      const result = await api.syncRepo(id)
      await loadAll()
      return result.savedCount
    } catch (err) {
      setError((err as Error).message)
      return 0
    }
  }

  async function logout() {
    await api.logout().catch(() => {})
    setMe(null)
    setTrackedRepos([])
    setCommitsByRepo({})
  }

  return (
    <AppDataContext.Provider
      value={{
        me,
        loading,
        error,
        trackedRepos,
        commitsByRepo,
        trackRepo,
        untrackRepo,
        syncRepo,
        logout,
        clearError: () => setError(null),
        isAddRepoOpen,
        openAddRepo: () => setAddRepoOpen(true),
        closeAddRepo: () => setAddRepoOpen(false),
      }}
    >
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
