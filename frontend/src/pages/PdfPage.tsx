import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { languageColor } from '../utils/languageColor'
import type { PortfolioSnapshot } from '../types'

function PdfPage() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .portfolioSummary()
      .then(setSnapshot)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>불러오는 중...</p>
  if (error) return <p style={{ color: 'var(--muted)' }}>{error}</p>
  if (!snapshot) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>포트폴리오 PDF</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
            추적 중인 레포와 커밋 통계를 한 장으로 정리해 PDF로 내려받습니다.
          </p>
        </div>
        <a
          href={api.portfolioPdfUrl()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13.5,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M8 2v7M8 9l3-3M8 9L5 6" />
            <path d="M2.5 11v2.5h11V11" />
          </svg>
          PDF 다운로드
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        <div style={statCardStyle}>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>추적 레포</span>
          <span style={{ fontSize: 27, fontWeight: 600 }}>{snapshot.totalRepos}</span>
        </div>
        <div style={statCardStyle}>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>총 커밋</span>
          <span style={{ fontSize: 27, fontWeight: 600, fontFamily: "'Geist Mono', monospace" }}>{snapshot.totalCommits}</span>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          PDF에 포함될 레포
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
          {snapshot.repos.map((repo) => (
            <div
              key={repo.fullName}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{repo.fullName}</div>
                {repo.description && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{repo.description}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: 'var(--muted)', flexShrink: 0 }}>
                {repo.language && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: languageColor(repo.language) }} />
                    {repo.language}
                  </span>
                )}
                <span style={{ fontFamily: "'Geist Mono', monospace" }}>{repo.commitCount} commits</span>
              </div>
            </div>
          ))}
          {snapshot.repos.length === 0 && (
            <p style={{ padding: '20px 18px', fontSize: 13.5, color: 'var(--muted)' }}>추적 중인 레포가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  )
}

const statCardStyle = {
  border: '1px solid var(--border)',
  borderRadius: 13,
  background: 'var(--panel)',
  padding: '16px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
} as const

export default PdfPage
