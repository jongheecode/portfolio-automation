import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAppData } from '../contexts/AppDataContext'
import MarkdownEditor from '../components/MarkdownEditor'
import { languageColor } from '../utils/languageColor'
import type { PortfolioDraft, PortfolioSection } from '../types'

const SECTIONS: { key: PortfolioSection; label: string; hint?: string }[] = [
  { key: 'intro', label: '자기소개' },
  { key: 'challenges', label: '어려웠던 점과 해결 과정' },
  { key: 'strengths', label: '강점/약점', hint: 'AI 추측이라 직접 검토가 특히 필요합니다' },
  { key: 'techstack', label: '기술 스택 종합 요약' },
]

function PdfPage() {
  const { trackedRepos, setPortfolioInclusion } = useAppData()
  const [sections, setSections] = useState<Set<PortfolioSection>>(new Set(['intro', 'techstack']))
  const [draft, setDraft] = useState<PortfolioDraft | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .portfolioDraft()
      .then((d) => {
        setDraft(d)
        setContent(d.content)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function toggleSection(key: PortfolioSection) {
    setSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const result = await api.generatePortfolioDraft(Array.from(sections))
      setDraft(result)
      setContent(result.content)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    try {
      const updated = await api.updatePortfolioDraft(content)
      setDraft(updated)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading) return <p>불러오는 중...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>포트폴리오 PDF</h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
          넣을 프로젝트와 항목을 고르면 AI가 초안을 써주고, 수정한 뒤 PDF로 내려받습니다.
        </p>
      </div>

      {error && <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{error}</p>}

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          포함할 항목
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {SECTIONS.map((s) => (
            <label
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                cursor: 'pointer',
                background: sections.has(s.key) ? 'var(--accent-soft)' : 'var(--panel)',
              }}
            >
              <input type="checkbox" checked={sections.has(s.key)} onChange={() => toggleSection(s.key)} />
              {s.label}
              {s.hint && sections.has(s.key) && (
                <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>({s.hint})</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          포함할 프로젝트
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
          {trackedRepos.map((repo) => (
            <label
              key={repo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={repo.includeInPortfolio}
                onChange={(e) => setPortfolioInclusion(repo.id, e.target.checked)}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{repo.fullName}</div>
                {repo.description && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{repo.description}</div>}
              </div>
              {repo.language && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', flexShrink: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: languageColor(repo.language) }} />
                  {repo.language}
                </span>
              )}
            </label>
          ))}
          {trackedRepos.length === 0 && (
            <p style={{ padding: '20px 18px', fontSize: 13.5, color: 'var(--muted)' }}>추적 중인 레포가 없습니다.</p>
          )}
        </div>
      </div>

      <div>
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
          }}
        >
          {generating ? '초안 작성 중...' : draft?.content ? 'AI로 다시 생성' : 'AI로 초안 생성'}
        </button>
      </div>

      {draft?.content && (
        <>
          <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            포트폴리오 편집
          </div>
          <MarkdownEditor value={content} onChange={setContent} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                background: 'var(--panel2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
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
                padding: '9px 16px',
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              PDF 생성
            </a>
          </div>
        </>
      )}
    </div>
  )
}

export default PdfPage
