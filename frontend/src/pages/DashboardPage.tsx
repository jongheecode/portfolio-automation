import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import Heatmap from '../components/Heatmap'
import { useAppData } from '../contexts/AppDataContext'
import { languageColor } from '../utils/languageColor'
import { countThisWeek } from '../utils/heatmap'
import { formatRelativeTime } from '../utils/time'

const statCardStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 13,
  background: 'var(--panel)',
  padding: '16px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

function segStyle(active: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: 6,
    padding: '5px 13px',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? 'var(--panel)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--muted)',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
  }
}

function DashboardPage() {
  const { me, trackedRepos, commitsByRepo, openAddRepo } = useAppData()
  const navigate = useNavigate()
  const [layout, setLayout] = useState<'cards' | 'table'>('cards')

  const allCommittedAts = useMemo(
    () => Object.values(commitsByRepo).flat().map((c) => c.committedAt),
    [commitsByRepo],
  )
  const totalCommits = trackedRepos.reduce((sum, repo) => sum + repo.commitCount, 0)
  const thisWeek = countThisWeek(allCommittedAts)
  const lastSynced = trackedRepos
    .map((r) => r.lastSyncedAt)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1)

  const isEmpty = trackedRepos.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>
          안녕하세요, {me?.username} 님
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>추적 중인 레포의 개발 활동 요약입니다.</p>
      </div>

      {isEmpty ? (
        <div
          style={{
            border: '1px dashed var(--border2)',
            borderRadius: 14,
            padding: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            textAlign: 'center',
            background: 'var(--panel)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth={1.4}>
              <rect x="2" y="3" width="12" height="10" rx="2" />
              <path d="M2 6h12" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>아직 추적 중인 레포가 없어요</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 380, lineHeight: 1.5 }}>
              GitHub 레포를 추가하면 커밋 기록을 자동으로 수집하고 개발 활동을 정리해 드립니다.
            </div>
          </div>
          <button
            type="button"
            onClick={openAddRepo}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M8 3v10M3 8h10" />
            </svg>
            첫 레포 추가하기
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <div style={statCardStyle}>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>추적 레포</span>
              <span style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em' }}>{trackedRepos.length}</span>
              <span style={{ fontSize: 12, color: 'var(--muted2)' }}>GitHub 연동됨</span>
            </div>
            <div style={statCardStyle}>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>총 커밋</span>
              <span style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: "'Geist Mono', monospace" }}>
                {totalCommits.toLocaleString()}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted2)' }}>수집 완료</span>
            </div>
            <div style={statCardStyle}>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>이번 주 커밋</span>
              <span
                style={{
                  fontSize: 27,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--green)',
                  fontFamily: "'Geist Mono', monospace",
                }}
              >
                +{thisWeek}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted2)' }}>이번 주 수집된 커밋</span>
            </div>
            <div style={statCardStyle}>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>최근 동기화</span>
              <span style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em' }}>
                {formatRelativeTime(lastSynced ?? null)}
              </span>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--panel)', padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>개발 활동</span>
              <span style={{ fontSize: 12, color: 'var(--muted2)', fontFamily: "'Geist Mono', monospace" }}>last 26 weeks</span>
            </div>
            <Heatmap committedAts={allCommittedAts} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginTop: 12, fontSize: 11.5, color: 'var(--muted2)' }}>
              적음
              {[0, 1, 2, 3, 4].map((level) => (
                <span key={level} style={{ width: 11, height: 11, borderRadius: 2, background: `var(--heat-${level})` }} />
              ))}
              많음
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>추적 중인 레포</span>
              <div style={{ display: 'flex', background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
                <button type="button" onClick={() => setLayout('cards')} style={segStyle(layout === 'cards')}>
                  카드
                </button>
                <button type="button" onClick={() => setLayout('table')} style={segStyle(layout === 'table')}>
                  테이블
                </button>
              </div>
            </div>

            {layout === 'cards' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {trackedRepos.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => navigate(`/repos/${repo.id}`)}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 13,
                      background: 'var(--panel)',
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="var(--muted2)">
                            <path d="M2 2.5A1.5 1.5 0 013.5 1H12a1 1 0 011 1v10.5a.5.5 0 01-.5.5H4a1 1 0 00-1 1h9.5a.5.5 0 010 1H3.5A1.5 1.5 0 012 13.5V2.5zM4 3v8.05c.16-.03.33-.05.5-.05H12V3H4z" />
                          </svg>
                          <span style={{ fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {repo.fullName}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {repo.description ?? ' '}
                        </div>
                      </div>
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'var(--muted2)', flexShrink: 0 }}
                      >
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path d="M6 3.5H3.5v9h9V10M9.5 3.5H13V7M13 3.5L7.5 9" />
                        </svg>
                      </a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: 'var(--muted)' }}>
                        {repo.language && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: languageColor(repo.language) }} />
                            {repo.language}
                          </span>
                        )}
                        <span style={{ fontFamily: "'Geist Mono', monospace" }}>{repo.commitCount} commits</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--muted2)' }}>{formatRelativeTime(repo.lastSyncedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2.4fr 1fr 1fr 1.1fr 40px',
                    gap: 12,
                    padding: '11px 18px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted2)',
                  }}
                >
                  <span>레포지토리</span>
                  <span>언어</span>
                  <span>커밋</span>
                  <span>마지막 동기화</span>
                  <span />
                </div>
                {trackedRepos.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => navigate(`/repos/${repo.id}`)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2.4fr 1fr 1fr 1.1fr 40px',
                      gap: 12,
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border)',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontSize: 13.5,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.fullName}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {repo.description ?? ' '}
                      </div>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
                      {repo.language && <span style={{ width: 9, height: 9, borderRadius: '50%', background: languageColor(repo.language) }} />}
                      {repo.language}
                    </span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--muted)' }}>{repo.commitCount}</span>
                    <span style={{ color: 'var(--muted2)', fontSize: 12.5 }}>{formatRelativeTime(repo.lastSyncedAt)}</span>
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: 'var(--muted2)' }}
                    >
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M6 3.5H3.5v9h9V10M9.5 3.5H13V7M13 3.5L7.5 9" />
                      </svg>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default DashboardPage
