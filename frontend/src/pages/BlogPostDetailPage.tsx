import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import MarkdownEditor from '../components/MarkdownEditor'
import PublishedBadge from '../components/PublishedBadge'
import { useAppData } from '../contexts/AppDataContext'
import type { BlogPostDetail } from '../types'

function BlogPostDetailPage() {
  const { id } = useParams()
  const postId = Number(id)
  const navigate = useNavigate()

  const [post, setPost] = useState<BlogPostDetail | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { me } = useAppData()
  const [publishingToTistory, setPublishingToTistory] = useState(false)

  useEffect(() => {
    api
      .blogPost(postId)
      .then((detail) => {
        setPost(detail)
        setTitle(detail.title)
        setContent(detail.content)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [postId])

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await api.updateBlogPost(postId, title, content)
      setPost(updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    setSaving(true)
    try {
      await api.updateBlogPost(postId, title, content)
      const updated = await api.publishBlogPost(postId)
      setPost(updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    await api.deleteBlogPost(postId)
    navigate('/blog')
  }

  async function handlePublishToTistory() {
    setPublishingToTistory(true)
    try {
      const updated = await api.publishToTistory(postId)
      setPost(updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPublishingToTistory(false)
    }
  }

  if (loading) return <p>불러오는 중...</p>
  if (!post) return <p>{error ?? '포스트를 찾을 수 없습니다.'}</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={() => navigate('/blog')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <path d="M10 3L5 8l5 5" />
          </svg>
          목록
        </button>
        <PublishedBadge published={post.published} />
      </div>

      {error && <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{error}</p>}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 20,
          fontWeight: 600,
          background: 'var(--panel)',
          color: 'var(--text)',
          fontFamily: 'inherit',
        }}
      />

      <MarkdownEditor value={content} onChange={setContent} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={handleSave} disabled={saving} style={buttonStyle('secondary')}>
          저장
        </button>
        {!post.published && (
          <button type="button" onClick={handlePublish} disabled={saving} style={buttonStyle('primary')}>
            발행
          </button>
        )}
        <button type="button" onClick={handleDelete} style={buttonStyle('danger')}>
          삭제
        </button>
        {post.tistoryUrl ? (
          <a
            href={post.tistoryUrl}
            target="_blank"
            rel="noreferrer"
            style={{ ...buttonStyle('secondary'), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            티스토리에서 보기
          </a>
        ) : (
          me?.tistoryConnected && (
            <button
              type="button"
              onClick={handlePublishToTistory}
              disabled={publishingToTistory}
              style={buttonStyle('primary')}
            >
              {publishingToTistory ? '올리는 중...' : '티스토리에 올리기'}
            </button>
          )
        )}
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          이 글에 쓰인 커밋 ({post.commits.length})
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
          {post.commits.map((c) => (
            <div
              key={c.sha}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13 }}
            >
              <div style={{ minWidth: 0 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--muted)', marginRight: 8 }}>{c.repoName}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
              </div>
              <a href={c.htmlUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
                {c.sha.slice(0, 7)}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function buttonStyle(kind: 'primary' | 'secondary' | 'danger') {
  const base = {
    border: 'none',
    borderRadius: 8,
    padding: '9px 16px',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  }
  if (kind === 'primary') return { ...base, background: 'var(--accent)', color: '#fff' }
  if (kind === 'danger') return { ...base, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' }
  return { ...base, background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)' }
}

export default BlogPostDetailPage
