import { useMemo } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { commitTitle, parseCommitTag } from '../utils/commitTag'
import { formatRelativeTime } from '../utils/time'

function CommitsFeedPage() {
  const { trackedRepos, commitsByRepo } = useAppData()

  const feed = useMemo(() => {
    const items = trackedRepos.flatMap((repo) =>
      (commitsByRepo[repo.id] ?? []).map((c) => ({ ...c, repoName: repo.fullName })),
    )
    return items.sort((a, b) => (a.committedAt < b.committedAt ? 1 : -1))
  }, [trackedRepos, commitsByRepo])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>커밋 기록</h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>추적 중인 모든 레포의 최근 커밋 활동입니다.</p>
      </div>

      {feed.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>아직 수집된 커밋이 없습니다.</p>}

      {feed.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
          {feed.map((c) => {
            const { tag, color } = parseCommitTag(c.message)
            return (
              <div
                key={`${c.repoName}-${c.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', borderBottom: '1px solid var(--border)' }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 11,
                        fontWeight: 500,
                        color,
                        background: `color-mix(in srgb, ${color} 16%, transparent)`,
                        padding: '2px 7px',
                        borderRadius: 5,
                        flexShrink: 0,
                      }}
                    >
                      {tag}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {commitTitle(c.message)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 3 }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--muted)' }}>{c.repoName}</span> ·{' '}
                    {formatRelativeTime(c.committedAt)}
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
    </div>
  )
}

export default CommitsFeedPage
