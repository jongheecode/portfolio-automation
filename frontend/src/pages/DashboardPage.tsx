import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { CommitRecord, GithubRepo, Me, TrackedRepo } from '../types'

function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([])
  const [trackedRepos, setTrackedRepos] = useState<TrackedRepo[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [commits, setCommits] = useState<CommitRecord[]>([])

  useEffect(() => {
    api
      .me()
      .then((meResponse) => {
        setMe(meResponse)
        return api.trackedRepos()
      })
      .then(setTrackedRepos)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedRepoId === null) return
    api.commits(selectedRepoId).then(setCommits).catch((err: Error) => setError(err.message))
  }, [selectedRepoId])

  async function loadGithubRepos() {
    try {
      setGithubRepos(await api.githubRepos())
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleTrack(repo: GithubRepo) {
    try {
      const tracked = await api.trackRepo(repo.fullName.split('/')[0], repo.name)
      setTrackedRepos((prev) => [...prev, tracked])
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleUntrack(id: number) {
    try {
      await api.untrackRepo(id)
      setTrackedRepos((prev) => prev.filter((repo) => repo.id !== id))
      if (selectedRepoId === id) {
        setSelectedRepoId(null)
        setCommits([])
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleSync(id: number) {
    try {
      const result = await api.syncRepo(id)
      const refreshed = await api.trackedRepos()
      setTrackedRepos(refreshed)
      if (selectedRepoId === id) {
        setCommits(await api.commits(id))
      }
      setError(null)
      alert(`새 커밋 ${result.savedCount}개를 저장했습니다.`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading) return <p>불러오는 중...</p>
  if (!me) return <p>로그인이 필요합니다.</p>

  return (
    <main>
      <h1>{me.username}님의 기록</h1>
      {error && <p role="alert">{error}</p>}

      <section>
        <h2>추적 중인 레포</h2>
        {trackedRepos.length === 0 && <p>아직 등록된 레포가 없습니다.</p>}
        <ul>
          {trackedRepos.map((repo) => (
            <li key={repo.id}>
              <button type="button" onClick={() => setSelectedRepoId(repo.id)}>
                {repo.fullName}
              </button>
              {' '}
              <span>{repo.lastSyncedAt ? `마지막 동기화: ${repo.lastSyncedAt}` : '동기화 전'}</span>
              {' '}
              <button type="button" onClick={() => handleSync(repo.id)}>
                커밋 동기화
              </button>
              {' '}
              <button type="button" onClick={() => handleUntrack(repo.id)}>
                해제
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>GitHub 레포 추가</h2>
        <button type="button" onClick={loadGithubRepos}>
          내 GitHub 레포 불러오기
        </button>
        <ul>
          {githubRepos.map((repo) => (
            <li key={repo.id}>
              {repo.fullName}
              {' '}
              <button type="button" onClick={() => handleTrack(repo)}>
                추적 등록
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedRepoId !== null && (
        <section>
          <h2>커밋 타임라인</h2>
          {commits.length === 0 && <p>동기화된 커밋이 없습니다.</p>}
          <ul>
            {commits.map((commit) => (
              <li key={commit.id}>
                <a href={commit.htmlUrl} target="_blank" rel="noreferrer">
                  {commit.message.split('\n')[0]}
                </a>
                {' — '}
                {commit.authorName} · {commit.committedAt}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

export default DashboardPage
