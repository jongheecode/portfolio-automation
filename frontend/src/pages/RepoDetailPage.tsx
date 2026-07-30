import { useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { useAppData } from '../contexts/AppDataContext'
import { commitTitle, parseCommitTag } from '../utils/commitTag'
import { languageColor } from '../utils/languageColor'
import { formatRelativeTime } from '../utils/time'
import { segmentButtonStyle } from '../utils/styles'

function tagBadgeStyle(color: string): CSSProperties {
  return {
    fontFamily: "'Geist Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
    color,
    background: `color-mix(in srgb, ${color} 16%, transparent)`,
    padding: '2px 7px',
    borderRadius: 5,
    flexShrink: 0,
  }
}

function RepoDetailPage() {
  const { id } = useParams()
  const repoId = Number(id)
  const { trackedRepos, commitsByRepo, syncRepo } = useAppData()
  const [style, setStyle] = useState<'list' | 'timeline'>('list')
  const [syncing, setSyncing] = useState(false)

  const repo = trackedRepos.find((r) => r.id === repoId)
  const commits = commitsByRepo[repoId] ?? []

  if (!repo) return <p>레포를 찾을 수 없습니다.</p>

  async function handleSync() {
    setSyncing(true)
    await syncRepo(repoId)
    setSyncing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: "'Geist Mono', monospace" }}>
              {repo.fullName}
            </h1>
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12.5,
                color: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '4px 9px',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--muted)' }}>
            {repo.description && <span>{repo.description}</span>}
            {repo.language && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: languageColor(repo.language) }} />
                {repo.language}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 8,
              padding: '8px 13px',
              fontSize: 13,
              fontWeight: 500,
              cursor: syncing ? 'default' : 'pointer',
              opacity: syncing ? 0.6 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M13.5 8a5.5 5.5 0 10-1.6 3.9M13.5 12V8.5H10" />
            </svg>
            {syncing ? '동기화 중...' : '지금 동기화'}
          </button>
          <div style={{ display: 'flex', background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            <button type="button" onClick={() => setStyle('list')} style={segmentButtonStyle(style === 'list')}>
              리스트
            </button>
            <button type="button" onClick={() => setStyle('timeline')} style={segmentButtonStyle(style === 'timeline')}>
              타임라인
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '14px 18px',
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--panel)',
          fontSize: 13,
        }}
      >
        <span style={{ color: 'var(--muted)' }}>
          총 <strong style={{ color: 'var(--text)', fontFamily: "'Geist Mono', monospace" }}>{repo.commitCount}</strong> 커밋
        </span>
        <span style={{ width: 1, height: 14, background: 'var(--border2)' }} />
        <span style={{ color: 'var(--muted)' }}>
          마지막 동기화 <strong style={{ color: 'var(--text)' }}>{formatRelativeTime(repo.lastSyncedAt)}</strong>
        </span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        커밋 타임라인
      </div>

      {commits.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>동기화된 커밋이 없습니다.</p>}

      {style === 'list' && commits.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
          {commits.map((c) => {
            const { tag, color } = parseCommitTag(c.message)
            return (
              <div
                key={c.id}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', borderBottom: '1px solid var(--border)' }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={tagBadgeStyle(color)}>{tag}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {commitTitle(c.message)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 3 }}>
                    {c.authorName} 님이 {formatRelativeTime(c.committedAt)} 커밋
                  </div>
                </div>
                <a
                  href={c.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 12.5,
                    color: 'var(--muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    flexShrink: 0,
                  }}
                >
                  {c.sha.slice(0, 7)}
                </a>
              </div>
            )
          })}
        </div>
      )}

      {style === 'timeline' && commits.length > 0 && (
        <div style={{ position: 'relative', paddingLeft: 8 }}>
          {commits.map((c, i) => {
            const { tag, color } = parseCommitTag(c.message)
            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: '50%',
                      background: color,
                      border: '3px solid var(--panel)',
                      boxShadow: '0 0 0 1px var(--border2)',
                      marginTop: 4,
                    }}
                  />
                  {i < commits.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--border)', margin: '2px 0' }} />}
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--panel)', padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={tagBadgeStyle(color)}>{tag}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {commitTitle(c.message)}
                      </span>
                    </div>
                    <a href={c.htmlUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
                      {c.sha.slice(0, 7)}
                    </a>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 10 }}>
                    {c.authorName} · {formatRelativeTime(c.committedAt)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default RepoDetailPage
