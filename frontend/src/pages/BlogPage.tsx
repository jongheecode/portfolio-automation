import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import PublishedBadge from '../components/PublishedBadge'
import type { BlogPostSummary, DraftStatus } from '../types'

const FILTERS: { id: 'all' | DraftStatus; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'draft', label: '초안' },
  { id: 'published', label: '발행됨' },
  { id: 'failed', label: '실패' },
]

function BlogPage() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<BlogPostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | DraftStatus>('all')
  const [retryingId, setRetryingId] = useState<number | null>(null)

  function load(status: 'all' | DraftStatus) {
    setLoading(true)
    const request = status === 'all' ? api.drafts() : api.drafts(status)
    request
      .then(setPosts)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(filter)
  }, [filter])

  async function retry(id: number) {
    setRetryingId(id)
    setError(null)
    try {
      await api.retryPublish(id)
      load(filter)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>블로그 포스팅</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
            주간 초안 아카이브입니다. 새 글은 대시보드에서 이번 주 커밋으로 만듭니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
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
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          이번 주 보드로
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            style={{
              fontSize: 13,
              padding: '5px 10px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: filter === item.id ? 'var(--cell-active)' : 'var(--panel)',
              color: filter === item.id ? 'var(--text)' : 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{error}</p>}
      {loading && <p style={{ color: 'var(--muted)', fontSize: 14 }}>불러오는 중...</p>}

      {!loading && posts.length === 0 && (
        <div
          style={{
            border: '1px dashed var(--border2)',
            borderRadius: 14,
            padding: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            textAlign: 'center',
            background: 'var(--panel)',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600 }}>아직 작성된 포스트가 없어요</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 380, lineHeight: 1.5 }}>
            대시보드에서 레포를 동기화한 뒤 "이번 주 초안 만들기"를 눌러보세요.
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
          {posts.map((post) => (
            <div
              key={post.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                padding: '16px 18px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                onClick={() => navigate(`/blog/${post.id}`)}
                style={{ minWidth: 0, cursor: 'pointer', flex: 1 }}
              >
                <div style={{ fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {post.title}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 4 }}>
                  커밋 {post.commitCount}개 · {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                  {post.publishedUrl && ' · 발행 링크 있음'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {post.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => void retry(post.id)}
                    disabled={retryingId === post.id}
                    style={{
                      fontSize: 12,
                      color: 'var(--act-plan)',
                      background: 'transparent',
                      border: '1px solid var(--act-plan)',
                      borderRadius: 7,
                      padding: '4px 8px',
                      cursor: retryingId === post.id ? 'default' : 'pointer',
                    }}
                  >
                    {retryingId === post.id ? '재시도 중...' : '다시 발행'}
                  </button>
                )}
                {post.publishedUrl && (
                  <a
                    href={post.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 12, color: 'var(--muted)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    보기
                  </a>
                )}
                <PublishedBadge published={post.published} status={post.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BlogPage
