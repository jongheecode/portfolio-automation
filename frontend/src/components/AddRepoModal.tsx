import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAppData } from '../contexts/AppDataContext'
import type { GithubRepo } from '../types'
import { languageColor } from '../utils/languageColor'

function AddRepoModal() {
  const { isAddRepoOpen, closeAddRepo, trackedRepos, trackRepo, untrackRepo } = useAppData()
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAddRepoOpen) return
    setLoading(true)
    api
      .githubRepos()
      .then(setGithubRepos)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isAddRepoOpen])

  const trackedFullNames = useMemo(() => new Set(trackedRepos.map((r) => r.fullName)), [trackedRepos])

  const filtered = githubRepos.filter((repo) =>
    repo.fullName.toLowerCase().includes(query.toLowerCase()),
  )

  if (!isAddRepoOpen) return null

  async function handleToggle(repo: GithubRepo) {
    const tracked = trackedRepos.find((r) => r.fullName === repo.fullName)
    if (tracked) {
      await untrackRepo(tracked.id)
    } else {
      const [owner] = repo.fullName.split('/')
      await trackRepo(owner, repo.name, repo.language, repo.description)
    }
  }

  return (
    <div
      onClick={closeAddRepo}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '80px 20px',
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 540,
          background: 'var(--panel)',
          border: '1px solid var(--border2)',
          borderRadius: 16,
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 16, fontWeight: 600 }}>
              <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 014 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub 레포 추가
            </div>
            <button
              type="button"
              onClick={closeAddRepo}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted2)', cursor: 'pointer', padding: 4 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            추적할 레포를 선택하면 커밋 기록을 자동으로 수집합니다.
          </p>
        </div>

        <div style={{ padding: '14px 22px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--panel2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '9px 12px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--muted2)" strokeWidth={1.6}>
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="레포 검색..."
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: 13,
                flex: 1,
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {error && <p style={{ margin: '0 22px 10px', fontSize: 13, color: 'var(--muted)' }}>{error}</p>}
        {loading && <p style={{ margin: '0 22px 10px', fontSize: 13, color: 'var(--muted)' }}>불러오는 중...</p>}

        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '0 14px 14px' }}>
          {filtered.map((repo) => {
            const tracked = trackedFullNames.has(repo.fullName)
            return (
              <div
                key={repo.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderRadius: 10 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        fontFamily: "'Geist Mono', monospace",
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {repo.fullName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                    {repo.language && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: languageColor(repo.language) }} />
                        {repo.language}
                      </span>
                    )}
                    {repo.description && (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.description}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(repo)}
                  style={{
                    border: '1px solid ' + (tracked ? 'transparent' : 'var(--border2)'),
                    background: tracked ? 'var(--accent-soft)' : 'transparent',
                    color: tracked ? 'var(--accent)' : 'var(--text)',
                    borderRadius: 7,
                    padding: '6px 14px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                    minWidth: 68,
                  }}
                >
                  {tracked ? '추적 중' : '추가'}
                </button>
              </div>
            )
          })}
          {!loading && filtered.length === 0 && (
            <p style={{ padding: '20px 10px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>레포가 없습니다.</p>
          )}
        </div>

        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12.5, color: 'var(--muted2)' }}>{trackedRepos.length}개 레포 추적 중</span>
          <button
            type="button"
            onClick={closeAddRepo}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '9px 18px',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            완료
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddRepoModal
