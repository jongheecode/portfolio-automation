import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import PublishedBadge from '../components/PublishedBadge'
import type { BlogPostSummary } from '../types'

function BlogPage() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<BlogPostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .blogPosts()
      .then(setPosts)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const post = await api.generateBlogPost()
      navigate(`/blog/${post.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>블로그 포스팅</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
            아직 글에 쓰이지 않은 커밋을 모아 초안을 자동으로 작성합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
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
            cursor: generating ? 'default' : 'pointer',
            opacity: generating ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          {generating ? '초안 작성 중...' : '새 초안 생성'}
        </button>
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
            레포를 동기화해서 커밋을 모은 다음 "새 초안 생성"을 눌러보세요.
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => navigate(`/blog/${post.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                padding: '16px 18px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {post.title}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 4 }}>
                  커밋 {post.commitCount}개 · {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                </div>
              </div>
              <PublishedBadge published={post.published} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BlogPage
