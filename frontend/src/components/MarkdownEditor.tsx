import { marked } from 'marked'
import { useState } from 'react'

function segStyle(active: boolean) {
  return {
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? 'var(--panel)' : 'var(--panel2)',
    color: active ? 'var(--text)' : 'var(--muted)',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
  } as const
}

function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={() => setShowPreview(false)} style={segStyle(!showPreview)}>
          편집
        </button>
        <button type="button" onClick={() => setShowPreview(true)} style={segStyle(showPreview)}>
          미리보기
        </button>
      </div>

      {showPreview ? (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--panel)',
            padding: '20px 24px',
            minHeight: 320,
            lineHeight: 1.7,
          }}
          // 이 앱은 1인 사용자 전용이라 본인이 생성/수정한 마크다운만 렌더링함 (외부 입력 없음)
          dangerouslySetInnerHTML={{ __html: marked.parse(value, { async: false }) }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 18px',
            minHeight: 320,
            background: 'var(--panel)',
            color: 'var(--text)',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 13.5,
            lineHeight: 1.6,
            resize: 'vertical',
          }}
        />
      )}
    </div>
  )
}

export default MarkdownEditor
