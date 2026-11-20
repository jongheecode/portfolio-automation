import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { LiveFinding, WeekView } from '../types'

const STATUS_LABEL: Record<string, string> = {
  OPEN: '아직 안 봄',
  DISMISSED: '넘김',
  USED_IN_POST: '글에 넣음',
}
const STATUS_COLOR: Record<string, string> = {
  OPEN: 'var(--muted)',
  DISMISSED: 'var(--muted)',
  USED_IN_POST: 'var(--diff-add)',
}

function WeekReviewPage() {
  const [week, setWeek] = useState<WeekView | null>(null)
  const [live, setLive] = useState<LiveFinding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.week(), api.liveFindings()])
      .then(([weekRes, liveRes]) => {
        setWeek(weekRes)
        setLive(liveRes)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const recurringFriction = week?.recurringFriction ?? []
  const commitsWithFindings = (week?.days ?? []).flatMap((day) =>
    day.commits.filter((commit) => (commit.findings ?? []).length > 0),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>주간 리뷰</h1>

      {error && <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{error}</p>}
      {loading && <p style={{ color: 'var(--muted)', fontSize: 14 }}>불러오는 중...</p>}

      {!loading && !error && (
        <>
          <section style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', boxShadow: 'var(--card-shadow)', padding: '14px 14px 12px' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>지금 만지는 중</div>
            {live.length === 0 && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>지금 걸리는 게 없어요.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {live.map((finding) => (
                <div key={finding.ruleId} style={{ display: 'flex', gap: 8, fontSize: 13.5 }}>
                  <span style={{ fontWeight: 600, color: 'var(--muted)' }}>{finding.category}</span>
                  <span>{finding.message}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', boxShadow: 'var(--card-shadow)', padding: '14px 14px 12px' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>계속 걸리는 것</div>
            {recurringFriction.length === 0 && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>아직 반복되는 게 없어요.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recurringFriction.map((item) => (
                <div key={item.ruleId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span>{item.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{item.count}번</span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>걸린 커밋</div>
            {commitsWithFindings.length === 0 && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>이번 주엔 걸린 게 없어요.</p>
            )}
            {commitsWithFindings.map((commit) => (
              <div
                key={commit.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--panel)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commit.message}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{commit.repoName}</span>
                </div>
                {(commit.findings ?? []).map((finding) => (
                  <div key={finding.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: 'var(--muted)' }}>{finding.category}</span>
                    <span style={{ flex: 1 }}>{finding.message}</span>
                    <span style={{ fontSize: 11.5, color: STATUS_COLOR[finding.status] ?? 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {STATUS_LABEL[finding.status] ?? finding.status}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

export default WeekReviewPage
